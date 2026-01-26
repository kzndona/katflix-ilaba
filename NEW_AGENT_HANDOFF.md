# POS Overhaul Implementation - Agent Handoff Guide

**Date:** January 27, 2026  
**Status:** Ready for Implementation Phase 2 & 3  
**Previous Work:** Database schema clarification completed, UI/Services/Products pages polished  

---

## 📋 Executive Summary

A laundry POS system is being overhauled from legacy code. The UI for **Services** and **Products** management pages are **COMPLETE** ✅. You're now starting the **NEW POS ORDER CREATION** interface (Step 1-6 workflow).

**Key Facts:**
- Stack: Next.js 13+, TypeScript, Tailwind CSS, Supabase
- Architecture: Client-side + API routes
- Status: Requirements clarified, ready to build UI + APIs
- Database: Schema is LOCKED (see below)
- Styling: Professional, polished (follow services/products pages as reference)

---

## 📁 Project Structure

```
src/app/
├── in/
│   ├── manage/
│   │   ├── services/page.tsx        ✅ COMPLETE (table-based, polished)
│   │   ├── products/page.tsx        ✅ COMPLETE (table-based, images, polished)
│   │   ├── machines/                (Other management pages)
│   │   └── ...
│   └── pos/
│       ├── page.tsx                 🔨 TODO: Main POS layout
│       ├── components/
│       │   ├── ServiceTypeSelector.tsx     🔨 TODO
│       │   ├── BasketConfigurator.tsx      🔨 TODO
│       │   ├── ProductSelector.tsx         🔨 TODO
│       │   ├── CustomerLookup.tsx          🔨 TODO
│       │   ├── DeliveryHandler.tsx         🔨 TODO
│       │   ├── OrderSummary.tsx            🔨 TODO (Right sidebar)
│       │   ├── PaymentModal.tsx            🔨 TODO
│       │   └── ReceiptModal.tsx            🔨 TODO
│       └── logic/
│           ├── usePOSState.ts              🔨 TODO (Main state hook)
│           ├── posTypes.ts                 🔨 TODO (Type definitions)
│           ├── posHelpers.ts               🔨 TODO (Calculations)
│           └── breakdownBuilder.ts         🔨 TODO (JSONB builder)
├── api/
│   ├── manage/
│   │   ├── services/                ✅ COMPLETE
│   │   ├── products/                ✅ COMPLETE (includes image upload API)
│   │   └── ...
│   └── orders/
│       └── pos/
│           └── create/              🔨 TODO (Main transactional endpoint)
└── ...
```

---

## 🎯 Clarified Requirements (From Answers Document)

### ✅ LOCKED - Service Definition

```typescript
// Service structure per basket:
// Self-service: No 40 PHP fee
// Staff-service: +40 PHP fee (optional, checkbox in UI)

Wash: [Off] [Basic] [Premium]  // Radio buttons (mutually exclusive)
  - Basic: 65 PHP, 33 min, 2 cycles (toggle 1/2 cycles disabled)
  - Premium: 80 PHP, 39 min, 3 cycles (cycles disabled)
  - Off: No wash service

Dry: [Off] [Basic] [Premium]
  - Basic: 65 PHP, 32 min
  - Premium: 80 PHP, 40 min
  - Off: No dry service

Spin: Toggle [On/Off]
  - On: 20 PHP, 10 min
  - Off: No spin

Iron: [Off] [2kg] [3kg] [4kg] [5kg] [6kg] [7kg] [8kg]  // Only if enabled
  - Price: 80 PHP/kg (so 2kg = 160, 3kg = 240, etc.)
  - Min: 2kg, Max: 8kg (same as basket max weight)

Additional Dry Time: -/+ buttons
  - Options: 0, 8, 16, 24 minutes
  - Price per level: 15 PHP
  - Affects total duration

Plastic Bag: -/+ buttons (Product item, not service)
  - From products table, treated as line item
  - Show quantity, price
  - Deduct from inventory
```

### ✅ LOCKED - Basket & Weight Rules

