# POS Mobile App Integration Guide

## Overview
This document provides complete specifications for integrating the Katflix Laundry POS system with a mobile app. The POS system follows a 5-step order creation workflow with comprehensive API endpoints for data loading and order processing.

---

## 1. ORDER CREATION PROCESS

### Flow Overview
```
Step 1: Service Type Selection
    ↓
Step 2: Basket Configuration (Services)
    ↓
Step 3: Products Selection
    ↓
Step 4: Customer Information
    ↓
Step 5: Handling & Payment
    ↓
Order Creation (API Call)
    ↓
Receipt Generation
```

### Step 1: Service Type Selection
**Purpose**: Determine if order is self-service or staff-assisted

**User Input**:
- Select `self_service` (customer handles laundry) OR
- Select `staff_service` (staff handles laundry, +₱40.00 fee added to order)

**Data Stored**:
```typescript
pos.serviceType: "self_service" | "staff_service"
```

**UI Guidance**:
- Large clickable buttons showing both options
- Visual distinction with emoji icons (👤 for self-service, 👥 for staff-service)
- Clear display of fee for staff service

---

### Step 2: Basket Configuration (Services)
**Purpose**: Configure laundry services for one or more baskets

**Basket Services Options** (per basket):
- **Wash**: `off` | `basic` | `premium`
- **Wash Cycles**: 1, 2, or 3 (only if wash != "off")
- **Dry**: `off` | `basic` | `premium`
- **Spin**: boolean (yes/no)
- **Iron**: 0, 2, 3, 4, 5, 6, 7, 8 kg (0 = off, minimum 2kg if enabled)
- **Fold**: boolean (yes/no)
- **Additional Dry Time**: 0, 8, 16, or 24 minutes
- **Plastic Bags**: quantity (integer, 0 or more)

**Key Rules**:
- Each basket can hold max 8kg of laundry
- Iron requires minimum 2kg (automatically skipped if < 2kg)
- Plastic bags are deducted from inventory and charged at product price
- Multiple baskets auto-created when weight exceeds 8kg

**Data Stored**:
```typescript
pos.baskets: Array<{
  basket_number: number;
  weight_kg: number;
  services: {
    wash: "off" | "basic" | "premium";
    wash_cycles: 1 | 2 | 3;
    dry: "off" | "basic" | "premium";
    spin: boolean;
    iron_weight_kg: 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
    fold: boolean;
    additional_dry_time_minutes: 0 | 8 | 16 | 24;
    plastic_bags: number;
  };
  notes: string;
  subtotal: number; // Calculated in real-time
}>
```

**Pricing Calculation**:
- Wash (basic/premium): Fixed price from `services` table
- Dry (basic/premium): Fixed price from `services` table
- Spin: ₱20.00
- Fold: ₱0.00 (free)
- Iron: ₱80.00 per kg (only if weight >= 2kg)
- Additional Dry Time: ₱15.00 per level (0, 1, 2, or 3 levels)
- Plastic Bags: Unit price from `products` table (₱0.50 default)

**UI Guidance**:
- Show service selection with pricing for each option
- Display running total for each basket
- Allow adding multiple baskets
- Show weight tracker for each basket (max 8kg)
- Display plastic bags as optional add-on

---

### Step 3: Products Selection
**Purpose**: Add retail products to the order (detergent, fabric softener, etc.)

**Available Products**:
- Loaded from `products` table (is_active = true)
- Includes: id, item_name, unit_price, quantity_in_stock, image_url, reorder_level

**User Input**:
- Select product
- Enter quantity
- Add to order

**Data Stored**:
```typescript
pos.selectedProducts: Record<string, number> // {product_id: quantity}
```

**Key Rules**:
- Check inventory before allowing order
- Inventory deducted from `products.quantity` table when order created
- Product transaction logged in `product_transactions` table

**UI Guidance**:
- Display product grid/list with images and prices
- Show "In Stock" status with quantity available
- Spinner or + button to add products and adjust quantities
- Display product subtotal in real-time

---

### Step 4: Customer Information
**Purpose**: Associate order with customer or create new customer

**Two Paths**:

**Path A: Existing Customer**
- Search for customer by phone number or name
- Select from list
- Load customer loyalty points

**Path B: New Customer**
- Enter first name, last name, phone number, email
- Create new customer record in database
- Start with 0 loyalty points

