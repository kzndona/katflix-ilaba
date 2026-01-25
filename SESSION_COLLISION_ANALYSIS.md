# Session Collision Analysis - Deep Dive

## The Evidence

### What We Know For Certain
1. **Private window works** → Token is NOT expired, issue is cookies/sessions
2. **Regular window fails 90%** → Existing cookies are interfering
3. **Admin password gets changed** → `updateUser()` is updating admin's session, not new staff's
4. **Link works within 3 minutes** → Confirms token expiration is NOT the issue

---

## The Exact Problem Flow

### Scenario: Admin logged in + Staff clicks invite link

**Step 1: Admin is logged in**
```
Browser cookies:
- sb-<project>-auth-token: {admin's session}
- sb-<project>-auth-token.0: {first chunk}
- sb-<project>-auth-token.1: {second chunk}
- ... (refresh token, etc)
```

**Step 2: Staff clicks invite link**
```
URL: /auth/set-password#access_token=recovery_token&refresh_token=...&type=recovery
```

**Step 3: set-password-form.tsx executes (CLIENT SIDE)**
```tsx
const supabase = createClient(); // Creates browser client with EXISTING COOKIES

// From middleware's perspective, this request still has admin's session!
const { data: { session }, error: sessionError } = await supabase.auth.setSession({
  access_token: accessToken,  // Recovery token
  refresh_token: params.get("refresh_token") || "",
});
```

### ⚠️ THE CRITICAL PROBLEM

When you call `supabase.auth.setSession()`:
- It doesn't **replace** the old session
- It **merges** with the existing session in Supabase's state
- The browser still has the **admin's cookies** in localStorage/cookies
- Supabase's JavaScript client might prioritize the admin's session because it's "already verified"

### Step 4: updateUser() gets called
```tsx
const { error: updateError } = await supabase.auth.updateUser({
  password: password,
});
```

**The problem:** Which user does `updateUser()` apply to?

Looking at Supabase documentation:
- `updateUser()` updates the **currently authenticated user** as determined by the client instance
- The client instance was created with the admin's cookies already present
- Even though `setSession()` was called, the admin's session might still be the "primary" one

---

## Why Middleware Might Be Making It Worse

Looking at `/src/app/utils/supabase/middleware.ts`:

```typescript
const { data } = await supabase.auth.getClaims()
const user = data?.claims

if (user) {
  // Auth is found, query staff table with this user
  const { data: staffData, error: staffError } = await supabase
    .from('staff')
    .select('id, is_active')
    .eq('auth_id', user.sub)  // ← Matches staff to auth_id
```

**Issue:** When the new recovery session is set, the middleware still has the **old server-side supabase client** that reads the admin's session from cookies. The client-side session change doesn't propagate back to the server properly.

---

## Why Private Window Works

In a private window:
1. **No existing cookies** → No admin session to conflict with
2. `setSession()` with recovery token → Supabase recognizes this as THE ONLY session
3. `updateUser()` → Updates the only authenticated user (the staff member)
4. Works perfectly

---

## The Core Issue: Cookie Persistence + Session Priority

Supabase's browser client uses **localStorage** or **cookies** to store session state. When you create a new client instance:

```typescript
const supabase = createClient(); // Reads existing cookies immediately
```

This reads and uses ANY existing valid session. Then calling `setSession()` tries to add/update, but doesn't necessarily clear the old one.

**The fix needs to:**
1. **Clear existing session explicitly** before setting recovery token
2. **Verify the correct user** was set
3. **Prevent middleware from reading old admin session**

---

## Why This Happens at `updateUser()`

The Supabase browser client maintains an internal state of "current user". 

When you call:
```typescript
const { data: { session } } = await supabase.auth.setSession({...})
```

You get back a session object, but the client's **internal current user** might not update immediately.

Then when you call:
```typescript
await supabase.auth.updateUser({ password })
```

It updates the "current" user, which might still be the admin because:
- The session was never fully "committed" to the client
- OR the old session still takes precedence
- OR there's a race condition between setting and updating

---

## The Solution: Explicit Session Replacement

The fix should be:

```typescript
// 1. FIRST: Clear any existing session
await supabase.auth.signOut({ scope: 'local' });

// 2. THEN: Set the recovery session
const { data: { session } } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: refreshToken,
});

// 3. VERIFY it worked
if (!session) {
  setError("Failed to establish session");
  return;
}

// 4. Verify we have the RIGHT user (check email matches invite)
const { data: { user } } = await supabase.auth.getUser();
if (user?.email !== expectedInvitedEmail) {
  setError("Session mismatch. Please try again in a private window.");
  return;
}

// 5. THEN update password
const { error: updateError } = await supabase.auth.updateUser({
  password: password,
});
```

This ensures:
- Old session is completely cleared
- New session is the ONLY active session
- You verify the correct user
- `updateUser()` has no ambiguity

