# Mobile App - Loading Basket Services & Products Information

## Overview

This guide explains how the mobile app should fetch, structure, and display basket and service information throughout the order workflow. The data architecture is hierarchical:

```
Order
├── Baskets (laundry batches)
│   ├── Services (wash, dry, fold, etc.)
│   │   └── Service Details (rate, premium, status)
│   └── Basket metadata (weight, notes, approval status)
└── Items (standalone products, not in baskets)
```

---

## Data Loading Architecture

### Phase 1: Order Creation (What User Sees)

When creating an order, the mobile app needs access to:

1. **Products list** - Available detergents, fabric softeners, etc.
2. **Services list** - Available services (wash, dry, fold) with pricing
3. **Service definitions** - What services exist and their rate types

**No database call needed yet** - These should be cached locally on app startup or fetched once.

### Phase 2: Order Submission (Send to Backend)

The mobile app creates baskets locally with:

- Basket weight
- Selected services (with multiplier/quantity)
- Selected products
- Notes

Then calls `POST /api/orders/transactional-create` with the complete order breakdown.

### Phase 3: Order Confirmation (After Backend Returns)

Backend returns the created order with:

- Order ID
- Status: "pending"
- Complete breakdown with items, baskets, services, fees
- GCash payment info placeholder
- Audit log entry

**This is the order to display to user.**

### Phase 4: Waiting for Approval

App polls or listens for:

- Push notification when cashier approves
- Or periodic check: `GET /api/orders/{orderId}` (if no push notifications yet)

### Phase 5: After Approval

Order status changes to "processing" and display:

- All baskets with approval_status: "approved"
- Receipt ready to email
- Order in workflow

---

## Required API Endpoints

### 1. Get Order Details (with Full Breakdown)

```
GET /api/orders/{orderId}
```

**Response**: Complete order object including:

- All baskets with services
- All items
- Payment info
- Approval status
- Audit log

**Used When**:

- Loading existing order for viewing
- Refreshing order status
- Fallback when push notifications unavailable

**Response Example**:

```json
{
  "id": "order-uuid-123",
  "status": "processing",
  "source": "app",
  "customer_id": "customer-uuid",
  "cashier_id": "staff-uuid",
  "approved_at": "2026-01-19T10:30:00Z",
  "total_amount": 1250.5,
  "breakdown": {
    "items": [
      {
        "id": "item-001",
        "product_id": "prod-detergent-001",
        "product_name": "Laundry Detergent",
        "quantity": 2,
        "unit_cost": 50.0,
        "unit_price": 75.0,
        "subtotal": 150.0,
        "discount": null
      }
    ],
    "baskets": [
      {
        "basket_number": 1,
        "weight": 5.5,
        "basket_notes": "Delicate items",
        "approval_status": "approved",
        "approved_at": "2026-01-19T10:30:00Z",
        "approved_by": "staff-uuid",
        "rejection_reason": null,
        "services": [
          {
            "id": "service-item-001",
            "service_id": "svc-wash-001",
            "service_name": "Washing Service",
            "is_premium": false,
            "multiplier": 1,
            "rate_per_kg": 20.0,
            "subtotal": 110.0,
            "status": "pending",
            "started_at": null,
            "completed_at": null,
            "completed_by": null,
            "duration_in_minutes": null
          },
          {
            "id": "service-item-002",
            "service_id": "svc-dry-001",
            "service_name": "Drying Service",
            "is_premium": true,
            "multiplier": 1,
            "rate_per_kg": 25.0,
            "subtotal": 137.5,
            "status": "pending",
            "started_at": null,
            "completed_at": null,
            "completed_by": null,
            "duration_in_minutes": null
          }
        ],
        "total": 247.5
      },
      {
        "basket_number": 2,
        "weight": 3.2,
        "basket_notes": null,
        "approval_status": "approved",
        "approved_at": "2026-01-19T10:30:00Z",
        "approved_by": "staff-uuid",
        "rejection_reason": null,
        "services": [
          {
            "id": "service-item-003",
            "service_id": "svc-wash-001",
            "service_name": "Washing Service",
            "is_premium": false,
            "multiplier": 1,
            "rate_per_kg": 20.0,
            "subtotal": 64.0,
            "status": "pending",
            "started_at": null,
            "completed_at": null,
            "completed_by": null,
            "duration_in_minutes": null
          }
        ],
        "total": 64.0
      }
    ],
    "fees": [
      {
        "id": "fee-001",
        "type": "handling_fee",
        "description": "Delivery Fee",
        "amount": 50.0
      }
    ],
    "summary": {
      "subtotal_products": 150.0,
      "subtotal_services": 311.5,
      "handling": 50.0,
      "service_fee": null,
      "discounts": 0,
      "vat_rate": 12,
      "vat_amount": 91.38,
      "vat_model": "inclusive",
      "grand_total": 1020.38
    },
    "payment": {
      "method": "gcash",
      "amount_paid": 1020.38,
      "change": 0,
      "reference_number": "GCash-REF-12345",
      "payment_status": "successful",
      "completed_at": "2026-01-19T10:25:00Z",
      "gcash_receipt": {
        "verified": true,
        "screenshot_url": null
      }
    },
    "audit_log": [
      {
        "action": "created",
        "timestamp": "2026-01-19T10:15:00Z",
        "changed_by": "customer-uuid",
        "details": {
          "source": "mobile app",
          "customer_phone": "+63912345678"
        }
      },
      {
        "action": "order_approved",
        "timestamp": "2026-01-19T10:30:00Z",
        "changed_by": "staff-uuid",
        "details": {
          "gcash_verified": true,
          "baskets_approved": 2
        }
      }
    ]
  }
}
```

