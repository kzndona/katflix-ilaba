"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    // Store the email in localStorage so reset-password page can retrieve it
    localStorage.setItem("reset_password_email", email);

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
      localStorage.removeItem("reset_password_email"); // Clear on error
    } else {
      setSuccess("Password reset link has been sent to your email. Please check your inbox.");
      setEmail(""); // Clear the email input on success
    }
  };

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
            <h2 className="text-2xl text-gray-600 mb-4">Forgot Password</h2>
            <p className="text-lg text-gray-500 mb-6">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>
          </div>

          <form
            onSubmit={handleResetRequest}
            className="flex flex-col space-y-4"
          >
            {/* Email */}
            <div>
              <label className="block text-md font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
              {loading ? "Sending..." : "Send Reset Link"}
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
        </div>
      </div>
    </div>
  );
}
