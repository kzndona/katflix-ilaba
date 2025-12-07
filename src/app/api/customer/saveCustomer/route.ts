import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    let result: any = null;

    if (!data.id) {
      // New customer: Create auth user first if email provided
      let authUserId: string | null = null;

      if (data.email_address) {
        try {
          // Invite customer via email - Supabase will send invitation link
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
            throw new Error(`Failed to invite customer: ${authError.message}`);
          }

          if (authData?.user?.id) {
            authUserId = authData.user.id;
          }
        } catch (authErr) {
          console.error("Error inviting customer:", authErr);
          throw authErr;
        }
      }

      // Now insert customer profile with auth_id
      const { id, ...dataWithoutId } = data; // Remove id from payload for insert
      const customerPayload = {
        ...dataWithoutId,
        auth_id: authUserId || null, // Use null instead of empty string
      };

      result = await supabase.from("customers").insert(customerPayload).select();
    } else {
      // Update existing customer
      const { email_address, loyalty_points, ...dataWithoutEmailAndPoints } = data;

      // If email is being set and customer doesn't have auth_id, send invitation
      if (email_address) {
        try {
          // First check if this customer already has an auth user
          const { data: customerData } = await supabase
            .from("customers")
            .select("auth_id")
            .eq("id", data.id)
            .single();

          if (!customerData?.auth_id) {
            // No auth user yet - create one and send invitation
            const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
              email_address,
              {
                data: {
                  first_name: data.first_name,
                  last_name: data.last_name,
                },
              }
            );

            if (authError) {
              console.error("Auth invite error:", authError);
              // Don't throw - continue with profile update
            }

            if (authData?.user?.id) {
              // Update customer with new auth_id and email
              result = await supabase
                .from("customers")
                .update({
                  ...dataWithoutEmailAndPoints,
                  email_address,
                  auth_id: authData.user.id,
                })
                .eq("id", data.id)
                .select();
            } else {
              // Invitation failed, update without auth_id
              result = await supabase
                .from("customers")
                .update({
                  ...dataWithoutEmailAndPoints,
                  email_address,
                })
                .eq("id", data.id)
                .select();
            }
          } else {
            // Auth user already exists - just update profile
            result = await supabase
              .from("customers")
              .update({
                ...dataWithoutEmailAndPoints,
                email_address,
              })
              .eq("id", data.id)
              .select();
          }
        } catch (emailErr) {
          console.warn("Error handling email update:", emailErr);
          // Continue with regular update
          result = await supabase
            .from("customers")
            .update(dataWithoutEmailAndPoints)
            .eq("id", data.id)
            .select();
        }
      } else {
        // No email - just update other fields
        result = await supabase
          .from("customers")
          .update(dataWithoutEmailAndPoints)
          .eq("id", data.id)
          .select();
      }
    }

    if (result.error) throw result.error;

    return NextResponse.json({
      success: true,
      data: result.data,
      message: data.id
        ? "Customer updated successfully"
        : "Customer created and invitation email sent",
    });
  } catch (error) {
    console.error("Failed to save customer:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to save customer: ${errorMessage}` },
      { status: 500 }
    );
  }
}
