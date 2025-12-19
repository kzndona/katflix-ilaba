# API Architecture Analysis

## Question 7: API Structure for Order Management

### Option A: One Comprehensive Endpoint (`/api/orders`)

**Endpoint: `POST/GET/PUT /api/orders`**

```typescript
POST /api/orders
{
  action: 'create' | 'read' | 'update',
  payload: { ... }
}

// Or separate methods:
POST /api/orders              // Create
GET /api/orders/:id           // Read
PUT /api/orders/:id           // Update
```

**Pros:**
- ✅ Single source of truth for order logic
- ✅ Easier to maintain consistent business rules
- ✅ Simpler authentication (one endpoint to protect)
- ✅ Less API surface area to document
- ✅ Transaction handling in one place (all-or-nothing)

**Cons:**
- ❌ Fat endpoint - does too much
- ❌ Harder to scale individual operations
- ❌ Complex action routing logic needed
- ❌ Difficult to add specific validations per operation
- ❌ Blurs responsibility (SRP violation)

**Best For:** Small teams, simple operations, monolithic architecture

---

### Option B: Separate Endpoints (`/api/orders/create`, `/api/orders/update`, etc.)

**Endpoints:**
```
POST /api/orders/create
GET /api/orders/fetch/:id
PUT /api/orders/update/:id
POST /api/orders/cancel/:id
PATCH /api/orders/update-service-status/:id
```

**Pros:**
- ✅ Clear responsibility separation (SRP)
- ✅ Specific error handling per operation
- ✅ Easier to test individual operations
- ✅ Can add operation-specific validation/authorization
- ✅ Better for API versioning (v1/v2)
- ✅ Easier to add logging/monitoring per operation

**Cons:**
- ❌ More endpoints to maintain
- ❌ Risk of duplicated logic
- ❌ Need versioning strategy
- ❌ More complex URL structure
- ❌ Transaction coordination harder (multiple endpoints)

**Best For:** Medium teams, multiple client types, complex operations

---

### Option C: RESTful Style (`/api/orders`, standard HTTP verbs)

**Endpoints:**
```
POST /api/orders                    // Create
GET /api/orders/:id                 // Read (fetch one)
PUT /api/orders/:id                 // Update (full replacement)
PATCH /api/orders/:id               // Partial update
DELETE /api/orders/:id              // Cancel/soft-delete
GET /api/orders?filter=status:completed  // List with filters
```

**Pros:**
- ✅ Standard REST conventions (familiar to most developers)
- ✅ Great for CRUD-heavy APIs
- ✅ Easy to understand for new developers
- ✅ Natural caching behavior (GET vs POST/PUT)
- ✅ Aligns with REST architectural principles
- ✅ Works well with API clients (Postman, etc.)

**Cons:**
- ❌ HTTP verbs (PUT/PATCH) semantics sometimes ambiguous
- ❌ Complex operations don't map well to CRUD
- ❌ DELETE semantics: hard delete vs soft delete vs cancel?
- ❌ May need custom query parameters for complex filters
- ❌ Versioning still needed

**Best For:** Public APIs, standard CRUD operations, API-first design

---

## Recommendation for Katflix

**Use Option C (RESTful) with selective Option B (custom endpoints for non-CRUD operations)**

```typescript
// Standard CRUD
POST /api/orders                              // Create new order
GET /api/orders/:id                           // Read order details
GET /api/orders                               // List orders (with filters)

// Complex/non-CRUD operations
PATCH /api/orders/:id/service-status          // Update service status in breakdown
POST /api/orders/:id/cancel                   // Cancel order (not DELETE)
PATCH /api/orders/:id/payment-status          // Update payment status
PATCH /api/orders/:id/handling-status         // Update handling stage status
```

**Why this works for you:**
- ✅ Orders are mostly CRUD (create, read, update)
- ✅ Complex updates (service status) are well-defined and separate
- ✅ Cancel is not a DELETE - it's a specific business operation
- ✅ Future proof (easy to add more operations)
- ✅ Clear semantics for each operation
- ✅ Easy to implement role-based authorization per endpoint

---

## Question 9: Service Status Update Approaches

**Constraint:** No separate table (so no audit_logs or service_updates table)

### Approach A: Direct JSONB Update Endpoint

**Endpoint:** `PATCH /api/orders/:id/service-status`

```typescript
Request:
{
  basket_index: 0,
  service_index: 1,
  status: 'in_progress',
  completed_by: 'staff-uuid',
  completed_at: '2025-12-19T10:30:00Z'
}

Response:
{
  success: true,
  order: { ... full updated order ... }
}
```

**How it works:**
1. Validate service exists at breakdown.baskets[basket_index].services[service_index]
2. Update JSONB field directly: `jsonb_set(breakdown, '{"baskets",0,"services",1,"status"}', '"completed"')`
3. Update `completed_at` and `completed_by` in same operation
4. Return full order (proving the change)

**Pros:**
- ✅ Simple, direct update
- ✅ Single database operation
- ✅ Full order returned for audit trail
- ✅ No separate tables needed
- ✅ History available via: ORDER history (point-in-time recovery if DB supports)

**Cons:**
- ❌ No separate audit log stored
- ❌ Cannot see WHO changed it or WHEN exactly (only final state in breakdown)
- ❌ Hard to trace intermediate states
- ❌ Requires full order fetch to see history
- ❌ If DB doesn't have MVCC/audit, changes are lost

