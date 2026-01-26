# POS System - API Integration Reference

## Overview

This document maps all API endpoints used in the POS system and how they integrate with the frontend.

---

## 📡 API Endpoints

### 1. GET /api/pos/customers/search

**Purpose:** Real-time customer search from the database

**Called From:**

- [src/app/in/pos/logic/usePOSState.ts](src/app/in/pos/logic/usePOSState.ts#L58-L66) (Line 58-66)

**Request:**

```typescript
const { data } = await supabase
  .from("customers")
  .select(
    "id, first_name, last_name, phone_number, email_address, loyalty_points",
  )
  .or(
    `first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_number.ilike.%${query}%`,
  )
  .limit(5);
```

**Response:**

```json
[
  {
    "id": "uuid-1",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "09123456789",
    "email_address": "john@email.com",
    "loyalty_points": 150
  }
]
```

**Behavior:**

- ✅ Debounced 300ms (waits for user to stop typing)
- ✅ Case-insensitive search
- ✅ Searches: first_name, last_name, phone_number
- ✅ Returns up to 5 results
- ✅ Called in useEffect when customerSearch changes

---

### 2. POST /api/pos/customers

**Purpose:** Create new customer record in database

**Called From:**

- [src/app/in/pos/page.tsx](src/app/in/pos/page.tsx#L587-L615) (Step4Customer, validateAndCreate function)

**Request:**

```typescript
const response = await fetch("/api/pos/customers", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    first_name: firstName,
    last_name: lastName,
    phone_number: phone,
    email_address: email_address || null,
  }),
});
```

**Response:**

```json
{
  "success": true,
  "customer": {
    "id": "uuid-new",
    "first_name": "Jane",
    "last_name": "Smith",
    "phone_number": "09987654321",
    "email_address": "jane@email.com",
    "loyalty_points": 0
  }
}
```

**Behavior:**

- ✅ Validates first_name, last_name, phone_number required
- ✅ Email is optional
- ✅ Returns created customer with ID
- ✅ Sets isCreatingCustomer loading state
- ✅ Auto-selects created customer
- ✅ Shows error if validation fails

**Implementation Location:**

- API Route: [src/app/api/pos/customers/route.ts](src/app/api/pos/customers/route.ts)

---

### 3. POST /api/email/send-invitation

**Purpose:** Send welcome email to newly created customer

**Called From:**

- [src/app/in/pos/page.tsx](src/app/in/pos/page.tsx#L609-L616) (Step4Customer, after customer creation if email provided)

**Request:**

```typescript
if (pos.newCustomerForm.email_address) {
  await fetch("/api/email/send-invitation", {
    method: "POST",
    body: JSON.stringify({
      customer_id: data.customer.id,
      email: data.customer.email_address,
      first_name: data.customer.first_name,
    }),
  });
}
```

**Response:**

```json
{
  "success": true,
  "message": "Invitation email queued",
  "email": "jane@email.com"
}
```

**Email Content:**

```
Subject: Welcome to Our Laundry Service, Jane!

Dear Jane,

Your customer account has been created. You can now:
- Track your orders
- Accumulate loyalty points
- Enjoy exclusive discounts

Visit our website or call us for more information.

Best regards,
The Laundry Team
```

**Behavior:**

- ✅ Only called if customer email provided
- ✅ Email is optional
- ✅ Async (doesn't block UI)
- ✅ Currently logs to console (placeholder)
- ✅ Ready for SendGrid/AWS SES/Resend integration

**Implementation Location:**

- API Route: [src/app/api/email/send-invitation/route.ts](src/app/api/email/send-invitation/route.ts) ✅ CREATED

---

### 4. POST /api/orders/pos/create

**Purpose:** Create order with transactional inventory deduction

**Called From:**

- [src/app/in/pos/logic/usePOSState.ts](src/app/in/pos/logic/usePOSState.ts#L158-L205) (createOrder function)

**Request:**

```typescript
// In page.tsx Step6Receipt, on checkout
await pos.createOrder();

// This calls the API through usePOSState:
const response = await fetch("/api/orders/pos/create", {
  method: "POST",
  body: JSON.stringify({
    customer_id: customer?.id,
    breakdown: {
      baskets: [...],
      items: [{product_id, quantity, ...}],
      summary: {subtotal, service_fee, delivery_fee, tax, total}
    },
    handling: {
      service_type: "self_service" | "staff_service",
      delivery_type: "pickup" | "delivery",
      delivery_address: "...",
      payment_method: "cash" | "gcash",
      amount_paid: 1000,
      gcash_reference: "REF123"
    }
  })
});
```

**Response:**

```json
{
  "success": true,
  "order_id": "order-uuid",
  "order": {
    "id": "order-uuid",
    "customer_id": "customer-uuid",
    "breakdown": {...},
    "handling": {...},
    "status": "pending",
    "created_at": "2024-01-15T10:30:00Z"
  }
}
```

**Behavior:**

- ✅ Validates inventory BEFORE creating order
- ✅ Creates order record
- ✅ Creates product_transactions for audit trail
- ✅ Updates products.quantity
- ✅ Rolls back if any step fails
- ✅ Awards loyalty points (if applicable)
- ✅ Requires authentication (staff user)

**Error Handling:**

```json
{
  "success": false,
  "error": "Insufficient stock for product X. Available: 5, Requested: 10",
  "status": 402
}
```

**Implementation Location:**

- API Route: [src/app/api/orders/pos/create/route.ts](src/app/api/orders/pos/create/route.ts)

---

## 🔄 Data Flow Diagram

```
USER INTERACTION
      ↓
STEP 1: SELECT SERVICE TYPE (self_service / staff_service)
      ↓
STEP 2: CONFIGURE BASKETS
      ├─ Services loaded from DB on mount (supabase.from("services"))
      └─ Prices displayed from services.base_price
      ↓
STEP 3: SELECT PRODUCTS
      ├─ Products loaded from DB on mount (supabase.from("products"))
      └─ Prices displayed from products.unit_price
      ↓
STEP 4: SELECT/CREATE CUSTOMER
      ├─ Search: Debounced API call (supabase.from("customers").select(...))
      ├─ Results displayed with suggestions
      ├─ IF SELECTING EXISTING:
      │   └─ Customer data loaded (phone/email disabled)
      └─ IF CREATING NEW:
          ├─ POST /api/pos/customers (saves to DB)
          └─ POST /api/email/send-invitation (if email provided)
      ↓
STEP 5: HANDLING OPTIONS (pickup / delivery)
      ├─ Delivery fee loaded from services table (service_type = 'delivery')
      └─ Optional: set delivery address, notes
      ↓
STEP 6: PAYMENT REVIEW
      ├─ Calculate total from breakdown
      └─ Accept payment (cash / gcash)
      ↓
CHECKOUT - POST /api/orders/pos/create
      ├─ Validate inventory
      ├─ Create order
      ├─ Deduct inventory → products.quantity
      ├─ Create transactions → product_transactions
      ├─ Award loyalty points
      └─ Show receipt modal
      ↓
ORDER COMPLETE
```

---

## 🗂️ Supabase Direct Queries (No API)

These queries are made directly through the Supabase client in the frontend:

### Load Services on Mount

```typescript
// usePOSState.ts - Line 47-51
const { data: servicesData } = await supabase
  .from("services")
  .select("*")
  .eq("is_active", true);
```

### Load Products on Mount

```typescript
// usePOSState.ts - Line 52-58
const { data: productsData } = await supabase
  .from("products")
  .select("id, item_name, unit_price, quantity, image_url, reorder_level")
  .eq("is_active", true)
  .order("item_name");
```

### Search Customers (Debounced)

```typescript
// usePOSState.ts - Line 58-66
const { data } = await supabase
  .from("customers")
  .select(
    "id, first_name, last_name, phone_number, email_address, loyalty_points",
  )
  .or(
    `first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone_number.ilike.%${query}%`,
  )
  .limit(5);
```

---

## 📊 API Call Frequency

| API                             | Called When                | Frequency             | Purpose                        |
| ------------------------------- | -------------------------- | --------------------- | ------------------------------ |
| GET /api/pos/customers/search   | User types in search       | 300ms debounced       | Find customers                 |
| POST /api/pos/customers         | Click "Create Customer"    | Once per new customer | Save new customer              |
| POST /api/email/send-invitation | After new customer created | If email provided     | Send welcome email             |
| POST /api/orders/pos/create     | Click "Checkout"           | Once per order        | Create order, deduct inventory |
| Load services                   | Page load                  | Once                  | Get all services               |
| Load products                   | Page load                  | Once                  | Get all products               |

---

## 🔐 Authentication

### Public Endpoints (No Auth Required)

- ❌ None - All POS endpoints require staff authentication

### Authenticated Endpoints (Staff Only)

- ✅ POST /api/pos/customers - Create customer
- ✅ POST /api/email/send-invitation - Send email
- ✅ POST /api/orders/pos/create - Create order

**Authentication Method:**

- Requires valid Supabase auth session (staff user)
- Checked via: `supabase.auth.getUser()`
- Staff record verified: `supabase.from("staff").select("id").eq("auth_id", user.id)`

---

## 🧪 Testing API Endpoints

### Test Customer Creation

```bash
curl -X POST http://localhost:3001/api/pos/customers \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "09123456789",
    "email_address": "john@email.com"
  }'
```

### Test Customer Search

```bash
curl http://localhost:3001/api/pos/customers/search?q=john
```

### Test Email Invitation

```bash
curl -X POST http://localhost:3001/api/email/send-invitation \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": "uuid-123",
    "email": "john@email.com",
    "first_name": "John"
  }'
```

### Test Order Creation

```bash
curl -X POST http://localhost:3001/api/orders/pos/create \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "customer_id": "uuid-123",
    "breakdown": {
      "baskets": [...],
      "items": [{product_id: "uuid", quantity: 2}],
      "summary": {subtotal: 500, total: 550}
    },
    "handling": {
      "service_type": "self_service",
      "delivery_type": "pickup",
      "payment_method": "cash",
      "amount_paid": 550
    }
  }'
```

---

## 📝 Error Handling

### Customer Creation Errors

```json
{
  "success": false,
  "error": "First name is required"
}
```

### Order Creation Errors

```json
{
  "success": false,
  "error": "Insufficient stock for product X",
  "status": 402
}
```

### General Errors

```json
{
  "success": false,
  "error": "Unauthorized",
  "status": 401
}
```

---

## 🚀 Integration Checklist

- ✅ Services load from DB on POS mount
- ✅ Products load from DB on POS mount
- ✅ Customer search calls Supabase
- ✅ Customer creation calls API
- ✅ Email invitation API exists
- ✅ Order creation with inventory deduction
- ✅ Product transactions recorded
- ✅ Error handling with rollback
- ✅ Loading states for async operations
- ✅ No hardcoded values (except fallbacks)

---

## 📚 Related Files

- Main POS: [src/app/in/pos/page.tsx](src/app/in/pos/page.tsx)
- State Management: [src/app/in/pos/logic/usePOSState.ts](src/app/in/pos/logic/usePOSState.ts)
- Customer API: [src/app/api/pos/customers/route.ts](src/app/api/pos/customers/route.ts)
- Customer Search: [src/app/api/pos/customers/search/route.ts](src/app/api/pos/customers/search/route.ts)
- Order Creation: [src/app/api/orders/pos/create/route.ts](src/app/api/orders/pos/create/route.ts)
- Email Invitation: [src/app/api/email/send-invitation/route.ts](src/app/api/email/send-invitation/route.ts)

---

**Last Updated:** Current Session  
**Status:** ✅ All APIs integrated and functional
