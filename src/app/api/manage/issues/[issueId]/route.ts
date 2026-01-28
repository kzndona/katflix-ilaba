import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * PATCH /api/manage/issues/[issueId]
 * 
 * Update issue status and resolution metadata
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ issueId: string }> }
) {
  const supabase = await createClient();
  const { issueId } = await params;

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

    // === GET STAFF ID ===
    const { data: staffData, error: staffError } = await supabase
      .from("staff")
      .select("id")
      .eq("auth_id", user.id)
      .single();

    if (staffError || !staffData) {
      return NextResponse.json(
        { success: false, error: "Staff record not found" },
        { status: 400 }
      );
    }

    // === PARSE REQUEST ===
    const body = await request.json();
    const { status } = body;

    if (!status || !["open", "resolved", "cancelled"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Invalid status" },
        { status: 400 }
      );
    }

    // === PREPARE UPDATE DATA ===
    const updateData: Record<string, any> = {
      status,
      updated_at: new Date().toISOString(),
    };

    // If status is being changed to resolved, set resolved_by and resolved_at
    if (status === "resolved") {
      updateData.resolved_by = staffData.id;
      updateData.resolved_at = new Date().toISOString();
    }

    // === UPDATE ISSUE ===
    const { error: updateError } = await supabase
      .from("issues")
      .update(updateData)
      .eq("id", issueId);

    if (updateError) {
      console.error("[ISSUE UPDATE] Error updating issue:", updateError);
      return NextResponse.json(
        { success: false, error: "Failed to update issue" },
        { status: 500 }
      );
    }

    console.log("[ISSUE UPDATE] Success:", {
      issue_id: issueId,
      status,
      resolved_by: status === "resolved" ? staffData.id : null,
    });

    return NextResponse.json({
      success: true,
      message: "Issue updated successfully",
    });
  } catch (error) {
    console.error("[ISSUE UPDATE] Exception:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
