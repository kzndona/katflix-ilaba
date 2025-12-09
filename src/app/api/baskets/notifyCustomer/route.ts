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

    // Send SMS notification if phone number exists
    let smsSuccess = false;
    if (customer.phone_number) {
      try {
        // TODO: Replace with your actual SMS service (Twilio, Semaphore, etc.)
        // Example for Semaphore SMS (Philippines):
        // const smsResponse = await fetch('https://api.semaphore.co/api/v4/messages', {
        //   method: 'POST',
        //   headers: { 'Content-Type': 'application/json' },
        //   body: JSON.stringify({
        //     apikey: process.env.SEMAPHORE_API_KEY,
        //     number: customer.phone_number,
        //     message: message,
        //     sendername: 'iLaba'
        //   })
        // });
        // smsSuccess = smsResponse.ok;
        
        console.log("SMS would be sent to:", customer.phone_number);
        console.log("Message:", message);
      } catch (smsError) {
        console.error("SMS error:", smsError);
      }
    }

    // Send Email notification if email exists
    let emailSuccess = false;
    if (customer.email_address) {
      try {
        // TODO: Replace with your actual email service (SendGrid, Resend, etc.)
        // Example for Resend:
        // const { Resend } = require('resend');
        // const resend = new Resend(process.env.RESEND_API_KEY);
        // await resend.emails.send({
        //   from: 'iLaba <notifications@yourdomain.com>',
        //   to: customer.email_address,
        //   subject: `Order Update - Basket ${basket.basket_number}`,
        //   html: `<p>${message}</p>`
        // });
        // emailSuccess = true;
        
        console.log("Email would be sent to:", customer.email_address);
        console.log("Subject:", `Order Update - Basket ${basket.basket_number}`);
      } catch (emailError) {
        console.error("Email error:", emailError);
      }
    }

    // Log notification details
    console.log("Notification processed:", {
      customerId: customer.id,
      customerName: `${customer.first_name} ${customer.last_name}`,
      phone: customer.phone_number,
      email: customer.email_address,
      message,
      notificationType,
      basketId,
      orderId,
      smsSuccess,
      emailSuccess,
    });

    return NextResponse.json({
      success: true,
      message: "Customer notification processed",
      details: {
        customerId: customer.id,
        customerName: `${customer.first_name} ${customer.last_name}`,
        notificationType,
        basketNumber: basket.basket_number,
        phone: customer.phone_number,
        email: customer.email_address,
        smsReady: !!customer.phone_number,
        emailReady: !!customer.email_address,
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
