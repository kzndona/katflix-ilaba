import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * PATCH /api/notifications/{notificationId}/read
 * 
 * Mark a specific notification as read
 * Updates read_at timestamp and status to 'read'
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: notificationId } = await params;

  try {
    // === AUTHENTICATE ===
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // === PARSE REQUEST ===
    const body = await request.json();
    const action = body.action; // 'read' or 'click'

    if (!action) {
      return NextResponse.json(
        { error: "Action is required" },
        { status: 400 }
      );
    }

    // === GET NOTIFICATION ===
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("*")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // === VERIFY OWNERSHIP ===
    if (notification.customer_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // === UPDATE NOTIFICATION ===
    let updateData: any = {};

    if (action === "read") {
      updateData = {
        status: "read",
        read_at: new Date().toISOString(),
      };
    } else if (action === "click") {
      updateData = {
        status: "read",
        clicked_at: new Date().toISOString(),
        read_at: notification.read_at || new Date().toISOString(),
      };
    } else {
      return NextResponse.json(
        { error: "Invalid action" },
        { status: 400 }
      );
    }

    const { error: updateError } = await supabase
      .from("notifications")
      .update(updateData)
      .eq("id", notificationId);

    if (updateError) {
      console.error("Error updating notification:", updateError);
      return NextResponse.json(
        { error: "Failed to update notification" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Notification marked as ${action}`,
    });
  } catch (error: any) {
    console.error("[NOTIFICATION UPDATE] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/{notificationId}
 * 
 * Delete a single notification
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { id: notificationId } = await params;

  try {
    // === AUTHENTICATE ===
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // === GET NOTIFICATION ===
    const { data: notification, error: fetchError } = await supabase
      .from("notifications")
      .select("customer_id")
      .eq("id", notificationId)
      .single();

    if (fetchError || !notification) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    // === VERIFY OWNERSHIP ===
    if (notification.customer_id !== user.id) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    // === DELETE NOTIFICATION ===
    const { error: deleteError } = await supabase
      .from("notifications")
      .delete()
      .eq("id", notificationId);

    if (deleteError) {
      console.error("Error deleting notification:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete notification" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error: any) {
    console.error("[NOTIFICATION DELETE] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
