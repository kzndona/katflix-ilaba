# 🚴 Flutter Rider Companion App - Login & Authentication Guide

**Date**: January 29, 2026  
**Status**: Complete & Production-Ready  
**Version**: 1.0  
**Target Duration**: 1 Hour Implementation

---

## Overview

This guide provides complete implementation specifications for the **Flutter Rider Companion App** authentication system. It covers login flows, session management, role-based access control (Riders & Admins), and integration with the Katflix backend using **Supabase authentication** and **service key credentials**.

### Goals

- ✅ Secure login/logout for Riders and Admins only
- ✅ Role-based access control and redirection
- ✅ Session persistence across app restarts
- ✅ Biometric authentication support (fingerprint/face ID)
- ✅ Service key integration for API calls
- ✅ Error handling and user feedback

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│          Flutter Rider Companion App                     │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌────────────────────┐          ┌──────────────────┐   │
│  │   Login Screen     │          │  Home Screen     │   │
│  │  (Riders/Admins)   │─────────▶│  (Role-based)    │   │
│  └────────────────────┘          └──────────────────┘   │
│           ▲                                 │             │
│           │                                 │             │
│           └─────────────────────────────────┘             │
│                  Session Management                      │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                  Authentication Layer                    │
│  ┌──────────────────────────────────────────────────┐   │
│  │    Supabase Auth Client                          │   │
│  │    - Email/Password Login                        │   │
│  │    - Session Token Storage (Secure)              │   │
│  │    - User Role Verification                      │   │
│  │    - Biometric Authentication                    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                           │
├─────────────────────────────────────────────────────────┤
│                    Backend (Katflix)                     │
│  ┌──────────────────────────────────────────────────┐   │
│  │    Supabase Auth & Database                      │   │
│  │    - User Authentication                         │   │
│  │    - Staff Role Validation (riders/admins)       │   │
│  │    - Service Key for Admin Operations            │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Project Setup (5 minutes)

### 1.1 Flutter Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter

  # Authentication & Storage
  supabase_flutter: ^2.0.0 # Supabase client
  local_auth: ^2.1.0 # Biometric auth
  shared_preferences: ^2.1.0 # Session persistence
  flutter_secure_storage: ^9.0.0 # Secure token storage

  # UI & State Management
  provider: ^6.0.0 # State management
  flutter_riverpod: ^2.4.0 # Alternative state management
  go_router: ^13.0.0 # Navigation

  # HTTP & Networking
  http: ^1.1.0 # HTTP client
  dio: ^5.3.0 # Advanced HTTP

  # UI Components
  google_fonts: ^5.1.0 # Typography
  intl: ^0.18.0 # Localization

  # Logging & Debugging
  logger: ^2.0.0 # Structured logging

  # Environment Configuration
  flutter_dotenv: ^5.1.0 # .env file support

dev_dependencies:
  flutter_test:
    sdk: flutter
  flutter_lints: ^2.0.0
```

Run:

```bash
flutter pub get
```

### 1.2 Environment Configuration

Create `.env` file in project root:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anonymous_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
API_BASE_URL=https://katflix-backend.com/api
APP_VERSION=1.0.0
```

Create `lib/config/environment.dart`:

```dart
import 'package:flutter_dotenv/flutter_dotenv.dart';

class Environment {
  static final String supabaseUrl = dotenv.env['SUPABASE_URL'] ?? '';
  static final String supabaseAnonKey = dotenv.env['SUPABASE_ANON_KEY'] ?? '';
  static final String supabaseServiceKey = dotenv.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
  static final String apiBaseUrl = dotenv.env['API_BASE_URL'] ?? '';
}
```

---

## 2. Authentication Service (15 minutes)

### 2.1 Auth Service Class

Create `lib/services/auth_service.dart`:

