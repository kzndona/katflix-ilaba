import admin from "@/src/app/utils/firebase-admin";

export async function sendPushNotification(
  customerId: string,
  title: string,
  body: string,
  data?: Record<string, string>
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
      return;
    }

    // Send notification via FCM
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      token: customer.fcm_device_token,
    };

    const response = await admin.messaging().send(message);
    console.log(`✅ Notification sent to ${customerId}:`, response);
    
    return response;
  } catch (err: any) {
    console.error("❌ Failed to send notification:", err);
  }
}