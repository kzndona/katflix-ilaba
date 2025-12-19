import { NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();

  try {
    const { basketId, handlingType, action, staffId } = await req.json();

    if (!staffId) {
      return NextResponse.json(
        { error: "staffId (authenticated user) is required" },
        { status: 400 }
      );
    }

    if (!basketId && !handlingType) {
      return NextResponse.json(
        { error: "Either basketId or handlingType is required" },
        { status: 400 }
      );
    }

    if (!action || !["start", "complete", "skip"].includes(action)) {
      return NextResponse.json(
        { error: "action must be 'start', 'complete', or 'skip'" },
        { status: 400 }
      );
    }

    // Get the order
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    if (orderError || !order) {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }

    const breakdown = order.breakdown as any;
    const handling = order.handling as any;
    const now = new Date().toISOString();

    // ==================== HANDLING SERVICE UPDATE ====================
    if (handlingType) {
      const stage = handlingType as "pickup" | "delivery";

      // Handle null address (in-store) - auto-skip
      if (!handling[stage].address && action === "start") {
        handling[stage].status = "skipped";
        // Still update order status
        if (stage === "pickup") {
          order.status = "processing";
        }
        if (stage === "delivery") {
          // Delivery can't be auto-skipped if not started yet
          return NextResponse.json(
            { error: "Delivery requires an address to proceed" },
            { status: 400 }
          );
        }

        // Add audit log entry
        if (!breakdown.audit_log) {
          breakdown.audit_log = [];
        }
        breakdown.audit_log.push({
          action: `handling_skipped`,
          timestamp: now,
          changed_by: staffId,
          handling_stage: stage,
          details: { reason: "no_address", new_status: "skipped" },
        });
      } else {
        // Normal handling flow
        // Validate: Pickup must complete before services start
        if (action === "start" && stage === "pickup") {
          // Check if any basket service is already in_progress or completed
          const basketsWithServices = breakdown.baskets || [];
          const anyServiceStarted = basketsWithServices.some((b: any) =>
            (b.services || []).some((s: any) => s.status !== "pending")
          );

          if (anyServiceStarted) {
            return NextResponse.json(
              { error: "Cannot start pickup after basket services have started" },
              { status: 400 }
            );
          }
        }

        // Validate: Cannot start delivery unless all baskets are completed
        if (action === "start" && stage === "delivery") {
          const basketsWithServices = breakdown.baskets || [];
          const allCompleted = basketsWithServices.every((b: any) =>
            (b.services || []).every((s: any) => s.status === "completed" || s.status === "skipped")
          );

          if (!allCompleted) {
            return NextResponse.json(
              { error: "All baskets must complete their services before starting delivery" },
              { status: 400 }
            );
          }
        }

        // Update handling stage
        if (!handling[stage]) {
          return NextResponse.json(
            { error: `Handling stage '${stage}' not found in order` },
            { status: 400 }
          );
        }

        const stageData = handling[stage];

        if (action === "start") {
          stageData.status = "in_progress";
          stageData.started_at = now;
          stageData.started_by = staffId;
        } else if (action === "complete") {
          stageData.status = "completed";
          stageData.completed_at = now;
          stageData.completed_by = staffId;
        } else if (action === "skip") {
          stageData.status = "skipped";
        }

        // Update order status based on handling progress
        if (stage === "pickup") {
          if (stageData.status === "completed" || stageData.status === "skipped") {
            order.status = "processing";
          } else if (stageData.status === "in_progress") {
            order.status = "for_pick-up";
          }
        }

        if (stage === "delivery") {
          if (stageData.status === "in_progress") {
            order.status = "for_delivery";
          } else if (stageData.status === "completed") {
            order.status = "completed";
            order.completed_at = now;
          }
        }

        // Add audit log entry
        if (!breakdown.audit_log) {
          breakdown.audit_log = [];
        }

        breakdown.audit_log.push({
          action: `handling_${action}ed`,
          timestamp: now,
          changed_by: staffId,
          handling_stage: stage,
          details: { previous_status: handling[stage].status, new_status: stageData.status },
        });

        handling[stage] = stageData;
      }
    }

    // ==================== BASKET SERVICE UPDATE ====================
    if (basketId) {
      // Validate: Pickup must be completed before services start
      if (action === "start" || action === "complete") {
        if (handling.pickup.status !== "completed" && handling.pickup.status !== "skipped") {
          return NextResponse.json(
            { error: "Pickup must be completed before starting basket services" },
            { status: 400 }
          );
        }
      }

      // Find basket
      const basket = breakdown.baskets?.find((b: any) => b.basket_number === basketId || b.id === basketId);

      if (!basket) {
        return NextResponse.json(
          { error: "Basket not found in order" },
          { status: 404 }
        );
      }

      // Validate service sequence
      const services = basket.services || [];
      const serviceSequence = ["wash", "spin", "dry", "iron", "fold"];

      // Helper: Extract service type by substring matching
      const getServiceType = (serviceName: string): string | null => {
        const normalized = (serviceName || "").toLowerCase().trim();
        for (const serviceType of serviceSequence) {
          if (normalized.includes(serviceType)) {
            return serviceType;
          }
        }
        return null;
      };

      if (action === "start" || action === "complete") {
        let targetService;
        
        if (action === "complete") {
          // When completing, find the service that is CURRENTLY IN_PROGRESS
          targetService = services.find((s: any) => s.status === "in_progress");
          if (!targetService) {
            return NextResponse.json(
              { error: "No in_progress service to complete" },
              { status: 400 }
            );
          }
        } else {
          // When starting, find the first PENDING service
          targetService = services.find((s: any) => s.status === "pending");
          if (!targetService) {
            return NextResponse.json(
              { error: "No pending services in this basket" },
              { status: 400 }
            );
          }
        }

        const serviceName = getServiceType(targetService.service_name);
        const currentIndex = serviceName ? serviceSequence.indexOf(serviceName) : -1;

        if (currentIndex === -1) {
          return NextResponse.json(
            { 
              error: `Invalid service type: "${targetService.service_name}" does not contain any of [${serviceSequence.join(", ")}]`
            },
            { status: 400 }
          );
        }

        // Update target service
        if (action === "start") {
          targetService.status = "in_progress";
          targetService.started_at = now;
          targetService.started_by = staffId;
        } else if (action === "complete") {
          targetService.status = "completed";
          targetService.completed_at = now;
          targetService.completed_by = staffId;

          // Auto-start next pending service in sequence order
          // Find the first service type in the sequence that comes after current and is pending
          for (const nextServiceType of serviceSequence) {
            const nextTypeIndex = serviceSequence.indexOf(nextServiceType);
            if (nextTypeIndex <= currentIndex) continue; // Skip already-done types
            
            const nextServiceInBasket = services.find((s: any) => {
              const sType = getServiceType(s.service_name);
              return sType === nextServiceType && s.status === "pending";
            });
            
            if (nextServiceInBasket) {
              nextServiceInBasket.status = "in_progress";
              nextServiceInBasket.started_at = now;
              nextServiceInBasket.started_by = staffId;
              break; // Only start the immediate next one
            }
          }
        }
      } else if (action === "skip") {
        const targetService = services.find((s: any) => s.status === "pending");
        if (targetService) {
          targetService.status = "skipped";
        }
      }

      // Check if all basket services are done
      const allServicesDone = services.every(
        (s: any) => s.status === "completed" || s.status === "skipped"
      );

      if (allServicesDone) {
        basket.status = "completed";
        basket.completed_at = now;
      } else {
        const inProgressService = services.find((s: any) => s.status === "in_progress");
        basket.status = inProgressService ? "processing" : "pending";
      }

      // Add audit log entry
      if (!breakdown.audit_log) {
        breakdown.audit_log = [];
      }

      const targetService = services.find((s: any) => s.status === "in_progress" || s.status === "completed" || s.status === "skipped");

      breakdown.audit_log.push({
        action: `service_${action}ed`,
        timestamp: now,
        changed_by: staffId,
        basket_number: basket.basket_number,
        service_name: targetService?.service_name,
        details: { action, service_status: targetService?.status },
      });

      // Check if all baskets in order are now completed
      const allBasketsCompleted = breakdown.baskets.every((b: any) =>
        b.services.every((s: any) => s.status === "completed" || s.status === "skipped")
      );

      if (allBasketsCompleted) {
        // All services done - check delivery
        if (handling.delivery.address) {
          // Has delivery address - set to for_delivery
          order.status = "for_delivery";
        } else {
          // No delivery needed - mark completed
          order.status = "completed";
          order.completed_at = now;
        }
      }
    }

    // Update order in database
    const { error: updateError } = await supabase
      .from("orders")
      .update({
        breakdown,
        handling,
        status: order.status,
        completed_at: order.completed_at,
      })
      .eq("id", id);

    if (updateError) {
      throw updateError;
    }

    // Return updated order
    const { data: updatedOrder } = await supabase
      .from("orders")
      .select("*")
      .eq("id", id)
      .single();

    return NextResponse.json(updatedOrder);
  } catch (error: any) {
    console.error("Error updating service status:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update service status" },
      { status: 500 }
    );
  }
}