```typescript
// Basket = Load (limited to 8kg max)
// If cashier adds weight > 8kg, create new basket automatically
// No explicit basket creation - just incremental baskets
// Baskets numbered 1, 2, 3, etc.

Example:
- Input 8kg → Basket 1 created
- Input 6kg → Basket 2 created (total 14kg)
- Input 3kg → Basket 3 created (total 17kg)
```

### ✅ LOCKED - Fees & Pricing

```typescript
// 1. Service Fee (staff-service only)
service_fee: baskets.some(b => b.staffService) ? 40 : 0

// 2. Drop-off Service
drop_off_fee: staffService ? 40 : 0  // Same as service fee, now conditional

// 3. Delivery Fee
delivery_fee: handling.deliver ? (override || 50) : 0
// Cashier can override but not below 50

// 4. VAT
vat: (subtotal) * 0.12  // 12% INCLUSIVE in total
// This means VAT is pre-calculated into service prices

// 5. Loyalty Discount
discount: breakdown.useLoyaltyDiscount ? (loyaltyPoints / 100) : 0
```

### ✅ LOCKED - Workflow (6 Steps)

```
Step 0: Service Type Selector
  - Self-service OR Staff-service (radio)
  - Affects pricing (service fee) & handling

Step 1: Basket Configurator
  - Add laundry baskets (services)
  - Configure wash/dry/spin/iron/fold
  - Plastic bags (product items shown here)
  - Can go back and edit previous baskets

Step 2: Product Selector
  - Browse products with images, prices, quantities
  - Add to order (increments quantity)
  - Shows reorder level warning if low stock

Step 3: Customer Lookup
  - Search existing customer (debounced 300ms)
  - Or create new customer inline
  - First name, last name, phone, email
  - If existing selected, first/last names locked

Step 4: Delivery Handler
  - Pickup OR Delivery (radio)
  - If delivery: Address input + Fee field (default 50, min 50, cashier override)
  - Special instructions (order-level notes)

Step 5: Order Review
  - Summary of everything
  - Loyalty discount checkbox (if eligible)
  - Final total

Step 6: Payment Modal
  - MOP: Cash or GCash (radio)
  - If Cash: Amount received → Calculate change
  - If GCash: Reference number
  - Create order button → Transactional save
```

### ✅ LOCKED - Order Breakdown Structure

```typescript
// breakdown JSONB structure:
{
  items: [
    {
      product_id: string
      quantity: number
      unit_price: number
      total_price: number
    }
  ],
  
  baskets: [
    {
      basket_number: number
      weight_kg: number
      staff_service: boolean  // If true, +40 PHP fee
      services: {
        wash: "off" | "basic" | "premium"
        wash_cycles: 1 | 2 | 3
        dry: "off" | "basic" | "premium"
        spin: boolean
        iron_weight_kg: 0 | 2 | 3 | 4 | 5 | 6 | 7 | 8
        fold: boolean
        additional_dry_time_minutes: 0 | 8 | 16 | 24
      },
      notes: string  // Per-basket laundry notes
      subtotal: number
    }
  ],
  
  fees: [
    { type: "service_fee", amount: 40, description: "Staff service" },
    { type: "delivery_fee", amount: 50, description: "Delivery to address" },
    { type: "plastic_bag", amount: 3, quantity: 5, description: "Plastic bags" }
  ],
  
  summary: {
    subtotal: number
    service_fee: number
    delivery_fee: number
    vat: number  // 12% of subtotal (inclusive)
    loyalty_discount: number
    total: number
  }
}

// handling JSONB structure:
{
  service_type: "self_service" | "staff_service"
  pickup_or_delivery: "pickup" | "delivery"
  delivery_address: string  // If delivery
  delivery_fee_override: number | null
  special_instructions: string  // Order-level notes
  payment_method: "cash" | "gcash"
  amount_paid: number
  gcash_reference: string | null
  use_loyalty_discount: boolean
}
```

### ✅ LOCKED - Transaction Save Order

```typescript
// POST /api/orders/pos/create - Transactional:

1. Validate:
   - Customer exists or create
   - Products in stock
   - Services available
   - Payment amount valid

2. Execute (atomic transaction):
   - Create/update customer
   - Create order row
   - Create product_transactions (inventory deduction)
   - Return order with receipt data

3. If ANY step fails: Rollback entire transaction
```

