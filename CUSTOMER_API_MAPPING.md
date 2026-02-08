# Customer API Usage Mapping

## Overview

This document maps customer creation and update operations across different features to identify which APIs are used and detect any inconsistencies.

**Last Updated:** February 7, 2026  
**Status:** ✅ Analysis Complete

---

## 1. API Endpoints Summary

### Three Customer Management APIs Exist

| Endpoint                          | Purpose                     | Creates Auth User | Update Support      | Used By        |
| --------------------------------- | --------------------------- | ----------------- | ------------------- | -------------- |
| `POST /api/pos/customers`         | POS customer create/update  | ❌ No             | ✅ Yes (id check)   | POS Page       |
| `POST /api/customer/saveCustomer` | Account customers page save | ✅ Yes            | ✅ Yes              | Customers Page |
| `POST /api/customers/create`      | Mobile order creation       | ❌ No             | ❌ No (create only) | Mobile Orders  |

---

## 2. Feature Usage Breakdown

### 2.1 POS Page - Create Customer (`/api/pos/customers`)

**Location:** `src/app/in/pos/page.tsx` (lines 600-665)

**When Used:**

- User clicks "Create New Customer" in Step 2 (Customer Selection)
- Validates: first_name, last_name, phone_number, email (optional)

**API Endpoint:** `POST /api/pos/customers`

