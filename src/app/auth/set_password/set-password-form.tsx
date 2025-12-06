"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/src/app/utils/supabase/client";

export default function SetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  useEffect(() => {
    // Check if user has a valid session with recovery token
    const checkSession = async () => {
      try {
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) {
          setError("Invalid or expired link. Please request a new invitation.");
          return;
        }

        if (!session?.user) {
          setError(
            "No active session found. Please check your invitation link."
          );
        }
      } catch (err) {
        console.error("Session check error:", err);
        setError("Failed to verify session");
      }
    };

    checkSession();
  }, [supabase.auth]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setLoading(true);

    try {
      // Update the user's password
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to set password");
        return;
      }

      setSuccess(true);

      // Redirect to sign-in after 2 seconds
      setTimeout(() => {
        router.push("/auth/sign-in");
      }, 2000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (error && error.includes("Invalid or expired")) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900">Link Expired</h1>
            <p className="text-gray-600 mt-2">{error}</p>
          </div>
          <button
            onClick={() => router.push("/auth/sign-in")}
            className="w-full py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Set Your Password</h1>
          <p className="text-gray-600 mt-2">Create a password for your account</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-300 rounded-lg p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {success && (
          <div className="bg-green-50 border border-green-300 rounded-lg p-4 text-sm text-green-700">
            ✓ Password set successfully! Redirecting to sign in...
          </div>
        )}

        <form onSubmit={handleSetPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (min 6 characters)"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || success}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirm password"
              className="w-full border border-gray-300 rounded-lg px-4 py-2 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={loading || success}
            />
          </div>

          <button
            type="submit"
            disabled={loading || success}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? "Setting Password..." : "Set Password"}
          </button>
        </form>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
          <strong>ℹ️ Password Requirements:</strong>
          <ul className="mt-2 space-y-1 list-disc list-inside">
            <li>Minimum 6 characters</li>
            <li>Passwords must match</li>
            <li>After setting, you'll be redirected to sign in</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
