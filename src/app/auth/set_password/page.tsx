"use client";

import { Suspense } from "react";
import SetPasswordForm from "./set-password-form";

export default function SetPasswordPage() {
  return (
    <Suspense fallback={<SetPasswordLoading />}>
      <SetPasswordForm />
    </Suspense>
  );
}

function SetPasswordLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-lg shadow p-8 space-y-6 animate-pulse">
        <div className="space-y-2">
          <div className="h-8 bg-gray-200 rounded w-3/4 mx-auto"></div>
          <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto"></div>
        </div>
        <div className="space-y-4">
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
          <div className="h-10 bg-gray-200 rounded"></div>
        </div>
      </div>
    </div>
  );
}
