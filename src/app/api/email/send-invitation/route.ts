import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/src/app/utils/supabase/server";

/**
 * POST /api/email/send-invitation
 * 
 * Send invitation email to new customer with loyalty program info
 * Called after new customer creation in POS
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { customer_id, email, first_name } = body;

    if (!email || !first_name) {
      return NextResponse.json(
        { success: false, error: "Missing email or first_name" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Send email (using Supabase email or external service)
    // For now, we'll log this and create a placeholder
    console.log(`📧 Sending invitation email to ${email} for customer ${customer_id}`);

    // In a real scenario, you'd integrate with:
    // - SendGrid
    // - AWS SES
    // - Resend
    // - Supabase Auth emails
    // For now, just log success

    const invitationContent = `
Dear ${first_name},

Welcome to our laundry service! 

Your customer account has been created. You can now:
- Track your orders
- Accumulate loyalty points
- Enjoy exclusive discounts

Visit our website or call us for more information.

Best regards,
The Laundry Team
    `;

    // TODO: Integrate with actual email service
    // await sendEmail({
    //   to: email,
    //   subject: `Welcome to Our Laundry Service, ${first_name}!`,
    //   text: invitationContent,
    // });

    return NextResponse.json({
      success: true,
      message: "Invitation email queued",
      email,
    });
  } catch (error) {
    console.error("Invitation email error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to send invitation",
      },
      { status: 500 }
    );
  }
}