**Best for:** Simple status tracking, current state is most important

---

### Approach B: Audit Array in Breakdown JSON

**Concept:** Add an `audit_log` array to `breakdown` that records all state changes

```typescript
breakdown: {
  items: [ ... ],
  baskets: [ ... ],
  fees: [ ... ],
  discounts: [ ... ],
  summary: { ... },
  payment: { ... },
  
  // NEW: Audit log array
  audit_log: [
    {
      action: 'created',
      timestamp: '2025-12-19T09:00:00Z',
      changed_by: 'cashier-uuid'
    },
    {
      action: 'service_status_changed',
      service_path: 'baskets.0.services.1',
      from_status: 'pending',
      to_status: 'in_progress',
      timestamp: '2025-12-19T09:15:00Z',
      changed_by: 'attendant-uuid'
    },
    {
      action: 'service_completed',
      service_path: 'baskets.0.services.1',
      status: 'completed',
      timestamp: '2025-12-19T09:45:00Z',
      changed_by: 'attendant-uuid'
    },
    {
      action: 'payment_received',
      method: 'cash',
      amount: 5000,
      timestamp: '2025-12-19T10:00:00Z',
      changed_by: 'cashier-uuid'
    }
  ]
}
```

**Endpoint:** `PATCH /api/orders/:id/service-status`

```typescript
Request:
{
  basket_index: 0,
  service_index: 1,
  status: 'completed',
  completed_by: 'staff-uuid'
}

Database Operation:
UPDATE orders SET 
  breakdown = jsonb_set(
    jsonb_set(
      breakdown,
      '{"baskets",0,"services",1,"status"}',
      '"completed"'
    ),
    '{"audit_log", -1}',  // Append to end of array
    jsonb_build_object(
      'action', 'service_completed',
      'service_path', 'baskets.0.services.1',
      'timestamp', NOW(),
      'changed_by', 'staff-uuid'
    )
  )
WHERE id = order_id
RETURNING *;
```

**Pros:**
- ✅ Complete audit trail in one JSONB column
- ✅ Can see exact history of all changes
- ✅ Can reconstruct order state at any point in time
- ✅ No separate tables
- ✅ Easy to query: `SELECT breakdown->'audit_log' FROM orders`
- ✅ Perfect for compliance/debugging

**Cons:**
- ❌ JSONB grows over time (not a problem, but note it)
- ❌ Complex jsonb_set() operations (need helper functions)
- ❌ Harder to query specific changes (require JSON navigation)
- ❌ If audit_log gets very large, JSON parsing slower
- ❌ Requires discipline to log all changes

**Best for:** Full audit trails, compliance requirements, debugging

---

### Approach C: Database Versioning (MVCC)

**Concept:** Rely on database change history/versioning

**How it works:**
- PostgreSQL has transaction visibility/MVCC
- Enable `pg_stat_statements` to track queries
- Use `SELECT * FROM orders WHERE id=X` at different times
- Or use `temporal_tables` extension for automatic versioning

**Pros:**
- ✅ Automatic, no code needed
- ✅ Complete history without extra storage
- ✅ Can query any point in time

**Cons:**
- ❌ Requires PostgreSQL extensions (temporal_tables)
- ❌ Hard to query who made the change (no user info)
- ❌ More complex setup
- ❌ Can be slow for large tables
- ❌ Not portable to other databases

**Best for:** Enterprise systems with DBA support

---

## Recommendation for Katflix

**Use Approach B (Audit Array in Breakdown)**

**Why:**
- ✅ Complete audit trail without separate tables
- ✅ Everything in one immutable JSONB snapshot
- ✅ Can query history easily
- ✅ Supports future compliance needs
- ✅ Perfect for your "ensure everything can be audited" requirement
- ✅ Easy to extend (add more actions as needed)

**Implementation:**
```typescript
// Helper function to append to audit log
const addAuditLog = (breakdown, action, details, stafffId) => {
  return {
    ...breakdown,
    audit_log: [
      ...(breakdown.audit_log || []),
      {
        action,
        timestamp: new Date().toISOString(),
        changed_by: staffId,
        ...details
      }
    ]
  };
};

// Usage when updating service status
const newBreakdown = addAuditLog(
  breakdown,
  'service_completed',
  {
    service_path: `baskets.${basketIdx}.services.${serviceIdx}`,
    from_status: breakdown.baskets[basketIdx].services[serviceIdx].status,
    to_status: 'completed'
  },
  attendantId
);
```

---

## Summary Table

| Aspect | Option A (Comprehensive) | Option B (Separate) | Option C (RESTful) |
|--------|--------------------------|---------------------|--------------------|
| Simplicity | ⭐⭐⭐ | ⭐⭐ | ⭐⭐⭐⭐ |
| Maintainability | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Scalability | ⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐ |
| Standards Compliance | ⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Recommendation** | ❌ | ✅ (for complex ops) | ✅ **PRIMARY** |

| Aspect | Approach A (Direct) | Approach B (Audit Array) | Approach C (MVCC) |
|--------|---------------------|--------------------------|-------------------|
| Audit Trail | ⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| Complexity | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐ |
| Query Performance | ⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ |
| Compliance | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Recommendation** | ❌ | ✅ **PRIMARY** | ⭐ (enterprise only) |

