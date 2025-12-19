# Data Duplication Analysis & Resolution

## Current Redundancy Issues

### Problem 1: Started/Completed Timestamps Duplicated Across Layers

**Current Structure:**

```json
breakdown: {
  baskets: [
    {
      services: [
        {
          started_at: "2025-12-19T10:15:00Z",
          completed_at: "2025-12-19T10:45:00Z",
          completed_by: "staff-uuid",
          status: "completed"
        }
      ]
    }
  ],
  audit_log: [
    {
      action: "service_started",
      timestamp: "2025-12-19T10:15:00Z",
      changed_by: "staff-uuid"
    },
    {
      action: "service_completed",
      timestamp: "2025-12-19T10:45:00Z",
      changed_by: "staff-uuid"
    }
  ]
}

handling: {
  pickup: {
    started_at: "2025-12-19T09:00:00Z",
    completed_at: "2025-12-19T09:30:00Z",
    completed_by: "rider-uuid"
  }
}
```

**Issues:**

- ❌ Same timestamp appears twice (in object + in audit_log)
- ❌ `completed_by` appears twice
- ❌ If one is updated, the other might not be
- ❌ Confusion about which is source of truth
- ❌ Wasted storage

---

## Solution: Separation of Concerns

### Principle

- **Object timestamps** (started_at, completed_at): Current state representation
- **audit_log entries**: Change history (WHO changed it, WHEN, WHAT)

### Rule

**Don't duplicate the timestamp in audit_log - just reference it**

---

## Recommended Structure

### Option A: Minimal Duplication (RECOMMENDED)

Keep timestamps on objects for **quick display/calculations**, but **don't repeat in audit_log**:

```json
breakdown: {
  baskets: [
    {
      services: [
        {
          status: "completed",
          started_at: "2025-12-19T10:15:00Z",      // Current state
          completed_at: "2025-12-19T10:45:00Z",    // Current state
          completed_by: "staff-uuid"               // Current state
        }
      ]
    }
  ],
  audit_log: [
    {
      action: "service_status_changed",
      service_path: "baskets.0.services.0",
      from_status: "pending",
      to_status: "in_progress",
      timestamp: "2025-12-19T10:15:00Z",
      changed_by: "staff-uuid",
      // NO duration, NO started_at duplicate
      // Audit log just records the FACT that it changed, not the state
    },
    {
      action: "service_status_changed",
      service_path: "baskets.0.services.0",
      from_status: "in_progress",
      to_status: "completed",
      timestamp: "2025-12-19T10:45:00Z",
      changed_by: "staff-uuid"
    }
  ]
}
```

**Pros:**

- ✅ Single source for current state (the object fields)
- ✅ audit_log records WHO made the change (not duplicate data)
- ✅ No data inconsistency possible
- ✅ Clean separation: state vs history
- ✅ Efficient: one update operation per change

**Cons:**

- Must reconstruct full history from audit_log (little bit slower to query)
- But querying current state is super fast (just read the field)

---

### Option B: Zero Duplication (PURE)

Remove timestamps from objects entirely, derive from audit_log:

```json
breakdown: {
  baskets: [
    {
      services: [
        {
          status: "completed"
          // NO started_at, completed_at, completed_by
          // These are in audit_log only
        }
      ]
    }
  ],
  audit_log: [
    {
      action: "service_started",
      service_path: "baskets.0.services.0",
      timestamp: "2025-12-19T10:15:00Z",
      changed_by: "staff-uuid"
    },
    {
      action: "service_completed",
      service_path: "baskets.0.services.0",
      timestamp: "2025-12-19T10:45:00Z",
      changed_by: "staff-uuid"
    }
  ]
}
```

**Pros:**

- ✅ Zero duplication - single source of truth
- ✅ Audit log IS the state machine
- ✅ Perfect for compliance (everything tracked)
- ✅ No inconsistency possible

**Cons:**

- ❌ Must parse audit_log to get current state
- ❌ Queries slower: need to find latest entry per service
- ❌ Complex: `SELECT breakdown->'audit_log' where service_path = X ORDER BY timestamp DESC LIMIT 1`
- ❌ Caching becomes important for performance

---

## My Recommendation: **Option A (Minimal Duplication)**

**Why:**

1. **Fast reads**: Service current state in object, no query needed
2. **Clean writes**: Update object, add one audit_log entry
3. **No inconsistency**: Can't have mismatched state
4. **Display friendly**: UI reads `service.completed_at` directly
5. **Audit friendly**: audit_log shows WHO made changes

---

## Updated Responsibility Matrix

| Data                   | Location                                      | Purpose                                | Updated When      |
| ---------------------- | --------------------------------------------- | -------------------------------------- | ----------------- |
| Service status         | `breakdown.baskets[].services[].status`       | Current state (display, logic)         | Status changes    |
| Service started time   | `breakdown.baskets[].services[].started_at`   | Current state (display, duration calc) | Service starts    |
| Service completed time | `breakdown.baskets[].services[].completed_at` | Current state (display, duration calc) | Service completes |
| Service completed by   | `breakdown.baskets[].services[].completed_by` | Current state (attribution)            | Service completes |
| **What happened**      | `breakdown.audit_log[].action`                | History (audit trail)                  | Every change      |
| **Who made it**        | `breakdown.audit_log[].changed_by`            | History (audit trail)                  | Every change      |
| **When it happened**   | `breakdown.audit_log[].timestamp`             | History (audit trail)                  | Every change      |
| **Where it happened**  | `breakdown.audit_log[].service_path`          | History (audit trail)                  | Every change      |

