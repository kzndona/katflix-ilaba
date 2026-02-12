# Customer Mobile Booking App - Phone Number Sign-In Handoff

**Date:** February 12, 2026  
**Platform:** Flutter (Android only)  
**Status:** Backend complete, awaiting Flutter implementation  
**Goal:** Allow customers to sign in with their phone number (09XXXXXXXXX) as an alternative to email

---

## Summary: What's Already Done (Backend) ✅

1. ✅ **Customer phone lookup API** created: `POST /api/customers/phone-lookup`
2. ✅ Looks up `email_address` from the `customers` table by `phone_number`
3. ✅ Only returns results for active customers (`is_active = true`) who have an `auth_id` (i.e., already set up for login)
4. ✅ Phone format enforced: `09XXXXXXXXX` (11 digits, no +63)

**No additional backend changes needed.**

---

## How It Works

Same approach as the web management app and rider app — phone-to-email lookup, then sign in with Supabase:

```
Customer enters phone number + password
        │
        ▼
POST /api/customers/phone-lookup { phone: "09171234567" }
        │
        ▼
Backend queries: customers table WHERE phone_number = "09171234567"
                 AND is_active = true AND auth_id IS NOT NULL
        │
        ▼
Returns: { email: "customer@example.com" }
        │
        ▼
Flutter calls: supabase.auth.signInWithPassword(email: "customer@example.com", password: password)
        │
        ▼
Customer is signed in ✅
```

If the user enters an email instead, skip the lookup and sign in directly with Supabase.

---

## Important Difference from Rider/Staff App

|                      | Staff/Rider App               | Customer App                                       |
| -------------------- | ----------------------------- | -------------------------------------------------- |
| **API endpoint**     | `POST /api/auth/phone-lookup` | `POST /api/customers/phone-lookup`                 |
| **Table queried**    | `staff`                       | `customers`                                        |
| **Auth requirement** | `is_active = true`            | `is_active = true` AND `auth_id IS NOT NULL`       |
| **Extra error**      | None                          | "Account not set up for login yet" if no `auth_id` |

The customer API has an extra check: customers created from POS might not have an `auth_id` (they were never invited to log in). Only customers who received an email invitation and set their password can use phone sign-in.

---

## API Reference

### `POST /api/customers/phone-lookup`

**Base URL:** Same as the app's API base URL (e.g., `https://your-domain.com`)

**Request:**

```json
{
  "phone": "09171234567"
}
```

**Success Response (200):**

```json
{
  "email": "customer@example.com"
}
```

**Error Responses:**

| Status | Body                                                                                       | Meaning                                              |
| ------ | ------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| 400    | `{ "error": "Phone number is required" }`                                                  | Missing or empty phone                               |
| 400    | `{ "error": "Phone number must be in format 09XXXXXXXXX (11 digits)" }`                    | Invalid format                                       |
| 403    | `{ "error": "This account has not been set up for login yet. Please contact the store." }` | Customer exists but has no `auth_id` (never invited) |
| 404    | `{ "error": "No account found with that phone number" }`                                   | No matching active customer                          |
| 404    | `{ "error": "No email associated with this account. Please contact the store." }`          | Customer has no email                                |
| 500    | `{ "error": "Internal server error" }`                                                     | Server error                                         |

---

## What You Need to Do: Flutter Implementation

### Step 1: Add http dependency (if not already added)

In `pubspec.yaml`:

```yaml
dependencies:
  http: ^1.1.0
  supabase_flutter: ^2.0.0 # or your current version
```

```bash
flutter pub get
```

---

### Step 2: Create the Phone Lookup Service

**File:** `lib/services/auth_service.dart`

```dart
import 'dart:convert';
import 'package:http/http.dart' as http;

class AuthService {
  // Use the same API base URL as the rest of the app
  static const String apiBaseUrl = 'https://your-domain.com';

  /// Check if input looks like a phone number (09XXXXXXXXX, 11 digits)
  static bool isPhoneNumber(String input) {
    return RegExp(r'^09\d{9}$').hasMatch(input.trim());
  }

  /// Look up customer email by phone number from the backend
  /// Returns the email if found, throws an exception if not
  static Future<String> lookupEmailByPhone(String phone) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/customers/phone-lookup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phone': phone.trim()}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['email'] as String;
    } else {
      final data = jsonDecode(response.body);
      throw Exception(data['error'] ?? 'Failed to look up phone number');
    }
  }
}
```

---

### Step 3: Update the Login Screen

**File:** `lib/screens/login_screen.dart` (or wherever your sign-in screen is)

Replace the existing email-only sign-in logic with this pattern:

