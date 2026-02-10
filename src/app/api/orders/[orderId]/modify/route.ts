import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * PATCH /api/orders/{orderId}/modify
 *
 * Modify a mobile order before acceptance.
 * Supports two modes:
 *   1. Simple field edits (customer_phone, pickup_address, delivery_address, items)
 *   2. Full breakdown replacement (breakdown object from POS-style editor)
 *
 * Only works for mobile orders in pending status.
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> }
) {
  const supabase = await createClient();
  const { orderId } = await params;

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

    // === PARSE REQUEST ===
    const body = await request.json();
    const {
      customer_phone,
      pickup_address,
      delivery_address,
      items,
      breakdown: fullBreakdown, // Full POS-style breakdown replacement
      modified_by,
      modified_at,
    } = body;

    console.log("[MODIFY ORDER] Request body:", {
      orderId,
      hasFullBreakdown: !!fullBreakdown,
      customer_phone,
      pickup_address,
      delivery_address,
      itemsCount: items?.length,
      modified_by,
      modified_at,
    });

    // === FETCH CURRENT ORDER ===
    const { data: order, error: fetchError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", orderId)
      .single();

    if (fetchError || !order) {
      console.error("[MODIFY ORDER] Order not found:", fetchError);
      return NextResponse.json(
        { success: false, error: "Order not found" },
        { status: 404 }
      );
    }

    // === VALIDATE ORDER TYPE AND STATUS ===
    if (order.source !== "mobile") {
      return NextResponse.json(
        { success: false, error: "Only mobile orders can be modified" },
        { status: 400 }
      );
    }

    if (order.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Only pending orders can be modified" },
        { status: 400 }
      );
    }

    // === PREPARE UPDATE DATA ===
    const updateData: any = {};

    // =====================================================
    // MODE 1: Full breakdown replacement (from order editor)
    // =====================================================
    if (fullBreakdown) {
      console.log("[MODIFY ORDER] Full breakdown replacement mode");
      console.log("[MODIFY ORDER] Baskets:", fullBreakdown.baskets?.length);
      console.log("[MODIFY ORDER] Items:", fullBreakdown.items?.length);
      console.log("[MODIFY ORDER] Summary total:", fullBreakdown.summary?.total);

      // Enrich services with pricing snapshots (same logic as POS create)
      const { data: allServices } = await supabase
        .from("services")
        .select("service_type, tier, name, base_price");

      const pricingMap: Record<string, any> = {};
      if (allServices) {
        for (const service of allServices) {
          const key = `${service.service_type}:${service.tier || "null"}`;
          pricingMap[key] = {
            base_price: service.base_price,
            service_type: service.service_type,
            name: service.name,
            tier: service.tier,
          };
        }
      }

      // Enrich each basket with pricing snapshots
      const enrichedBaskets = (fullBreakdown.baskets || []).map((basket: any) => {
        const services = basket.services || {};
        const enrichedServices = { ...services };

        if (services.wash && services.wash !== "off") {
          enrichedServices.wash_pricing = pricingMap[`wash:${services.wash}`] || {};
        }
        if (services.dry && services.dry !== "off") {
          enrichedServices.dry_pricing = pricingMap[`dry:${services.dry}`] || {};
        }
        if (services.spin) {
          enrichedServices.spin_pricing = pricingMap["spin:null"] || {};
        }
        if (services.iron_weight_kg && services.iron_weight_kg > 0) {
          enrichedServices.iron_pricing = pricingMap["iron:null"] || {};
        }
        if (services.additional_dry_time_minutes && services.additional_dry_time_minutes > 0) {
          enrichedServices.additional_dry_time_pricing = {
            service_type: "additional_dry_time",
            price_per_increment: 15,
            minutes_per_increment: 8,
            total_minutes: services.additional_dry_time_minutes,
            total_price: (services.additional_dry_time_minutes / 8) * 15,
          };
        }

        return {
          ...basket,
          services: enrichedServices,
        };
      });

      const enrichedBreakdown = {
        ...fullBreakdown,
        baskets: enrichedBaskets,
      };

      updateData.breakdown = enrichedBreakdown;
      updateData.total_amount = fullBreakdown.summary?.total || order.total_amount;

      // Also update basket_service_status rows to match the new baskets/services
      // First delete existing status rows for this order
      const { error: deleteStatusError } = await supabase
        .from("basket_service_status")
        .delete()
        .eq("order_id", orderId);

      if (deleteStatusError) {
        console.warn("[MODIFY ORDER] Failed to clear old service statuses:", deleteStatusError.message);
      }

      // Insert new status rows for each basket/service
      const newStatusRows: any[] = [];
      for (const basket of enrichedBaskets) {
        const services = basket.services || {};
        const serviceTypes: string[] = [];

        if (services.wash && services.wash !== "off") serviceTypes.push("wash");
        if (services.dry && services.dry !== "off") serviceTypes.push("dry");
        if (services.spin === true) serviceTypes.push("spin");
        if (services.iron_weight_kg && services.iron_weight_kg > 0) serviceTypes.push("iron");
        if (services.fold === true || (services.fold && services.fold !== "off")) serviceTypes.push("fold");

        for (const serviceType of serviceTypes) {
          newStatusRows.push({
            order_id: orderId,
            basket_number: basket.basket_number,
            service_type: serviceType,
            status: "pending",
          });
        }
      }

      if (newStatusRows.length > 0) {
        const { error: insertStatusError } = await supabase
          .from("basket_service_status")
          .insert(newStatusRows);

        if (insertStatusError) {
          console.warn("[MODIFY ORDER] Failed to insert new service statuses:", insertStatusError.message);
        } else {
          console.log("[MODIFY ORDER] Inserted", newStatusRows.length, "service status rows");
        }
      }
    }
    // =====================================================
    // MODE 2: Simple field edits (legacy)
    // =====================================================
    else {
      // Update customer phone if provided
      if (customer_phone !== undefined) {
        if (order.customer_id) {
          const { error: customerUpdateError } = await supabase
            .from("customers")
            .update({ phone_number: customer_phone })
            .eq("id", order.customer_id);

          if (customerUpdateError) {
            console.error(
              "[MODIFY ORDER] Failed to update customer phone:",
              customerUpdateError
            );
          }
        }
      }

      // Update handling info (pickup/delivery addresses)
      if (pickup_address !== undefined || delivery_address !== undefined) {
        const currentHandling =
          typeof order.handling === "string"
            ? JSON.parse(order.handling)
            : order.handling || {};

        if (pickup_address !== undefined) {
          currentHandling.pickup = currentHandling.pickup || {};
          currentHandling.pickup.address = pickup_address;
        }

        if (delivery_address !== undefined) {
          currentHandling.delivery = currentHandling.delivery || {};
          currentHandling.delivery.address = delivery_address;
        }

        updateData.handling = currentHandling;
      }

      // Update items if provided
      if (items && items.length > 0) {
        const currentBreakdown =
          typeof order.breakdown === "string"
            ? JSON.parse(order.breakdown)
            : order.breakdown || {};

        currentBreakdown.items = items;

        // Recalculate totals
        let newTotal = 0;
        items.forEach((item: any) => {
          const subtotal = (item.unit_price || 0) * (item.quantity || 0);
          newTotal += subtotal;
        });

        updateData.breakdown = currentBreakdown;
        updateData.total_amount = newTotal;
      }
    }

    console.log("[MODIFY ORDER] Update data prepared, total_amount:", updateData.total_amount);

    // === UPDATE ORDER ===
    const { data: updatedOrder, error: updateError } = await supabase
      .from("orders")
      .update(updateData)
      .eq("id", orderId)
      .select()
      .single();

    if (updateError) {
      console.error("[MODIFY ORDER] Update failed:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update order: " + updateError.message },
        { status: 500 }
      );
    }

    console.log("[MODIFY ORDER] Order updated successfully:", updatedOrder.id);

    // === RETURN SUCCESS ===
    return NextResponse.json({
      success: true,
      message: "Order modified successfully",
      order: updatedOrder,
    });
  } catch (error: any) {
    console.error("[MODIFY ORDER] Server error:", error);
    return NextResponse.json(
      { success: false, error: "Server error: " + error.message },
      { status: 500 }
    );
  }
}
