# POS Overhaul - Implementation Gameplan

**Date:** January 26, 2026  
**Status:** Ready to Execute

---

## Dependency Analysis

```
┌─────────────────────────────────────────────────────────────┐
│                      DATABASE SCHEMA                         │
│  (Everything depends on this - lock it down FIRST)          │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴───────────────┐
        ▼                              ▼
┌──────────────────┐        ┌──────────────────┐
│  API Contracts   │        │  UI/UX Design    │
│ (Data shapes)    │        │  (Components)    │
└────────┬─────────┘        └─────────┬────────┘
         │                            │
         │        ┌──────────────────┬┘
         │        ▼                  ▼
         │   ┌─────────────────────────────┐
         └──→│  API Implementation         │
             │ (Backend logic)             │
             └────────┬────────────────────┘
                      ▼
             ┌─────────────────────────────┐
             │  Integration & Testing      │
             └─────────────────────────────┘
```

**Key Insight:** Database schema is the foundation. Everything else builds on it.

---

## Recommended Sequence

### Phase 1: Foundation (1-2 days)

**Goal:** Lock down schema before writing any code

#### 1.1 Database Schema Refinement

**What:** Define exact database changes needed
**Duration:** 4-6 hours
**Deliverables:**

- [ ] Migration SQL file (create/modify tables)
- [ ] New JSONB structure definitions
- [ ] Service tier/variant handling
- [ ] Updated breakdown structure
- [ ] Updated handling structure

**Key Changes Needed:**

1. Add `service_tier` or `variant` column to services table (basic/premium)
2. Modify `breakdown` JSONB structure:
   - Add `drop_off_service` field (boolean)
   - Add special instructions
   - Fix VAT calculation (inclusive, not additive)
3. Modify `handling` JSONB structure:
   - Add `special_instructions`
   - Add `delivery_fee_override`
4. Add `basket_service_charge` (boolean) to track self-service vs staff-service
5. Create/update `product_transactions` for inventory deduction

**Why here?** Everything else depends on knowing the data structure.

---

#### 1.2 API Specification Document

**What:** Define all new/modified API endpoints
**Duration:** 2-3 hours
**Deliverables:**

- [ ] Request/response shapes for each endpoint
- [ ] Error handling strategy
- [ ] Transaction flow (create order with everything)
- [ ] Validation rules

**Key Endpoints:**

1. `POST /api/orders/pos/create` (new unified POS endpoint)
2. `GET /api/products` (with images, stock, etc.)
3. `GET /api/services` (grouped by type + tier)
4. `GET /api/customers/search` (debounced)
5. `PATCH /api/orders/:id/service-status` (update service status)

**Why here?** UI team needs to know exactly what to call and what data structure to expect.

---

### Phase 2: UI Design & Build (3-4 days)

**Goal:** Complete new POS UI following the guide

**Why this order?** Now we know:

- What data schema exists (Phase 1.1)
- What APIs will return (Phase 1.2)
- Can build with confidence

#### 2.1 Component Architecture

**Duration:** 2-3 hours
**Create:**

- [ ] New component structure (following guide)
- [ ] State management plan
- [ ] Data flow diagrams

**Components Needed:**

```
src/app/in/pos/
├── page.tsx (main layout)
├── components/
│   ├── ServiceTypeSelector.tsx    (Self-service vs Staff-service)
│   ├── BasketConfigurator.tsx     (Wash/Dry/Spin/Iron/Fold + Plastic Bags)
│   ├── ProductSelector.tsx        (Products with images)
│   ├── CustomerLookup.tsx         (Search + create)
│   ├── DeliveryHandler.tsx        (Pickup/Delivery address + fee)
│   ├── OrderSummary.tsx           (Right sidebar)
│   ├── OrderReview.tsx            (Before payment)
│   ├── PaymentModal.tsx           (Cash/GCash)
│   └── ReceiptModal.tsx           (Post-order)
└── logic/
    ├── usePOSState.ts             (Simplified state hook)
    ├── posTypes.ts                (Type definitions)
    ├── posHelpers.ts              (Calculation helpers)
    └── breakdownBuilder.ts        (Build JSONB structures)
```

#### 2.2 UI Implementation

**Duration:** 2-3 days
**Build in sequence:**

1. [ ] Step 0: Service Type Selector (Self-service vs Staff-service)
2. [ ] Step 1: Basket Configurator
3. [ ] Step 2: Product Selector
4. [ ] Step 3: Customer Lookup
5. [ ] Step 4: Delivery Handler
6. [ ] Step 5: Order Review
7. [ ] Step 6: Payment Modal
8. [ ] Right Sidebar: Order Summary (real-time updates)

**Why sequential?** Each step builds on previous data; easier to test incrementally.

---

### Phase 3: API Implementation (2-3 days)

**Goal:** Build backend to support UI
**Can be done in parallel with Phase 2 UI**

#### 3.1 Database Migrations

**Duration:** 1-2 hours
**Execute:** Schema changes from Phase 1.1

#### 3.2 API Endpoints

**Duration:** 2 days
**Build in order:**

1. [ ] GET /api/services (return all services with pricing)
2. [ ] GET /api/products (return all products with images, stock)
3. [ ] POST/GET /api/customers (search, create, update)
4. [ ] POST /api/orders/pos/create (main transactional endpoint)
5. [ ] Other supporting endpoints

#### 3.3 Business Logic

**Duration:** 1 day
**Implement:**

- [ ] Breakdown JSONB builder
- [ ] Handling JSONB builder
- [ ] VAT calculation (inclusive)
- [ ] Loyalty discount logic
- [ ] Inventory deduction
- [ ] Transaction handling (rollback on failure)