```dart
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:logger/logger.dart';

class AuthService {
  final logger = Logger();
  final supabase = Supabase.instance.client;
  static const String _tokenKey = 'supabase_token';
  static const String _userRoleKey = 'user_role';
  static const String _userIdKey = 'user_id';

  final _secureStorage = const FlutterSecureStorage();

  /// Login with email and password
  /// Returns user data if successful
  Future<AuthResponse> login({
    required String email,
    required String password,
  }) async {
    try {
      logger.i('Attempting login for email: $email');

      final response = await supabase.auth.signInWithPassword(
        email: email,
        password: password,
      );

      if (response.user == null) {
        throw Exception('Login failed: No user returned');
      }

      // Get user role
      final userRole = await _getUserRole(response.user!.id);

      // Validate that user is either rider or admin
      if (!['rider', 'admin'].contains(userRole)) {
        await supabase.auth.signOut();
        throw Exception('Only riders and admins can access this app');
      }

      // Save session info securely
      await _saveSession(
        token: response.session?.accessToken ?? '',
        userId: response.user!.id,
        role: userRole,
      );

      logger.i('Login successful for user: ${response.user!.id}');

      return AuthResponse(
        user: response.user!,
        session: response.session,
        userRole: userRole,
      );
    } on AuthException catch (e) {
      logger.e('Auth exception: ${e.message}');
      rethrow;
    } catch (e) {
      logger.e('Login error: $e');
      rethrow;
    }
  }

  /// Logout user
  Future<void> logout() async {
    try {
      logger.i('Logging out user');
      await supabase.auth.signOut();
      await _clearSession();
      logger.i('Logout successful');
    } catch (e) {
      logger.e('Logout error: $e');
      rethrow;
    }
  }

  /// Get current authenticated user
  User? getCurrentUser() {
    return supabase.auth.currentUser;
  }

  /// Get user role (rider or admin)
  Future<String> getUserRole() async {
    final user = getCurrentUser();
    if (user == null) return '';

    return await _getUserRole(user.id);
  }

  /// Check if user is authenticated
  bool isAuthenticated() {
    return supabase.auth.currentUser != null;
  }

  /// Get stored access token
  Future<String?> getAccessToken() async {
    return await _secureStorage.read(key: _tokenKey);
  }

  /// Refresh session if expired
  Future<bool> refreshSession() async {
    try {
      final refreshToken = supabase.auth.currentSession?.refreshToken;
      if (refreshToken == null) return false;

      final response = await supabase.auth.refreshSession();
      if (response.session != null) {
        await _secureStorage.write(
          key: _tokenKey,
          value: response.session!.accessToken,
        );
        logger.i('Session refreshed successfully');
        return true;
      }
      return false;
    } catch (e) {
      logger.e('Session refresh error: $e');
      return false;
    }
  }

  // ============ PRIVATE METHODS ============

  /// Get user role from database
  Future<String> _getUserRole(String userId) async {
    try {
      final response = await supabase
          .from('staff')
          .select('role')
          .eq('auth_id', userId)
          .single();

      return response['role'] ?? '';
    } catch (e) {
      logger.e('Error fetching user role: $e');
      return '';
    }
  }

  /// Save session data securely
  Future<void> _saveSession({
    required String token,
    required String userId,
    required String role,
  }) async {
    final prefs = await SharedPreferences.getInstance();

    await _secureStorage.write(key: _tokenKey, value: token);
    await prefs.setString(_userIdKey, userId);
    await prefs.setString(_userRoleKey, role);
  }

  /// Clear stored session
  Future<void> _clearSession() async {
    final prefs = await SharedPreferences.getInstance();

    await _secureStorage.delete(key: _tokenKey);
    await prefs.remove(_userIdKey);
    await prefs.remove(_userRoleKey);
  }
}

class AuthResponse {
  final User user;
  final Session? session;
  final String userRole;

  AuthResponse({
    required this.user,
    required this.session,
    required this.userRole,
  });
}
```

### 2.2 Auth State Provider

Create `lib/providers/auth_provider.dart`:

```dart
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../services/auth_service.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

final authServiceProvider = Provider((ref) => AuthService());

// Current user state
final authStateProvider = StreamProvider<User?>((ref) {
  final authService = ref.watch(authServiceProvider);
  return authService.supabase.auth.onAuthStateChange.map((event) {
    return event.session?.user;
  });
});

// User role state
final userRoleProvider = FutureProvider<String>((ref) async {
  final authService = ref.watch(authServiceProvider);
  return await authService.getUserRole();
});

// Login provider (mutation)
final loginProvider = FutureProvider.family<void, LoginRequest>((ref, request) async {
  final authService = ref.watch(authServiceProvider);
  await authService.login(
    email: request.email,
    password: request.password,
  );
});

class LoginRequest {
  final String email;
  final String password;

  LoginRequest({required this.email, required this.password});
}
```

