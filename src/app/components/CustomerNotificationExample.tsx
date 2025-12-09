"use client";

import { useEffect, useState } from "react";
import { useCustomerNotifications } from "@/src/app/hooks/useCustomerNotifications";

/**
 * Example component showing how to use customer notifications
 * This would typically be used in a customer-facing app or page
 */
export default function CustomerNotificationExample() {
  const [customerId, setCustomerId] = useState<string>("");
  const [isEnabled, setIsEnabled] = useState(false);

  // Use the notification hook
  const { isConnected, notifications, clearNotifications } = useCustomerNotifications(
    isEnabled ? customerId : null,
    (notification) => {
      // Handle notification - you can show a toast, play a sound, etc.
      console.log("New notification received:", notification);
      
      if (notification.type === "basket_status_change") {
        // Show a toast notification or update UI
        alert(`Order #${notification.basketNumber} is now ${notification.newStatus}!`);
      }
    }
  );

  // Request browser notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Customer Notification Test</h1>

      <div className="mb-6 p-4 bg-white rounded-lg shadow">
        <h2 className="text-lg font-semibold mb-3">Setup</h2>
        
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Customer ID</label>
          <input
            type="text"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="Enter customer ID"
            className="w-full px-3 py-2 border rounded"
          />
        </div>

        <button
          onClick={() => setIsEnabled(!isEnabled)}
          disabled={!customerId}
          className={`px-4 py-2 rounded font-semibold ${
            isEnabled
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-green-500 hover:bg-green-600 text-white"
          } disabled:bg-gray-300 disabled:cursor-not-allowed`}
        >
          {isEnabled ? "Disable Notifications" : "Enable Notifications"}
        </button>

        <div className="mt-3 text-sm">
          <p>
            <strong>Connection Status:</strong>{" "}
            <span className={isConnected ? "text-green-600" : "text-red-600"}>
              {isConnected ? "Connected ✓" : "Disconnected ✗"}
            </span>
          </p>
        </div>
      </div>

      <div className="p-4 bg-white rounded-lg shadow">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Notifications</h2>
          <button
            onClick={clearNotifications}
            className="px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
          >
            Clear All
          </button>
        </div>

        {notifications.length === 0 ? (
          <p className="text-gray-500 text-center py-8">
            No notifications yet. Enable notifications and trigger a status change.
          </p>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification, index) => (
              <div
                key={index}
                className="p-3 border rounded bg-blue-50 border-blue-200"
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold">
                    Order #{notification.basketNumber}
                  </h3>
                  <span className="text-xs text-gray-500">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <p className="text-sm">
                  {notification.oldStatus ? (
                    <>
                      Status changed from{" "}
                      <span className="font-semibold">{notification.oldStatus}</span> to{" "}
                      <span className="font-semibold">{notification.newStatus}</span>
                    </>
                  ) : (
                    <>
                      Status: <span className="font-semibold">{notification.newStatus}</span>
                    </>
                  )}
                </p>
                {notification.orderId && (
                  <p className="text-xs text-gray-600 mt-1">
                    Order ID: {notification.orderId}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 p-4 bg-gray-100 rounded-lg">
        <h3 className="font-semibold mb-2">How to Test:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Enter a customer ID and enable notifications</li>
          <li>Go to the baskets page and find an order for this customer</li>
          <li>Click the "Notify" button when a basket is ready for pickup/delivery</li>
          <li>The notification will appear here and as a browser notification</li>
        </ol>
      </div>
    </div>
  );
}