---

### Phase 4: Integration & Testing (1-2 days)

**Goal:** Wire everything together

#### 4.1 Connect UI to APIs

**Duration:** 1 day

- [ ] Update API calls in components
- [ ] Handle errors gracefully
- [ ] Add loading states

#### 4.2 End-to-End Testing

**Duration:** 1 day

- [ ] Create test orders with various combinations
- [ ] Verify database records created correctly
- [ ] Check receipt generation
- [ ] Test edge cases (overpayment, underpayment, etc.)

#### 4.3 Performance & Polish

**Duration:** 0.5 day

- [ ] Debounce customer search
- [ ] Lazy-load product images
- [ ] Optimize component renders
- [ ] Fix UI/UX issues found during testing

---

## Total Timeline

| Phase                             | Duration     | Effort   |
| --------------------------------- | ------------ | -------- |
| 1. Foundation (Schema + API Spec) | 1 day        | 20%      |
| 2. UI Design & Build              | 3-4 days     | 50%      |
| 3. API Implementation             | 2-3 days     | 25%      |
| 4. Integration & Testing          | 1-2 days     | 5%       |
| **TOTAL**                         | **7-9 days** | **100%** |

---

## Why This Order?

### ❌ Don't: Build UI First, Figure Out Schema Later

- UI built on assumptions that might be wrong
- Major refactor when schema doesn't match
- APIs built last are rushed
- **Wasted effort**

### ❌ Don't: Build APIs First Without UI Design

- APIs built for non-existent UI features
- Wrong data shapes returned
- APIs need redesign when UI reveals requirements
- **Wasted effort**

### ✅ Do: Schema → API Design → UI + APIs (parallel) → Testing

- Schema is the source of truth (single change point)
- APIs designed before implementation (fewer surprises)
- UI and APIs built in parallel (no bottlenecks)
- Testing catches integration issues early
- **Efficient pipeline**

---

## Parallel Work Opportunities

**Week 1:**

```
Monday:
  - You: Database schema refinement
  - Me: API specification document
  - (Both complete by EOD)

Tuesday-Thursday:
  - You: Build UI components (steps 0-6)
  - Me: Implement APIs endpoints in parallel
  - Daily sync on blockers

Friday:
  - Integration testing
  - Polish & fixes
```

---

## Checkpoints & Validation

### Checkpoint 1: Schema Lock (End of Phase 1)

- [ ] Database migration file reviewed
- [ ] JSONB structures finalized
- [ ] API contract document complete
- **Decision:** Ready for Phase 2?

### Checkpoint 2: UI Components Built (Mid Phase 2)

- [ ] All components functional with mock data
- [ ] State management working
- [ ] Layout matches guide
- **Decision:** Ready for API integration?

### Checkpoint 3: APIs Complete (End of Phase 3)

- [ ] All endpoints implemented
- [ ] Database transactions working
- [ ] Error handling in place
- **Decision:** Ready for integration?

### Checkpoint 4: Integration Complete (End of Phase 4)

- [ ] UI calls APIs correctly
- [ ] Database records created correctly
- [ ] No crashes or errors
- **Decision:** Ready for production?

---

## Risk Mitigation

### Risk 1: Requirements Change Mid-Build

**Mitigation:** Lock requirements NOW

- We've clarified most details in IMPLEMENTATION_READY_QUESTIONS.md
- Remaining 4 blocking questions are simple
- No more surprises after Phase 1

### Risk 2: Schema Needs Change After Build Starts

**Mitigation:** Build schema changes first

- Migration file ready before any code written
- If schema changes, update migration + API spec
- No rework of UI/API code needed

### Risk 3: UI Components Block API Implementation

**Mitigation:** Build in parallel after Phase 1

- Schema locked
- API contract defined
- UI team can build with mock data
- API team can build endpoints in parallel
- No dependencies = no blocking

### Risk 4: Performance Issues on Supabase Free Tier

**Mitigation:** Plan for constraints

- [ ] Debounce all searches (300-500ms)
- [ ] Lazy-load product images
- [ ] Cache services/products on client
- [ ] Batch API calls where possible
- [ ] Monitor request usage

---

## What I'll Need From You

### Before Phase 1 Starts:

1. **Answer the 4 blocking questions** in IMPLEMENTATION_READY_QUESTIONS.md
   - Self-service UI placement
   - Plastic bag placement
   - Fold pricing
   - Iron UI (use -/+ buttons)

2. **Confirm database access**
   - Can you run SQL migrations on Supabase?
   - Do you have admin access to database?

3. **Confirm priority conflicts**
   - Are there other projects blocking time?
   - Can we focus on POS overhaul exclusively?

### During Phase 1 (Phase 1 work):

1. Database schema changes (I can draft, you execute on Supabase)
2. API specification review (quick validation)

### During Phase 2-3 (Parallel work):

1. Answer questions as they come up
2. Review components/endpoints as they're built
3. Test on actual Supabase (not mock data)

### During Phase 4 (Testing):

1. Test user flows
2. Verify business logic matches guide
3. Sign off on final product

---

## Next Steps

1. **Answer 4 blocking questions** (30 min)
2. **I draft database schema migration** (1-2 hours)
3. **You review & approve** (30 min)
4. **I create API specification document** (2-3 hours)
5. **You review & approve** (30 min)
6. **Phase 2-3 begins** (UI + APIs in parallel)

---

**This gameplan assumes we start immediately after Phase 1. Ready to proceed?**
