import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: "Email is required" },
        { status: 400 }
      );
    }

    // Use service role key for server-side password reset request
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Generate password reset link using the admin API
    // This properly creates a valid recovery token in Supabase's database
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "https://katflix-ilaba.vercel.app"}/auth/reset-password`,
      },
    });

    if (error) {
      console.error("Password reset generation error:", error);
      return NextResponse.json(
        { error: `Failed to generate reset link: ${error.message}` },
        { status: 500 }
      );
    }

    // Extract the reset link from the response
    if (!data || !data.properties || !data.properties.action_link) {
      console.error("No action link returned from generateLink");
      return NextResponse.json(
        { error: "Failed to generate reset link" },
        { status: 500 }
      );
    }

    const resetLink = data.properties.action_link;

    // Now send the email with the reset link using Resend
    const emailResult = await resend.emails.send({
      from: "noreply@katflix.com",
      to: email,
      subject: "Reset your KATFLIX password",
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
            <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2>Password Reset Request</h2>
              <p>We received a request to reset your password for your KATFLIX account.</p>
              
              <p>Click the button below to set a new password:</p>
              
              <div style="margin: 30px 0;">
                <a href="${resetLink}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
                  Reset Password
                </a>
              </div>

              <p style="color: #666; font-size: 14px;">
                Or copy and paste this link in your browser:<br />
                <code style="background-color: #f0f0f0; padding: 8px; border-radius: 4px; word-break: break-all;">
                  ${resetLink}
                </code>
              </p>

              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                This link will expire in 1 hour.
              </p>

              <p style="color: #666; font-size: 14px; margin-top: 20px;">
                If you didn't request this password reset, you can safely ignore this email.
              </p>

              <hr style="margin: 20px 0; border: none; border-top: 1px solid #ddd;" />
              <p style="text-align: center; color: #666; font-size: 12px;">
                <strong>KATFLIX Management System</strong>
              </p>
            </div>
          </body>
        </html>
      `,
      text: `
Password Reset Request

We received a request to reset your password for your KATFLIX account.

Please click the link below to set a new password:
${resetLink}

This link will expire in 1 hour.

If you didn't request this password reset, you can safely ignore this email.

---
KATFLIX Management System
      `,
    });

    if (emailResult.error) {
      console.error("Email sending error:", emailResult.error);
      return NextResponse.json(
        { error: `Failed to send reset email: ${emailResult.error.message}` },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Password reset link has been sent to your email",
    });
  } catch (error) {
    console.error("Password reset request error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to process password reset: ${errorMessage}` },
      { status: 500 }
    );
  }
}