### 2. Get Basket Status (Quick Check)

```
GET /api/orders/{orderId}/baskets
```

**Response**: Lightweight basket array with status info only

```json
[
  {
    "basket_number": 1,
    "weight": 5.5,
    "approval_status": "approved",
    "services_count": 2,
    "completed_services": 0,
    "total_subtotal": 247.5
  },
  {
    "basket_number": 2,
    "weight": 3.2,
    "approval_status": "approved",
    "services_count": 1,
    "completed_services": 0,
    "total_subtotal": 64.0
  }
]
```

**Used When**:

- Quick status check (less data transfer)
- Polling for progress updates
- Showing basket summary list

---

## Data Loading Flow by Screen

### Order Creation Screen

**Data Needed**:

- Services list (all available services)
- Products list (available add-on products)

**Loading Strategy**:

```typescript
// On app startup or first load
const services = await fetchServices(); // One-time fetch, cache locally
const products = await fetchProducts(); // One-time fetch, cache locally

// Store in local state/Redux/Zustand
```

**No API calls needed after first load** - Use cached data.

### Order Review Screen (Before Submission)

**Data Already Available**:

- User's inputs (baskets, services, products selected)
- Service details from cache

**Display Logic**:

```typescript
// For each basket
breakdown.baskets.forEach((basket) => {
  // Basket weight
  // For each service in basket
  basket.services.forEach((service) => {
    // Get service details from cached services list
    const serviceDetails = cachedServices.find(
      (s) => s.id === service.service_id,
    );
    // Display: service_name, rate_per_kg, multiplier, subtotal
  });
});

// For items (standalone products)
breakdown.items.forEach((item) => {
  // Display: product_name, quantity, unit_price, subtotal
});
```

### Order Confirmation Screen (After Submission)

**Data Received From Backend** (in POST response):

- Created order object with all breakdown data
- Status: "pending"
- Created_at timestamp

**Display Logic**:

```typescript
const order = response.order;

// Show baskets with services
order.breakdown.baskets.forEach((basket) => {
  console.log(`Basket ${basket.basket_number}:`);
  console.log(`  Weight: ${basket.weight}kg`);
  console.log(`  Status: ${basket.approval_status}`);

  basket.services.forEach((service) => {
    console.log(`  - ${service.service_name}`);
    console.log(`    Rate: ₱${service.rate_per_kg}/kg`);
    console.log(`    Subtotal: ₱${service.subtotal}`);
  });
});

// Show standalone items
order.breakdown.items.forEach((item) => {
  console.log(`${item.product_name}: ${item.quantity}x ₱${item.unit_price}`);
});

// Show summary
console.log(`Total: ₱${order.breakdown.summary.grand_total}`);
```

### Order Status Screen (Waiting for Approval)

**Data Needed**:

- Current order details
- Update frequency

**Loading Strategy**:

```typescript
// Option 1: Push notifications (preferred)
setupPushNotificationListener((notification) => {
  if (notification.type === "order_approved") {
    // Refresh order details
    const updatedOrder = await fetchOrder(orderId);
    displayApprovedOrder(updatedOrder);
  }
});

// Option 2: Polling (fallback)
const pollInterval = setInterval(async () => {
  const updatedOrder = await fetchOrder(orderId);
  if (updatedOrder.status !== "pending") {
    clearInterval(pollInterval);
    displayApprovedOrder(updatedOrder);
  }
}, 5000); // Poll every 5 seconds
```