**Customer Data Loaded**:
```typescript
{
  id: string (UUID);
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address: string;
  loyalty_points: number; // Current balance
}
```

**Loyalty Feature**:
- Display customer's current loyalty points
- Show available redemption tiers:
  - **Tier 1**: 10 points = 5% discount
  - **Tier 2**: 20 points = 15% discount
- Allow selecting tier if customer has enough points
- Points automatically awarded: 1 point per completed order
- Discount applied at order creation

**Data Stored**:
```typescript
pos.customer: CustomerData; // Selected/created customer
pos.loyaltyDiscountTier: null | 'tier1' | 'tier2'; // Selected discount
pos.newCustomerForm: { // For new customer
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address: string;
}
```

**UI Guidance**:
- Customer search with autocomplete
- Form fields for new customer creation
- Display loyalty points prominently
- Radio buttons for tier selection
- Show discount amount in real-time (₱X.XX)

---

### Step 5: Handling & Payment
**Purpose**: Configure delivery/pickup and payment method

**Service Type Options**:
- **Pickup**: Customer picks up order (no delivery fee)
- **Delivery**: Staff delivers to address (₱50.00 minimum fee, can override)

**If Delivery Selected**:
- Enter delivery address
- Optional: Override delivery fee (minimum ₱50.00)

**Payment Method Options**:
- **Cash**: 
  - Enter amount paid
  - Auto-calculate change
  - Show required payment
- **GCash**: 
  - Enter GCash reference number
  - Validate reference provided

**Special Instructions**:
- Optional: Add order-level notes (e.g., "Dry clean only", "Special folding")

**Data Stored**:
```typescript
pos.deliveryType: "pickup" | "delivery";
pos.deliveryAddress: string | null; // If delivery
pos.deliveryFeeOverride: number | null; // If overridden
pos.specialInstructions: string;
pos.paymentMethod: "cash" | "gcash";
pos.amountPaid: number;
pos.gcashReference: string; // If GCash
```

**UI Guidance**:
- Large buttons for pickup vs. delivery
- Conditional address input field
- Payment method selector
- Amount input field with auto-change calculation
- Display order total prominently
- Show final total after any loyalty discount

---

## 2. UI SUMMARY & GUIDANCE

### Key Display Elements

#### Order Summary Panel
Located in sidebar, shows real-time calculation of:
- **Baskets** (grouped)
  - Services breakdown (Wash, Dry, Spin, Iron, Fold, Dry Time, Bags)
  - Subtotal per basket
- **Products** section
  - Product list with quantities and prices
  - Products subtotal
- **Fees** section
  - Staff service fee (if applicable)
  - Delivery fee (if applicable)
  - VAT (12% inclusive, shown in breakdown)
- **Loyalty Discount** (if tier selected)
  - Discount amount (₱X.XX)
  - Final total after discount

#### Step Navigation
- Numbered steps 1-5
- Current step highlighted
- Can jump backward to previous steps
- Cannot jump forward until current step complete

#### Real-Time Pricing
- All prices calculated and displayed immediately
- Updates when:
  - Services changed
  - Basket weight modified
  - Products added/removed
  - Loyalty tier selected
  - Delivery method changed

### Mobile-Specific Considerations
- **Responsive Layout**: Stack vertically on mobile, sidebar on desktop
- **Touch-Friendly**: Large buttons and input fields
- **Minimal Scrolling**: Keep critical info visible
- **Clear Errors**: Validation messages for invalid inputs
- **Loading States**: Show processing indicator during API calls

---

## 3. API ENDPOINTS: DATA LOADING

### Initial POS Load
These endpoints are called when POS page first loads or when data needs refresh.

#### GET `/api/auth/user`
**Purpose**: Get authenticated staff user information

**Request**:
```
GET /api/auth/user
Headers: {
  "Content-Type": "application/json"
}
Credentials: include
```

**Response** (200 OK):
```json
{
  "staff_id": "uuid",
  "staff_name": "John Doe",
  "email": "john@katflix.com"
}
```

**Response** (401 Unauthorized):
```json
{
  "error": "Unauthorized"
}
```

**Usage**: Called on POS page mount to identify current cashier for order attribution and daily sales filtering

---

#### GET `/api/orders`
**Purpose**: Fetch all orders (used for sales reports and order history)

**Request**:
```
GET /api/orders
Query Parameters (optional):
  - dateFrom: ISO date string (filters orders >= this date)
  - dateTo: ISO date string (filters orders <= this date)
  - cashierId: UUID (filters orders by staff member)

Headers: {
  "Content-Type": "application/json"
}
Credentials: include
```