---

## 📊 Database Schema (LOCKED)

### Services Table
```sql
CREATE TABLE services (
  id UUID PRIMARY KEY,
  service_type TEXT NOT NULL,  -- 'wash', 'dry', 'spin', 'iron', 'fold'
  name TEXT NOT NULL,           -- "Premium Wash", "Basic Wash", etc.
  rate_per_kg NUMERIC,          -- No longer used (now per basket)
  base_duration_minutes NUMERIC,
  base_price NUMERIC,           -- Now per basket (65, 80, 20, etc.)
  tier TEXT,                    -- 'basic' or 'premium' (NEW)
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by TEXT
);
```

### Products Table
```sql
CREATE TABLE products (
  id UUID PRIMARY KEY,
  item_name TEXT NOT NULL,
  sku TEXT,
  unit_price NUMERIC NOT NULL,
  unit_cost NUMERIC,
  quantity NUMERIC NOT NULL,    -- Stock quantity
  reorder_level NUMERIC,
  image_url TEXT,               -- Supabase public URL
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by TEXT
);
```

### Orders Table (Already Exists)
```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID REFERENCES customers(id),
  breakdown JSONB NOT NULL,     -- Above structure
  handling JSONB NOT NULL,      -- Above structure
  status TEXT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  updated_by TEXT
);
```

### Key: breakdown & handling are JSONB - no separate rows

---

## 🎨 Styling Standards (Copy from Services/Products Pages)

```typescript
// Colors & Spacing
Headers: text-2xl, font-bold, mb-4
Labels: text-xs, font-semibold, mb-1
Inputs: px-3 py-1.5, border border-gray-300, rounded, text-sm
Buttons (standard): px-4 py-2, text-sm
Buttons (modal): px-3 py-1.5, text-xs
Table cells: px-4 py-2
Modal content: p-5, space-y-4
Modal header: px-6 py-3, border-b

Financial: Always ₱${parseFloat(value).toFixed(2)}
Status badges: px-2 py-0.5, rounded-full, text-xs, font-semibold
```

---

## 🛠 What's Already Built (Don't Duplicate)

### ✅ Management Pages (Reference These)
- [Services Page](src/app/in/manage/services/page.tsx) - **COMPLETE**, polished UI
- [Products Page](src/app/in/manage/products/page.tsx) - **COMPLETE**, table-based, image upload

**What to learn:**
- Professional table layout with sorting/pagination
- Modal editing patterns (right-slide modal)
- Financial formatting
- Search & filter logic
- Form validation
- Error handling

### ✅ API Routes for Image Upload
- `POST /api/products/upload-image` - Uses service key, bypasses RLS
- **Key Learning:** Server-side Supabase client with service key for privileged operations

### ✅ Supabase Client Setup
- `.env.local` has `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
- Server routes use service key
- Client routes use public key

---

## 🚀 What You Need to Build

### Phase 1: UI Components (3-4 days)

#### 1. Main POS Layout ([src/app/in/pos/page.tsx](src/app/in/pos/page.tsx))
- Left side: Step-by-step form (scrollable)
- Right side: Order summary (sticky, real-time updates)
- Professional layout matching services/products style
- Progress indicator (Step 1/6, 2/6, etc.)

#### 2. Components (In src/app/in/pos/components/)

**ServiceTypeSelector.tsx**
```typescript
// Radio: Self-service vs Staff-service
// Affects: Service fee (40 PHP if staff)
```

**BasketConfigurator.tsx**
```typescript
// Add baskets with services
// Wash: Off/Basic/Premium
// Dry: Off/Basic/Premium
// Spin: Toggle
// Iron: Dropdown 0-8kg (min 2)
// Fold: Toggle
// Additional Dry Time: -/+ buttons
// Plastic Bags: Show as line items

