import { NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  try {
    const { basketId, orderId } = await req.json();

    if (!basketId || !orderId) {
      return NextResponse.json(
        { error: "basketId and orderId are required" },
        { status: 400 }
      );
    }

    // Fetch basket and order details
    const { data: basketData, error: basketError } = await supabase
      .from("baskets")
      .select(
        `
        id,
        basket_number,
        orders!inner (
          id,
          customer_id,
          status,
          pickup_address,
          delivery_address,
          customers!inner (
            id,
            first_name,
            last_name,
            phone_number,
            email_address
          )
        )
      `
      )
      .eq("id", basketId)
      .single();

    if (basketError || !basketData) {
      throw new Error("Basket not found");
    }

    const basket = basketData as any;
    const order = basket.orders;
    const customer = order?.customers;

    if (!customer) {
      throw new Error("Customer information not found");
    }

    // Determine notification type based on order status
    let notificationType = "update";
    let message = `Your order is being processed.`;

    if (order.status === "pick-up") {
      notificationType = "pickup";
      message = `Your order (Basket ${basket.basket_number}) is ready for pickup at the store!`;
    } else if (order.status === "delivering") {
      notificationType = "delivery";
      message = `Your order (Basket ${basket.basket_number}) is on its way to you for delivery!`;
    }

    // Log notification details for processing
    console.log("Notification ready to send:", {
      customerId: customer.id,
      customerName: `${customer.first_name} ${customer.last_name}`,
      phone: customer.phone_number,
      email: customer.email_address,
      message,
      notificationType,
      basketId,
      orderId,
    });

    // TODO: Implement actual notification service (SMS/Email/Push)
    // For now, this serves as a logging mechanism for staff to manually notify customers

    return NextResponse.json({
      success: true,
      message: "Customer notification sent",
      details: {
        customerId: customer.id,
        customerName: `${customer.first_name} ${customer.last_name}`,
        notificationType,
        basketNumber: basket.basket_number,
      },
    });
  } catch (error: any) {
    console.error("Error notifying customer:", error);
    return NextResponse.json(
      { error: error.message || "Failed to notify customer" },
      { status: 500 }
    );
  }
}
