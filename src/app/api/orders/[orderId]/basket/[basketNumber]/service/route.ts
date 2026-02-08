/**
 * PATCH /api/orders/{orderId}/basket/{basketNumber}/service
 * 
 * Update basket service status (start, complete, skip)
 * - Creates basket_service_status records if they don't exist
 * - Updates existing status records
 * - Tracks who started/completed and when
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";
import { sendPushNotification } from "@/src/app/utils/send-notification";

interface UpdateServiceStatusRequest {
  service_type: string; // 'wash', 'dry', 'spin', 'iron', 'fold'
  action: "start" | "complete" | "skip";
  notes?: string;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string; basketNumber: string }> }
) {
  const supabase = await createClient();
  const { orderId, basketNumber: basketNumberStr } = await params;
  const basketNumber = parseInt(basketNumberStr);

  try {
    // === AUTHENTICATE ===
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { success: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Get staff record
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json(
        { success: false, error: "Staff record not found" },
        { status: 401 }
      );
    }

    const staffId = staffData.id;

    // === PARSE REQUEST ===
    const body: UpdateServiceStatusRequest = await request.json();
    const { service_type, action, notes } = body;

    if (!service_type || !action) {
      return NextResponse.json(
        { success: false, error: "service_type and action required" },
        { status: 400 }
      );
    }

    if (!["wash", "dry", "spin", "iron", "fold"].includes(service_type)) {
      return NextResponse.json(
        { success: false, error: "Invalid service_type" },
        { status: 400 }
      );
    }

    if (!["start", "complete", "skip"].includes(action)) {
      return NextResponse.json(
        { success: false, error: "Invalid action" },
        { status: 400 }
      );
    }

    // === FETCH ORDER DATA ===
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("handling, customer_id")
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // === AUTO-SKIP PICKUP IF IN-STORE OR STORE (POS) ===
    // If pickup address is "In-store" or "store" (POS), auto-mark pickup as skipped on first service action
    const pickupAddr = order.handling?.pickup?.address?.toLowerCase() || "";
    const isStorePickup = pickupAddr === "in-store" || pickupAddr === "store";
    if (isStorePickup && order.handling?.pickup?.status === "pending") {
      console.log(`[Store Pickup] Order ${orderId} - Auto-skipping pickup phase`);
      
      // Update the order's handling to mark pickup as skipped
      const updatedHandling = {
        ...order.handling,
        pickup: {
          ...order.handling.pickup,
          status: "skipped",
          completed_at: new Date().toISOString(),
        },
      };

      const { error: handlingError } = await supabase
        .from("orders")
        .update({ handling: updatedHandling })
        .eq("id", orderId);

      if (handlingError) {
        console.warn("[Store Pickup] Failed to auto-skip pickup:", handlingError);
        // Don't fail - continue with service update
      } else {
        console.log(`[Store Pickup] Order ${orderId} pickup marked as skipped`);
      }
    }

    // === UPSERT SERVICE STATUS ===
    const statusMap = {
      start: "in_progress",
      complete: "completed",
      skip: "skipped",
    };

    const newStatus = statusMap[action as keyof typeof statusMap];
    const now = new Date().toISOString();

    // First, try to get existing record
    const { data: existingRecord } = await supabase
      .from("basket_service_status")
      .select("id, status")
      .eq("order_id", orderId)
      .eq("basket_number", basketNumber)
      .eq("service_type", service_type)
      .single();

    if (existingRecord) {
      // Update existing record
      const updateData: any = {
        status: newStatus,
        updated_at: now,
        notes: notes || null,
      };

      if (action === "start") {
        updateData.started_at = now;
        updateData.started_by = staffId;
      } else if (action === "complete") {
        updateData.completed_at = now;
        updateData.completed_by = staffId;
      }

      const { error: updateError } = await supabase
        .from("basket_service_status")
        .update(updateData)
        .eq("id", existingRecord.id);

      if (updateError) {
        console.error("Update error:", updateError);
        return NextResponse.json(
          { success: false, error: "Failed to update service status" },
          { status: 500 }
        );
      }
    } else {
      // Create new record
      const insertData: any = {
        order_id: orderId,
        basket_number: basketNumber,
        service_type: service_type,
        status: newStatus,
        notes: notes || null,
      };

      if (action === "start") {
        insertData.started_at = now;
        insertData.started_by = staffId;
      } else if (action === "complete") {
        insertData.completed_at = now;
        insertData.completed_by = staffId;
      }

      const { error: insertError } = await supabase
        .from("basket_service_status")
        .insert(insertData);

      if (insertError) {
        console.error("Insert error:", insertError);
        return NextResponse.json(
          { success: false, error: "Failed to create service status" },
          { status: 500 }
        );
      }
    }

    // === SUCCESS ===
    console.log(
      `[Basket Service Status] Order: ${orderId}, Basket: ${basketNumber}, Service: ${service_type}, Action: ${action}`
    );

    // === SEND PUSH NOTIFICATION ===
    if (order.customer_id) {
      const actionLabel = action === "start" 
        ? `${service_type.charAt(0).toUpperCase() + service_type.slice(1)} started`
        : action === "complete"
          ? `${service_type.charAt(0).toUpperCase() + service_type.slice(1)} completed`
          : `${service_type.charAt(0).toUpperCase() + service_type.slice(1)} skipped`;
      
      await sendPushNotification(
        order.customer_id,
        `Basket #${basketNumber} Update`,
        actionLabel
      );
    } else {
      console.warn(`[Notification] No customer_id found for order ${orderId}`);
    }

    // === UPDATE ORDER STATUS IF NEEDED ===
    // Check if all services in all baskets are complete
    // First, fetch the order with breakdown to see what services are expected
    const { data: fullOrder } = await supabase
      .from("orders")
      .select("breakdown")
      .eq("id", orderId)
      .single();

    if (!fullOrder || !fullOrder.breakdown?.baskets) {
      console.warn("Could not fetch order breakdown for status check");
    } else {
      // Get all service status records for this order
      const { data: allServiceStatuses } = await supabase
        .from("basket_service_status")
        .select("basket_number, service_type, status")
        .eq("order_id", orderId);

      // Check if all expected services are complete or skipped
      let allServicesComplete = true;
      
      console.log(
        `[Service Check] Order ${orderId} - Processing ${fullOrder.breakdown.baskets?.length || 0} baskets`
      );
      console.log(
        `[Service Check] Order ${orderId} - Available status records:`,
        JSON.stringify(allServiceStatuses || [])
      );
      
      for (const basket of fullOrder.breakdown.baskets) {
        const services = basket.services || {};
        
        console.log(
          `[Service Check] Order ${orderId} - Basket ${basket.basket_number} full services object:`,
          JSON.stringify(services)
        );
        
        // Main service types: wash, dry, spin, iron, fold
        // They're complete if they exist and have a status record that's completed/skipped
        const mainServices = ["wash", "dry", "spin", "iron", "fold"];
        
        for (const serviceType of mainServices) {
          let serviceValue = services[serviceType];
          
          // Handle special case: iron is stored as iron_weight_kg
          if (serviceType === "iron") {
            serviceValue = services.iron_weight_kg;
          }
          
          // Service is expected if it's not "off" and not null/false/0
          const isExpected = 
            serviceValue !== "off" && 
            serviceValue !== false && 
            serviceValue !== null && 
            serviceValue !== 0 && 
            serviceValue !== "";

          if (isExpected) {
            // Check if there's a completed/skipped record for this service
            const statusRecord = allServiceStatuses?.find(
              (s: any) =>
                s.basket_number === basket.basket_number &&
                s.service_type === serviceType
            );

            if (
              !statusRecord ||
              (statusRecord.status !== "completed" &&
                statusRecord.status !== "skipped")
            ) {
              allServicesComplete = false;
              console.log(
                `[Service Check] Order ${orderId} - Basket ${basket.basket_number} service ${serviceType} NOT COMPLETE. Value: ${serviceValue}, Expected: ${isExpected}, Has Record: ${!!statusRecord}, Status: ${statusRecord?.status || "N/A"}`
              );
              break;
            } else {
              console.log(
                `[Service Check] Order ${orderId} - Basket ${basket.basket_number} service ${serviceType} OK. Status: ${statusRecord.status}`
              );
            }
          } else {
            console.log(
              `[Service Check] Order ${orderId} - Basket ${basket.basket_number} service ${serviceType} not expected. Value: ${serviceValue}`
            );
          }
        }

        if (!allServicesComplete) break;
      }
      
      console.log(
        `[Service Check] Order ${orderId} - Final result: allServicesComplete=${allServicesComplete}`
      );

      if (allServicesComplete) {
        // Check if both pickup and delivery are skipped (store addresses)
        const pickupAddr = order.handling?.pickup?.address?.toLowerCase() || "";
        const deliveryAddr = order.handling?.delivery?.address?.toLowerCase() || "";
        const isInStoreOnly = 
          (pickupAddr === "store" || pickupAddr === "in-store") &&
          (deliveryAddr === "store" || deliveryAddr === "in-store");

        if (isInStoreOnly) {
          // For in-store only orders, go directly to "completed" when all services are done
          const { error: statusError } = await supabase
            .from("orders")
            .update({ status: "completed" })
            .eq("id", orderId)
            .eq("status", "processing");

          if (statusError) {
            console.warn("[Order Status Update] Warning:", statusError);
          } else {
            console.log(
              `[Order Status Update] Order ${orderId} updated to completed (in-store only)`
            );
          }
        } else {
          // For orders with delivery, go to "for_pick-up" when all services are done
          const { error: statusError } = await supabase
            .from("orders")
            .update({ status: "for_pick-up" })
            .eq("id", orderId)
            .eq("status", "processing"); // Only update if currently processing

          if (statusError) {
            console.warn("[Order Status Update] Warning:", statusError);
            // Don't fail the request, just warn
          } else {
            console.log(
              `[Order Status Update] Order ${orderId} updated to for_pick-up`
            );
          }
        }
      } else if (newStatus === "in_progress") {
        // Update order status to "processing" when first service starts
        const { data: currentOrder } = await supabase
          .from("orders")
          .select("status")
          .eq("id", orderId)
          .single();

        if (currentOrder && currentOrder.status === "pending") {
          const { error: statusError } = await supabase
            .from("orders")
            .update({ status: "processing" })
            .eq("id", orderId);

          if (statusError) {
            console.warn("[Order Status Update] Warning:", statusError);
          } else {
            console.log(
              `[Order Status Update] Order ${orderId} updated to processing`
            );
          }
        }
      }
    }

    return NextResponse.json(
      {
        success: true,
        message: `Service ${service_type} marked as ${newStatus}`,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Basket service status error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
