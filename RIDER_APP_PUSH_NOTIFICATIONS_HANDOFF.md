# Rider Companion App - Push Notifications Handoff

**Date:** February 12, 2026
**Platform:** Flutter (Android only)
**Status:** Backend complete, awaiting Flutter implementation
**Goal:** Receive push notifications when a new order pickup starts, and navigate to that order's screen when tapped

---

## Summary: What's Already Done (Backend) ✅

1. ✅ Firebase Admin SDK initialized on the Next.js server
2. ✅ Firebase service account key configured in `.env.local`
3. ✅ `staff` table already has `fcm_device_token TEXT` column
4. ✅ API endpoint created: **POST `/api/rider/register-device`** (stores rider device token)
5. ✅ Notification sender utility: `sendRiderPushNotification()` broadcasts to ALL active riders
6. ✅ Pickup start trigger wired in: when staff clicks "Start Pickup" on the web app, all riders with a registered device token receive a push notification

---

## Firebase Project

This app shares the **same Firebase project** as the customer booking app. Both apps use Firebase Cloud Messaging (FCM) through the same project but with different app registrations.

You need to register a **new Android app** in the existing Firebase project:
- Go to Firebase Console → Project Settings → Add App → Android
- Use a **different package name** than the customer app (e.g., `com.katflix.rider`)
- Download the generated `google-services.json` for this new Android app

---

## What You Need to Do: Flutter Implementation

### Step 1: Install Dependencies

Add to `pubspec.yaml`:

```yaml
dependencies:
  firebase_core: ^2.24.0
  firebase_messaging: ^14.7.0
  http: ^1.1.0
```

```bash
flutter pub get
```

---

### Step 2: Configure Firebase for Android

