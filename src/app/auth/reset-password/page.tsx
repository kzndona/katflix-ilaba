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
        console.log('Full URL:', window.location.href);
        console.log('Hash:', window.location.hash);
        console.log('Search:', window.location.search);
        
        // Check for error in query params first (expired link)
        const queryParams = new URLSearchParams(window.location.search);
        const queryError = queryParams.get('error');
        const errorCode = queryParams.get('error_code');
        const errorDescription = queryParams.get('error_description');
        
        // Check for tokens (Supabase can send either token= or token_hash=)
        const tokenHash = queryParams.get('token_hash');
        const token = queryParams.get('token'); // New PKCE format uses 'token'
        const type = queryParams.get('type');

        console.log('Query params:', { tokenHash: !!tokenHash, token: !!token, type, queryError, errorCode });

        if (queryError) {
          console.log('Error in URL:', { queryError, errorCode, errorDescription });
          if (errorCode === 'otp_expired') {
            setError("This reset link has expired. Password reset links are valid for 1 hour. Please request a new one.");
          } else {
            setError(`Error: ${errorDescription || queryError}`);
          }
          setSessionValid(false);
          setVerifying(false);
          return;
        }

        // Handle token_hash from query params (old Supabase magiclink format)
        if (tokenHash && type === 'recovery') {
          console.log('Token hash found in query params, verifying OTP...');
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: 'recovery',
          });

          if (error || !data.session) {
            console.error('OTP verification error:', error);
            setError("Invalid or expired reset link. Please request a new password reset.");
            setSessionValid(false);
          } else {
            console.log('OTP verified successfully, session established!');
            setSessionValid(true);
          }
          setVerifying(false);
          return;
        }

        // Handle token from query params (new PKCE format - pkce_xxx)
        if (token && type === 'recovery') {
          console.log('PKCE token found in query params, verifying...');
          // For PKCE tokens, we need to clear any existing session first
          await supabase.auth.signOut({ scope: 'local' });
          
          // Try to verify as OTP with the token as token_hash
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: 'recovery',
          });

          if (error || !data.session) {
            console.error('Token verification error:', error);
            setError("Invalid or expired reset link. Please request a new password reset.");
            setSessionValid(false);
          } else {
            console.log('Token verified successfully, session established!');
            setSessionValid(true);
          }
          setVerifying(false);
          return;
        }
        
        // Check if we have a hash in the URL (legacy token-based flow)
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const hashType = hashParams.get('type');
        const hashError = hashParams.get('error');

        console.log('Parsed hash tokens:', { hashType, hasAccessToken: !!accessToken, hasRefreshToken: !!refreshToken, hashError });

        // Check for error in hash
        if (hashError) {
          console.log('Error in hash:', hashError);
          const hashErrorCode = hashParams.get('error_code');
          if (hashErrorCode === 'otp_expired') {
            setError("This reset link has expired. Password reset links are valid for 1 hour. Please request a new one.");
          } else {
            setError(`Error: ${hashParams.get('error_description') || hashError}`);
          }
          setSessionValid(false);
          setVerifying(false);
          return;
        }

        // If this is a recovery/password reset link (legacy flow with hash)
        if (hashType === 'recovery' && accessToken) {
          console.log('Attempting to set session with recovery token from hash...');
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
            console.log('Session established successfully from hash!');
            // Session established successfully
            setSessionValid(true);
          }
        } else {
          console.log('No recovery token or code found, checking existing session...');
          // No valid token in URL, check if already has session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          console.log('Existing session check:', { hasSession: !!session, error });
          
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

    try {
      // SECURITY: Verify we still have a valid session before updating password
      const { data: { user } } = await supabase.auth.getUser();
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