// Auto-creates new basket if weight > 8kg
// Can edit/delete previous baskets
```

**ProductSelector.tsx**
```typescript
// Grid or list of products
// Show: Image, Name, Price, Quantity in stock
// Click to add (increments quantity)
// Show reorder level indicator
```

**CustomerLookup.tsx**
```typescript
// Search input (debounced 300ms)
// Results dropdown (first 10)
// Click to select (fills form, locks first/last)
// Or create new customer inline
```

**DeliveryHandler.tsx**
```typescript
// Pickup OR Delivery (radio)
// If delivery: Address field + Fee field (default 50, min 50)
// Special instructions text area
```

**OrderSummary.tsx** (Right sidebar - sticky)
```typescript
// Real-time updates as you add items
// Baskets breakdown (weight, services, subtotal)
// Products list (with quantities)
// Fees breakdown (service, delivery, VAT)
// Loyalty discount (if applicable)
// TOTAL (bold, large)
```

**PaymentModal.tsx**
```typescript
// Modal overlay
// MOP: Cash or GCash (radio)
// If Cash: Amount received → Change calculation
// If GCash: Reference number input
// Create Order button
// Error handling
```

**ReceiptModal.tsx**
```typescript
// Show after successful creation
// Order ID, Date, Customer, Items, Total
// Print button
// Close button
```

#### 3. Logic Hooks (In src/app/in/pos/logic/)

**usePOSState.ts**
```typescript
// Main state management
const [serviceType, setServiceType] = useState('self_service')
const [baskets, setBaskets] = useState([])
const [products, setProducts] = useState([])
const [customer, setCustomer] = useState(null)
const [handling, setHandling] = useState({})
const [payment, setPayment] = useState({})

// Methods: addBasket, updateBasket, deleteBasket
//          addProduct, removeProduct
//          calculateTotals, validateForm
```

**posTypes.ts**
```typescript
// TypeScript types for all POS structures
type Basket = { ... }
type OrderItem = { ... }
type OrderBreakdown = { ... }
type OrderHandling = { ... }
```

**posHelpers.ts**
```typescript
// Calculation functions
calculateBasketSubtotal(basket: Basket): number
calculateVAT(subtotal: number): number
calculateTotal(breakdown, handling): number
validateDeliveryFee(fee: number): boolean
```

**breakdownBuilder.ts**
```typescript
// Build JSONB structures
buildBreakdown(baskets, products, ...): OrderBreakdown
buildHandling(customer, delivery, payment, ...): OrderHandling
```

---

### Phase 2: API Endpoints (2-3 days)

#### 1. Support Endpoints (Already Exist - Use These)
- `GET /api/services` - ✅ DONE
- `GET /api/products` - ✅ DONE (includes images, stock)
- `GET /api/customers/search?q=` - Check if exists, else create

#### 2. New: POST /api/orders/pos/create

```typescript
// Request body:
{
  breakdown: OrderBreakdown,
  handling: OrderHandling,
  customer_id: string | null,
  customer_data: CustomerData | null  // If new customer
}

// Response:
{
  order_id: string,
  order_number: string,
  receipt: {
    items: [...],
    baskets: [...],
    total: number,
    payment_method: string,
    change: number
  }
}

// Logic:
1. Validate all inputs
2. Create/update customer (if needed)
3. Create order in DB
4. Deduct inventory (product_transactions)
5. Return receipt data

// Errors:
- 400: Invalid input
- 402: Insufficient stock
- 500: Database error
```

---

## 🔗 API Data Shapes (Reference)

### GET /api/services
```json
[
  {
    "id": "uuid",
    "service_type": "wash",
    "name": "Premium Wash",
    "base_price": 80,
    "base_duration_minutes": 39,
    "tier": "premium",
    "is_active": true
  }
]
```

### GET /api/products
```json
[
  {
    "id": "uuid",
    "item_name": "Plastic Bag",
    "sku": "BAG-001",
    "unit_price": 3,
    "quantity": 100,
    "image_url": "https://...",
    "reorder_level": 10,
    "is_active": true
  }
]
```

### GET /api/customers/search?q=John
```json
[
  {
    "id": "uuid",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "09171234567",
    "email": "john@example.com"
  }
]
```

---

## 📝 Testing Checklist

### UI Testing
- [ ] All 6 steps render correctly
- [ ] Back/forward navigation works
- [ ] Form validation (required fields)
- [ ] Calculations accurate (VAT, totals, change)
- [ ] Responsive on desktop (POS terminals are wide)
- [ ] Error messages clear and helpful

### API Testing
- [ ] POST /api/orders/pos/create with valid payload succeeds
- [ ] Creates customer if doesn't exist
- [ ] Deducts inventory correctly
- [ ] Returns proper error messages
- [ ] Transaction rolls back on failure

### Edge Cases
- [ ] Basket > 8kg auto-creates new basket ✓
- [ ] Iron minimum 2kg enforced ✓
- [ ] Delivery fee not below 50 ✓
- [ ] Insufficient stock blocks order ✓
- [ ] Underpayment blocks checkout ✓
- [ ] Customer search debounces ✓

---

## 🎓 Code Examples to Reference

### Services Table - How to format financial values
```typescript
// In products/services pages
`₱${parseFloat(service.base_price).toFixed(2)}`

