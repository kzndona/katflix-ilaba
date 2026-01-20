# Mobile App Order Creation - Debugging Guide

## API Endpoint

**Route**: `POST /api/orders/transactional-create`

**Purpose**: Creates an order and updates customer details in a single transaction

---

## Request Format

```json
{
  "customer": {
    "id": "customer-uuid",
    "phone_number": "+63912345678",
    "email_address": "customer@example.com"
  },
  "orderPayload": {
    "source": "app",
    "customer_id": "customer-uuid",
    "cashier_id": "staff-uuid",
    "status": "pending",
    "total_amount": 1250.50,
    "order_note": null,
    "breakdown": { ... },
    "handling": { ... }
  }
}
```

---

## Common Error Messages & Solutions

### 1. "Customer ID is required"

**What it means**: The `customer` object is missing or doesn't have an `id` field

**Debug info returned**:

```json
{
  "debug": {
    "customerReceived": boolean,
    "customerKeys": ["id", "phone_number", ...],
    "customerId": "value-or-null"
  }
}
```

**How to fix**:

1. Ensure customer is selected/created in your app before submitting order
2. Check that customer object has `id` field (UUID format)
3. Verify customer exists in database

**Mobile app code**:

```typescript
if (!customer?.id) {
  showError("Please select or create a customer first");
  return;
}

// Make sure to pass customer object:
const response = await fetch("/api/orders/transactional-create", {
  method: "POST",
  body: JSON.stringify({
    customer: {
      id: customer.id,  // ❌ Don't forget this
      phone_number: customer.phone_number,
      email_address: customer.email_address,
    },
    orderPayload: { ... }
  })
});
```

---

### 2. "Order payload is required"

**What it means**: The `orderPayload` object is missing from the request

**Debug info returned**:

```json
{
  "debug": {
    "receivedBodyKeys": ["customer"] // Shows what was received
  }
}
```

**How to fix**:

- Always send both `customer` and `orderPayload` in the request body

```typescript
// ✅ Correct
await fetch("/api/orders/transactional-create", {
  body: JSON.stringify({
    customer: { ... },
    orderPayload: { ... }
  })
});

// ❌ Wrong
await fetch("/api/orders/transactional-create", {
  body: JSON.stringify({ customer: { ... } })  // Missing orderPayload
});
```

---

### 3. "Failed to update customer details"

**What it means**: Customer exists but couldn't be updated with new phone/email

**Debug info returned**:

```json
{
  "errorCode": "PGRST123",
  "errorMessage": "Error message from database",
  "customerId": "the-id-we-tried"
}
```

**How to fix**:

1. Check that customer ID is a valid UUID format
2. Verify customer exists in database
3. Check Supabase connection permissions
4. Try with empty phone/email if uncertain:

```typescript
customer: {
  id: customer.id,
  phone_number: customer.phone_number || "",
  email_address: customer.email_address || "",
}
```

---

### 4. "Failed to create order" (from /api/orders endpoint)

**What it means**: Order payload is invalid or stock is insufficient

**Debug info returned**:

```json
{
  "error": "Insufficient stock for one or more items",
  "insufficientItems": [
    {
      "productId": "prod-123",
      "productName": "Detergent",
      "currentQuantity": 2,
      "requestedQuantity": 5
    }
  ],
  "debugInfo": {
    "endpointCalled": "/api/orders",
    "statusCode": 400,
    "responseKeys": ["success", "error", "insufficientItems"]
  }
}
```

**Common causes**:

1. **Insufficient stock** - Check available inventory before allowing order
2. **Missing required fields** - breakdown, handling, customer_id, cashier_id
3. **Invalid data format** - breakdown.items or baskets structure incorrect

**How to fix**:

```typescript
// Before creating order, validate:
if (!orderPayload.breakdown) {
  showError("Order breakdown is missing");
  return;
}

if (!orderPayload.handling) {
  showError("Handling information is missing");
  return;
}

if (!orderPayload.customer_id) {
  showError("Customer ID must be in order payload");
  return;
}

if (!orderPayload.cashier_id) {
  showError("Cashier ID must be in order payload");
  return;
}

// Check stock before submitting
const checkStockResponse = await fetch("/api/orders/validate-stock", {
  method: "POST",
  body: JSON.stringify({
    items: orderPayload.breakdown.items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
    })),
  }),
});

if (!checkStockResponse.ok) {
  const { insufficientItems } = await checkStockResponse.json();
  showError(
    `Insufficient stock: ${insufficientItems.map((i) => i.productName).join(", ")}`,
  );
  return;
}
```

---

### 5. "Order creation returned unexpected format"

**What it means**: Order was created but response doesn't have expected structure

**Debug info returned**:

```json
{
  "debugInfo": {
    "responseHasSuccess": boolean,
    "responseHasOrderId": boolean,
    "responseKeys": ["...keys from response"]
  }
}
```

**How to fix**:

- This is a backend issue - contact backend team
- Check server logs for what /api/orders endpoint is returning

---

### 6. "Internal server error during order creation"

**What it means**: Unexpected error occurred (network, JSON parsing, etc.)

**Debug info returned**:

```json
{
  "details": "error message",
  "errorType": "TypeError or other error class"
}
```

