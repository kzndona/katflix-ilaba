/**
 * GET /api/orders/withServiceStatus
 * 
 * Fetch active orders with breakdown data and service status tracking
 * Joins order data with basket_service_status for complete workflow visibility
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();

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

    // === FETCH ORDERS ===
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select(
        `
        id,
        source,
        customer_id,
        cashier_id,
        status,
        total_amount,
        breakdown,
        handling,
        gcash_receipt_url,
        created_at,
        customers:customer_id(
          id,
          first_name,
          last_name,
          phone_number,
          email_address
        ),
        staff:cashier_id(
          id,
          first_name,
          last_name
        )
      `
      )
      .in("status", ["pending", "processing", "for_delivery"])
      .order("created_at", { ascending: false });

    if (orderError) {
      console.error("Order fetch error:", orderError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch orders" },
        { status: 500 }
      );
    }

    // === FETCH SERVICE STATUSES ===
    const { data: serviceStatuses, error: serviceError } = await supabase
      .from("basket_service_status")
      .select("*");

    if (serviceError) {
      console.error("Service status fetch error:", serviceError);
      return NextResponse.json(
        { success: false, error: "Failed to fetch service statuses" },
        { status: 500 }
      );
    }

    // === BUILD RESPONSE ===
    // Create a map of order/basket/service -> status
    const statusMap: Record<string, Record<number, Record<string, any>>> = {};
    (serviceStatuses || []).forEach((status: any) => {
      if (!statusMap[status.order_id]) {
        statusMap[status.order_id] = {};
      }
      if (!statusMap[status.order_id][status.basket_number]) {
        statusMap[status.order_id][status.basket_number] = {};
      }
      statusMap[status.order_id][status.basket_number][status.service_type] =
        status;
    });

    // Transform orders to include service statuses
    const transformedOrders = (orders || []).map((order: any) => {
      const breakdown = order.breakdown || {};
      const baskets = breakdown.baskets || [];
      
      // Ensure handling has proper default structure
      const handling = order.handling || {};
      const safeHandling = {
        service_type: handling.service_type,
        handling_type: handling.handling_type,
        pickup_address: handling.pickup_address,
        delivery_address: handling.delivery_address,
        pickup: handling.pickup || {
          address: handling.pickup_address || "",
          status: "pending" as const,
        },
        delivery: handling.delivery || {
          address: handling.delivery_address || "",
          status: "pending" as const,
        },
      };

      return {
        id: order.id,
        source: order.source || "pos",
        customer_id: order.customer_id,
        cashier_id: order.cashier_id,
        status: order.status,
        total_amount: order.total_amount,
        created_at: order.created_at,
        gcash_receipt_url: order.gcash_receipt_url,
        customers: order.customers,
        staff: order.staff,
        handling: safeHandling,
        breakdown: {
          items: breakdown.items || [],
          baskets: baskets.map((basket: any) => {
            const serviceTypesList = [
              "wash",
              "dry",
              "spin",
              "iron",
              "fold",
            ].filter((svc) => {
              const services = basket.services || {};
              // Check if service is mentioned in the services object
              if (svc === "wash")
                return services.wash && services.wash !== "off";
              if (svc === "dry")
                return services.dry && services.dry !== "off";
              if (svc === "spin") return services.spin === true;
              if (svc === "iron")
                return services.iron_weight_kg && services.iron_weight_kg > 0;
              if (svc === "fold") return services.fold && services.fold !== "off";
              return false;
            });

            // Fetch service statuses for this basket
            const basketServiceStatuses = serviceTypesList.map(
              (serviceType) => {
                const storedStatus =
                  statusMap[order.id]?.[basket.basket_number]?.[serviceType] ||
                  {
                    status: "pending",
                    service_type: serviceType,
                  };

                return {
                  service_type: serviceType,
                  status: storedStatus.status || "pending",
                  started_at: storedStatus.started_at,
                  completed_at: storedStatus.completed_at,
                  started_by: storedStatus.started_by,
                  completed_by: storedStatus.completed_by,
                  notes: storedStatus.notes,
                };
              }
            );

            return {
              basket_number: basket.basket_number,
              weight: basket.weight_kg || 0,
              basket_notes: basket.basket_notes || null,
              total: basket.total || 0,
              services: basketServiceStatuses,
              services_data: basket.services, // Keep pricing snapshots for reference
            };
          }),
          summary: breakdown.summary,
        },
      };
    });

    console.log(`[Orders with Service Status] Fetched ${transformedOrders.length} active orders`);

    return NextResponse.json(
      {
        success: true,
        data: transformedOrders,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Get orders with service status error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
