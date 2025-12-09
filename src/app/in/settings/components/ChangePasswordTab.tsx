"use client";

import { useState } from "react";
import { createClient } from "@/src/app/utils/supabase/client";

export default function ChangePasswordTab() {
  const supabase = createClient();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordsMatch = newPassword && confirmPassword && newPassword === confirmPassword;
  const isFormValid = currentPassword && passwordsMatch && !loading;

  const validatePassword = (password: string): string | null => {
    if (password.length < 6) {
      return "Password must be at least 6 characters";
    }
    return null;
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    // Validation
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match");
      return;
    }

    if (currentPassword === newPassword) {
      setError("New password must be different from current password");
      return;
    }

    setLoading(true);

    try {
      // Get current user
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setError("Failed to verify your identity. Please try signing in again.");
        return;
      }

      // Verify current password by attempting to sign in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email!,
        password: currentPassword,
      });

      if (signInError) {
        setError("Current password is incorrect");
        return;
      }

      // Update password
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) {
        setError(updateError.message || "Failed to update password");
        return;
      }

      setSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "An error occurred";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const PasswordInput = ({
    label,
    value,
    onChange,
    show,
    toggleShow,
    placeholder,
  }: {
    label: string;
    value: string;
    onChange: (v: string) => void;
    show: boolean;
    toggleShow: () => void;
    placeholder: string;
  }) => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        />
        <button
          type="button"
          onClick={toggleShow}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
          disabled={loading}
        >
          {show ? (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            </svg>
          ) : (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
              />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-8 border-b border-gray-200 shrink-0">
        <h3 className="text-3xl font-bold text-gray-900">Change Password</h3>
        <p className="text-gray-600 mt-2">
          Update your password to keep your account secure
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-300 rounded-lg text-sm text-red-700 flex gap-3">
            <svg
              className="w-5 h-5 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div>{error}</div>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 bg-green-50 border border-green-300 rounded-lg text-sm text-green-700 flex gap-3">
            <svg
              className="w-5 h-5 shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div>✓ Password updated successfully!</div>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="max-w-md space-y-6">
          <PasswordInput
            label="Current Password"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrentPassword}
            toggleShow={() => setShowCurrentPassword(!showCurrentPassword)}
            placeholder="Enter your current password"
          />

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
            <strong>ℹ️ New Password Requirements:</strong>
            <ul className="mt-2 space-y-1 list-disc list-inside">
              <li>Minimum 6 characters</li>
              <li>Must be different from current password</li>
              <li>Both new password fields must match</li>
            </ul>
          </div>

          <PasswordInput
            label="New Password"
            value={newPassword}
            onChange={setNewPassword}
            show={showNewPassword}
            toggleShow={() => setShowNewPassword(!showNewPassword)}
            placeholder="Enter your new password"
          />

          <PasswordInput
            label="Confirm New Password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirmPassword}
            toggleShow={() => setShowConfirmPassword(!showConfirmPassword)}
            placeholder="Confirm your new password"
          />

          {newPassword && confirmPassword && !passwordsMatch && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-700">
              ⚠️ Passwords do not match
            </div>
          )}

          <button
            type="submit"
            disabled={!isFormValid}
            className="w-full py-3 rounded-lg bg-linear-to-r from-blue-600 to-blue-700 text-white font-bold text-base hover:from-blue-700 hover:to-blue-800 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition shadow-md hover:shadow-lg"
          >
            {loading ? "Updating Password..." : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