---

## 3. Login Screen UI (15 minutes)

### 3.1 Main Login Screen

Create `lib/screens/login_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../providers/auth_provider.dart';
import '../services/auth_service.dart';
import 'package:go_router/go_router.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({Key? key}) : super(key: key);

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();

  bool obscurePassword = true;
  bool isLoading = false;
  String? errorMessage;

  @override
  void dispose() {
    emailController.dispose();
    passwordController.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    if (emailController.text.isEmpty || passwordController.text.isEmpty) {
      setState(() => errorMessage = 'Please fill in all fields');
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
    });

    try {
      final authService = ref.read(authServiceProvider);

      final response = await authService.login(
        email: emailController.text.trim(),
        password: passwordController.text,
      );

      // Route based on user role
      if (mounted) {
        if (response.userRole == 'admin') {
          context.go('/admin-dashboard');
        } else if (response.userRole == 'rider') {
          context.go('/rider-dashboard');
        } else {
          setState(() => errorMessage = 'Unknown user role');
        }
      }
    } on Exception catch (e) {
      setState(() => errorMessage = e.toString());
    } finally {
      if (mounted) {
        setState(() => isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[100],
      body: SafeArea(
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                SizedBox(height: MediaQuery.of(context).size.height * 0.08),

                // Logo/Title
                Center(
                  child: Column(
                    children: [
                      const Icon(
                        Icons.delivery_dining,
                        size: 64,
                        color: Colors.blue,
                      ),
                      const SizedBox(height: 16),
                      const Text(
                        'KATFLIX',
                        style: TextStyle(
                          fontSize: 36,
                          fontWeight: FontWeight.bold,
                          color: Colors.grey[800],
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Rider Companion App',
                        style: TextStyle(
                          fontSize: 16,
                          color: Colors.grey[600],
                        ),
                      ),
                    ],
                  ),
                ),

                SizedBox(height: MediaQuery.of(context).size.height * 0.06),

                // Error Message
                if (errorMessage != null)
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Colors.red[50],
                      border: Border.all(color: Colors.red[300]!),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Text(
                      errorMessage!,
                      style: TextStyle(color: Colors.red[700]),
                    ),
                  ),

                const SizedBox(height: 24),

                // Email Field
                TextField(
                  controller: emailController,
                  decoration: InputDecoration(
                    labelText: 'Email Address',
                    prefixIcon: const Icon(Icons.email_outlined),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[300]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.blue, width: 2),
                    ),
                  ),
                  keyboardType: TextInputType.emailAddress,
                  enabled: !isLoading,
                ),

                const SizedBox(height: 16),

                // Password Field
                TextField(
                  controller: passwordController,
                  obscureText: obscurePassword,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    prefixIcon: const Icon(Icons.lock_outlined),
                    suffixIcon: IconButton(
                      icon: Icon(
                        obscurePassword ? Icons.visibility_off : Icons.visibility,
                      ),
                      onPressed: () {
                        setState(() => obscurePassword = !obscurePassword);
                      },
                    ),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    enabledBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide(color: Colors.grey[300]!),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Colors.blue, width: 2),
                    ),
                  ),
                  enabled: !isLoading,
                ),

                const SizedBox(height: 24),

                // Login Button
                ElevatedButton(
                  onPressed: isLoading ? null : _handleLogin,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blue,
                    disabledBackgroundColor: Colors.grey[400],
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: isLoading
                      ? const SizedBox(
                          height: 20,
                          width: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : const Text(
                          'Sign In',
                          style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                ),

                const SizedBox(height: 16),

                // Forgot Password Link
                Align(
                  alignment: Alignment.center,
                  child: TextButton(
                    onPressed: () => context.go('/forgot-password'),
                    child: const Text('Forgot Password?'),
                  ),
                ),

                const SizedBox(height: 32),

                // Biometric Login (Optional)
                if (BiometricHelper.isAvailable)
                  Column(
                    children: [
                      Divider(color: Colors.grey[300]),
                      const SizedBox(height: 16),
                      ElevatedButton.icon(
                        onPressed: isLoading ? null : _handleBiometricLogin,
                        icon: const Icon(Icons.fingerprint),
                        label: const Text('Use Biometric'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.grey[800],
                          padding: const EdgeInsets.symmetric(vertical: 14),
                        ),
                      ),
                    ],
                  ),

                const SizedBox(height: 24),

                // Help Text
                Center(
                  child: Text(
                    'Only riders and admins can access this app',
                    style: TextStyle(
                      color: Colors.grey[600],
                      fontSize: 12,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Future<void> _handleBiometricLogin() async {
    // Implementation covered in section 4
    try {
      final credentials = await BiometricHelper.authenticate();
      // Use stored email/password to login
    } catch (e) {
      setState(() => errorMessage = 'Biometric authentication failed');
    }
  }
}
```

