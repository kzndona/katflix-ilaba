# Inventory Management System Implementation

## Overview

Complete inventory tracking system for POS orders with real-time stock validation, deduction, and automatic restoration on cancellation.

## Changes Made

### 1. **New Helper Module** (`src/app/api/orders/inventoryHelpers.ts`)

**Core Functions:**

- **`validateStockAvailability(supabase, items)`**
  - Checks all products have sufficient stock before order creation
  - Returns detailed list of insufficient items with requested vs available quantities
  - Prevents overselling

- **`deductInventory(supabase, orderId, items)`**
  - Reduces `products.quantity` by ordered amount
  - Creates `product_transactions` records with `change_type: "consume"`
  - Links transactions to order for full audit trail
  - Returns which items succeeded/failed

- **`restoreInventory(supabase, orderId, items)`**
  - Increases quantity when order is cancelled
  - Creates reverse transactions with `change_type: "add"`
  - Maintains complete audit trail
  - Handles partial failures gracefully

- **`getStockLevels(supabase, productIds)`**
  - Gets current stock for multiple products (for UI warnings)
  - Returns map of product ID → quantity

### 2. **Order Creation Endpoint** (`POST /api/orders`)

**New Behavior:**

```
1. Validate all required fields
2. → Check stock availability (NEW)
   - If insufficient: Return 400 with detailed insufficiency report
   - User must adjust quantities and retry
3. Create order in database
4. → Deduct inventory (NEW)
   - Update products.quantity
   - Create product_transactions records
   - Link to order for audit trail
5. Return order ID
```

**Stock Check Response (on failure):**

```json
{
  "success": false,
  "error": "Insufficient stock for one or more items",
  "insufficientItems": [
    {
      "productId": "uuid",
      "productName": "Detergent",
      "requested": 5,
      "available": 2
    }
  ]
}
```

### 3. **Order Cancellation Endpoint** (`POST /api/orders/removeOrder`)

**New Behavior:**

```
1. Fetch order with breakdown
2. → Restore inventory (NEW)
   - Reverse deduction in products.quantity
   - Create add transactions
3. Delete order (and cascade deletes)
```

### 4. **POS State Management** (`usePOSState.tsx`)

**Enhanced saveOrder():**

- Catches stock validation errors specifically
- Shows user-friendly error message listing insufficient items:
  ```
  "Insufficient stock for:
   - Detergent: need 5, have 2
   - Fabric Softener: need 3, have 0"
  ```
- User can adjust quantities and retry
- Prevents silent failures

---

## How It Works - Flow Diagram

### Creating an Order with Products

```
POS User selects products
      ↓
User clicks "Save Order"
      ↓
usePOSState.saveOrder() validates customer, baskets
      ↓
POST /api/orders with breakdown.items
      ↓
validateStockAvailability() checks each product
      ├─ All available? → Continue
      └─ Insufficient? → Return 400 + details
                         ↓
                    User sees alert with items/quantities
                    User adjusts quantities
                    User retries
      ↓
Create order in database
      ↓
deductInventory() for each product
      ├─ Get current quantity
      ├─ Subtract ordered amount
      ├─ Update products.quantity
      └─ Create product_transactions (consume)
      ↓
Order created successfully ✓
```

### Cancelling an Order

```
User seletes order via orders page
      ↓
POST /api/orders/removeOrder
      ↓
Fetch order.breakdown.items
      ↓
restoreInventory() for each product
      ├─ Get current quantity
      ├─ Add back ordered amount
      ├─ Update products.quantity
      └─ Create product_transactions (add)
      ↓
Delete order
      ↓
Order cancelled, inventory restored ✓
```

---

## Database Transactions Created

### On Order Creation

```
product_transactions record:
{
  product_id: "uuid",
  order_id: "order-id",
  change_type: "consume",
  quantity: 5,
  reason: "Order {order-id}: 5x Detergent"
}
```

### On Order Cancellation

```
product_transactions record:
{
  product_id: "uuid",
  order_id: "order-id",
  change_type: "add",
  quantity: 5,
  reason: "Cancelled order {order-id}: 5x Detergent"
}
```

---

## Complete Audit Trail Example

Scenario: Create order for 5 detergent, then cancel

| ID  | Product      | Order   | Type    | Qty | Reason                                  |
| --- | ------------ | ------- | ------- | --- | --------------------------------------- |
| 1   | detergent-id | order-1 | consume | 5   | Order {order-1}: 5x Detergent           |
| 2   | detergent-id | order-1 | add     | 5   | Cancelled order {order-1}: 5x Detergent |

**Result:** Quantity unchanged (5-5), but complete history maintained

---

## Error Handling

**Stock Validation Fails:**

- Order not created
- User sees list of items with insufficient stock
- User can adjust and retry

**Inventory Deduction Fails (partial):**

- Order is still created (business requirement)
- Warning logged to console
- Partial deductions recorded
- Operator can manually fix later

**Cancellation Restoration Fails (partial):**

- Order is still deleted
- Warning logged to console
- Partial restorations recorded
- Inventory may need manual adjustment

---

## Key Features

✅ **Real-time Stock Validation** - Prevents overselling
✅ **Immediate Deduction** - Inventory updated on order creation
✅ **Automatic Reversal** - Cancelled orders restore inventory
✅ **Complete Audit Trail** - Every transaction logged with reason
✅ **User-Friendly Errors** - Clear messages about insufficient stock
✅ **Graceful Degradation** - Partial failures don't break orders
✅ **Both Channels** - Works for POS (store) and future mobile orders

---

## Testing Checklist

- [ ] Create order with products → stock decreases
- [ ] Cancel order → stock increases by same amount
- [ ] Try creating order with insufficient stock → gets 400 error with details
- [ ] Check product_transactions table → sees consume/add records
- [ ] Create multiple orders for same product → quantities compound correctly
- [ ] Cancel first order, then second → each restores correctly
