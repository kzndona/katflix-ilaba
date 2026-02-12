"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Auto-detect: if input is 09xxxxxxxxx (11 digits), it's a phone number
  const isPhoneNumber = (value: string) =>
    /^09\d{9}$/.test(value.trim());

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    let emailToUse = identifier.trim();

    // If it looks like a phone number, look up the email first
    if (isPhoneNumber(identifier)) {
      try {
        const res = await fetch("/api/auth/phone-lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone: identifier }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.error || "No account found with that phone number");
          setLoading(false);
          return;
        }

        const data = await res.json();
        emailToUse = data.email;
      } catch {
        setError("Failed to verify phone number. Please try again.");
        setLoading(false);
        return;
      }
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailToUse,
      password: password,
    });

    setLoading(false);

    if (error) {
      setError(error.message);
    } else {
      router.replace("/in/orders"); // redirect after successful login
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100 p-2">
      <div className="flex w-full h-full gap-2">
        {/* Left Image Panel */}
        <div className="w-1/2 rounded-2xl shadow-xl overflow-hidden bg-blue-600">
          <Image
            src="/images/login_carousel_1.jpg" // replace with your image path
            alt="Laundry Shop"
            className="object-cover h-full w-full"
            width={500}
            height={500}
          />
        </div>

        {/* Right Login Panel */}
        <div className="w-1/2 bg-gray-100 p-48 rounded-2xl flex flex-col justify-center space-y-6">
          <div>
            <h1 className="text-6xl font-bold text-gray-800 mb-2">KATFLIX</h1>
            <h2 className="text-2xl text-gray-600 mb-4">
              iLaba Management System
            </h2>
            <p className="text-lg text-gray-500 mb-6">
              Please sign-in to continue.
            </p>
          </div>

          <form onSubmit={handleLogin} className="flex flex-col space-y-4">
            {/* Email or Phone Number */}
            <div>
              <label className="block text-md font-medium text-gray-700 mb-2">
                Email or Phone Number
              </label>
              <input
                type="text"
                placeholder="you@example.com or 09171234567"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-md font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                className="w-full rounded-lg border border-gray-300 px-4 py-3 text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Forgot Password */}
            <div className="flex justify-end">
              <a
                href="/auth/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Forgot Password?
              </a>
            </div>

            {/* Error Message (always preserves spacing) */}
            <div className="min-h-5">
              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg text-lg font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? "Logging in..." : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
