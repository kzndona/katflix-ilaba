# Rider App - Phone Number Sign-In Handoff

**Date:** February 12, 2026  
**Platform:** Flutter (Android only)  
**Status:** Backend complete, awaiting Flutter implementation  
**Goal:** Allow riders to sign in with their phone number (09XXXXXXXXX) as an alternative to email, using the same method as the web app

---

## Summary: What's Already Done (Backend) ✅

1. ✅ **Phone lookup API** exists: `POST /api/auth/phone-lookup`
2. ✅ Looks up `email_address` from the `staff` table by `phone_number`
3. ✅ Only returns results for active staff (`is_active = true`)
4. ✅ Phone format enforced: `09XXXXXXXXX` (11 digits, no +63)
5. ✅ Web app sign-in already uses this method and works

**No backend changes needed.** The Flutter app just needs to call the existing API.

---

## How It Works (Same as Web)

The approach is **not** SMS OTP. It uses a simple phone-to-email lookup:

```
User enters phone number + password
        │
        ▼
POST /api/auth/phone-lookup { phone: "09171234567" }
        │
        ▼
Backend queries: staff table WHERE phone_number = "09171234567" AND is_active = true
        │
        ▼
Returns: { email: "rider@example.com" }
        │
        ▼
Flutter calls: supabase.auth.signInWithPassword(email: "rider@example.com", password: password)
        │
        ▼
Rider is signed in ✅
```

If the user enters an email instead, skip the lookup and sign in directly with Supabase.

---

## API Reference

### `POST /api/auth/phone-lookup`

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
  "email": "rider@example.com"
}
```

**Error Responses:**

| Status | Body                                                                    | Meaning                  |
| ------ | ----------------------------------------------------------------------- | ------------------------ |
| 400    | `{ "error": "Phone number is required" }`                               | Missing or empty phone   |
| 400    | `{ "error": "Phone number must be in format 09XXXXXXXXX (11 digits)" }` | Invalid format           |
| 404    | `{ "error": "No account found with that phone number" }`                | No matching active staff |
| 500    | `{ "error": "Internal server error" }`                                  | Server error             |

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

  /// Look up email by phone number from the backend
  /// Returns the email if found, throws an exception if not
  static Future<String> lookupEmailByPhone(String phone) async {
    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/auth/phone-lookup'),
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

      // Navigate to home/orders screen on success
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
                'Rider App',
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
| **API call**           | Only call `/api/auth/phone-lookup` when input is detected as a phone number                           |
| **Supabase auth**      | Always sign in via `signInWithPassword(email:, password:)` — the phone lookup just resolves the email |
| **Single input field** | One `TextField` for both email and phone — no toggle, no tabs                                         |

---

## Database Context

The `staff` table has these relevant columns:

```sql
staff.phone_number  TEXT NOT NULL  -- format: 09XXXXXXXXX
staff.email_address TEXT NOT NULL  -- used for Supabase auth
staff.auth_id       UUID           -- links to Supabase auth.users
staff.is_active     BOOLEAN        -- only active staff can sign in
```

Riders are staff members with the `rider` role in the `staff_roles` table:

```sql
staff_roles.staff_id  UUID  -- references staff.id
staff_roles.role_id   TEXT  -- 'rider'
```

The phone lookup API queries by `phone_number` and `is_active = true`. It does **not** filter by role — any active staff member can use phone sign-in. If you want rider-only restriction, that should be handled at a different layer (e.g., after sign-in, check the user's role).

---

## Testing Checklist

- [ ] Enter email + password → signs in normally (no phone lookup called)
- [ ] Enter 09XXXXXXXXX + password → calls phone lookup → resolves email → signs in
- [ ] Enter wrong phone number → shows "No account found with that phone number"
- [ ] Enter phone of inactive staff → shows "No account found with that phone number"
- [ ] Enter wrong password with valid phone → shows Supabase auth error ("Invalid login credentials")
- [ ] Enter invalid phone format (e.g., 0917123) → treated as email, Supabase returns error
- [ ] Loading state shows while signing in
- [ ] After successful sign-in, navigates to home screen

---

## Files Reference

| File                                     | Purpose                                                         |
| ---------------------------------------- | --------------------------------------------------------------- |
| `src/app/api/auth/phone-lookup/route.ts` | Backend API — looks up email by phone number from `staff` table |
| `src/app/auth/sign-in/page.tsx`          | Web app sign-in — reference implementation of the same flow     |

---

## Notes

- The phone lookup is an **unauthenticated** endpoint (the user isn't signed in yet). It only returns the email address, nothing sensitive.
- Phone numbers must be stored consistently in the `staff` table as `09XXXXXXXXX`. If existing records use different formats, they won't match.
- This approach requires **zero additional infrastructure** — no SMS provider, no Twilio, no OTP codes.