```dart
import 'package:flutter/material.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../services/auth_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifierController = TextEditingController(); // email OR phone
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _error;

  Future<void> _handleLogin() async {
    setState(() {
      _loading = true;
      _error = null;
    });

    final identifier = _identifierController.text.trim();
    final password = _passwordController.text;

    if (identifier.isEmpty || password.isEmpty) {
      setState(() {
        _error = 'Please enter your email/phone and password';
        _loading = false;
      });
      return;
    }

    try {
      String emailToUse = identifier;

      // If it looks like a phone number, look up the email first
      if (AuthService.isPhoneNumber(identifier)) {
        try {
          emailToUse = await AuthService.lookupEmailByPhone(identifier);
        } catch (e) {
          setState(() {
            _error = e.toString().replaceFirst('Exception: ', '');
            _loading = false;
          });
          return;
        }
      }

      // Sign in with Supabase using email + password
      await Supabase.instance.client.auth.signInWithPassword(
        email: emailToUse,
        password: password,
      );

      // Navigate to home screen on success
      if (mounted) {
        Navigator.pushReplacementNamed(context, '/home');
      }
    } on AuthException catch (e) {
      setState(() {
        _error = e.message;
      });
    } catch (e) {
      setState(() {
        _error = 'An unexpected error occurred. Please try again.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _loading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // App Title
              const Text(
                'KATFLIX',
                style: TextStyle(
                  fontSize: 36,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const Text(
                'Booking App',
                style: TextStyle(
                  fontSize: 18,
                  color: Colors.grey,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              // Email or Phone input
              TextField(
                controller: _identifierController,
                keyboardType: TextInputType.emailAddress,
                decoration: const InputDecoration(
                  labelText: 'Email or Phone Number',
                  hintText: 'you@example.com or 09171234567',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.person),
                ),
              ),
              const SizedBox(height: 16),

              // Password input
              TextField(
                controller: _passwordController,
                obscureText: true,
                decoration: const InputDecoration(
                  labelText: 'Password',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(Icons.lock),
                ),
              ),
              const SizedBox(height: 8),

              // Error message
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 8),
                  child: Text(
                    _error!,
                    style: const TextStyle(color: Colors.red, fontSize: 14),
                    textAlign: TextAlign.center,
                  ),
                ),
              const SizedBox(height: 16),

              // Sign In button
              ElevatedButton(
                onPressed: _loading ? null : _handleLogin,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.blue[700],
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: _loading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: Colors.white,
                        ),
                      )
                    : const Text(
                        'Sign In',
                        style: TextStyle(fontSize: 16),
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  void dispose() {
    _identifierController.dispose();
    _passwordController.dispose();
    super.dispose();
  }
}
```

---

## Key Implementation Rules

| Rule                   | Detail                                                                                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| **Phone format**       | `09XXXXXXXXX` — exactly 11 digits, starts with `09`                                                   |
| **No +63 support**     | Do NOT accept `+63` format on the frontend                                                            |
| **Detection logic**    | `RegExp(r'^09\d{9}$')` — if it matches, it's a phone number; otherwise treat as email                 |
| **API endpoint**       | `POST /api/customers/phone-lookup` (NOT `/api/auth/phone-lookup` — that's for staff)                  |
| **Supabase auth**      | Always sign in via `signInWithPassword(email:, password:)` — the phone lookup just resolves the email |
| **Single input field** | One `TextField` for both email and phone — no toggle, no tabs                                         |

---

## Database Context

The `customers` table has these relevant columns:

```sql
customers.phone_number   TEXT         -- format: 09XXXXXXXXX
customers.email_address  TEXT         -- used for Supabase auth
customers.auth_id        UUID         -- links to Supabase auth.users (may be NULL)
customers.is_active      BOOLEAN      -- only active customers can sign in
```

**Important:** Not all customers have an `auth_id`. Customers created from POS without an email invitation will not have one. The phone lookup API checks for this and returns a friendly error:

- `403` — "This account has not been set up for login yet. Please contact the store."

This means the customer needs to have been invited (via email) and set their password before phone sign-in will work.

---

## Testing Checklist

- [ ] Enter email + password → signs in normally (no phone lookup called)
- [ ] Enter 09XXXXXXXXX + password → calls phone lookup → resolves email → signs in
- [ ] Enter wrong phone number → shows "No account found with that phone number"
- [ ] Enter phone of inactive customer → shows "No account found with that phone number"
- [ ] Enter phone of customer without `auth_id` → shows "This account has not been set up for login yet"
- [ ] Enter phone of customer without email → shows "No email associated with this account"
- [ ] Enter wrong password with valid phone → shows Supabase auth error ("Invalid login credentials")
- [ ] Enter invalid phone format (e.g., 0917123) → treated as email, Supabase returns error
- [ ] Loading state shows while signing in
- [ ] After successful sign-in, navigates to home screen

---

## Files Reference

| File                                          | Purpose                                                             |
| --------------------------------------------- | ------------------------------------------------------------------- |
| `src/app/api/customers/phone-lookup/route.ts` | Backend API — looks up email by phone number from `customers` table |
| `src/app/api/customers/create/route.ts`       | Customer creation — creates `auth_id` when email is provided        |
| `src/app/api/customer/saveCustomer/route.ts`  | Customer save — also creates `auth_id` via email invitation         |
| `RIDER_APP_PHONE_SIGNIN_HANDOFF.md`           | Rider app equivalent (uses `staff` table instead)                   |

---

## Notes

- **Different API from rider app:** Customers use `POST /api/customers/phone-lookup`, NOT `/api/auth/phone-lookup`. The staff endpoint queries the `staff` table which won't have customer records.
- The phone lookup is an **unauthenticated** endpoint (the user isn't signed in yet). It only returns the email address.
- Customers who were created from POS without an email invitation **cannot** use phone sign-in until they are invited and set their password. The API returns a clear error for this case.
- Phone numbers must be stored consistently in the `customers` table as `09XXXXXXXXX`.
- This approach requires **zero additional infrastructure** — no SMS provider, no Twilio, no OTP codes.
