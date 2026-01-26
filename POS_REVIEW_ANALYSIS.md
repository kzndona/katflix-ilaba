# POS System Review & Analysis

**Date:** January 26, 2026  
**Reviewed by:** Claude Haiku 4.5  
**Status:** Ready for Overhaul Planning

---

## Executive Summary

Your POS system is a comprehensive laundry service ordering platform with a sophisticated state management system. It handles basket-based laundry services, product sales, customer loyalty, and flexible payment/delivery options. The system is well-structured but has areas for UX improvement and feature expansion.

---

## Current Architecture

### 1. **Core Flow**

```
Customer Selection → Baskets (Laundry Services) → Products → Handling (Pickup/Delivery) → Payment → Order Creation
```

### 2. **Technology Stack**

- **Frontend:** Next.js 13+ (App Router), React, Tailwind CSS
- **State Management:** React hooks (usePOSState)
- **Backend:** Next.js API Routes
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth

### 3. **Key Components**

#### Page Structure

- **page.tsx** - Main POS page (3-column layout)
  - Left: SidebarTabs (navigation + basket list)
  - Center: Dynamic pane renderer (Customer/Basket/Products/Handling)
  - Right: PaneReceipt (summary + checkout)

#### Components (`/components`)

- **sidebarTabs.tsx** - Navigation & basket tabs
- **paneCustomer.tsx** - Customer search & selection
- **paneBaskets.tsx** - Laundry basket configuration (weight, services, notes)
- **paneProducts.tsx** - Product catalog & order
- **paneHandling.tsx** - Pickup/delivery options
- **paneReceipt.tsx** - Order summary & checkout button
- **receiptModal.tsx** - Receipt display modal

#### Logic (`/logic`)

- **usePOSState.tsx** (767 lines) - Central state management hook
  - Manages products, customers, baskets, services, payment, handling
  - Handles data fetching from Supabase
  - Builds order breakdown JSON
  - Contains saveOrder() logic
- **orderHelpers.ts** - Order processing utilities
- **orderTypes.ts** - TypeScript type definitions (comprehensive JSONB structures)
- **receiptGenerator.ts** - Receipt formatting

---

## Current Features

### ✅ Implemented

1. **Customer Management**
   - Search by first name, last name, phone number
   - Auto-selection from suggestions
   - Create/Select customers
   - Loyalty points tracking (10pts = 10%, 20pts = 15% discount)

2. **Basket-Based Services**
   - Multiple laundry baskets per order
   - Weight tracking (kg)
   - Service selection: Wash, Dry, Spin, Iron, Fold
   - Premium tier for Wash & Dry services
   - Service pricing by kg + multiplier
   - Duration estimation from service data

3. **Products**
   - Product catalog with price/cost tracking
   - Quantity management
   - Tax calculation (12% VAT)

4. **Order Processing**
   - Unified transactional endpoint: `POST /api/orders/transactional-create`
   - Supports both POS and Mobile formats
   - Service fee (PHP40) when services present
   - Inventory deduction on order save

5. **Payment**
   - Cash (with change calculation)
   - GCash (with reference number)
   - Amount validation

6. **Delivery/Pickup**
   - Toggle pickup/delivery
   - Delivery fee configuration
   - Address input
   - Courier reference tracking
   - Special instructions

7. **Loyalty System**
   - Points accumulation from orders
   - Two-tier discount tiers (10pts, 20pts)
   - Optional loyalty discount application
   - Points deduction on use

8. **Receipt Generation**
   - Compact receipt format
   - Detailed breakdown display
   - Modal-based viewing
   - Email sending capability

---

## Data Flow

### Order Creation Flow

1. User selects/creates customer → Updates loyalty points
2. Adds baskets with weight + services
3. Optionally adds products
4. Configures pickup/delivery
5. Selects payment method
6. Confirmation modal → Validates input
7. **saveOrder() executes:**
   - Validates customer selection
   - Validates basket configurations
   - Builds comprehensive breakdown JSON
   - Gets authenticated cashier ID
   - Calls `/api/orders/transactional-create`
   - Generates receipt from database
   - Shows receipt modal
   - Resets POS state

### Database Calls (Supabase)

- **Load:** products, services, customers
- **Search:** customers (real-time search)
- **Fetch:** loyalty_points on customer select
- **Get:** auth user, staff record
- **Save:** order via API endpoint

---

## Current State Structure