**Response** (200 OK):
```json
[
  {
    "id": "uuid",
    "customer_id": "uuid",
    "customer_name": "John Smith",
    "phone_number": "09XX-XXX-XXXX",
    "cashier_id": "uuid",
    "cashier_name": "Jane Doe",
    "created_at": "2026-01-27T10:30:00Z",
    "breakdown": {
      "items": [...],
      "baskets": [...],
      "fees": [...],
      "summary": {
        "subtotal_products": 100.00,
        "subtotal_services": 250.00,
        "staff_service_fee": 40.00,
        "delivery_fee": 0.00,
        "subtotal_before_vat": 390.00,
        "vat_amount": 46.80,
        "loyalty_discount": 0.00,
        "total": 436.80
      }
    },
    "handling": {
      "service_type": "staff_service",
      "handling_type": "delivery",
      "delivery_address": "123 Main St, Manila",
      "special_instructions": "Dry clean only",
      "payment_method": "cash",
      "amount_paid": 500.00
    },
    "loyalty": {
      "discount_tier": "tier1",
      "points_awarded": 1,
      "points_before": 5,
      "points_after": 6
    },
    "service_logs": [
      {
        "basket_number": 1,
        "service_type": "wash",
        "status": "completed",
        "started_at": "2026-01-27T10:31:00Z",
        "completed_at": "2026-01-27T10:45:00Z",
        "started_by": "staff_name",
        "completed_by": "staff_name",
        "notes": "Standard wash"
      }
    ]
  }
]
```