**How to fix**:

1. Check server logs for the full stack trace
2. Ensure valid JSON in request body
3. Check network connectivity
4. Verify all data types are correct

---

## Order Payload Structure

Required fields in `orderPayload`:

```typescript
orderPayload: {
  source: "app",                    // Required: "app" or "store"
  customer_id: string,              // Required: UUID
  cashier_id: string,               // Required: UUID (for mobile, this is manager approving)
  status: "pending" | "processing", // Required: "pending" for mobile orders
  total_amount: number,             // Required: Final price
  order_note: string | null,        // Optional
  breakdown: {
    items: Array,                   // Array of products ordered
    baskets: Array,                 // Array of laundry baskets with services
    fees: Array,                    // Delivery fee, service fee
    discounts: Array | null,        // Applied discounts
    summary: { ... },              // Price breakdown
    payment: { ... },              // Payment info
    audit_log: Array,              // Change history
  },
  handling: {
    pickup: { ... },               // Pickup details (status, address, etc.)
    delivery: { ... },             // Delivery details
  }
}
```

---

## Testing Checklist

When mobile app order creation fails:

- [ ] **Check browser console** for fetch error
- [ ] **Check network tab** - is request being sent? What's the response?
- [ ] **Log the request body** - print customer and orderPayload before sending
- [ ] **Verify customer object**:
  - [ ] Has `id` field (UUID format)
  - [ ] Has `phone_number` (string)
  - [ ] Has `email_address` (string)
- [ ] **Verify orderPayload**:
  - [ ] Has all required fields
  - [ ] `customer_id` matches customer.id
  - [ ] `breakdown` is not null and has correct structure
  - [ ] `handling` is not null and has correct structure
- [ ] **Check server logs**:
  - [ ] Search for "Transactional create request" - shows what was received
  - [ ] Look for error emoji (❌) messages for specific failures
  - [ ] Check /api/orders logs if order creation failed

---

## Logging Output

### Successful Flow

```
📥 Transactional create request: { hasCustomer: true, hasOrderPayload: true, customerId: "abc-123", source: "app", ... }
📝 Updating customer details: { customerId: "abc-123", hasPhoneNumber: true, hasEmail: true }
✅ Customer updated successfully
📦 Creating order: { customerId: "abc-123", cashierId: "staff-123", source: "app", status: "pending", ... }
✅ Order created successfully: { orderId: "order-123" }
```

### Failure Examples

```
❌ Customer validation failed: { customer: null, keys: "null" }
❌ Order payload missing: { body: { ... } }
❌ Customer update failed: { code: "PGRST401", message: "Unauthorized" }
❌ Order creation failed: { status: 400, error: "Insufficient stock" }
```

---

## Mobile App Implementation Example

```typescript
async function createOrder() {
  try {
    // 1. Validate customer
    if (!customer?.id) {
      throw new Error("Customer must be selected");
    }

    // 2. Build order payload
    const orderPayload = {
      source: "app",
      customer_id: customer.id,
      cashier_id: managerId, // Manager approving order
      status: "pending",
      total_amount: calculateTotal(),
      breakdown: buildBreakdown(),
      handling: buildHandling(),
    };

    // 3. Log for debugging
    console.log("📦 Sending order:", {
      customer: { id: customer.id },
      orderPayload,
    });

    // 4. Send request
    const response = await fetch("/api/orders/transactional-create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer: {
          id: customer.id,
          phone_number: customer.phone_number,
          email_address: customer.email_address,
        },
        orderPayload,
      }),
    });

    const data = await response.json();

    // 5. Handle response
    if (!response.ok) {
      console.error("❌ Order creation failed:", {
        status: response.status,
        error: data.error,
        debug: data.debug || data.debugInfo,
      });

      // Show user-friendly error
      if (data.insufficientItems) {
        showError(
          `Insufficient stock: ${data.insufficientItems.map((i) => i.productName).join(", ")}`,
        );
      } else if (data.error === "Customer ID is required") {
        showError("Please select a customer first");
      } else {
        showError(data.error || "Failed to create order");
      }
      return;
    }

    if (!data.success || !data.orderId) {
      console.error("❌ Unexpected response format:", data);
      showError("Order created but with unexpected response");
      return;
    }

    // 6. Success
    console.log("✅ Order created:", data.orderId);
    showSuccess("Order created successfully!");
    navigateTo(`/order/${data.orderId}`);
  } catch (err) {
    console.error("❌ Error:", err);
    showError(err instanceof Error ? err.message : "Unknown error");
  }
}
```

---

## Server Log Inspection

To debug issues, check Vercel/server logs for:

1. **Incoming request validation**:

   ```
   📥 Transactional create request: { ... }
   ```

2. **Customer update status**:

   ```
   📝 Updating customer details: { ... }
   ✅ Customer updated successfully
   // OR
   ❌ Customer update failed: { ... }
   ```

3. **Order creation status**:
   ```
   📦 Creating order: { ... }
   ✅ Order created successfully: { orderId: "..." }
   // OR
   ❌ Order creation failed: { ... }
   ```

---

**Last Updated**: 2026-01-21  
**API Endpoint**: `POST /api/orders/transactional-create`  
**Status**: Ready for debugging
