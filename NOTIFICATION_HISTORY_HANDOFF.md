# Notification History Feature - Customer App Integration Guide

## Overview

The server now maintains a complete notification history in the database and exposes APIs for the customer app to:

1. **Fetch notification history** with filtering & pagination
2. **Mark notifications as read** (track engagement)
3. **Delete/clear notifications**
4. **Bulk mark as read** (clear all notifications)

---

## Database Schema

**Table:** `notifications`

```sql
{
  id: UUID (Primary Key)
  customer_id: UUID (Foreign Key → customers.id)
  order_id: UUID (Foreign Key → orders.id)
  basket_number: INTEGER (nullable - for basket-level notifications)

  type: VARCHAR (50)  -- 'pickup', 'delivery', 'service_update', 'order_status', 'general'
  title: VARCHAR (255) -- Notification title (e.g., "📍 Pickup in Progress")
  body: TEXT -- Notification body/message
  data: JSONB -- Flexible metadata (service_type, action, etc.)

  status: VARCHAR (20) -- 'sent', 'delivered', 'read', 'failed'
  read_at: TIMESTAMP (nullable) -- When user marked as read
  clicked_at: TIMESTAMP (nullable) -- When user clicked/opened

  created_at: TIMESTAMP
  updated_at: TIMESTAMP (auto-updated on any change)
}
```

---

## API Endpoints

### 1️⃣ GET /api/notifications

**Fetch notification history for authenticated customer**

#### Request

```typescript
// GET /api/notifications?page=1&limit=20&type=pickup&status=read
// All query parameters are optional

interface QueryParams {
  page?: number; // default: 1
  limit?: number; // default: 20, max: 100
  type?: string; // 'pickup' | 'delivery' | 'service_update' | 'order_status' | 'general'
  status?: string; // 'sent' | 'delivered' | 'read' | 'failed'
  orderId?: string; // UUID of specific order
  startDate?: string; // ISO date string (e.g., "2026-02-01T00:00:00Z")
  endDate?: string; // ISO date string
}
```

#### Response

```typescript
{
  success: boolean;
  data: Notification[];  // Array of notifications
  pagination: {
    page: number;
    limit: number;
    total: number;         // Total notifications matching filters
    totalPages: number;
  };
}
```

#### Example Usage (React/TypeScript)

```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase'; // Your Supabase client

type Notification = {
  id: string;
  type: 'pickup' | 'delivery' | 'service_update' | 'order_status' | 'general';
  title: string;
  body: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  read_at: string | null;
  clicked_at: string | null;
  basket_number: number | null;
  order_id: string;
  created_at: string;
  data: Record<string, any>;
};

export function NotificationHistory() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    fetchNotifications();
  }, [page]);

  async function fetchNotifications() {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        // Optional filters:
        // type: 'pickup',
        // status: 'read',
        // startDate: new Date(Date.now() - 7*24*60*60*1000).toISOString(),
      });

      const response = await fetch(`/api/notifications?${query}`, {
        headers: {
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        }
      });

      const result = await response.json();
      setNotifications(result.data);
      setTotalPages(result.pagination.totalPages);
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Notification History</h2>

      {notifications.length === 0 ? (
        <p className="text-gray-500">No notifications yet</p>
      ) : (
        <div className="space-y-3">
          {notifications.map((notif) => (
            <NotificationItem key={notif.id} notification={notif} />
          ))}
        </div>
      )}

      {/* Pagination */}
      <div className="flex gap-2 justify-center">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          Previous
        </button>
        <span>Page {page} of {totalPages}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          disabled={page >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function NotificationItem({ notification }: { notification: Notification }) {
  const handleMarkAsRead = async (id: string) => {
    const response = await fetch(`/api/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'read' }),
    });
    if (response.ok) {
      // Update UI to reflect read status
    }
  };

  return (
    <div
      className={`p-4 border rounded-lg ${
        notification.status === 'read' ? 'bg-gray-50' : 'bg-blue-50 border-blue-200'
      }`}
      onClick={() => handleMarkAsRead(notification.id)}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <h3 className="font-semibold">{notification.title}</h3>
          <p className="text-sm text-gray-700">{notification.body}</p>
          <div className="flex gap-2 mt-2 text-xs text-gray-500">
            <span>📅 {new Date(notification.created_at).toLocaleString()}</span>
            {notification.basket_number && (
              <span>🧺 Basket #{notification.basket_number}</span>
            )}
            {notification.status === 'read' && (
              <span className="text-green-600">✓ Read</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
```

---

### 2️⃣ PATCH /api/notifications/{id}/read

**Mark a single notification as read or clicked**

#### Request

```typescript
{
  action: "read" | "click";
  // 'read' = user viewed the notification
  // 'click' = user clicked/opened the notification
}
```

#### Response

```typescript
{
  success: boolean;
  message: string; // "Notification marked as read"
}
```

#### Example

```typescript
// Mark as read
async function markAsRead(notificationId: string) {
  const response = await fetch(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "read" }),
  });
  return response.json();
}