```typescript
{
  // Products & Services
  products: Product[]
  services: LaundryService[]
  loadingProducts: boolean

  // Customer
  customer: Customer | null
  customerQuery: string
  customerSuggestions: Customer[]
  customerLoyaltyPoints: number
  useLoyaltyDiscount: boolean

  // Baskets & Items
  baskets: Basket[]
  activeBasketIndex: number
  orderProductCounts: Record<string, number>

  // Order Totals
  computeReceipt: {
    productLines: ReceiptProductLine[]
    basketLines: ReceiptBasketLine[]
    productSubtotal: number
    basketSubtotal: number
    serviceFee: number
    handlingFee: number
    taxIncluded: number
    total: number
    loyaltyDiscountAmount: number
    loyaltyPointsUsed: number
    loyaltyDiscountPercentage: number
    breakdown: BreakdownJSON
    handling: HandlingJSON
  }

  // Payment & Checkout
  handling: HandlingState
  payment: Payment
  showConfirm: boolean
  isProcessing: boolean

  // UI State
  activePane: "customer" | "basket" | "products" | "handling"
  showReceiptModal: boolean
  receiptContent: string
  lastOrderId: string | null
}
```

---

## Issues & Observations

### 🔴 Critical Issues

1. **No Basket-to-Machine Assignment**
   - Baskets have `machine_id` field but UI doesn't assign machines
   - Processing/completion would be difficult without machine tracking
   - Impact: Cannot track which washing machine/dryer used

2. **Incomplete Handling Data**
   - `handling` object has `pickup: true`, `deliver: false`
   - But `buildHandlingJSON()` expects `HandlingStage` objects with timestamps/status
   - Mismatch between UI state and database schema
   - Impact: Handling data may not save correctly

3. **Missing Payment Snapshot**
   - Payment method/amount collected but not fully integrated into breakdown
   - `breakdownWithPayment` updates breakdown.payment but type safety unclear
   - Impact: Payment audit trail might be incomplete

### 🟡 Medium Issues

1. **UX Friction Points**
   - 4 separate panes to navigate (Customer → Basket → Products → Handling)
   - Customer validation happens multiple times
   - No progress indicator showing which step user is on
   - No ability to edit previous panes after moving forward
   - Impact: Users can't quickly adjust baskets after selecting products

2. **Basket Management Complexity**
   - No drag-drop reordering
   - Basket numbering doesn't persist logically
   - No bulk operations (e.g., "apply to all baskets")
   - Impact: Adding/managing multiple baskets is tedious

3. **Service Selection Ambiguity**
   - Premium toggle is boolean but names include "Premium" string
   - `getServiceByType()` uses string matching which is fragile
   - No visual distinction between basic/premium tiers
   - Impact: Users might not understand premium pricing

4. **Pricing Transparency**
   - Service fee (PHP40) only shown in final receipt
   - Tax calculation not detailed in breakdown
   - Loyalty discount applies at last moment
   - Impact: Users don't see total cost until payment modal

5. **Error Handling**
   - Validation warnings only shown as alert() boxes
   - No inline validation feedback
   - Receipt generation failure falls back to alert
   - Impact: Poor error visibility and debugging

### 🟢 Minor Issues

1. Auto-clearing customer if no selection after 3s is UX gotcha
2. Empty baskets (0kg) filtered from order but UI shows them initially
3. `calculateBasketDuration()` called in render but purely informational
4. No confirmation before deleting a basket with weight/services
5. Toast notifications missing (using alerts instead)
6. No loading states for slow Supabase queries
7. Limited keyboard navigation (no Enter to confirm, Esc to cancel)

---

## Missing Features

### High Priority

1. **Draft Orders**
   - Save WIP orders without finalizing
   - Resume from draft later
   - Auto-save every 30s

2. **Order Modifications**
   - View recent orders and duplicate
   - Modify pending orders before processing starts
   - Cancel/refund completed orders

3. **Inventory Management**
   - Real-time stock checking
   - Low-stock warnings
   - Backorder handling

4. **Batch Operations**
   - Mark multiple orders ready for pickup
   - Bulk print receipts
   - Daily shift reports

### Medium Priority

1. **Discounts & Promotions**
   - Bulk basket discounts
   - Promotional codes
   - Staff discounts
   - Time-based discounts (off-peak rates)

2. **Analytics**
   - Daily POS sales report
   - Popular products/services
   - Customer repeat rates
   - Cashier performance

3. **Customer Communication**
   - SMS notifications (order ready, delivery arriving)
   - WhatsApp integration
   - Email receipt with order tracking link

### Lower Priority

1. **Accessibility**
   - Keyboard shortcuts (F1 for help, Ctrl+S for save)
   - Screen reader support
   - High contrast mode

