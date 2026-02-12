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

/**
 * Send push notification to ALL riders (staff with role "rider" and a valid FCM token).
 * Used to alert riders about new pickup assignments, delivery requests, etc.
 *
 * @param title - Notification title
 * @param body - Notification body
 * @param data - Optional data payload (must be Record<string, string> for FCM)
 * @param options - Optional metadata for notification history
 * @returns Array of FCM responses (one per rider notified)
 */
export async function sendRiderPushNotification(
  title: string,
  body: string,
  data?: Record<string, string>,
  options?: SendNotificationOptions
) {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );

    // Fetch all staff with role "rider" who have a device token registered
    const { data: riders, error } = await supabase
      .from("staff")
      .select("id, first_name, last_name, fcm_device_token, staff_roles!inner(role_id)")
      .eq("staff_roles.role_id", "rider")
      .eq("is_active", true)
      .not("fcm_device_token", "is", null);

    if (error) {
      console.error("❌ Failed to fetch riders:", error.message);
      return [];
    }

    if (!riders || riders.length === 0) {
      console.warn("⚠️ No riders with device tokens found");
      return [];
    }

    console.log(`📱 Sending rider notification to ${riders.length} rider(s)...`);

    const results = await Promise.allSettled(
      riders.map(async (rider: any) => {
        // Send FCM push notification
        const message = {
          notification: {
            title,
            body,
          },
          data: data || {},
          token: rider.fcm_device_token,
        };

        const fcmResponse = await admin.messaging().send(message);
        console.log(
          `✅ Rider notification sent to ${rider.first_name} ${rider.last_name} (${rider.id}):`,
          fcmResponse
        );

        return { riderId: rider.id, response: fcmResponse };
      })
    );

    // Log summary
    const succeeded = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;
    console.log(
      `📱 Rider notifications: ${succeeded} sent, ${failed} failed`
    );

    return results;
  } catch (err: any) {
    console.error("❌ Failed to send rider notifications:", err);
    return [];
  }
}