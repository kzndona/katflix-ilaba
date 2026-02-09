import admin from "@/src/app/utils/firebase-admin";
import { SupabaseClient } from "@supabase/supabase-js";

export interface SendNotificationOptions {
  orderId?: string;
  basketNumber?: number;
  notificationType?: string; // 'pickup', 'delivery', 'service_update', 'order_status', 'general'
  metadata?: Record<string, any>;
}

/**
 * Award loyalty points to a customer when order is completed
 * @param customerId - Customer ID
 * @param supabase - Supabase client instance
 * @param pointsToAward - Number of points to award (default: 1)
 * @returns true if successful, false otherwise
 */
export async function awardLoyaltyPoints(
  customerId: string,
  supabase: SupabaseClient,
  pointsToAward: number = 1
): Promise<boolean> {
  try {
    // Get current loyalty points
    const { data: customer, error: fetchError } = await supabase
      .from("customers")
      .select("loyalty_points")
      .eq("id", customerId)
      .single();

    if (fetchError || !customer) {
      console.warn(
        `⚠️ Failed to fetch loyalty points for customer ${customerId}:`,
        fetchError?.message
      );
      return false;
    }

    // Calculate new points
    const newPoints = (customer.loyalty_points || 0) + pointsToAward;

    // Update customer loyalty points
    const { error: updateError } = await supabase
      .from("customers")
      .update({ loyalty_points: newPoints })
      .eq("id", customerId);

    if (updateError) {
      console.error(
        `❌ Failed to award loyalty points to ${customerId}:`,
        updateError.message
      );
      return false;
    }

    console.log(
      `✅ Awarded ${pointsToAward} loyalty points to customer ${customerId}. Total: ${newPoints}`
    );
    return true;
  } catch (err: any) {
    console.error("❌ Error in awardLoyaltyPoints:", err);
    return false;
  }
}

export async function sendPushNotification(
  customerId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
  options?: SendNotificationOptions
) {
  try {
    // Get device token from database using server-side Supabase
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    const { data: customer, error } = await supabase
      .from("customers")
      .select("fcm_device_token")
      .eq("id", customerId)
      .single();

    if (error || !customer?.fcm_device_token) {
      console.warn(`No device token for customer ${customerId}`);
    }

    let fcmResponse = null;

    // Send notification via FCM if device token exists
    if (customer?.fcm_device_token) {
      const message = {
        notification: {
          title,
          body,
        },
        data: data || {},
        token: customer.fcm_device_token,
      };

      fcmResponse = await admin.messaging().send(message);
      console.log(`✅ Notification sent to ${customerId}:`, fcmResponse);
    }

    // Insert notification into history table
    const { error: insertError } = await supabase
      .from("notifications")
      .insert({
        customer_id: customerId,
        order_id: options?.orderId,
        basket_number: options?.basketNumber,
        type: options?.notificationType || "general",
        title,
        body,
        data: options?.metadata,
        status: "sent",
      });

    if (insertError) {
      console.warn(
        `⚠️ Failed to insert notification record for ${customerId}:`,
        insertError.message
      );
    } else {
      console.log(`✅ Notification record inserted for ${customerId}`);
    }

    return fcmResponse;
  } catch (err: any) {
    console.error("❌ Failed to send notification:", err);
  }
}