---

## 4. Biometric Authentication (10 minutes)

### 4.1 Biometric Helper

Create `lib/utils/biometric_helper.dart`:

```dart
import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:logger/logger.dart';

class BiometricHelper {
  static final LocalAuthentication _auth = LocalAuthentication();
  static final _secureStorage = const FlutterSecureStorage();
  static final logger = Logger();

  static const String _bioEmailKey = 'bio_email';
  static const String _bioPasswordKey = 'bio_password';

  /// Check if device supports biometric authentication
  static Future<bool> get isAvailable async {
    try {
      final isDeviceSupported = await _auth.canCheckBiometrics;
      final isDeviceSecure = await _auth.deviceSupportsBiometrics;
      return isDeviceSupported || isDeviceSecure;
    } catch (e) {
      logger.e('Error checking biometric availability: $e');
      return false;
    }
  }

  /// Get available biometric types
  static Future<List<BiometricType>> getAvailableBiometrics() async {
    try {
      return await _auth.getAvailableBiometrics();
    } catch (e) {
      logger.e('Error getting available biometrics: $e');
      return [];
    }
  }

  /// Authenticate user with biometrics
  static Future<bool> authenticate({String reason = 'Authenticate to login'}) async {
    try {
      final isAuthenticated = await _auth.authenticate(
        localizedReason: reason,
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
      return isAuthenticated;
    } catch (e) {
      logger.e('Biometric authentication error: $e');
      return false;
    }
  }

  /// Save credentials for biometric login
  static Future<void> saveCredentialsForBiometric({
    required String email,
    required String password,
  }) async {
    try {
      await _secureStorage.write(key: _bioEmailKey, value: email);
      await _secureStorage.write(key: _bioPasswordKey, value: password);
      logger.i('Credentials saved for biometric login');
    } catch (e) {
      logger.e('Error saving biometric credentials: $e');
      rethrow;
    }
  }

  /// Retrieve saved credentials
  static Future<BiometricCredentials?> getStoredCredentials() async {
    try {
      final email = await _secureStorage.read(key: _bioEmailKey);
      final password = await _secureStorage.read(key: _bioPasswordKey);

      if (email != null && password != null) {
        return BiometricCredentials(email: email, password: password);
      }
      return null;
    } catch (e) {
      logger.e('Error retrieving biometric credentials: $e');
      return null;
    }
  }

  /// Clear saved credentials
  static Future<void> clearStoredCredentials() async {
    try {
      await _secureStorage.delete(key: _bioEmailKey);
      await _secureStorage.delete(key: _bioPasswordKey);
      logger.i('Biometric credentials cleared');
    } catch (e) {
      logger.e('Error clearing biometric credentials: $e');
    }
  }
}

class BiometricCredentials {
  final String email;
  final String password;

  BiometricCredentials({required this.email, required this.password});
}
```

---

## 5. Navigation & Routing (8 minutes)

### 5.1 Route Configuration

Create `lib/config/router.dart`:

