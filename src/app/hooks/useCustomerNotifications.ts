import { useEffect, useRef, useState } from "react";
import { createClient } from "@/src/app/utils/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

export type BasketStatusChangeNotification = {
  type: "basket_status_change";
  basketId: string;
  basketNumber: number | string;
  orderId: string | null;
  oldStatus: string | null;
  newStatus: string;
  timestamp: string;
};

export type NotificationPayload = BasketStatusChangeNotification;

/**
 * Custom hook for subscribing to customer notifications via Supabase Realtime
 * @param customerId - The customer ID to subscribe to notifications for
 * @param onNotification - Callback function when a notification is received
 */
export function useCustomerNotifications(
  customerId: string | null | undefined,
  onNotification?: (notification: NotificationPayload) => void
) {
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState<NotificationPayload[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const supabaseRef = useRef(createClient());

  useEffect(() => {
    if (!customerId) {
      return;
    }

    const supabase = supabaseRef.current;
    const channelName = `customer_notifications:${customerId}`;

    // Create and subscribe to channel
    const channel = supabase
      .channel(channelName, {
        config: {
          broadcast: { self: true }, // Allow receiving own broadcasts for testing
        },
      })
      .on("broadcast", { event: "notification" }, (payload) => {
        console.log("Notification received:", payload);
        
        const notification = payload.payload as NotificationPayload;
        
        // Add to notifications list
        setNotifications((prev) => [notification, ...prev]);
        
        // Call callback if provided
        if (onNotification) {
          onNotification(notification);
        }

        // Show browser notification if supported
        if (notification.type === "basket_status_change") {
          showBrowserNotification(notification);
        }
      })
      .subscribe((status) => {
        console.log(`Realtime subscription status: ${status}`);
        setIsConnected(status === "SUBSCRIBED");
      });

    channelRef.current = channel;

    // Cleanup on unmount
    return () => {
      console.log("Unsubscribing from notifications");
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [customerId, onNotification]);

  return {
    isConnected,
    notifications,
    clearNotifications: () => setNotifications([]),
  };
}

/**
 * Show a browser push notification
 */
function showBrowserNotification(notification: BasketStatusChangeNotification) {
  // Check if browser supports notifications
  if (!("Notification" in window)) {
    return;
  }

  // Request permission if not granted
  if (Notification.permission === "default") {
    Notification.requestPermission().then((permission) => {
      if (permission === "granted") {
        displayNotification(notification);
      }
    });
  } else if (Notification.permission === "granted") {
    displayNotification(notification);
  }
}

function displayNotification(notification: BasketStatusChangeNotification) {
  const getStatusEmoji = (status: string) => {
    const statusMap: Record<string, string> = {
      'ready': '🎉',
      'prepared': '✨',
      'completed': '✅',
      'delivering': '🚚',
      'delivered': '🎁',
      'pick-up': '📍',
      'preparing': '🧵',
      'washing': '🧼',
      'drying': '🌬️',
      'ironing': '👔',
      'packaging': '📦',
    };
    return statusMap[status.toLowerCase()] || '📄';
  };

  const statusEmoji = getStatusEmoji(notification.newStatus);
  const title = `${statusEmoji} Your Order #${notification.basketNumber} Updated!`;
  
  const body = notification.oldStatus
    ? `Your order has progressed from *${notification.oldStatus}* → *${notification.newStatus}*. Tap to see details!`
    : `Great news! Your order is now *${notification.newStatus}*. Things are moving along nicely!`;

  const notif = new Notification(title, {
    body,
    icon: "/images/logo.png", // Update with your logo path
    badge: "/images/badge.png", // Update with your badge path
    tag: `basket-${notification.basketId}`, // Prevent duplicate notifications
    data: {
      basketId: notification.basketId,
      orderId: notification.orderId,
      url: `/orders/${notification.orderId}`, // Deep link to order page
    },
  });

  // Handle notification click
  notif.onclick = function (event) {
    event.preventDefault();
    window.focus();
    // Navigate to order page if URL is available
    if (notif.data?.url) {
      window.location.href = notif.data.url;
    }
  };
}
