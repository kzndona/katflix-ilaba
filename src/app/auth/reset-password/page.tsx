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
        // Check if we have a hash in the URL (from the email link)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');

        // If this is a recovery/password reset link
        if (type === 'recovery' && accessToken) {
          // Exchange the tokens for a session
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken || '',
          });

          if (error || !data.session) {
            console.error('Session error:', error);
            setError("Invalid or expired reset link. Please request a new password reset.");
            setSessionValid(false);
          } else {
            // Session established successfully
            setSessionValid(true);
          }
        } else {
          // No valid token in URL, check if already has session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error || !session) {
            setError("Invalid or expired reset link. Please request a new password reset.");
            setSessionValid(false);
          } else {
            setSessionValid(true);
          }
        }
      } catch (err) {
        console.error('Error handling password reset:', err);
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

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      setSuccess("Password updated successfully! Redirecting to login...");
      setTimeout(() => {
        router.push("/auth/sign-in");
      }, 2000);
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
            <h2 className="text-2xl text-gray-600 mb-4">
              Reset Password
            </h2>
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
            <form onSubmit={handleResetPassword} className="flex flex-col space-y-4">
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