### Order Processing Screen (After Approval)

**Data Displayed**:

- All baskets with `approval_status: "approved"`
- All services with `status: "pending"`
- Receipt summary

**Loading Strategy**:

```typescript
const order = await fetchOrder(orderId);

// Display approval info
console.log(`Approved at: ${order.approved_at}`);
console.log(`Approved by: ${order.cashier_id}`);

// Show baskets
order.breakdown.baskets.forEach((basket) => {
  console.log(`Basket ${basket.basket_number} - ${basket.approval_status}`);
  console.log(`  Approved: ${basket.approved_at}`);

  // Show services with current status
  basket.services.forEach((service) => {
    console.log(`  - ${service.service_name}: ${service.status}`);
    if (service.completed_at) {
      console.log(`    Completed: ${service.completed_at}`);
    }
  });
});
```

---

## Real-Time Updates Strategy

### Recommended: Push Notifications

When order state changes, backend sends push notification:

```json
{
  "type": "order_status_changed",
  "orderId": "order-uuid",
  "status": "processing",
  "message": "Order Approved! Processing started.",
  "timestamp": "2026-01-19T10:30:00Z"
}
```

**Mobile App Action**:

```typescript
messaging.onMessage((message) => {
  if (message.data.type === "order_status_changed") {
    // Refresh order details
    const order = await fetchOrder(message.data.orderId);
    updateOrderDisplay(order);
  }
});
```

### Fallback: Polling

If push notifications unavailable:

```typescript
// Poll every 5-10 seconds while order is "pending"
let pollInterval;

function startPolling(orderId) {
  pollInterval = setInterval(async () => {
    try {
      const order = await fetchOrder(orderId);

      if (order.status !== "pending") {
        // Approval received!
        clearInterval(pollInterval);
        displayApprovedOrder(order);
      }
    } catch (error) {
      console.error("Polling failed:", error);
    }
  }, 5000);
}

function stopPolling() {
  if (pollInterval) {
    clearInterval(pollInterval);
  }
}
```

---

## Caching Strategy

### What to Cache Locally

**On App Startup**:

```typescript
// Fetch once, cache for session
const services = await fetchServices();
localStorage.setItem("services", JSON.stringify(services));

const products = await fetchProducts();
localStorage.setItem("products", JSON.stringify(products));
```

**Why**: Services and products rarely change, no need to refetch constantly.

### What NOT to Cache

- Order details - Always fetch from server (can change via cashier actions)
- Order status - Always fetch/poll (changes in real-time)

### Cache Invalidation

```typescript
// Invalidate when:
// 1. User manually refreshes
// 2. App returns to foreground
// 3. Order is approved (fetch full details)

app.onFocus(() => {
  // Refresh order details if app was in background
  if (currentOrderId) {
    const order = await fetchOrder(currentOrderId);
    updateDisplay(order);
  }
});
```

---

## Code Examples

### React/TypeScript Example

```typescript
import { useEffect, useState } from 'react';

interface Basket {
  basket_number: number;
  weight: number;
  approval_status: 'pending' | 'approved' | 'rejected';
  services: Service[];
}

interface Service {
  id: string;
  service_id: string;
  service_name: string;
  rate_per_kg: number;
  subtotal: number;
  status: string;
  completed_at?: string;
}

interface Order {
  id: string;
  status: string;
  breakdown: {
    baskets: Basket[];
    items: any[];
    summary: any;
  };
}

export function OrderDetailsScreen({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    loadOrder();

    // Start polling while pending
    let pollInterval: NodeJS.Timeout;
    if (order?.status === 'pending') {
      pollInterval = setInterval(loadOrder, 5000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [orderId, order?.status]);

  async function loadOrder() {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      const data = await response.json();
      setOrder(data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to load order:', error);
    }
  }

  if (loading) return <div>Loading...</div>;
  if (!order) return <div>Order not found</div>;

  return (
    <div>
      <h1>Order #{orderId.slice(0, 8)}</h1>
      <p>Status: {order.status}</p>

      <h2>Baskets</h2>
      {order.breakdown.baskets.map(basket => (
        <div key={basket.basket_number}>
          <h3>Basket {basket.basket_number}</h3>
          <p>Weight: {basket.weight}kg</p>
          <p>Status: {basket.approval_status}</p>

          <h4>Services</h4>
          <ul>
            {basket.services.map(service => (
              <li key={service.id}>
                {service.service_name}
                <br />
                Rate: ₱{service.rate_per_kg}/kg
                <br />
                Subtotal: ₱{service.subtotal}
                <br />
                Progress: {service.status}
              </li>
            ))}
          </ul>
        </div>
      ))}

      <h2>Total: ₱{order.breakdown.summary.grand_total}</h2>
    </div>
  );
}
```

