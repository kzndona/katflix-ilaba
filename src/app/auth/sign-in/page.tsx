"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// import { createClient } from "@/utils/supabase/client";

export default function LoginPage() {
  //   const supabase = createClient();
  //   const router = useRouter();

  //   const [email, setEmail] = useState("");
  //   const [password, setPassword] = useState("");
  //   const [error, setError] = useState("");
  //   const [loading, setLoading] = useState(false);

  //   const handleLogin = async (e: React.FormEvent) => {
  //     e.preventDefault();
  //     setLoading(true);
  //     setError("");

  //     // const { data, error } = await supabase.auth.signInWithPassword({
  //     //   email: email,
  //     //   password: password,
  //     // });

  //     setLoading(false);

  //     if (error) {
  //     //   console.log(error.message);
  //     } else {
  //       router.push("/dashboard/orders"); // redirect after successful login
  //     }
  //   };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-sm bg-white shadow-xl rounded-2xl p-8">
        <h1 className="text-2xl font-semibold text-center mb-6">
          Ilaba Laundry Management
        </h1>

        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              //   value={email}
              //   onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              //   value={password}
              //   onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* {error && <p className="text-sm text-red-600">{error}</p>} */}

          <button
            type="submit"
            // disabled={loading}
            className="w-full bg-blue-600 text-white py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {/* {loading ? "Logging in..." : "Login"} */}
          </button>
        </form>

        <div className="mt-4 text-center">
          <a
            href="/forgot-password"
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            Forgot Password?
          </a>
        </div>
      </div>
    </div>
  );
}
