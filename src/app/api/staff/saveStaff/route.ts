import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let result;
    
    if (!data.id) {
      // New staff: Create auth user first if email provided
      let authUserId: string | null = null;
      
      if (data.email_address) {
        try {
          // Invite user via email - Supabase will send invitation link
          const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
            data.email_address,
            {
              data: {
                first_name: data.first_name,
                last_name: data.last_name,
                role: data.role,
              },
            }
          );

          if (authError) {
            console.error("Auth invite error:", authError);
            throw new Error(`Failed to invite user: ${authError.message}`);
          }

          if (authData?.user?.id) {
            authUserId = authData.user.id;
          }
        } catch (authErr) {
          console.error("Error inviting user:", authErr);
          throw authErr;
        }
      }

      // Now insert staff profile with auth_id
      const { id, ...dataWithoutId } = data; // Remove id from payload for insert
      const staffPayload = {
        ...dataWithoutId,
        auth_id: authUserId || null, // Use null instead of empty string
      };

      result = await supabase.from("staff").insert(staffPayload).select();
    } else {
      // Update existing staff
      // Don't allow changing email (would need re-invitation)
      const { email_address, ...dataWithoutEmail } = data;
      
      result = await supabase
        .from("staff")
        .update(dataWithoutEmail)
        .eq("id", data.id)
        .select();
    }

    if (result.error) throw result.error;
    
    return NextResponse.json({
      success: true,
      data: result.data,
      message: data.id 
        ? "Staff updated successfully" 
        : "Staff created and invitation email sent",
    });
  } catch (error) {
    console.error("Failed to save staff:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save staff: ${errorMessage}` },
      { status: 500 }
    );
  }
}
