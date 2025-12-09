import { NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

export async function POST(req: Request) {
  const supabase = await createClient();

  try {
    const { customerId, basketId, basketNumber, oldStatus, newStatus, orderId } = await req.json();

    // Validate required fields
    if (!customerId || !basketId || !basketNumber || !newStatus) {
      return NextResponse.json(
        { error: "customerId, basketId, basketNumber, and newStatus are required" },
        { status: 400 }
      );
    }

    // Broadcast to Realtime channel
    const channelName = `customer_notifications:${customerId}`;
    const payload = {
      type: "basket_status_change",
      basketId,
      basketNumber,
      orderId: orderId || null,
      oldStatus: oldStatus || null,
      newStatus,
      timestamp: new Date().toISOString(),
    };

    // Send broadcast using Supabase Realtime
    const channel = supabase.channel(channelName);
    await channel.subscribe();
    await channel.send({
      type: "broadcast",
      event: "notification",
      payload,
    });
    await channel.unsubscribe();

    console.log("Notification broadcast sent:", {
      channel: channelName,
      payload,
    });

    return NextResponse.json({
      success: true,
      message: "Customer notification sent",
      details: {
        customerId,
        basketId,
        basketNumber,
        oldStatus: oldStatus || null,
        newStatus,
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