1. **Download `google-services.json`** from Firebase Console (for the rider app's Android registration)
2. Place in: `android/app/google-services.json`

3. **Update `android/build.gradle`:**

   ```gradle
   buildscript {
     dependencies {
       classpath 'com.google.gms:google-services:4.3.15'
     }
   }
   ```

4. **Update `android/app/build.gradle`:**

   ```gradle
   plugins {
     id 'com.android.application'
     id 'com.google.gms.google-services'
   }
   ```

5. Run FlutterFire CLI to generate config:

   ```bash
   flutterfire configure
   ```

---

### Step 3: Initialize Firebase & Notification Handling on Startup

**File:** `lib/main.dart`

This is the core of the implementation. You need to:
- Initialize Firebase
- Set up notification handlers for foreground, background, and terminated states
- Handle notification tap to navigate to the specific order screen

```dart
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'firebase_options.dart';

/// Global navigator key — required to navigate from notification taps
/// that happen outside the widget tree (background/terminated).
final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

/// Background message handler — MUST be a top-level function (not a method).
/// Called when a notification arrives while the app is fully terminated or in background.
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  // No navigation here — the OS shows the notification automatically.
  // Navigation happens when the user taps the notification (handled by
  // getInitialMessage or onMessageOpenedApp).
  print('[BG] Received background message: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );

  // Register the background handler BEFORE runApp
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(const RiderApp());
}

class RiderApp extends StatefulWidget {
  const RiderApp({super.key});

  @override
  State<RiderApp> createState() => _RiderAppState();
}

class _RiderAppState extends State<RiderApp> {
  @override
  void initState() {
    super.initState();
    _setupNotifications();
  }

  Future<void> _setupNotifications() async {
    final messaging = FirebaseMessaging.instance;

    // Android auto-grants permission, but request anyway for forward-compatibility
    await messaging.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );

    // --- CASE 1: App was terminated, user tapped a notification to open it ---
    final initialMessage = await messaging.getInitialMessage();
    if (initialMessage != null) {
      _handleNotificationTap(initialMessage);
    }

    // --- CASE 2: App is in background, user taps the notification ---
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      _handleNotificationTap(message);
    });

    // --- CASE 3: App is in foreground ---
    // The OS does NOT show a system notification when the app is in foreground.
    // You can show a snackbar / in-app alert if you want.
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      print('[FG] Notification received: ${message.notification?.title}');

      // Example: show a SnackBar
      final ctx = navigatorKey.currentContext;
      if (ctx != null) {
        ScaffoldMessenger.of(ctx).showSnackBar(
          SnackBar(
            content: Text(message.notification?.body ?? 'New pickup!'),
            action: SnackBarAction(
              label: 'View',
              onPressed: () => _handleNotificationTap(message),
            ),
            duration: const Duration(seconds: 5),
          ),
        );
      }
    });
  }

  /// Central handler: extract orderId from the FCM data payload and navigate.
  void _handleNotificationTap(RemoteMessage message) {
    final orderId = message.data['orderId'];
    if (orderId == null || orderId.isEmpty) {
      print('[NAV] No orderId in notification data — ignoring');
      return;
    }

    print('[NAV] Navigating to order: $orderId');

    // Use the global navigator key to push the order detail screen.
    // WidgetsBinding ensures this runs after the route tree is built
    // (important for the terminated-app case).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      navigatorKey.currentState?.push(
        MaterialPageRoute(
          builder: (_) => OrderDetailScreen(orderId: orderId),
        ),
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey, // <-- IMPORTANT: attach the global key
      title: 'Katflix Rider',
      home: const HomeScreen(), // Your rider home/dashboard screen
    );
  }
}
```

**Key points:**
- `navigatorKey` is a global key that lets you navigate from anywhere (including notification callbacks).
- `getInitialMessage()` handles the case where the app was **fully closed** and the user taps a notification.
- `onMessageOpenedApp` handles taps when the app is in the **background**.
- `onMessage` handles notifications when the app is **in the foreground** (system tray notification is NOT shown by the OS in this case, so you show an in-app alert yourself).

---

### Step 4: Register Device Token After Rider Logs In

After the rider authenticates (however your auth flow works), call this to register the FCM token with the backend:

```dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

const String apiBaseUrl = 'https://your-production-domain.com'; // or http://10.0.2.2:3000 for local Android emulator

Future<void> registerRiderDeviceToken(String staffId) async {
  try {
    final messaging = FirebaseMessaging.instance;
    final token = await messaging.getToken();

    if (token == null) {
      print('❌ Failed to get FCM token');
      return;
    }

    print('📱 FCM Token: $token');

    final response = await http.post(
      Uri.parse('$apiBaseUrl/api/rider/register-device'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'staffId': staffId,
        'deviceToken': token,
      }),
    );

    if (response.statusCode == 200) {
      print('✅ Rider device token registered');
    } else {
      print('❌ Registration failed: ${response.body}');
    }

    // Also listen for token refreshes (happens periodically)
    messaging.onTokenRefresh.listen((newToken) async {
      print('🔄 FCM token refreshed, re-registering...');
      await http.post(
        Uri.parse('$apiBaseUrl/api/rider/register-device'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'staffId': staffId,
          'deviceToken': newToken,
        }),
      );
    });
  } catch (e) {
    print('❌ Error registering device token: $e');
  }
}
```

**Usage after login:**

```dart
// The staffId for the rider is their staff table UUID.
// For the existing test rider: "f6b0433f-e72c-46ff-8fc8-49ef66774de7"
await registerRiderDeviceToken(staffId);
```

---

### Step 5: Order Detail Screen (Navigation Target)

When the rider taps a notification, the app navigates to `OrderDetailScreen` with the `orderId`. This screen should:

1. Accept `orderId` as a constructor parameter
2. **Show a loading indicator** while fetching order data
3. Fetch the order from the backend API
4. Display the order details (customer name, pickup address, items, etc.)

```dart
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';

class OrderDetailScreen extends StatefulWidget {
  final String orderId;

  const OrderDetailScreen({super.key, required this.orderId});

  @override
  State<OrderDetailScreen> createState() => _OrderDetailScreenState();
}

class _OrderDetailScreenState extends State<OrderDetailScreen> {
  bool _loading = true;
  Map<String, dynamic>? _order;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchOrder();
  }

  Future<void> _fetchOrder() async {
    try {
      // Fetch order details from backend
      final response = await http.get(
        Uri.parse('$apiBaseUrl/api/orders/${widget.orderId}'),
        // Add auth headers as needed
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _order = data['data'] ?? data;
          _loading = false;
        });
      } else {
        setState(() {
          _error = 'Failed to load order';
          _loading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = e.toString();
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Order Details')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(child: Text('Error: $_error'))
              : _buildOrderDetails(),
    );
  }

  Widget _buildOrderDetails() {
    if (_order == null) return const Center(child: Text('No data'));

    // Build your order detail UI here using _order map
    // Key fields available:
    //   _order['id']
    //   _order['status']
    //   _order['total_amount']
    //   _order['handling']['pickup']['address']
    //   _order['handling']['delivery']['address']
    //   _order['customers']['first_name']
    //   _order['customers']['last_name']
    //   _order['customers']['phone_number']
    //   _order['breakdown']['baskets'] (array)

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Order: ${_order!['id']}',
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          // ... your order detail widgets
        ],
      ),
    );
  }
}
```

---

## FCM Data Payload Reference

When the backend sends a rider notification, the `data` payload in the FCM message contains:

```json
{
  "type": "pickup_started",
  "orderId": "uuid-of-the-order",
  "pickupAddress": "123 Main St, City"
}
```

**Use `message.data['orderId']`** to extract the order ID for navigation.

The `notification` payload (shown by the OS in the system tray) contains:

```
Title: "📍 New Pickup Assignment"
Body:  "Juan Dela Cruz - Pickup at 123 Main St, City"
```

---

## Backend API Endpoints (For Reference)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/rider/register-device` | POST | Register FCM token. Body: `{ staffId, deviceToken }` |
| `/api/orders/{orderId}` | GET | Fetch single order details (for the order detail screen) |
| `/api/orders/rider` | GET | Fetch orders assigned to riders (if you build a list view) |

---

## Backend Files (For Reference)

| File | Purpose |
|---|---|
| `src/app/utils/firebase-admin.ts` | Firebase Admin SDK initialization |
| `src/app/utils/send-notification.ts` | Contains `sendRiderPushNotification()` — broadcasts to all active riders |
| `src/app/api/rider/register-device/route.ts` | Stores rider's FCM device token in `staff` table |
| `src/app/api/orders/[orderId]/serviceStatus/route.ts` | Triggers rider notification when `handlingType=pickup` and `action=start` |

---

## Testing

1. **Build and run the rider app** on an Android device/emulator:
   ```bash
   flutter run
   ```

2. **Log in as the rider** and verify "Rider device token registered" in backend logs

3. **Open the web management app** → Baskets page

4. **Click "Start Pickup"** on any order

5. **Check the rider's phone** — you should see:
   - System notification: "📍 New Pickup Assignment"
   - Tapping it opens the app and navigates to that order's detail screen

6. **Test all 3 notification states:**
   - App in **foreground** → in-app SnackBar appears
   - App in **background** → system notification, tap navigates to order
   - App **terminated** → system notification, tap opens app and navigates to order

---

## Troubleshooting

| Issue | Solution |
|---|---|
| No notification received | Check backend logs for `sendRiderPushNotification` output. Verify token is saved in `staff.fcm_device_token` |
| Token registration returns 403 | The `staff_roles` table must have a row with `staff_id` and `role_id = "rider"` |
| Notification received but no navigation on tap | Ensure `message.data['orderId']` is present. Check that `navigatorKey` is attached to `MaterialApp` |
| App crashes on notification tap when terminated | Ensure `Firebase.initializeApp()` is called in `_firebaseMessagingBackgroundHandler` |
| `http://localhost:3000` doesn't work on emulator | Use `http://10.0.2.2:3000` for Android emulator (maps to host machine's localhost) |
| `google-services.json` not found | Make sure it's placed in `android/app/` (not `android/`) |

---

## Important Notes

- **No notification history screen needed.** The push notification is purely an alert — riders see it in the system tray and tap to view the order.
- **All active riders** with a registered device token receive the notification. There is no per-rider assignment at this time.
- The rider's `staffId` is their UUID from the `staff` table (e.g., `f6b0433f-e72c-46ff-8fc8-49ef66774de7` for the test rider account `rider@katflix-ilaba.com`).
- For local development, use `http://10.0.2.2:3000` as the API base URL (Android emulator → host machine).