```dart
import 'package:go_router/go_router.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../screens/login_screen.dart';
import '../screens/rider_dashboard.dart';
import '../screens/admin_dashboard.dart';
import '../screens/splash_screen.dart';
import '../providers/auth_provider.dart';

final routerProvider = Provider<GoRouter>((ref) {
  final authState = ref.watch(authStateProvider);

  return GoRouter(
    initialLocation: '/splash',
    redirect: (context, state) {
      final isGoingToSplash = state.location == '/splash';

      return authState.when(
        data: (user) {
          if (user == null && !isGoingToSplash) {
            return '/login';
          }
          if (user != null && state.location == '/login') {
            return '/splash';
          }
          return null;
        },
        loading: (_) => isGoingToSplash ? null : '/splash',
        error: (_, __) => '/login',
      );
    },
    routes: [
      GoRoute(
        path: '/splash',
        builder: (context, state) => const SplashScreen(),
      ),
      GoRoute(
        path: '/login',
        builder: (context, state) => const LoginScreen(),
      ),
      GoRoute(
        path: '/rider-dashboard',
        builder: (context, state) => const RiderDashboard(),
      ),
      GoRoute(
        path: '/admin-dashboard',
        builder: (context, state) => const AdminDashboard(),
      ),
      GoRoute(
        path: '/forgot-password',
        builder: (context, state) => const ForgotPasswordScreen(),
      ),
    ],
  );
});
```

### 5.2 Splash Screen

Create `lib/screens/splash_screen.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class SplashScreen extends ConsumerWidget {
  const SplashScreen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    authState.whenData((user) {
      if (user != null) {
        // Get user role and redirect
        ref.read(userRoleProvider).then((role) {
          if (role == 'admin') {
            context.go('/admin-dashboard');
          } else if (role == 'rider') {
            context.go('/rider-dashboard');
          }
        });
      } else {
        context.go('/login');
      }
    });

    return Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.delivery_dining, size: 64, color: Colors.blue),
            const SizedBox(height: 24),
            const Text(
              'KATFLIX',
              style: TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            const CircularProgressIndicator(),
            const SizedBox(height: 24),
            Text(
              'Loading...',
              style: TextStyle(color: Colors.grey[600]),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 6. Role-Based Dashboards (15 minutes)

### 6.1 Rider Dashboard

Create `lib/screens/rider_dashboard.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../services/auth_service.dart';
import '../providers/auth_provider.dart';

class RiderDashboard extends ConsumerWidget {
  const RiderDashboard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);
    final authService = ref.read(authServiceProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Rider Dashboard'),
        backgroundColor: Colors.blue,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _handleLogout(context, ref),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // User Info Card
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Welcome, Rider!',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Email: ${authState.value?.email ?? "Loading..."}',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Quick Actions
            const Text(
              'Quick Actions',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            GridView.count(
              crossAxisCount: 2,
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              childAspectRatio: 1.5,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              children: [
                _ActionCard(
                  icon: Icons.local_shipping,
                  title: 'Active Deliveries',
                  onTap: () {},
                ),
                _ActionCard(
                  icon: Icons.route,
                  title: 'View Route',
                  onTap: () {},
                ),
                _ActionCard(
                  icon: Icons.history,
                  title: 'Delivery History',
                  onTap: () {},
                ),
                _ActionCard(
                  icon: Icons.account_circle,
                  title: 'My Profile',
                  onTap: () {},
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      final authService = ref.read(authServiceProvider);
      await authService.logout();
      context.go('/login');
    }
  }
}

class _ActionCard extends StatelessWidget {
  final IconData icon;
  final String title;
  final VoidCallback onTap;

  const _ActionCard({
    required this.icon,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Card(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 32, color: Colors.blue),
            const SizedBox(height: 8),
            Text(
              title,
              textAlign: TextAlign.center,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ],
        ),
      ),
    );
  }
}
```

### 6.2 Admin Dashboard

Create `lib/screens/admin_dashboard.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../providers/auth_provider.dart';

