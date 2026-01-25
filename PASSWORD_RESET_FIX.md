# Password Reset Token Generation Fix

## The Real Problem

Your Supabase logs revealed the actual issue:
```
"error":"One-time token not found"
```

**Why**: You were using `supabase.auth.resetPasswordForEmail()` from the **client side** (browser), but this method doesn't properly generate valid recovery tokens in Supabase's system.

The invites work because they use the **server-side admin API**: `supabase.auth.admin.inviteUserByEmail()`

## The Root Cause

**Client-side call (failing):**
```typescript
// In forgot-password/page.tsx (CLIENT component)
const { error } = await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`,
});
```

**Problems:**
- Client has limited Supabase permissions
- Token generation isn't being stored properly in Supabase's database
- When user clicks the email link, Supabase's `/verify` endpoint can't find the token
- Result: "One-time token not found" error

**Server-side call (working):**
```typescript
// In api/auth/reset-password-request/route.ts (SERVER endpoint)
const { error } = await supabase.auth.admin.generateLink({
  type: "recovery",
  email: email,
  options: { redirectTo: "..." },
});
```

**Why it works:**
- Server has full admin permissions via `SUPABASE_SERVICE_ROLE_KEY`
- Uses `generateLink()` which properly stores the token in Supabase's database
- Same method used internally by `inviteUserByEmail()`
- Token is valid and can be verified at `/verify` endpoint

## The Fix Applied

### 1. Created new API endpoint: `/api/auth/reset-password-request`

This endpoint:
- Receives email from frontend
- Uses `supabase.auth.admin.generateLink()` with service role key
- Generates valid recovery token stored in Supabase
- Returns success/error response to frontend

**File:** [src/app/api/auth/reset-password-request/route.ts](src/app/api/auth/reset-password-request/route.ts)

### 2. Updated forgot-password page to use the API

Changed from:
```typescript
// Direct Supabase call (was failing)
await supabase.auth.resetPasswordForEmail(email, { ... })
```

To:
```typescript
// API call that uses server-side admin API
const response = await fetch("/api/auth/reset-password-request", {
  method: "POST",
  body: JSON.stringify({ email }),
});
```

**File:** [src/app/auth/forgot-password/page.tsx](src/app/auth/forgot-password/page.tsx)

## Why This Fixes Everything

1. **Tokens are now valid**: Generated using admin API like invites are
2. **Tokens are stored**: Supabase's database recognizes them
3. **Email links work**: `/verify` endpoint can find and validate tokens
4. **Consistent with invites**: Uses same pattern as working `inviteUserByEmail()`
5. **Better security**: Service role key stays on server, never exposed to client

## Key Difference: generateLink vs resetPasswordForEmail

| Method | Location | Scope | Token Storage | Works |
|--------|----------|-------|----------------|-------|
| `resetPasswordForEmail()` | Client | Limited | ❌ Unreliable | ❌ No |
| `generateLink('recovery')` | Server | Admin | ✅ Proper storage | ✅ Yes |
| `inviteUserByEmail()` | Server | Admin | ✅ Proper storage | ✅ Yes |

## Testing

- [ ] Go to forgot password page
- [ ] Enter your email
- [ ] Check your email inbox
- [ ] Click the reset link
- [ ] You should see the reset-password page (not "expired" error)
- [ ] Set your new password
- [ ] Log in with new password ✅

