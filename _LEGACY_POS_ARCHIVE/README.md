# Legacy POS Archive

This folder contains the previous POS implementation before the complete rebuild (January 27, 2026).

## Files Archived

- `usePOSState.tsx` - Previous state management (767 lines)
- `orderTypes.ts` - Previous type definitions (303 lines)
- Original components and helpers

## Key Business Logic from Legacy

### Pricing Constants

- Tax Rate: 12% (VAT INCLUSIVE)
- Service Fee: PHP40 (FLAT, not per basket) - IF there are baskets with weight

### Basket Management

- Weight limit: 8kg per basket
- Empty baskets (0kg) filtered out before calculation

### Services

- Each service has: `service_type`, `rate_per_kg`, `base_duration_minutes`, `base_price`
- Premium flag used for wash/dry selection

### Receipt Calculation

- Product subtotal + Basket subtotal + Service fee (if baskets) + Handling fee (if delivery)
- VAT included: `subtotalBeforeTax * (taxRate / (1 + taxRate))`
- Loyalty discount: 10pts = 10%, 20pts = 15%

### Handling

- Pickup: No fee
- Delivery: Default PHP50, minimum PHP50, cashier can override

### Payment

- Cash: Amount received → Change
- GCash: Reference number

## NEW System Changes

1. **Staff Service**: Per ORDER (not per basket)
2. **Service Pricing**: Flat rates per basket (not rate_per_kg)
3. **UI**: 6-step workflow (left form + right summary) instead of panes
4. **Basket Auto-Creation**: When weight > 8kg, create new basket automatically
5. **Iron**: Minimum 2kg, skip if < 2kg (don't ask)
6. **Term**: Use "staff service fee" (not separate drop-off fee)

## References

- NEW_AGENT_HANDOFF.md - Complete spec
- POS_overhaul_guide.txt - Business workflow
- IMPLEMENTATION_GAMEPLAN.md - Phased approach
