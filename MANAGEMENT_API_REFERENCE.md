# Management UI & API Quick Reference

## Services Management

### New Fields Available
- **Tier**: Basic or Premium designation
- **Modifiers**: JSON object for admin-configurable add-ons (e.g., `{"dry_time": "30 min", "fold": "yes"}`)
- **Sort Order**: Numeric value to control display order
- **Image URL**: Direct link to service image

### Service Type Options
- wash, spin, dry, iron, fold, pickup, delivery

### Example Service Data
```json
{
  "id": "uuid",
  "service_type": "wash",
  "name": "Premium Wash Service",
  "description": "Deep cleaning with special care",
  "tier": "premium",
  "modifiers": {
    "water_temp": "warm",
    "detergent": "premium"
  },
  "sort_order": 1,
  "image_url": "https://...",
  "rate_per_kg": "25.00",
  "base_duration_minutes": "60",
  "is_active": true
}
```

---

## Products Management

### New Fields Available
- **SKU**: Stock Keeping Unit - unique product identifier (e.g., PROD-001)

### Required Fields
- Item Name
- Unit Cost
- Unit Price
- Quantity
- Reorder Level

### Example Product Data
```json
{
  "id": "uuid",
  "item_name": "Laundry Detergent - Premium",
  "sku": "PROD-001",
  "unit_price": "450.00",
  "unit_cost": "250.00",
  "quantity": "25",
  "reorder_level": "10",
  "image_url": "https://...",
  "is_active": true
}
```

---

## API Endpoints

### Services

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/manage/services/getServices` | GET | Fetch all services (sorted by sort_order) | `{success: true, data: []}` |
| `/api/manage/services/saveService` | POST | Create or update service | `{success: true, data: {...}}` |
| `/api/manage/services/removeService` | POST | Delete service | `{success: true}` |

### Products

| Endpoint | Method | Purpose | Response |
|----------|--------|---------|----------|
| `/api/manage/products/getProducts` | GET | Fetch all active products (sorted by name) | `{success: true, data: []}` |
| `/api/manage/products/saveProduct` | POST | Create or update product (+ optional image) | `{success: true, data: {...}}` |
| `/api/manage/products/removeProduct` | POST | Delete product | `{success: true}` |

---

## Integration with Order Creation

✅ **Services** are validated by `/api/pos/create`:
- Checks service exists and is active
- Uses service data for order breakdown
- Applies modifier information if configured

✅ **Products** are validated by `/api/pos/create`:
- Checks product exists and is active
- Verifies stock availability
- Deducts inventory on order creation
- Uses unit_price for order total

---

## Form Validation

### Services
- `service_type` (required): Must be one of: wash, spin, dry, iron, fold, pickup, delivery
- `name` (required): Service name
- `tier` (optional): basic or premium
- `modifiers` (optional): Must be valid JSON or empty
- `sort_order`: Numeric, defaults to list length

### Products
- `item_name` (required): Product name
- `sku` (optional): Unique identifier
- `unit_price` (required): Positive number
- `unit_cost` (required): Positive number
- `quantity`: Non-negative number
- `reorder_level`: Non-negative number

---

## Usage in Phase 2 POS UI

### Service Selector Component
```typescript
// Fetch services with tier/modifier options
const services = await fetch('/api/manage/services/getServices')
  .then(r => r.json())
  .then(r => r.data);

// Display with tier selection
services.map(s => (
  <ServiceCard
    name={s.name}
    tier={s.tier}
    modifiers={s.modifiers}
    rate={s.rate_per_kg}
  />
))
```

### Product Selector Component
```typescript
// Fetch products with stock info
const products = await fetch('/api/manage/products/getProducts')
  .then(r => r.json())
  .then(r => r.data);

// Display with SKU and stock level
products.map(p => (
  <ProductCard
    name={p.item_name}
    sku={p.sku}
    price={p.unit_price}
    stock={p.quantity}
    reorderLevel={p.reorder_level}
  />
))
```

---

## Testing

1. Go to `/in/manage/services` - Create, update, delete services
2. Go to `/in/manage/products` - Create, update, delete products
3. Check order creation APIs use these services/products correctly
4. Verify inventory deduction on order creation
5. Test service tier/modifier display in future POS UI

All endpoints tested for TypeScript compilation and consistency. ✅