**Usage**: Called for:
- Daily sales report (filtered by staffId and today's date)
- Order history view
- Order details modal

---

#### Implicit Data Loads (via usePOSState hook)
These are loaded by the React hook when component mounts:

##### Services Data
```typescript
// Loaded from Supabase table: services
// Called internally by usePOSState.ts
GET FROM "services" WHERE is_active = true
SELECT: id, service_type, tier, name, base_price, duration_minutes
```

**Data Structure**:
```typescript
pos.services: Array<{
  id: string;
  service_type: "wash" | "dry"; // Service type
  tier: "basic" | "premium"; // Tier level
  name: string; // Display name (e.g., "Premium Wash")
  base_price: number; // Price in PHP
  duration_minutes: number; // Time estimate
}>
```

##### Products Data
```typescript
// Loaded from Supabase table: products
// Called internally by usePOSState.ts
GET FROM "products" WHERE is_active = true
SELECT: id, item_name, unit_price, quantity, image_url, reorder_level
ORDER BY: item_name
```

**Data Structure**:
```typescript
pos.products: Array<{
  id: string;
  item_name: string; // Product name
  unit_price: number; // Price per unit
  quantity_in_stock: number; // Current inventory
  image_url: string; // Product image
  reorder_level: number; // Reorder threshold
}>
```

##### Customers Data
```typescript
// Loaded on demand when customer search/selection occurs
// Can be filtered by phone_number or name
GET FROM "customers" WHERE is_active = true
SELECT: id, first_name, last_name, phone_number, email_address, loyalty_points
ORDER BY: last_name
```

**Data Structure**:
```typescript
customers: Array<{
  id: string;
  first_name: string;
  last_name: string;
  phone_number: string;
  email_address: string;
  loyalty_points: number; // Current loyalty points balance
}>
```

---

## 4. EXPECTED ORDER CREATION PAYLOAD STRUCTURE

### Request Sent to POST `/api/orders/pos/create`

```json
{
  "customer_id": "uuid or null",
  "customer_data": {
    "first_name": "string",
    "last_name": "string",
    "phone_number": "string",
    "email": "string (optional)"
  },
  "breakdown": {
    "items": [
      {
        "product_id": "uuid",
        "product_name": "string",
        "quantity": number,
        "unit_price": number,
        "total_price": number
      }
    ],
    "baskets": [
      {
        "basket_number": number,
        "weight_kg": number,
        "services": {
          "wash": "off" | "basic" | "premium",
          "wash_cycles": 1 | 2 | 3,
          "dry": "off" | "basic" | "premium",
          "spin": boolean,
          "iron_weight_kg": 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8,
          "fold": boolean,
          "additional_dry_time_minutes": 0 | 8 | 16 | 24,
          "plastic_bags": number
        },
        "notes": "string",
        "subtotal": number
      }
    ],
    "fees": [
      {
        "type": "staff_service_fee" | "delivery_fee" | "vat",
        "amount": number,
        "description": "string"
      }
    ],
    "summary": {
      "subtotal_products": number,
      "subtotal_services": number,
      "staff_service_fee": number,
      "delivery_fee": number,
      "subtotal_before_vat": number,
      "vat_amount": number,
      "loyalty_discount": number,
      "total": number
    }
  },
  "handling": {
    "service_type": "self_service" | "staff_service",
    "handling_type": "pickup" | "delivery",
    "delivery_address": "string or null",
    "delivery_fee_override": number or null,
    "special_instructions": "string",
    "payment_method": "cash" | "gcash",
    "amount_paid": number,
    "gcash_reference": "string (optional, only if gcash)"
  },
  "loyalty": {
    "discount_tier": null | "tier1" | "tier2"
  }
}
```

### Example Payload (Staff Service with Loyalty Discount)

```json
{
  "customer_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_data": null,
  "breakdown": {
    "items": [
      {
        "product_id": "660e8400-e29b-41d4-a716-446655440000",
        "product_name": "Laundry Detergent",
        "quantity": 1,
        "unit_price": 150.00,
        "total_price": 150.00
      }
    ],
    "baskets": [
      {
        "basket_number": 1,
        "weight_kg": 5.5,
        "services": {
          "wash": "premium",
          "wash_cycles": 2,
          "dry": "basic",
          "spin": true,
          "iron_weight_kg": 3,
          "fold": true,
          "additional_dry_time_minutes": 8,
          "plastic_bags": 2
        },
        "notes": "Dry clean only",
        "subtotal": 495.00
      }
    ],
    "fees": [
      {
        "type": "staff_service_fee",
        "amount": 40.00,
        "description": "Staff service fee"
      },
      {
        "type": "vat",
        "amount": 57.60,
        "description": "VAT (12% inclusive)"
      }
    ],
    "summary": {
      "subtotal_products": 150.00,
      "subtotal_services": 495.00,
      "staff_service_fee": 40.00,
      "delivery_fee": 0.00,
      "subtotal_before_vat": 685.00,
      "vat_amount": 57.60,
      "loyalty_discount": 34.25,
      "total": 650.75
    }
  },
  "handling": {
    "service_type": "staff_service",
    "handling_type": "pickup",
    "delivery_address": null,
    "delivery_fee_override": null,
    "special_instructions": "Fold neatly please",
    "payment_method": "cash",
    "amount_paid": 700.00,
    "gcash_reference": null
  },
  "loyalty": {
    "discount_tier": "tier1"
  }
}
```

### Payload Construction Notes

1. **Customer Selection**:
   - If existing customer: Include `customer_id`, set `customer_data` to null
   - If new customer: Set `customer_id` to null, include `customer_data` object

2. **Breakdown Calculation**:
   - `calculateOrderTotal()` function builds complete breakdown
   - All prices are snapshots at order creation time
   - Totals must match: subtotal_products + subtotal_services + staff_service_fee + delivery_fee = subtotal_before_vat

3. **Loyalty Discount**:
   - Only included if `loyaltyDiscountTier` is selected
   - Discount amount = order_total × discount_percent (5% for tier1, 15% for tier2)
   - Applied to final total: total = subtotal_before_vat - loyalty_discount

4. **Handling Configuration**:
   - `service_type` matches Step 1 selection (self_service or staff_service)
   - `handling_type` matches Step 5 selection (pickup or delivery)
   - If delivery: `delivery_address` required, `delivery_fee_override` optional
   - GCash reference only included if payment_method is "gcash"

---

## 5. API ENDPOINTS: ORDER CREATION

### POST `/api/orders/pos/create`

**Purpose**: Create a complete POS order transactionally

**Authentication**:
- Required: Valid Supabase session (staff user)
- Verified via `auth.getUser()` and staff table lookup

**Request**:
```
POST /api/orders/pos/create
Headers: {
  "Content-Type": "application/json"
}
Credentials: include
Body: [See payload structure above]
```

**Processing Steps** (All-or-Nothing Transaction):

1. **Authentication** (401 if fails)
   - Verify Supabase session
   - Get staff record (cashier_id)
   - Fail if user not authenticated or no staff record

2. **Customer Handling** (201+ if fails)
   - If customer_id provided: Verify customer exists
   - If customer_data provided: Create new customer record
   - If both null: Create anonymous customer with generic name

3. **Service Pricing Enrichment**
   - Load all services from database (pricing snapshot)
   - Attach service details to each basket's service selections

4. **Plastic Bags Handling**
   - Check if plastic bags product exists
   - If missing: Create it (item_name: "Plastic Bags", unit_price: 0.50)
   - Calculate total bags needed from all baskets

5. **Inventory Deduction**
   - For each product in items: Deduct from products.quantity
   - For plastic bags: Deduct total quantity from products table
   - Create product_transactions records for all deductions

6. **Order Creation**
   - Insert into orders table with:
     - customer_id (UUID)
     - cashier_id (from authenticated user)
     - breakdown (JSONB)
     - handling (JSONB)
     - created_at (current timestamp)

7. **Loyalty Points**
   - Award 1 point per order (if customer exists)
   - If discount_tier selected: Deduct tier points (10 or 20)
   - Update customer.loyalty_points
   - Record loyalty_transactions for audit trail

8. **Service Status Logging**
   - Create basket_service_status records for each service
   - Initial status: "pending"
   - Timestamp creation for audit

9. **Response**
   - Return success, order_id, receipt data

**Response** (201 Created):
```json
{
  "success": true,
  "order_id": "uuid",
  "receipt": "formatted receipt text",
  "order": {
    "id": "uuid",
    "customer_id": "uuid",
    "cashier_id": "uuid",
    "breakdown": {...},
    "handling": {...},
    "loyalty": {...},
    "created_at": "2026-01-27T10:30:00Z"
  }
}
```

**Response** (400 Bad Request):
```json
{
  "success": false,
  "error": "Description of validation error"
}
```

Examples:
- "Customer not found"
- "Insufficient inventory for product: Detergent"
- "Invalid payment method: invalid_type"
- "Delivery fee override below minimum ₱50"

**Response** (401 Unauthorized):
```json
{
  "success": false,
  "error": "Unauthorized"
}
```

**Response** (500 Internal Server Error):
```json
{
  "success": false,
  "error": "Database error or transaction failure"
}
```

### Error Handling & Rollback
- Any failure during the transaction rolls back all changes
- No partial orders created
- Inventory remains unchanged if any step fails
- Clear error message returned to client

### Receipt Format
The response includes formatted receipt with:
- Order ID
- Timestamp
- Basket breakdown (number, weight, subtotal)
- Product listing
- Fee summary (staff service, delivery, VAT)
- Loyalty discount (if applied)
- Total amount
- Payment method and amount paid
- Change (if cash payment)

---

## 6. MOBILE APP IMPLEMENTATION CHECKLIST

### Data Loading
- [ ] GET `/api/auth/user` on app startup (get current user info)
- [ ] Load services from local cache or API
- [ ] Load products from local cache or API
- [ ] Load customers data on demand (search)

### UI Implementation
- [ ] Step 1: Service Type selector (self-service vs staff-service)
- [ ] Step 2: Basket configuration (services per basket)
- [ ] Step 3: Products selection (shopping cart)
- [ ] Step 4: Customer selection/creation
- [ ] Step 5: Handling & payment configuration
- [ ] Real-time order summary panel with pricing
- [ ] Loyalty points display and tier selection

### Order Creation
- [ ] Build breakdown object with pricing calculations
- [ ] Build handling object from user selections
- [ ] POST to `/api/orders/pos/create`
- [ ] Handle success (show receipt)
- [ ] Handle errors (show error message, allow retry)
- [ ] Print receipt or save to file

### Offline Capability (Optional)
- [ ] Cache services and products locally
- [ ] Queue orders for sync when offline
- [ ] Sync when connection restored

---

## 7. KEY PRICING RULES FOR MOBILE IMPLEMENTATION

### VAT (Tax)
- **12% Inclusive Tax** (not added on top)
- Calculated on subtotal_before_vat
- Included in final total
- Formula: subtotal_before_vat × (1 + 0.12) = final_total (approximately, due to inclusive nature)

### Service Pricing
- **Wash**: Fixed price per tier (basic vs premium)
- **Dry**: Fixed price per tier (basic vs premium)
- **Spin**: ₱20.00 flat
- **Fold**: ₱0.00 (free)
- **Iron**: ₱80.00 per kg (minimum 2kg, maximum 8kg)
- **Additional Dry Time**: ₱15.00 per level (0, 1, 2, or 3 levels of 8 minutes each)
- **Plastic Bags**: From products table unit_price (₱0.50 default)

### Fees
- **Staff Service Fee**: ₱40.00 per order (flat, not per basket)
- **Delivery Fee**: ₱50.00 minimum, configurable override

### Loyalty Discounts
- **Award**: 1 point per completed order
- **Tier 1 Redemption**: 10 points = 5% discount
- **Tier 2 Redemption**: 20 points = 15% discount
- Discount applies to order total (after all services/fees/VAT)

### Basket Weight Limits
- **Maximum**: 8 kg per basket
- Auto-create new basket if weight exceeds 8kg

---

## 8. DATABASE SCHEMA REFERENCE

### orders table
```sql
id UUID PRIMARY KEY
customer_id UUID FOREIGN KEY (nullable, for anonymous orders)
cashier_id UUID FOREIGN KEY (staff.id, required)
breakdown JSONB (OrderBreakdown object)
handling JSONB (OrderHandling object)
loyalty JSONB (loyalty info)
created_at TIMESTAMP (order creation time)
updated_at TIMESTAMP
```

### customers table
```sql
id UUID PRIMARY KEY
first_name TEXT
last_name TEXT
phone_number TEXT
email_address TEXT
loyalty_points INTEGER (default 0)
created_at TIMESTAMP
updated_at TIMESTAMP
is_active BOOLEAN
```

### products table
```sql
id UUID PRIMARY KEY
item_name TEXT
unit_price DECIMAL
quantity INTEGER (current inventory)
image_url TEXT (optional)
reorder_level INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
is_active BOOLEAN
```

### services table
```sql
id UUID PRIMARY KEY
service_type TEXT (wash, dry, spin, iron, fold, etc.)
tier TEXT (basic, premium, or null)
name TEXT
base_price DECIMAL
duration_minutes INTEGER
created_at TIMESTAMP
updated_at TIMESTAMP
is_active BOOLEAN
```

### product_transactions table
```sql
id UUID PRIMARY KEY
order_id UUID FOREIGN KEY (orders.id)
product_id UUID FOREIGN KEY (products.id)
quantity_deducted INTEGER
created_at TIMESTAMP
```

### basket_service_status table
```sql
id UUID PRIMARY KEY
order_id UUID FOREIGN KEY (orders.id)
basket_number INTEGER
service_type TEXT
status TEXT (pending, in_progress, completed)
started_at TIMESTAMP (nullable)
completed_at TIMESTAMP (nullable)
started_by UUID (staff.id, nullable)
completed_by UUID (staff.id, nullable)
notes TEXT (nullable)
```

---

## 9. TESTING SCENARIOS FOR MOBILE

### Scenario 1: Basic Self-Service Order
1. Select self-service
2. Create 1 basket: Basic wash, basic dry, spin
3. No products
4. Existing customer
5. Cash payment

**Expected Total**: Services subtotal + VAT

### Scenario 2: Staff Service with Delivery & Loyalty
1. Select staff-service (+₱40)
2. Create 1 basket: Premium wash, premium dry, 3kg iron, 2 plastic bags
3. Add detergent product
4. New customer (create on-the-fly)
5. Delivery to address
6. GCash payment

**Expected Total**: Services + Products + Staff Fee + Delivery + VAT - Loyalty Discount (if applied)

### Scenario 3: Multiple Baskets
1. Select self-service
2. Create basket 1 (4kg) with services
3. Create basket 2 (5kg) with different services
4. Add products
5. Cash payment

**Expected**: Two basket subtotals summed

### Scenario 4: Inventory Management
1. Order plastic bags (5 units)
2. Check product inventory decremented
3. Order again, verify correct remaining inventory

### Scenario 5: Loyalty Points
1. Existing customer with 15 points
2. Select tier1 discount (10 points)
3. Verify 5% discount applied
4. After order, verify customer now has 6 points (15 - 10 + 1)

---

## Contact & Support

For questions about POS integration, refer to:
- `/src/app/in/pos/logic/posTypes.ts` - Type definitions
- `/src/app/in/pos/logic/posHelpers.ts` - Calculation logic
- `/src/app/api/orders/pos/create/route.ts` - Order creation logic
- `/src/app/in/pos/page.tsx` - UI implementation

Last Updated: January 27, 2026
Katflix POS System v2.0 (Post-Overhaul)
