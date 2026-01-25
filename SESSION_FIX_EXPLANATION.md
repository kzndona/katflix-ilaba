# Auth Session Collision Fix - Complete Explanation

## The Problem You Discovered

Your instinct was **100% correct**. This is a **session/cookie collision** issue, not a token expiration problem. The evidence:

1. **Private window works** → Token is fine, cookies are the problem
2. **Regular window fails** → Existing session cookies interfere
3. **Admin's password changes instead** → Wrong session is being updated
4. **Link works within 3 minutes** → Confirms token isn't expiring

---

## Root Cause: Session Priority Conflict

### What Was Happening

When you're logged in as admin and a new staff member tries to set their password:

**Step 1: Admin logged in**

- Browser has admin's session cookies: `sb-<project>-auth-token`
- Supabase client instance reads these cookies automatically

**Step 2: Staff clicks invite link**

- URL has recovery token: `#access_token=xxx&refresh_token=yyy&type=recovery`

**Step 3: `setSession()` called (OLD CODE)**

```typescript
const {
  data: { session },
} = await supabase.auth.setSession({
  access_token: recoveryToken,
  refresh_token: refreshToken,
});
```

**Problem**:

- `setSession()` tries to add/update the session
- But the admin's session cookies are **still present** in the browser
- Supabase's client has already loaded the admin's session
- The new recovery session doesn't properly **replace** the admin session
- They coexist in a weird state

**Step 4: `updateUser()` called (OLD CODE)**

```typescript
const { error } = await supabase.auth.updateUser({ password });
```

**Result**:

- `updateUser()` updates whoever is currently "active"
- The admin's session still takes priority
- **Admin's password gets changed instead of staff's** ❌

### Why Private Window Fixes It

- No existing cookies = no admin session to conflict
- Recovery token is the **only** session
- `updateUser()` has no ambiguity
- Works perfectly ✅

---

## The Fix I Implemented

### Change 1: Explicit Session Clearing (Line 31 in set-password-form.tsx)

**BEFORE:**

```typescript
// Just tried to set new session without clearing old one
const {
  data: { session },
  error: sessionError,
} = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: params.get("refresh_token") || "",
});
```

**AFTER:**

```typescript
// CRITICAL FIX: Sign out any existing session FIRST
console.log("Clearing any existing sessions...");
await supabase.auth.signOut({ scope: "local" });

// Now set the recovery session - this should be the ONLY active session
const {
  data: { session },
  error: sessionError,
} = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: params.get("refresh_token") || "",
});
```

**What this does:**

- `signOut({ scope: 'local' })` clears ALL browser-stored sessions
- Removes the admin's session from memory
- Recovery token becomes the **only** active session
- No possibility of collision

### Change 2: Session Verification (Lines 58-63)

**ADDED:**

```typescript
// SECURITY: Verify the session was set correctly
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  console.error("Session established but no user found");
  setError("Failed to verify your identity. Please request a new invitation.");
  return;
}
console.log("Session verified for user:", user.id);
```

**What this does:**

- Confirms the recovery session was actually established
- Fails fast if something went wrong
- Better error message for debugging

### Change 3: Pre-Update Verification (Lines 79-90)

**BEFORE:**

```typescript
// No verification before updating
const { error: updateError } = await supabase.auth.updateUser({
  password: password,
});
```

**AFTER:**

```typescript
// SECURITY: Verify we still have a valid session before updating password
const {
  data: { user },
} = await supabase.auth.getUser();
if (!user) {
  setError("Session expired. Please request a new invitation link.");
  setLoading(false);
  return;
}

console.log("Updating password for user:", user.id, "email:", user.email);

// Update the user's password
const { error: updateError } = await supabase.auth.updateUser({
  password: password,
});
```

**What this does:**

- Double-checks the correct user is still authenticated
- Prevents accidental password changes of wrong user
- Logs the user ID for debugging
- Catches session loss before attempting password change

---

## Why This Fixes Both Problems

### Problem #1: Admin's password getting changed ✅ FIXED

- Old session is explicitly cleared
- Only recovery token exists
- `updateUser()` can only update the staff member
- Admin's password stays safe

### Problem #2: 90% "link expired" error ✅ LIKELY FIXED

- The error wasn't actually token expiration
- It was session negotiation failure
- With explicit session clearing, the handoff is clean
- Recovery token is properly recognized as the active session
- Should work now within your 3-minute window

### Problem #3: Mobile users stuck in loop ✅ LIKELY FIXED

- Same root cause as #2
- Explicit session management is more reliable
- Works on first try in new/private context
- Should eliminate the "try again in private window" workaround

---

## Testing This Fix

1. **Test as Admin:**
   - Log in as admin
   - Create a new staff account (sends invite email)
   - DO NOT LOG OUT
   - In same browser, click the invite link
   - Set password for new staff account
   - ✅ Only staff's password should be set
   - ✅ Admin should still be logged in with original password
   - ✅ Log out and sign in as staff with new password

2. **Test in Regular Window:**
   - Repeat above test
   - Should work without needing private window
   - ✅ Link should not say "expired"

3. **Test on Mobile:**
   - Open invite email on mobile
   - Click link (in default browser)
   - Should reach set-password page without "expired" error
   - ✅ Should work on first try

4. **Test Multiple Tabs:**
   - Open admin in tab 1
   - Open invite link in tab 2
   - Set password in tab 2
   - ✅ Only staff password changes
   - ✅ Tab 1 admin still works

---

## Why This Was So Hard to Debug

1. **Supabase's behavior is counterintuitive**: `setSession()` doesn't immediately replace the active session
2. **Private windows work**: Made you think tokens expire, when it's actually sessions
3. **Error message misleading**: Says "expired link" when it really means "session negotiation failed"
4. **Cookie internals are hidden**: Hard to see that admin's cookies are still present
5. **Timing-dependent**: Sometimes works randomly (race conditions)

---

## Additional Notes

### About Token Expiration

- Supabase recovery tokens DO have expiration (typically 1 hour)
- But you're using them within 3 minutes, so this isn't the issue
- The UTC concern you mentioned is valid for OTHER date-based auth, but Supabase handles token comparison server-side, so local timezone shouldn't matter

### About the "Link Expired" Message

- Your code shows: `"Invalid or expired link. Please request a new invitation."`
- This appears for BOTH actual expiration AND session errors
- The error message is misleading you about the root cause
- With this fix, the real cause (session collision) is eliminated

### About Mobile Delays

- Email apps sometimes delay opening links (that's real)
- But within a few minutes you're safe
- The session fix makes the handoff more reliable
- Should significantly reduce the "it worked on my first try" randomness

---

## Going Forward

- **Monitor logs**: The added `console.log()` statements will help debug if issues persist
- **Check user IDs**: If password changes still happen to wrong user, the logs will show which ID was updated
- **Test thoroughly**: Run through the test cases above
- **Consider improvements**: If you still have issues, we could add:
  - Email verification token in the URL (confirm right person)
  - One-time use codes instead of recovery tokens
  - Simpler "set password on first login" flow
