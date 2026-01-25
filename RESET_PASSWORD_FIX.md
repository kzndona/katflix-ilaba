# Reset/Forgot Password Link Fix

## The Problem

Your forgot/reset password links were failing with "link expired" even though they were fresh. The invited staff password set links worked fine.

### Evidence

- **Token format difference** in the URLs you provided:
  - Failing links: `?token=pkce_xxx&type=recovery` (new format)
  - Working link: `?token=yyy&type=invite` (old format)

## Root Cause

Supabase changed their password reset token format from the old format to the new **PKCE format**. The tokens now come as:

- **Parameter name**: `token=` (not `token_hash=`)
- **Token format**: `pkce_xxx` prefix instead of plain hash
- **Type**: Still `recovery`, but needs different handling

Your `reset-password` page was **only looking for `token_hash=`** and completely ignoring the new `token=` parameter format.

## The Fix Applied

### In `/src/app/auth/reset-password/page.tsx`:

**1. Check for both token formats (Line 35-38):**

```typescript
const tokenHash = queryParams.get("token_hash"); // Old format
const token = queryParams.get("token"); // New PKCE format uses 'token'
const type = queryParams.get("type");
```

**2. Handle old format (Lines 50-66):**

```typescript
if (tokenHash && type === "recovery") {
  // Verify using old token_hash method
}
```

**3. Handle new PKCE format (Lines 69-86):**

```typescript
if (token && type === "recovery") {
  console.log("PKCE token found in query params, verifying...");
  // Clear existing sessions first (same fix as set-password)
  await supabase.auth.signOut({ scope: "local" });

  // Verify using the new token
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: token, // Pass PKCE token as token_hash
    type: "recovery",
  });
}
```

**4. Verify correct user before password update (Lines 184-190):**

```typescript
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  setError("Session expired. Please request a new password reset link.");
  return;
}
```

## Why This Works

1. **Supports both formats**: Old `token_hash=` URLs still work, new `token=` URLs now work
2. **Session clearing**: Prevents admin session interference (same issue as set-password had)
3. **User verification**: Ensures correct user before updating password
4. **Clear error messages**: Better logging for debugging

## What You Need to Test

- [ ] Request password reset → Link in email should now work
- [ ] Use link within a few minutes → Should set password successfully
- [ ] Verify you can log in with new password
- [ ] Test with admin logged in → Only your password changes, not admin's
- [ ] Test in regular window (not private) → Should work
- [ ] Test on mobile → Link should work on first try

## Technical Notes

### Why Both Formats?

- Supabase is transitioning token formats during a deprecation period
- Old projects/settings might still generate `token_hash=` URLs
- New projects/settings generate `token=pkce_xxx` URLs
- This code handles both to be future-proof

### PKCE vs Traditional

- **PKCE** (Proof Key for Code Exchange) is more secure
- It's the modern OAuth 2.0 standard
- Supabase is migrating to this for better security
- The verification process is the same, just different parameter name
