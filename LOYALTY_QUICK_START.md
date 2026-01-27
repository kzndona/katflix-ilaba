# Loyalty Points Feature - Quick Reference

## CORRECTED System (v2)

### 1. UI Component in Receipt Sidebar
```
┌─────────────────────────────────────┐
│ 💎 Loyalty Points: 35 pts            │
├─────────────────────────────────────┤
│ ◉ 10 pts → 5% OFF                    │
│   Save ₱50.00                        │
│                                      │
│ ○ 20 pts → 15% OFF                   │
│   Save ₱150.00                       │
│                                      │
│ ○ Don't use loyalty points           │
└─────────────────────────────────────┘

Loyalty Discount           -₱50.00
─────────────────────────────────────
TOTAL                      ₱950.00
```

### 2. Loyalty Point Rates

**AWARD System:**
```
1 point = 1 completed order (not per peso)

Example:
- Customer completes order #1 → +1 point
- Customer completes order #2 → +1 point  
- Total: 2 loyalty points earned
```

**DISCOUNT Tiers:**

| Tier | Points Cost | Discount | Savings Example |
|------|------------|----------|-----------------|
| Tier 1 | 10 pts | 5% | ₱1000 order → ₱950 (save ₱50) |
| Tier 2 | 20 pts | 15% | ₱1000 order → ₱850 (save ₱150) |

## Core Features

✅ **Award 1 Point Per Order**
- Automatically awarded after order completion
- Only if customer NOT using loyalty discount

✅ **Two Discount Tiers**
- Tier 1: 10 points = 5% off
- Tier 2: 20 points = 15% off
- Radio buttons to select tier
- Shows savings amount for each tier

✅ **Smart UI**
- Only shows available tiers (doesn't show Tier 2 if < 20 pts)
- Real-time savings calculations
- Option to not use loyalty

✅ **API Handling**
- Awards points: +1 when NOT using discount
- Deducts points: -10 (tier1) or -20 (tier2) when using discount
- Transactional with order creation

## Testing Scenarios

### Scenario 1: Award Points
1. Customer with 0 points
2. Create order for ₱500
3. Select "Don't use loyalty points"
4. Complete order
5. **Expected**: Customer now has 1 point

### Scenario 2: Tier 1 Discount
1. Customer with 15 points
2. Create order for ₱1000
3. Select "10 pts → 5% OFF"
4. Verify:
   - Loyalty Discount line shows: -₱50.00
   - Total shows: ₱950.00
5. Complete order
6. **Expected**: Customer now has 5 points (15 - 10)

### Scenario 3: Tier 2 Discount
1. Customer with 25 points
2. Create order for ₱1000
3. Select "20 pts → 15% OFF"
4. Verify:
   - Loyalty Discount line shows: -₱150.00
   - Total shows: ₱850.00
5. Complete order
6. **Expected**: Customer now has 5 points (25 - 20)

### Scenario 4: Insufficient Points
1. Customer with 5 points
2. Create order
3. **Expected**: Only "Don't use loyalty points" option shown
   - Tier 1 (10 pts) disabled
   - Tier 2 (20 pts) disabled

## File Changes

| File | What Changed |
|------|------------|
| `usePOSState.ts` | Changed from boolean toggle to `loyaltyDiscountTier: 'tier1' \| 'tier2' \| null` |
| `page.tsx` | Changed from checkbox to radio buttons showing both tiers |
| `route.ts` (/api/orders/pos/create) | Now awards 1 pt/order, handles tier1/tier2 deductions |

## Status: ✅ PRODUCTION READY (v2)

- ✅ 1 Point Per Order Award System
- ✅ 2-Tier Discount System (5% & 15%)
- ✅ Correct Point Deduction Logic
- ✅ Radio Button UI for Tiers
- ✅ Build Successful
- ✅ API Working