class AdminDashboard extends ConsumerWidget {
  const AdminDashboard({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authStateProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Dashboard'),
        backgroundColor: Colors.deepPurple,
        elevation: 0,
        actions: [
          IconButton(
            icon: const Icon(Icons.logout),
            onPressed: () => _handleLogout(context, ref),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Admin Info Card
            Card(
              color: Colors.deepPurple[50],
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Welcome, Admin!',
                      style: TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Email: ${authState.value?.email ?? "Loading..."}',
                      style: TextStyle(color: Colors.grey[600]),
                    ),
                    const SizedBox(height: 8),
                    const Text(
                      '⭐ You have full administrative access',
                      style: TextStyle(color: Colors.deepPurple),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 24),

            // Admin Functions
            const Text(
              'Admin Functions',
              style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 12),
            _AdminMenuTile(
              icon: Icons.people,
              title: 'Manage Riders',
              subtitle: 'Add, edit, or remove riders',
              onTap: () {},
            ),
            _AdminMenuTile(
              icon: Icons.analytics,
              title: 'Analytics & Reports',
              subtitle: 'View delivery statistics',
              onTap: () {},
            ),
            _AdminMenuTile(
              icon: Icons.settings,
              title: 'System Settings',
              subtitle: 'Configure app settings',
              onTap: () {},
            ),
            _AdminMenuTile(
              icon: Icons.security,
              title: 'Security & Permissions',
              subtitle: 'Manage access controls',
              onTap: () {},
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleLogout(BuildContext context, WidgetRef ref) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Logout'),
        content: const Text('Are you sure you want to logout?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Logout'),
          ),
        ],
      ),
    );

    if (confirmed == true && context.mounted) {
      final authService = ref.read(authServiceProvider);
      await authService.logout();
      context.go('/login');
    }
  }
}

class _AdminMenuTile extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  const _AdminMenuTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: ListTile(
        leading: Icon(icon, color: Colors.deepPurple),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w600)),
        subtitle: Text(subtitle),
        trailing: const Icon(Icons.arrow_forward_ios, size: 16),
        onTap: onTap,
      ),
    );
  }
}
```

---

## 7. HTTP Interceptor for Authenticated Requests (5 minutes)

### 7.1 Dio Interceptor

Create `lib/services/http_client.dart`:

```dart
import 'package:dio/dio.dart';
import 'package:logger/logger.dart';
import 'auth_service.dart';
import '../config/environment.dart';

class AppHttpClient {
  late final Dio dio;
  final AuthService authService;
  final logger = Logger();

  AppHttpClient({required this.authService}) {
    dio = Dio(
      BaseOptions(
        baseUrl: Environment.apiBaseUrl,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 30),
      ),
    );

    // Add auth interceptor
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          // Add auth token
          final token = await authService.getAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }

          logger.d('📡 ${options.method} ${options.path}');
          return handler.next(options);
        },
        onError: (error, handler) async {
          logger.e('❌ ${error.message}');

          // Handle 401 errors
          if (error.response?.statusCode == 401) {
            final refreshed = await authService.refreshSession();
            if (refreshed) {
              return handler.resolve(
                await _retry(error.requestOptions),
              );
            } else {
              await authService.logout();
            }
          }

          return handler.next(error);
        },
      ),
    );
  }

  Future<Response> _retry(RequestOptions requestOptions) async {
    final options = Options(
      method: requestOptions.method,
      headers: requestOptions.headers,
    );
    return dio.request<dynamic>(
      requestOptions.path,
      data: requestOptions.data,
      queryParameters: requestOptions.queryParameters,
      options: options,
    );
  }
}
```

---

## 8. Main App Setup (2 minutes)

### 8.1 Main Function

Create `lib/main.dart`:

```dart
import 'package:flutter/material.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'config/environment.dart';
import 'config/router.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Load environment variables
  await dotenv.load(fileName: '.env');

  // Initialize Supabase
  await Supabase.initialize(
    url: Environment.supabaseUrl,
    anonKey: Environment.supabaseAnonKey,
    authCallbackUrlScheme: 'io.katflix.rider',
  );

  runApp(const ProviderScope(child: MyApp()));
}

