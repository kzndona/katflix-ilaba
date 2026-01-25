# Auth Flow Analysis & Issues

## Current Architecture Overview

### 1. **Admin Account Creation** ✅
- Manually created in Supabase
- Pre-verified (email confirmed)
- Can immediately sign in

### 2. **Staff Account Creation Flow** (Admin creates staff)
- Admin fills staff form → API: `POST /api/staff/saveStaff`
- Backend calls: `supabase.auth.admin.inviteUserByEmail()`
- Supabase sends **magic link** email with recovery token
- Staff record created with `auth_id` reference
- **Expected**: User clicks link → Set password page → Password set

### 3. **Password Setting Flow** (The broken part)
- User clicks Supabase invite email link
- URL contains `#access_token=...&refresh_token=...&type=recovery`
- Page: `/auth/set_password/page.tsx` → `SetPasswordForm`
- Form extracts tokens and calls: `supabase.auth.setSession()`
- User updates password with: `supabase.auth.updateUser({ password })`

---

## Critical Issues Identified

### **Issue #1: "Link Expired" 90% of the Time** ⚠️

**Root Cause**: Supabase invite tokens expire **very quickly** (typically 24 hours, often less)

**Why it happens:**
1. Supabase sends invite email with magic link
2. Link is valid for ~24 hours at best
3. User gets to page, but token in URL has expired
4. When `setSession()` is called with expired token, it fails
5. Error message: "Invalid or expired link"

**Key Problem**: You're trying to manually parse and use the token from the URL hash, but:
- The token may have already expired during email delivery + user opening email + clicking link
- Supabase's `inviteUserByEmail()` uses a **one-time recovery token** that expires
- There's no way to extend or refresh this token

---

### **Issue #2: Wrong Account Getting Password Changed** ⚠️

**The Admin Account Password Gets Changed Instead of New Staff**

**Root Cause**: Session/Cookie Confusion

**Exact Scenario:**
1. Admin is logged in (has valid session cookie `sb-*` tokens)
2. Staff clicks invite link → New session created with recovery token
3. **Problem**: The new recovery session doesn't properly replace the admin session
4. `supabase.auth.updateUser()` updates the **currently authenticated user**
5. Since admin session was never cleared, admin password gets updated

**Why This Happens:**
- `setSession()` creates a new session BUT doesn't clear the old one
- Browser/Supabase may have TWO active sessions
- `updateUser()` modifies whichever session is "active" at that moment
- The admin's session cookie takes precedence

**Evidence in Code** (`set-password-form.tsx`):
```tsx
const { data: { session }, error: sessionError } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: params.get("refresh_token") || "",
});
```
- This sets a new session BUT doesn't explicitly log out the current user first
- No code clears admin's auth cookies before establishing new session

---

### **Issue #3: Mobile Users Get "Link Expired" Loop** ⚠️

**Root Cause**: Multi-step Mobile Flow

**What happens:**
1. Mobile user receives email with link
2. User clicks link → Safari/Chrome opens browser
3. Browser redirects to `/auth/set-password?...#access_token=...`
4. By the time page loads, token may have expired
5. Mobile email apps sometimes delay opening links
6. User gets "expired link" even on first attempt

**Why "1/10 times it works":**
- That 1 time is when user clicks IMMEDIATELY after receiving email
- Token hasn't had time to expire yet
- Or it's the user's first time, so no other session interference

---

## The Real Problem: Architecture

### What You're Doing Wrong
1. **Using manual token exchange** instead of Supabase's built-in magic link handler
2. **Not clearing existing sessions** before setting new ones
3. **Using recovery tokens for signup** instead of email confirmation flow
4. **Relying on token lifespan** which Supabase controls and is very short

### What Supabase Expects
1. User clicks link → Page automatically verifies with Supabase
2. Supabase auto-sets valid session
3. Page checks for valid session before allowing password change
4. No manual token parsing/exchange needed

---

## Key Code Problems

### In `set-password-form.tsx` (Lines 24-69):

**Problem 1**: Manual hash parsing is fragile
```tsx
const hash = window.location.hash;
const params = new URLSearchParams(hash.substring(1));
const accessToken = params.get("access_token");
// Token might already be expired at this point!
```

**Problem 2**: No session cleanup before new session
```tsx
const { data: { session }, error: sessionError } = await supabase.auth.setSession({
  access_token: accessToken,
  refresh_token: params.get("refresh_token") || "",
});
// If admin session exists, this doesn't clear it!
```

**Problem 3**: Directly updating user password without verification
```tsx
const { error: updateError } = await supabase.auth.updateUser({
  password: password,
});
// This updates whoever's currently logged in!
```

### In `saveStaff/route.ts` (Lines 28-40):

**Problem**: Using `inviteUserByEmail()` for signup instead of proper flow
```tsx
const { data: authData, error: authError } = await supabase.auth.admin.inviteUserByEmail(
  data.email_address,
  // Invite creates recovery token that expires very quickly
);
```

---

## Solution Options

### **Option A: Use Supabase Auth's Magic Link Handler (Recommended)**
✅ Simplest, most reliable, Supabase-native

**How:**
1. Don't manually parse tokens
2. Use `supabase.auth.onAuthStateChange()` 
3. Let Supabase auto-exchange the token from URL
4. Wait for valid session, then allow password update

**Advantages:**
- Automatic token refresh
- Supabase handles expiration
- No manual session management
- Works across tabs and devices

---

### **Option B: Use Email + Password SignUp Instead of Invite**
✅ More standard for initial account setup

**How:**
1. Admin creates staff account WITHOUT invite
2. Generate temporary password or send separate password link
3. User logs in with email + temp password
4. Forces password change on first login

**Advantages:**
- No recovery tokens needed
- Standard email/password flow
- Better session handling

---

### **Option C: Fix Current Flow (Session Management)**
⚠️ Band-aid solution, but possible

**How:**
1. **Sign out admin explicitly** before setting recovery session
2. **Verify session** established correctly
3. **Clear all cookies** except new session
4. **Verify correct user** before password update

**Disadvantages:**
- Still relies on token expiration
- Still fragile
- Doesn't solve mobile delay issues

---

## What I Recommend

**Use Option A + Option B hybrid:**

1. **For staff invites**: Send email with magic link that:
   - Uses Supabase's native `auth.onAuthStateChange()` listener
   - Auto-exchanges token when page loads
   - Establishes proper session
   - Explicitly signs out admin first

2. **Add session guards**:
   - Verify invited user's email matches link
   - Prevent password change if session is wrong user
   - Force logout of all other tabs

3. **For mobile**: Add timeout handling for slower email delivery

---

## Testing Checklist

- [ ] Click fresh invite link immediately → Set password works
- [ ] Click invite link after 1 hour → "Expired" message
- [ ] Admin logged in + staff clicks link → Only staff password changes
- [ ] Admin logged in + multiple tabs → Isolation maintained
- [ ] Mobile email app → Link works without browser delay
- [ ] Sign out admin → Click staff link → Works correctly
- [ ] Staff clicks link → Creates new session, not admin session