// Apply same everywhere in POS
```

### Products Page - Modal pattern
```typescript
// Right-slide modal from products/page.tsx
// Use same EditModal architecture for payment modal
```

### Image Display - From products
```typescript
// Already tested, use same pattern for product images in ProductSelector
<img src={product.image_url} className="w-full h-32 object-cover rounded" />
```

---

## ⚠️ Common Pitfalls to Avoid

1. **Don't** pre-calculate VAT - let backend do it
2. **Don't** allow iron < 2kg or > 8kg
3. **Don't** skip debouncing on customer search
4. **Don't** create multiple baskets for 8kg limit - auto-create
5. **Don't** mix service_fee and drop_off_fee - they're the same
6. **Don't** forget to validate delivery fee >= 50
7. **Don't** forget transaction rollback on order creation failure
8. **Don't** forget inventory deduction in API (product_transactions)
9. **Don't** render receipt before order actually created
10. **Don't** forget to show loyalty discount BEFORE final payment

---

## 📱 Responsive Design Notes

POS terminals are typically:
- Wide (1024px minimum, often 1280px+)
- Use 2-column layout (form left, summary right)
- Summary should be sticky (stays in view while scrolling form)
- Buttons should be touch-friendly (44px minimum height)

---

## 🔐 Security Notes

1. **Service key** only in server routes (`POST /api/orders/pos/create`)
2. **Public key** only in client components
3. **Validate all inputs** server-side
4. **Check inventory** server-side before deduction
5. **Use transactions** to prevent partial updates

---

## 📚 Files You'll Create/Edit

```
src/app/in/pos/
├── page.tsx (NEW)
├── components/
│   ├── ServiceTypeSelector.tsx (NEW)
│   ├── BasketConfigurator.tsx (NEW)
│   ├── ProductSelector.tsx (NEW)
│   ├── CustomerLookup.tsx (NEW)
│   ├── DeliveryHandler.tsx (NEW)
│   ├── OrderSummary.tsx (NEW)
│   ├── PaymentModal.tsx (NEW)
│   └── ReceiptModal.tsx (NEW)
└── logic/
    ├── usePOSState.ts (NEW)
    ├── posTypes.ts (NEW)
    ├── posHelpers.ts (NEW)
    └── breakdownBuilder.ts (NEW)

src/app/api/orders/pos/
└── create/
    └── route.ts (NEW)
```

---

## 🎯 Success Criteria

When complete, you should be able to:

1. ✅ Add service baskets with various configurations
2. ✅ Add product items from inventory
3. ✅ Search and select customers (or create new)
4. ✅ Specify delivery details with fee
5. ✅ Calculate totals with VAT (12% inclusive)
6. ✅ Process payment (cash or GCash)
7. ✅ Create order with transactional safety
8. ✅ Display receipt
9. ✅ Deduct inventory
10. ✅ Handle errors gracefully

---

## 📞 Questions Before Starting?

If anything is unclear:
- Reference `POS_OVERHAUL_CRITICAL_REVIEW_ANSWERS.md` for business logic Q&A
- Reference `IMPLEMENTATION_GAMEPLAN.md` for phased approach
- Reference services/products pages for code patterns
- Reference database tables for exact schema

---

**Ready to build? Start with Phase 1 UI components!**