---

## Same for Handling Stages

**DON'T duplicate timestamps:**

```json
handling: {
  pickup: {
    address: "Store location",
    status: "completed",
    started_at: "2025-12-19T09:00:00Z",       // Current state (read directly)
    completed_at: "2025-12-19T09:30:00Z",     // Current state (read directly)
    completed_by: "rider-uuid",               // Current state (read directly)
    // NOT in audit_log again
  },
  delivery: {
    address: "Customer address",
    status: "pending",
    started_at: null,
    completed_at: null,
    completed_by: null
  }
}

// In audit_log:
audit_log: [
  {
    action: "handling_started",
    handling_stage: "pickup",
    timestamp: "2025-12-19T09:00:00Z",
    changed_by: "rider-uuid"
    // NOT: started_at (already in object)
  },
  {
    action: "handling_completed",
    handling_stage: "pickup",
    duration_minutes: 30,
    timestamp: "2025-12-19T09:30:00Z",
    changed_by: "rider-uuid"
  }
]
```

---

## Update Operations (Implementation)

### Current State Update (object)

```typescript
// Update object directly
service.status = "completed";
service.completed_at = new Date().toISOString();
service.completed_by = staffId;
```

### Audit Log Entry (single operation)

```typescript
// Add to audit_log (no timestamp duplication)
audit_log.push({
  action: "service_completed",
  service_path: `baskets.${idx}.services.${sidx}`,
  from_status: "in_progress",
  to_status: "completed",
  timestamp: new Date().toISOString(), // Recorded once
  changed_by: staffId,
});
```

### Single Database Operation

```sql
UPDATE orders SET
  breakdown = jsonb_set(
    breakdown,
    '{"baskets",0,"services",0,"status"}',
    '"completed"'
  ) || jsonb_set(
    breakdown,
    '{"baskets",0,"services",0,"completed_at"}',
    to_jsonb(NOW())
  ) || jsonb_set(
    breakdown,
    '{"baskets",0,"services",0,"completed_by"}',
    to_jsonb(staff_id)
  ) || jsonb_set(
    breakdown,
    '{"audit_log",-1}',
    to_jsonb(jsonb_build_object(
      'action', 'service_completed',
      'from_status', 'in_progress',
      'to_status', 'completed',
      'timestamp', NOW(),
      'changed_by', staff_id
    ))
  )
WHERE id = order_id;
```

---

## Querying Examples

### Get current service state (FAST)

```sql
SELECT breakdown->'baskets'->0->'services'->0 as service
FROM orders WHERE id = 'order-uuid';

-- Returns:
-- {
--   "status": "completed",
--   "started_at": "2025-12-19T10:15:00Z",
--   "completed_at": "2025-12-19T10:45:00Z",
--   "completed_by": "staff-uuid",
--   ...
-- }
```

### Get service change history (AUDIT)

```sql
SELECT breakdown->'audit_log'
FROM orders
WHERE id = 'order-uuid'
  AND breakdown->'audit_log' @> '[{"service_path": "baskets.0.services.0"}]';

-- Returns:
-- [
--   { "action": "service_started", "timestamp": "...", "changed_by": "..." },
--   { "action": "service_completed", "timestamp": "...", "changed_by": "..." }
-- ]
```

### Reconstruct service state at any point in time

```sql
WITH service_events AS (
  SELECT jsonb_array_elements(breakdown->'audit_log') as event
  FROM orders
  WHERE id = 'order-uuid'
)
SELECT event->>'action' as action, event->>'timestamp' as when, event->>'changed_by' as who
FROM service_events
WHERE event->>'service_path' = 'baskets.0.services.0'
ORDER BY event->>'timestamp' ASC;
```

---

## Summary of Responsibilities (Updated)

| Responsibility                  | Before                        | After                  | Storage                                                       |
| ------------------------------- | ----------------------------- | ---------------------- | ------------------------------------------------------------- |
| **Track current service state** | ✅ service object             | ✅ service object      | `services[].{status, started_at, completed_at, completed_by}` |
| **Track who changed what**      | ❌ Not tracked                | ✅ audit_log entry     | `audit_log[].{action, changed_by, timestamp}`                 |
| **Track change history**        | ❌ order_status_history table | ✅ audit_log array     | `audit_log[]`                                                 |
| **Fast current state read**     | ❌ Must JOIN                  | ✅ Direct field access | Single object read                                            |
| **Full audit trail**            | ❌ Limited                    | ✅ Complete            | Complete history                                              |
| **Space efficiency**            | ⚠️ Multiple tables            | ✅ Single JSONB        | Minimal                                                       |

---

## Answer to Your Question

**Before fix:** YES, huge duplication and potential inconsistency

- started_at/completed_at in object
- Same timestamps repeated in audit_log
- completed_by in object AND audit_log
- Risk: Update one, forget the other → data corruption

**After fix:** NO duplication

- Object fields = current state (read-only after set)
- audit_log = history of changes only
- Single source of truth per piece of data
- One atomic update operation per change
- No inconsistency possible
