"use client";

import { useState } from "react";
import ChangePasswordTab from "./components/ChangePasswordTab";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("password");

  return (
    <div className="p-6 h-screen bg-gray-50 flex flex-col">
      <div className="grid grid-cols-4 gap-4 flex-1 overflow-hidden">
        {/* LEFT PANE - Settings Tabs */}
        <div className="col-span-1 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-3xl font-bold">Settings</h2>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="divide-y divide-gray-200">
              <button
                onClick={() => setActiveTab("password")}
                className={`w-full text-left px-6 py-4 transition ${
                  activeTab === "password"
                    ? "bg-blue-50 border-l-4 border-blue-600"
                    : "hover:bg-gray-50"
                }`}
              >
                <div className="font-medium text-gray-900">Change Password</div>
                <div className="text-xs text-gray-500 mt-1">
                  Update your account password
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT PANE - Settings Details */}
        <div className="col-span-3 bg-white rounded-lg shadow flex flex-col overflow-hidden">
          {activeTab === "password" && <ChangePasswordTab />}
        </div>
      </div>
    </div>
  );
}
