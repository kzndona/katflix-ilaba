import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let staffId: string;
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

      // Now insert staff profile with auth_id (without role)
      const { id, role, ...dataWithoutIdAndRole } = data; // Remove id and role from payload for insert
      const staffPayload = {
        ...dataWithoutIdAndRole,
        auth_id: authUserId || null, // Use null instead of empty string
      };

      result = await supabase.from("staff").insert(staffPayload).select();
      
      if (result.error) throw result.error;
      staffId = result.data[0].id;
      
      // Now insert role into staff_roles junction table
      if (data.role) {
        const roleResult = await supabase.from("staff_roles").insert({
          staff_id: staffId,
          role_id: data.role,
        });
        
        if (roleResult.error) throw roleResult.error;
      }
    } else {
      // Update existing staff
      // Don't allow changing email (would need re-invitation)
      const { email_address, role, ...dataWithoutEmailAndRole } = data;
      
      result = await supabase
        .from("staff")
        .update(dataWithoutEmailAndRole)
        .eq("id", data.id)
        .select();
        
      if (result.error) throw result.error;
      staffId = data.id;
      
      // Update role in staff_roles if provided
      if (data.role) {
        // Delete existing roles and insert new one
        await supabase.from("staff_roles").delete().eq("staff_id", staffId);
        
        const roleResult = await supabase.from("staff_roles").insert({
          staff_id: staffId,
          role_id: data.role,
        });
        
        if (roleResult.error) throw roleResult.error;
      }
    }

    // Fetch complete staff data with role
    const completeResult = await supabase
      .from("staff")
      .select("id, auth_id, first_name, last_name, email_address, is_active, staff_roles(role_id)")
      .eq("id", staffId)
      .single();
      
    if (completeResult.error) throw completeResult.error;
    
    const staffWithRole = {
      ...completeResult.data,
      role: completeResult.data.staff_roles?.[0]?.role_id || null,
    };
    
    return NextResponse.json({
      success: true,
      data: staffWithRole,
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