2. **Multi-User**
   - Role-based permissions (manager vs cashier)
   - Concurrent customer handling
   - Order assignment to specific staff

---

## Performance Observations

### Current Optimizations

- `computeReceipt` uses `useMemo` (depends on 8+ values)
- Services loaded once on mount
- Customer search is real-time (should debounce?)

### Potential Bottlenecks

1. **Customer search** - No debouncing, fires on every keystroke
2. **Product loading** - 100+ items loaded client-side if not filtered
3. **Receipt generation** - DB call + text formatting done sequentially
4. **No pagination** - All baskets rendered even if many

---

## Code Quality

### Strengths

- Clear separation of concerns (hooks, components, types)
- Comprehensive type definitions (orderTypes.ts)
- Good naming conventions
- Consistent error logging

### Improvements Needed

1. `usePOSState.tsx` is 767 lines → Consider splitting into smaller hooks
2. Component props are untyped in many places (using `any`)
3. No unit tests visible
4. Inline styles mixed with Tailwind (color maps, etc.)
5. Magic numbers (PHP40, 3000ms timeout, 0.12 tax rate)

---

## Database Schema Alignment

### Current ↔ Intended

| Aspect   | Current           | Intended                       |
| -------- | ----------------- | ------------------------------ |
| Handling | UI state only     | JSONB with timestamps/statuses |
| Baskets  | In-memory array   | Should link to machines        |
| Payment  | Collected locally | JSONB in breakdown             |
| Services | ID + name         | ID + type + name + variant     |

---

## Recommendations for Overhaul

### Phase 1: Foundation (Immediate)

1. Fix handling data mismatch (align UI to schema)
2. Add machine assignment to baskets
3. Implement form-based multi-step with back/forward buttons
4. Add inline validation with error messages
5. Implement toast notifications

### Phase 2: UX (Short-term)

1. Convert 4 panes → 2 panes (Item Selection | Review & Payment)
2. Add "Order Summary" sidebar showing all selections
3. Implement keyboard shortcuts
4. Add loading states for DB queries
5. Debounce customer search

### Phase 3: Features (Medium-term)

1. Draft order saving
2. Order modification/duplication
3. Inventory alerts
4. Discount system
5. Daily reports

### Phase 4: Polish (Long-term)

1. Real-time multi-user handling
2. SMS/WhatsApp notifications
3. Analytics dashboard
4. Accessibility improvements
5. Mobile POS layout

---

## Questions for Clarification

Before overhaul, please clarify:

1. **Machine Assignment** - Should each basket be assigned to a specific washing machine/dryer? How should this affect order fulfillment?

2. **Handling Data** - What does the current handling object save to the database? Are pickup/delivery stages tracked in `HandlingJSON`?

3. **Pane Navigation** - Should users be able to go back and edit previous panes? Or is it linear?

4. **Basket Limits** - Is there a max number of baskets per order? Any special handling for large orders (100+ kg)?

5. **Draft Orders** - Is saving incomplete orders a requirement?

6. **Reporting** - Who needs daily reports? What metrics matter most?

7. **Mobile Sync** - How does the Mobile app integrate with POS? Shared orders?

8. **Staffing** - Are there different POS interfaces for manager vs cashier? Any permission levels?

---

## File Structure Overview

```
src/app/in/pos/
├── page.tsx                    # Main POS page (3-column layout)
├── components/
│   ├── sidebarTabs.tsx         # Navigation & basket tabs
│   ├── paneCustomer.tsx        # Customer selection pane
│   ├── paneBaskets.tsx         # Basket configuration pane (463 lines)
│   ├── paneProducts.tsx        # Product selection pane
│   ├── paneHandling.tsx        # Delivery/pickup pane
│   ├── paneReceipt.tsx         # Order summary pane (426 lines)
│   └── receiptModal.tsx        # Receipt display modal
└── logic/
    ├── usePOSState.tsx         # Central state hook (767 lines) ⭐
    ├── types.ts                # Type definitions
    ├── orderTypes.ts           # Order schema types (303 lines)
    ├── orderHelpers.ts         # Order processing helpers
    ├── receiptGenerator.ts     # Receipt formatting
```

---

## Next Steps

1. **Review This Analysis** - Confirm observations align with your intent
2. **Answer Clarification Questions** - Help prioritize overhaul scope
3. **Define Overhaul Goals** - What's broken? What's missing? What's priority?
4. **Create Detailed Spec** - Feature list, mockups, user flows
5. **Build Phase 1** - Foundation fixes + UX improvements

---

**This document is a living reference for the POS overhaul project.**