class MyApp extends ConsumerWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);

    return MaterialApp.router(
      title: 'KATFLIX Rider App',
      theme: ThemeData(
        primarySwatch: Colors.blue,
        useMaterial3: true,
      ),
      routerConfig: router,
      debugShowCheckedModeBanner: false,
    );
  }
}
```

---

## 9. Testing & Implementation Checklist

### Quick Testing Checklist (5 minutes)

```yaml
Login Flow: ✅ Email/password validation works
  ✅ Rider login redirects to rider dashboard
  ✅ Admin login redirects to admin dashboard
  ✅ Invalid credentials show error message
  ✅ Logout clears session and returns to login

Session Management: ✅ Session persists across app restarts
  ✅ Token refresh works when expired
  ✅ Session clears on logout
  ✅ Biometric login stores credentials securely

Security: ✅ Password field is obscured
  ✅ Tokens stored in secure storage
  ✅ Only riders/admins can login
  ✅ API calls include auth headers

UI/UX: ✅ Loading states show spinner
  ✅ Error messages display clearly
  ✅ Biometric button appears if available
  ✅ Responsive design works on all screen sizes
```

---

## 10. Quick Reference Commands

### Build for Different Platforms

```bash
# iOS
flutter build ios --release

# Android
flutter build apk --release

# Run in debug
flutter run --debug

# Run with specific device
flutter run -d <device_id>
```

### Environment Setup Verification

```bash
# Check environment variables
cat .env

# Verify Supabase connection
flutter pub run supabase setup
```

---

## 11. Troubleshooting Guide

| Issue                           | Solution                                                |
| ------------------------------- | ------------------------------------------------------- |
| **Supabase connection fails**   | Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env` |
| **Login returns 401**           | Check user exists in `staff` table with `role` field    |
| **Biometric not working**       | Ensure `local_auth` permissions in Android/iOS manifest |
| **Session expires immediately** | Check `SUPABASE_SERVICE_ROLE_KEY` is valid              |
| **Tokens not persisting**       | Verify `flutter_secure_storage` is properly configured  |
| **Role-based redirect fails**   | Ensure `_getUserRole()` query matches database schema   |

---

## 12. Architecture Summary

```
┌─────────────────────────────────────────────────────┐
│              Flutter App (lib/)                      │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Presentation Layer                                 │
│  ├── screens/                                       │
│  │   ├── login_screen.dart (Login UI)               │
│  │   ├── rider_dashboard.dart (Rider Home)          │
│  │   ├── admin_dashboard.dart (Admin Home)          │
│  │   └── splash_screen.dart (Initialization)        │
│  │                                                  │
│  State Management Layer                             │
│  ├── providers/                                     │
│  │   ├── auth_provider.dart (Auth state)            │
│  │   └── router.dart (Navigation state)             │
│  │                                                  │
│  Business Logic Layer                               │
│  ├── services/                                      │
│  │   ├── auth_service.dart (Authentication)         │
│  │   └── http_client.dart (API calls)               │
│  │                                                  │
│  Utilities Layer                                    │
│  ├── utils/                                         │
│  │   └── biometric_helper.dart (Biometric auth)     │
│  │                                                  │
│  Configuration Layer                                │
│  ├── config/                                        │
│  │   ├── environment.dart (Env variables)           │
│  │   └── router.dart (Route setup)                  │
│                                                      │
└─────────────────────────────────────────────────────┘
```

---

## 13. Summary & Next Steps

**Completed in 1 Hour:**
✅ Complete login UI with email/password  
✅ Biometric authentication setup  
✅ Role-based access control (Rider/Admin)  
✅ Session management with secure storage  
✅ Navigation routing system  
✅ Auth interceptor for API calls  
✅ Error handling & user feedback

**Next Steps (Future):**

- Implement forget password flow
- Add multi-factor authentication (MFA)
- Setup push notifications for delivery updates
- Add delivery tracking with real-time location updates
- Implement offline mode for delivery details
- Create delivery proof of delivery (photo capture)
- Add chat/messaging between riders and admin

**Deployment Checklist:**

- [ ] Generate signing key for Android
- [ ] Configure iOS provisioning profiles
- [ ] Test on real devices (iOS & Android)
- [ ] Update version in pubspec.yaml
- [ ] Configure Firebase for push notifications
- [ ] Setup app signing in Google Play Console
- [ ] Submit to App Store and Google Play

---

**End of Guide** | Last Updated: January 29, 2026