**Request Payload:**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "09123456789",
  "email_address": "john@example.com" // optional
}
```

**Response:**

```json
{
  "success": true,
  "customer": {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "09123456789",
    "email_address": "john@example.com"
  }
}
```

**Key Behavior:**

- Does NOT create auth user
- Creates customer with loyalty_points = 0
- Sends invitation email via `/api/email/send-invitation` if email provided
- Automatically selects customer after creation

**Location of API:** `src/app/api/pos/customers/route.ts`

---

### 2.2 POS Page - Update Customer (via POS Search)

**Location:** `src/app/in/pos/page.tsx` (lines 677+)

**When Used:**

- User updates phone or email while searching for existing customer in Step 2
- Uses same `/api/pos/customers` endpoint

**Same API:** `POST /api/pos/customers` (with `id` field)

**Request Payload for Update:**

```json
{
  "id": "customer-uuid",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "09123456789",
  "email_address": "john@example.com"
}
```

**Key Behavior:**

- Checks if `id` field exists
- If id exists → UPDATE existing customer
- If no id → CREATE new customer
- No auth user creation in either case

---

### 2.3 Customers Page - Create/Update Customer (`/api/customer/saveCustomer`)

**Location:** `src/app/in/accounts/customers/page.tsx` (lines 150-190)

**When Used:**

- Click "Add" button to create new customer
- Click "Edit" to modify existing customer
- Uses same endpoint for both operations

**API Endpoint:** `POST /api/customer/saveCustomer`

**Request Payload:**

```json
{
  "id": null, // null for new customer
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "09123456789",
  "email_address": "john@example.com",
  "middle_name": null,
  "birthdate": null,
  "gender": null,
  "address": null,
  "loyalty_points": 0
}
```

**Key Differences from POS:**

- **Creates Auth User:** ✅ Yes (invites via email if email provided)
- **More Fields:** middle_name, birthdate, gender, address, loyalty_points
- **Handles Auth Invitation:** Explicitly creates Supabase auth user with invitation

**Location of API:** `src/app/api/customer/saveCustomer/route.ts`

---

### 2.4 Mobile Order Creation - Create Customer (`/api/customers/create`)

**Location:** `src/app/api/orders/mobile/create/route.ts` (embedded customer creation)

**When Used:**

- Mobile orders require customer data (no existing customer lookup)
- Embedded in order creation workflow

**API Endpoint:** `POST /api/customers/create`

**Request Payload:**

```json
{
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "09123456789",
  "email": "john@example.com" // Note: 'email' not 'email_address'
}
```

**Key Differences:**

- Does NOT create auth user
- Simple insert only
- Field naming inconsistency: `email` (not `email_address`)
- Returns customer object on success

**Location of API:** `src/app/api/customers/create/route.ts`

---

## 3. API Comparison Matrix

### Request Field Mapping

| Field            | POS Customers | Customers Page          | Mobile Create     |
| ---------------- | ------------- | ----------------------- | ----------------- |
| `id`             | ✅ (optional) | ✅ (optional)           | ❌ Not used       |
| `first_name`     | ✅            | ✅                      | ✅                |
| `last_name`      | ✅            | ✅                      | ✅                |
| `phone_number`   | ✅            | ✅                      | ✅                |
| `email_address`  | ✅            | ✅                      | ❌ (uses `email`) |
| `middle_name`    | ❌            | ✅                      | ❌                |
| `birthdate`      | ❌            | ✅                      | ❌                |
| `gender`         | ❌            | ✅                      | ❌                |
| `address`        | ❌            | ✅                      | ❌                |
| `loyalty_points` | ❌            | ✅ (preserve on update) | ❌                |

### Functionality Comparison

| Feature            | POS Customers    | Customers Page | Mobile Create |
| ------------------ | ---------------- | -------------- | ------------- |
| Create Customer    | ✅               | ✅             | ✅            |
| Update Customer    | ✅ (via id)      | ✅ (via id)    | ❌            |
| Auth User Creation | ❌               | ✅             | ❌            |
| Email Invitation   | ✅ (manual)      | ✅ (automatic) | ❌            |
| Update Auth Email  | ❌               | ✅ (automatic) | ❌            |
| Loyalty Points     | ❌ (hardcoded 0) | ✅ (preserved) | ❌            |

---

## 4. Current Usage Summary

### ✅ POS Page

- **Create:** `/api/pos/customers` (line 608)
- **Update:** `/api/pos/customers` (with id field)
- **Flow:** Create → Email invitation separately

### ✅ Customers Page

- **Create:** `/api/customer/saveCustomer` (line 169)
- **Update:** `/api/customer/saveCustomer` (line 169)
- **Flow:** Single endpoint handles both, auth user creation built-in

### ✅ Mobile Orders

- **Create:** `/api/customers/create` (embedded in order creation)
- **Update:** Not supported
- **Flow:** Simple insert without auth user

---

## 5. Consistency Analysis

### ⚠️ Issues Identified

#### 1. **Three Different Endpoints for Similar Operations**

- POS uses `/api/pos/customers`
- Accounts page uses `/api/customer/saveCustomer`
- Mobile uses `/api/customers/create`
- Problem: Maintenance burden, inconsistent behavior

#### 2. **Auth User Creation Inconsistency**

- Customers page: ✅ Creates auth user with email invitation
- POS & Mobile: ❌ Do NOT create auth user
- Problem: POS customers can't reset password; Mobile customers can't use web app

#### 3. **Email Field Naming Inconsistency**

- Customers page & POS: `email_address`
- Mobile: `email`
- Problem: Inconsistent API contracts

#### 4. **Email Invitation Handling**

- Customers page: Automatic via `saveCustomer`
- POS: Manual via separate `/api/email/send-invitation` call
- Mobile: None
- Problem: Unpredictable behavior

#### 5. **Loyalty Points Handling**

- Customers page: Preserves on update
- POS: Hardcoded to 0 on insert
- Mobile: Ignores
- Problem: Data inconsistency potential

---

## 6. Recommendations

### Option A: Consolidate to Single Endpoint (Recommended)

**Create unified endpoint:** `POST /api/customers/manage`

```json
{
  "id": "uuid-or-null", // null = create, uuid = update
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "09123456789",
  "email_address": "john@example.com",
  "middle_name": null,
  "birthdate": null,
  "gender": null,
  "address": null,
  "create_auth_user": true, // flag for auth creation (default true)
  "loyalty_points": 0 // only updated via dedicated endpoint
}
```

**Benefits:**

- Single source of truth
- Consistent behavior across all features
- Easier maintenance
- Clearer API contracts

**Migration Path:**

1. Create new unified endpoint
2. Update all three features to use it
3. Deprecate old endpoints
4. Remove after grace period

---

### Option B: Standardize Existing Endpoints

**If consolidation not feasible:**

1. **Standardize field naming:** Always use `email_address` (not `email`)
2. **Make auth creation optional:** Add flag to control behavior
3. **Consistent email invitation:** Handle in API (not frontend)
4. **Document differences:** Add clear API docs with use cases

---

## 7. Testing Matrix

### Current Coverage

- [x] POS create customer flow
- [x] POS update customer flow
- [x] Customers page create flow
- [x] Customers page update flow
- [x] Mobile order creation (embedded)
- [ ] Auth user creation verification
- [ ] Email invitation verification
- [ ] Loyalty points preservation verification

### Recommended Tests

1. Create customer via POS → Check if auth user created
2. Create customer via Accounts → Check auth user + email invitation
3. Create customer via Mobile → Check if auth user created
4. Update customer → Verify loyalty points preserved
5. Email field mapping → Verify both names work across APIs

---

## 8. Files & Line References

| File                                         | Lines   | Purpose             |
| -------------------------------------------- | ------- | ------------------- |
| `src/app/in/pos/page.tsx`                    | 600-665 | POS create customer |
| `src/app/in/accounts/customers/page.tsx`     | 150-190 | Customers page save |
| `src/app/api/pos/customers/route.ts`         | 1-123   | POS API             |
| `src/app/api/customer/saveCustomer/route.ts` | 1-154   | Customers page API  |
| `src/app/api/customers/create/route.ts`      | 1-142   | Mobile create API   |

---

## 9. Status Summary

- ✅ All endpoints functional
- ✅ All features working
- ⚠️ Inconsistencies present
- ⚠️ Auth user creation inconsistent
- ⚠️ Email field naming inconsistent
- 📋 Consolidation recommended for maintainability