// Mark as clicked (when user taps to view order details)
async function markAsClicked(notificationId: string) {
  await fetch(`/api/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "click" }),
  });
}
```

---

### 3️⃣ POST /api/notifications/mark-all-as-read

**Mark all unread notifications as read**

#### Request

```typescript
{
  action: "mark-all-as-read";
}
```

#### Response

```typescript
{
  success: boolean;
  message: "All notifications marked as read";
}
```

#### Example

```typescript
async function markAllAsRead() {
  const response = await fetch("/api/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "mark-all-as-read" }),
  });
  return response.json();
}
```

---

### 4️⃣ DELETE /api/notifications/{id}

**Delete a single notification**

#### Request

```
DELETE /api/notifications/{notificationId}
```

#### Response

```typescript
{
  success: boolean;
  message: "Notification deleted";
}
```

#### Example

```typescript
async function deleteNotification(notificationId: string) {
  const response = await fetch(`/api/notifications/${notificationId}`, {
    method: "DELETE",
  });
  return response.json();
}
```

---

## Notification Types & Examples

### Type: `pickup`

```typescript
{
  type: 'pickup',
  title: '📍 Pickup in Progress',
  body: 'We\'ve started picking your order. Hang tight—almost ready!',
  metadata: {
    handlingType: 'pickup',
    action: 'start',
    status: 'in_progress',
  }
}

// When complete:
{
  type: 'pickup',
  title: '✔️ Pickup Complete',
  body: 'Your order is now ready to collect.',
  metadata: {
    handlingType: 'pickup',
    action: 'complete',
    status: 'completed',
  }
}
```

### Type: `delivery`

```typescript
{
  type: 'delivery',
  title: '🚚 Delivery Started',
  body: 'Your order is on its way! Our driver is heading to you.',
  metadata: {
    handlingType: 'delivery',
    action: 'start',
  }
}

// When complete:
{
  type: 'delivery',
  title: '✅ Successfully Delivered',
  body: 'Your order has been delivered successfully. Thank you!',
  metadata: {
    handlingType: 'delivery',
    action: 'complete',
  }
}
```

### Type: `service_update`

```typescript
{
  type: 'service_update',
  title: '🧼 Basket #1 - Washing Started',
  body: 'We\'re now washing your items with care. Quality service in progress!',
  basket_number: 1,
  metadata: {
    service_type: 'wash',
    action: 'start',
  }
}

// When complete:
{
  type: 'service_update',
  title: '✨ Basket #1 - Washing Complete',
  body: 'Your items are being dried next.',
  basket_number: 1,
  metadata: {
    service_type: 'wash',
    action: 'complete',
  }
}
```

---

## UI Implementation Recommendations

### Notification List Screen

```
┌─────────────────────────────────────────┐
│ Notification History                    │
│ [Mark All as Read]                      │
├─────────────────────────────────────────┤
│ 🎉 Your Order #1 Updated!         2min  │
│ Great news! Your order has progressed   │
│ from preparing → ready.                 │
│ [Time: 14:30] [Status: Unread] [×]      │
├─────────────────────────────────────────┤
│ ✨ Basket #2 - Washing Complete  1 hour │
│ Your items are being dried next.        │
│ [Basket #2]                             │
├─────────────────────────────────────────┤
│ [← Previous] [Page 1 of 5] [Next →]    │
└─────────────────────────────────────────┘
```

### Features to Implement

✅ **Infinite scroll or pagination** - Load notifications as user scrolls  
✅ **Group by date** - "Today", "Yesterday", "This week"  
✅ **Filter by type** - Pickup, Delivery, Service Updates, All  
✅ **Mark unread badge** - Show count of unread notifications  
✅ **Swipe to delete** - Native mobile experience  
✅ **Tap to view order** - Navigate to order details when clicked  
✅ **Timestamps** - "2 minutes ago", "1 hour ago"  
✅ **Empty state** - Show message when no notifications

---

## Implementation Checklist

- [ ] Create `NotificationHistory.tsx` component
- [ ] Set up API hooks/services for notifications
- [ ] Implement notification list rendering
- [ ] Add pagination/infinite scroll
- [ ] Add filter buttons (by type/status)
- [ ] Implement mark as read on tap
- [ ] Add delete/swipe functionality
- [ ] Add "Mark all as read" button
- [ ] Test with real notification data
- [ ] Style according to app design system
- [ ] Add loading states
- [ ] Add error handling

---

## Error Handling

```typescript
// Handle common errors
const handleNotificationError = (error: any) => {
  if (error.status === 401) {
    // User not authenticated - redirect to login
  } else if (error.status === 404) {
    // Notification not found - likely deleted
    refetchNotifications();
  } else if (error.status === 403) {
    // Forbidden - user doesn't own this notification
  } else {
    // General error
    console.error("Notification error:", error);
  }
};
```

---

## Testing Checklist

- [ ] Create test notifications via admin panel
- [ ] Verify fetch returns correct data with filters
- [ ] Verify pagination works correctly
- [ ] Verify mark as read updates status
- [ ] Verify delete removes notification
- [ ] Verify read_at and clicked_at timestamps are set
- [ ] Verify RLS (only own notifications visible)
- [ ] Test with slow network (loading states)
- [ ] Test with empty notification list
- [ ] Test with large number of notifications (100+)

---

## Questions for the Customer App Dev Team?

If you have any questions or run into issues, check:

1. Network tab in DevTools to verify API responses
2. Supabase Dashboard → notifications table to see actual records
3. Browser console for any error messages
4. Verify authentication is working (check auth.uid())

Good luck with the implementation! 🚀
