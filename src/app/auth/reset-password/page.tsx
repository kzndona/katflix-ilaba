"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

export default function ResetPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);

  // Verify and exchange the token from the email link on mount
  useEffect(() => {
    const handlePasswordReset = async () => {
      try {
        console.log("Full URL:", window.location.href);
        console.log("Search:", window.location.search);

        // Check for error in query params first (Supabase /verify endpoint returns errors here)
        const queryParams = new URLSearchParams(window.location.search);
        const queryError = queryParams.get("error");
        const errorCode = queryParams.get("error_code");
        const errorDescription = queryParams.get("error_description");

        console.log("Query params:", {
          queryError,
          errorCode,
          errorDescription,
        });

        // If Supabase returned an error, show it
        if (queryError) {
          console.log("Error from Supabase /verify:", {
            queryError,
            errorCode,
            errorDescription,
          });
          if (errorCode === "otp_expired") {
            setError(
              "This reset link has expired. Password reset links are valid for 1 hour. Please request a new one.",
            );
          } else {
            setError(`Error: ${errorDescription || queryError}`);
          }
          setSessionValid(false);
          setVerifying(false);
          return;
        }

        // If no error, Supabase should have already set the session via the /verify redirect
        // Just check if we have a valid session
        console.log("Checking for existing session from Supabase /verify redirect...");
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError || !session) {
          console.error("Session error:", sessionError);
          setError(
            "Failed to establish session. Please request a new password reset link.",
          );
          setSessionValid(false);
        } else {
          console.log("Session established by Supabase /verify:", session.user?.email);
          setSessionValid(true);
        }
      } catch (err) {
        console.error("Error handling password reset:", err);
        setError("An error occurred. Please try again.");
        setSessionValid(false);
      } finally {
        setVerifying(false);
      }
    };

    handlePasswordReset();
  }, [supabase]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      setLoading(false);
      return;
    }

    try {
      // SECURITY: Verify we still have a valid session before updating password
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Session expired. Please request a new password reset link.");
        setLoading(false);
        return;
      }

      console.log("Updating password for user:", user.id, "email:", user.email);

      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        setError(error.message);
      } else {
        setSuccess("Password updated successfully! Redirecting to login...");
        setTimeout(() => {
          router.push("/auth/sign-in");
        }, 2000);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
      console.error("Password update error:", err);
    } finally {
      setLoading(false);
    }
  };

  // Show loading state while verifying session
  if (verifying) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100">
        <div className="text-center">
          <div className="text-xl text-gray-600">Verifying reset link...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 p-2">
      <div className="flex w-full h-full gap-2">
        {/* Left Image Panel */}
        <div className="w-1/2 rounded-2xl shadow-xl overflow-hidden bg-blue-600">
          <Image
            src="/images/login_carousel_1.jpg"
            alt="Laundry Shop"
            className="object-cover h-full w-full"
            width={500}
            height={500}
          />
        </div>

        {/* Right Form Panel */}
        <div className="w-1/2 bg-gray-100 p-48 rounded-2xl flex flex-col justify-center space-y-6">
          <div>
            <h1 className="text-6xl font-bold text-gray-800 mb-2">KATFLIX</h1>
            <h2 className="text-2xl text-gray-600 mb-4">Reset Password</h2>
            <p className="text-lg text-gray-500 mb-6">
              Enter your new password below.
            </p>
          </div>

          {!sessionValid ? (
            // Show error if session is invalid
            <>
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              {/* Back to Login */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push("/auth/sign-in")}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Back to Login
                </button>
              </div>
            </>
          ) : (
            <form
              onSubmit={handleResetPassword}
              className="flex flex-col space-y-4"
            >
              {/* New Password */}
              <div>
                <label className="block text-md font-medium text-gray-700 mb-2">
                  New Password
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-md font-medium text-gray-700 mb-2">
                  Confirm Password
                </label>
                <input
                  type="password"
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-300 text-red-700 px-4 py-3 rounded-lg text-sm">
                  {error}
                </div>
              )}

              {/* Success Message */}
              {success && (
                <div className="bg-green-50 border border-green-300 text-green-700 px-4 py-3 rounded-lg text-sm">
                  {success}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg text-lg transition disabled:opacity-50"
                disabled={loading}
              >
                {loading ? "Updating..." : "Reset Password"}
              </button>

              {/* Back to Login */}
              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push("/auth/sign-in")}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Back to Login
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