### Flutter Example

```dart
class BasketDetailsWidget extends StatefulWidget {
  final String orderId;

  @override
  State<BasketDetailsWidget> createState() => _BasketDetailsWidgetState();
}

class _BasketDetailsWidgetState extends State<BasketDetailsWidget> {
  late Future<Order> orderFuture;
  Timer? pollTimer;

  @override
  void initState() {
    super.initState();
    orderFuture = fetchOrder(widget.orderId);
    startPolling();
  }

  void startPolling() {
    pollTimer = Timer.periodic(Duration(seconds: 5), (_) {
      setState(() {
        orderFuture = fetchOrder(widget.orderId);
      });
    });
  }

  @override
  void dispose() {
    pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<Order>(
      future: orderFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return CircularProgressIndicator();
        }

        if (!snapshot.hasData) {
          return Text('Order not found');
        }

        final order = snapshot.data!;

        return ListView(
          children: [
            Text('Order #${order.id}'),
            Text('Status: ${order.status}'),
            ...order.breakdown.baskets.map((basket) {
              return BasketTile(basket: basket);
            }).toList(),
            Text('Total: ₱${order.breakdown.summary.grandTotal}'),
          ],
        );
      },
    );
  }
}

class BasketTile extends StatelessWidget {
  final Basket basket;

  const BasketTile({required this.basket});

  @override
  Widget build(BuildContext context) {
    return ExpansionTile(
      title: Text('Basket ${basket.basketNumber}'),
      subtitle: Text('${basket.weight}kg - ${basket.approvalStatus}'),
      children: [
        ...basket.services.map((service) {
          return ListTile(
            title: Text(service.serviceName),
            subtitle: Text('₱${service.ratePerKg}/kg → ₱${service.subtotal}'),
            trailing: Chip(label: Text(service.status)),
          );
        }).toList(),
      ],
    );
  }
}
```

---

## Error Handling

### Network Errors

```typescript
async function fetchOrderWithRetry(orderId: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(`/api/orders/${orderId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Wait before retrying (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, i)),
      );
    }
  }
}
```

### Order Not Found

```typescript
try {
  const order = await fetchOrder(orderId);
  displayOrder(order);
} catch (error) {
  if (error.status === 404) {
    showError("Order not found. Please check the order ID.");
  } else {
    showError("Failed to load order. Please try again.");
  }
}
```

### Approval Rejection

```typescript
// Listen for rejection in push notification
messaging.onMessage((message) => {
  if (message.data.type === "order_rejected") {
    showAlert({
      title: "Order Rejected",
      message: message.data.reason,
      action: () => {
        // Show retry or cancel options
      },
    });
  }
});
```

---

## Performance Tips

1. **Lazy Load Baskets**: Only load full basket details when user taps on basket
2. **Image Optimization**: Cache service/product images locally
3. **Pagination**: If order has many baskets, paginate or virtualize list
4. **Debounce Polling**: Stop polling immediately when approved (don't wait for next interval)
5. **Background Fetch**: Use background task to check status every 60 seconds
6. **Reduce Payload**: Use lightweight `/api/orders/{id}/baskets` endpoint for quick checks

---

## Testing Checklist

- [ ] Load order immediately after creation
- [ ] Display all baskets and their services correctly
- [ ] Show correct pricing (rate_per_kg × weight)
- [ ] Handle network errors gracefully
- [ ] Poll correctly until approval (no duplicate polls)
- [ ] Stop polling immediately upon approval
- [ ] Display "Order Approved" within 1 second of receiving notification
- [ ] Refresh on app foreground return
- [ ] Cache services/products data
- [ ] Handle rejection with user-friendly message
- [ ] Show real-time service status updates

---

**Created**: 2026-01-19  
**Last Updated**: 2026-01-19  
**For**: Mobile App Development Team  
**Status**: Ready for implementation
