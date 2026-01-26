# Quick Start - Deploy Basket Service Status System

## Pre-Deployment Checklist (2 minutes)

- [x] All code changes complete
- [x] Zero TypeScript errors in baskets page
- [x] API endpoints ready
- [x] Database migration script ready
- [x] Documentation complete

## Step 1: Deploy Database Migration (5 minutes)

### 1a. Access Supabase

1. Go to https://supabase.com
2. Log in to your account
3. Select your project (katflix_ilaba database)
4. Click "SQL Editor" in left sidebar

### 1b. Create New Query

1. Click "New Query" button (or "+" icon)
2. You'll see a blank SQL editor

### 1c. Copy Migration Script

1. Open file: `MIGRATION_BASKET_SERVICE_STATUS.sql`
2. Copy entire contents
3. Paste into Supabase SQL editor

### 1d. Execute

1. Click green "Run" button (or Ctrl+Enter)
2. Wait for success message
3. You should see: "Query executed successfully"

### 1e. Verify Table Created

```sql
-- Run this to verify:
SELECT * FROM basket_service_status LIMIT 0;
```

Should return: "0 rows" (table exists but empty)

## Step 2: Verify API Endpoints (2 minutes)

### Check Endpoint 1: Fetch with Service Status

1. Open browser DevTools (F12)
2. Navigate to `/in/baskets`
3. Look at Network tab
4. Find request: `GET /api/orders/withServiceStatus`
5. Response should be `{success: true, data: [...]}`

### Check Endpoint 2: Update Service Status

1. Create test order via POS
2. Go to `/in/baskets`
3. Click "Start Wash" button
4. Look for request: `PATCH /api/orders/{orderId}/basket/{basketNumber}/service`
5. Response should be `{success: true, message: "Service wash marked as in_progress"}`

## Step 3: Test End-to-End Workflow (15 minutes)

### Create Test Order

1. Navigate to `/in/pos` (POS page)
2. Create test customer: "Test Customer"
3. Add item (laundry product)
4. Create order with 1 basket
5. Confirm order created successfully
6. Note the order ID

### View in Baskets

1. Navigate to `/in/baskets`
2. Find your test order
3. Verify order shows with:
   - Customer name
   - Basket info
   - Services timeline (Wash, Dry, etc.)
   - Action buttons

### Test Service Progression

1. Click "Start Wash" button
   - Wash service should change to blue (in progress)
   - Console should show successful API call
2. Wait for page refresh (~2 seconds)
3. Click "Done" button
   - Wash should change to green (completed)
4. Click "Start Dry" button
   - Dry should change to blue
5. Click "Skip" button
   - Dry should change to green (marked as skipped)
6. Remaining services should now be available

### Verify Data Persistence

1. Refresh the page (F5)
2. Order should still show service statuses correctly
3. Confirms data persisted to database

## Step 4: Validate Staff Tracking (5 minutes)

### Check Supabase Records

1. Go to Supabase dashboard
2. Click "Table Editor" in left sidebar
3. Find "basket_service_status" table
4. Should see records with:
   - order_id: your test order ID
   - service_type: "wash", "dry", etc.
   - status: "completed", "skipped", etc.
   - started_by: UUID (your staff ID)
   - started_at: timestamp
   - completed_by: UUID
   - completed_at: timestamp

## Troubleshooting

### Issue: Table doesn't exist

**Fix:** Retry migration execution in SQL editor

### Issue: 401 Unauthorized on API calls

**Fix:** Ensure you're logged into the app and have valid session

### Issue: Services not showing in timeline

**Fix:** Check that order was created with services in POS

### Issue: Status not updating after button click

**Fix:**

1. Check browser console for errors
2. Check Supabase logs for RLS rejections
3. Verify staff record exists in staff table

### Issue: TypeScript error about service_type

**Fix:** Already fixed in this update - rebuild if still seeing error

## Performance Check

After deployment, measure:

- **Baskets page load**: Should be ~200-300ms
- **Service update**: Should be ~50-100ms
- **API response**: Should be <200ms

If slower, check:

1. Supabase database performance
2. Network latency
3. Server response times

## What to Monitor

### First 24 Hours

- [ ] No API errors in production
- [ ] Service updates working reliably
- [ ] Staff tracking accurate
- [ ] No database query errors

### Ongoing

- [ ] Check error logs weekly
- [ ] Monitor update latency
- [ ] Verify staff tracking records
- [ ] Test with multiple concurrent users

## Next Steps After Deployment

### Optional: Migrate Historical Orders

If you want old orders to appear in baskets page:

```sql
-- Create service status records for existing orders
INSERT INTO basket_service_status
  (order_id, basket_number, service_type, status, created_at)
SELECT
  o.id,
  b->>'basket_number' as basket_number,
  service_type,
  'completed' as status,
  NOW()
FROM orders o
CROSS JOIN jsonb_each_keys(o.breakdown->'services') AS service_type
CROSS JOIN jsonb_array_elements(o.breakdown->'baskets') AS b
WHERE o.status IN ('completed', 'cancelled')
  AND NOT EXISTS (
    SELECT 1 FROM basket_service_status
    WHERE order_id = o.id
  )
ON CONFLICT (order_id, basket_number, service_type) DO NOTHING;
```

### Remove Console Logging (Optional)

Before production, you can remove [SERVICE UPDATE] logs:

- Search for "console.log" in API endpoints
- Comment out or remove debug logging

### Add Monitoring (Optional)

Set up alerts for:

- API error rate > 1%
- Database connection pool > 80%
- Query latency > 500ms

## Support

If issues arise:

1. Check DEPLOYMENT_CHECKLIST.md
2. Review BASKET_SERVICE_STATUS_IMPLEMENTATION.md
3. Check browser console for client errors
4. Check Supabase logs for server errors
5. Verify data structure matches schema

---

**Deployment Time Estimate: 30 minutes total**

- Migration: 5 min
- Verification: 2 min
- Testing: 15 min
- Validation: 5 min
- Troubleshooting: 3 min (if needed)

**Ready? Deploy the migration and test! 🚀**
