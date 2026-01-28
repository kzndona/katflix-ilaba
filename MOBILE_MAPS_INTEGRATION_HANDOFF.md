# Google Maps Location Picker Integration - Mobile App Handoff

**Date**: January 28, 2026  
**Status**: Implementation Ready  
**Backend API**: Complete ✅  
**POS Web**: Complete ✅  
**Rider Web App**: Complete ✅

---

## Overview

The backend and web platforms now have Google Maps integration for location pinning. The mobile app (Flutter) needs to implement the **customer-side location picker** for both pickup and delivery locations.

**What's Complete:**

- ✅ POS cashier can pin delivery location with distance calculation
- ✅ Rider app displays orders on map with route visualization
- ✅ Coordinates stored in orders table under `handling.delivery_lng` and `handling.delivery_lat`
- ✅ Distance calculation API ready

**What's Needed (Mobile Team):**

- 🎯 Customer location picker in booking flow
- 🎯 Store location selection
- 🎯 Distance display in order summary
- 🎯 Send coordinates to backend when creating order

---

## Database Structure

### Orders Table - Location Fields

The `handling` JSONB field now includes:

```json
{
  "handling_type": "delivery", // "pickup" or "delivery"
  "delivery_address": "123 Main St", // User-entered address
  "delivery_lng": 120.9842, // Longitude coordinate
  "delivery_lat": 14.5994, // Latitude coordinate
  "pickup_address": "Store", // Always "Store" for pickup
  "pickup_lng": null, // Always null (store has fixed coordinates)
  "pickup_lat": null, // Always null
  "delivery_fee_override": 50.0, // Optional override
  "special_instructions": "Leave at door"
}
```

---

## Backend APIs Ready for Mobile

### 1. **POST `/api/maps/distance`** - Distance Calculation

**Request:**

```json
{
  "delivery": {
    "lat": 14.585,
    "lng": 120.995
  }
}
```

**Response:**

```json
{
  "success": true,
  "distance": 5250, // meters
  "duration": 900, // seconds
  "distanceKm": "5.25",
  "durationMinutes": 15,
  "polyline": "..." // encoded polyline for route visualization
}
```

**Use Case**: Call this after customer pins delivery location to show distance and duration.

---

### 2. **POST `/api/orders/mobile/create`** - Create Order with Location

**Current Endpoint**: Already accepts location data

**Request Structure** (relevant fields):

```json
{
  "customer_id": "uuid",
  "breakdown": { ... },
  "handling": {
    "delivery_address": "123 Main St",
    "delivery_lng": 120.9950,           // FROM MAP PICKER
    "delivery_lat": 14.5850,            // FROM MAP PICKER
    "delivery_fee_override": 55.00,
    "special_instructions": "..."
  },
  "loyalty": { ... }
}
```

**No changes needed** - backend already accepts these fields.

---

## Implementation Steps for Mobile Team

### Step 1: Add Google Maps to Flutter Project

In `pubspec.yaml`:

```yaml
dependencies:
  google_maps_flutter: ^2.5.0
  google_maps_webservice: ^3.8.4
  geolocator: ^9.0.2
```

### Step 2: Create Location Picker Widget

```dart
class LocationPickerWidget extends StatefulWidget {
  final Function(double lat, double lng, String address) onLocationSelected;
  final String title;
  final LatLng? initialLocation;

  @override
  State<LocationPickerWidget> createState() => _LocationPickerWidgetState();
}
```

**Features needed:**

- ✅ Display Google Map
- ✅ Allow user to tap/drag to select location
- ✅ Show marker on selected location
- ✅ Display coordinates and address
- ✅ Calculate distance to store via API
- ✅ Show estimated delivery time
- ✅ Confirm/Cancel buttons

### Step 3: Update Booking Flow

In `mobile_booking_payment_step.dart` (or equivalent):

**For Delivery Address:**

```dart
// When user selects "Delivery"
1. Show LocationPickerWidget
2. User pins location on map
3. Get: lat, lng, address
4. Call /api/maps/distance with coordinates
5. Display: distance + duration + delivery fee
6. Save to provider:
   - breakdown.handling.delivery_lng = lng
   - breakdown.handling.delivery_lat = lat
   - breakdown.handling.delivery_address = address
7. Update order total with distance-based delivery fee
```

**For Pickup Address:**

```dart
// When user selects "Pickup"
1. Show store location on map (pre-pinned)
2. No location picker needed
3. Set:
   - breakdown.handling.pickup_address = "Store"
   - breakdown.handling.pickup_lng = null
   - breakdown.handling.pickup_lat = null
```

### Step 4: Update Order Breakdown

Modify `order_models.dart`:

```dart
class OrderHandling {
  final String? delivery_address;
  final double? delivery_lng;
  final double? delivery_lat;
  final String? pickup_address;      // "Store"
  final double? pickup_lng;          // null
  final double? pickup_lat;          // null
  final double? delivery_fee_override;
  final String? special_instructions;

  OrderHandling({
    required this.delivery_address,
    required this.delivery_lng,
    required this.delivery_lat,
    ...
  });

  Map<String, dynamic> toJson() => {
    'delivery_address': delivery_address,
    'delivery_lng': delivery_lng,
    'delivery_lat': delivery_lat,
    'pickup_address': pickup_address,
    'pickup_lng': pickup_lng,
    'pickup_lat': pickup_lat,
    'delivery_fee_override': delivery_fee_override,
    'special_instructions': special_instructions,
  };
}
```

### Step 5: Update Provider Logic

In `mobile_booking_provider.dart`:

```dart
Future<void> calculateDeliveryDistance(double lat, double lng) async {
  try {
    final response = await http.post(
      Uri.parse('$API_BASE_URL/api/maps/distance'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'delivery': {'lat': lat, 'lng': lng}
      }),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);

      // Update breakdown with distance info
      _deliveryDistance = data['distanceKm'];
      _deliveryDuration = data['durationMinutes'];

      // Optionally update delivery fee based on distance
      // _breakdown.summary.delivery_fee = calculateFeeByDistance(data['distance']);

      notifyListeners();
    }
  } catch (e) {
    print('Distance calculation error: $e');
  }
}

void setDeliveryLocation(double lat, double lng, String address) {
  _breakdown = _breakdown.copyWith(
    handling: _breakdown.handling.copyWith(
      delivery_address: address,
      delivery_lng: lng,
      delivery_lat: lat,
    ),
  );

  calculateDeliveryDistance(lat, lng);
  notifyListeners();
}
```

### Step 6: Update UI

**Booking Flow - Address Input:**

```dart
// Old: Simple text input
// New: Combination of text + map button

Column(
  children: [
    TextField(
      controller: addressController,
      label: 'Enter address',
    ),
    SizedBox(height: 12),
    ElevatedButton.icon(
      onPressed: () {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (context) => LocationPickerScreen(
              onLocationSelected: (lat, lng, address) {
                provider.setDeliveryLocation(lat, lng, address);
                Navigator.pop(context);
              },
            ),
          ),
        );
      },
      icon: Icon(Icons.location_on),
      label: Text('📍 Pin Location'),
    ),
    if (provider.selectedDeliveryLng != null)
      Padding(
        padding: EdgeInsets.only(top: 12),
        child: Text(
          '✓ Location pinned • ${provider.deliveryDistance} km • ${provider.deliveryDuration} min',
          style: TextStyle(color: Colors.green, fontSize: 12),
        ),
      ),
  ],
)
```

---

## Configuration Required

### Google Maps API Key

The mobile app needs the same Google Maps API key used for web:

```dart
// android/app/src/main/AndroidManifest.xml
<meta-data
    android:name="com.google.android.geo.API_KEY"
    android:value="YOUR_GOOGLE_MAPS_API_KEY" />

// ios/Runner/GoogleService-Info.plist
<key>API_KEY</key>
<string>YOUR_GOOGLE_MAPS_API_KEY</string>
```

**Maps APIs Required:**

- ✅ Maps SDK for Android
- ✅ Maps SDK for iOS
- ✅ Directions API (for route/distance)
- ✅ Geocoding API (optional - for address lookup)

---

## Testing Checklist

- [ ] Customer can open location picker
- [ ] Map loads correctly
- [ ] Can tap/drag to select location
- [ ] Distance calculation works
- [ ] Coordinates sent correctly in order creation
- [ ] Order shows correct delivery coordinates in backend
- [ ] Rider can see order with correct location on map

---

## API Response Examples

### Successful Location Calculation

```json
{
  "success": true,
  "distance": 5250,
  "duration": 900,
  "distanceKm": "5.25",
  "durationMinutes": 15,
  "polyline": "encoded_route_data"
}
```

### Order Creation with Location

```json
{
  "success": true,
  "order_id": "uuid",
  "message": "Order created with delivery location"
}
```

---

## Troubleshooting

**Issue**: Distance API returns error

- Check API key is valid
- Verify Directions API is enabled in Google Cloud Console
- Ensure coordinates are valid (lat: -90 to 90, lng: -180 to 180)

**Issue**: Map not displaying

- Verify API key in app configuration
- Check Maps SDK is properly initialized
- Review Android/iOS permissions for location

**Issue**: Coordinates not saving in order\*\*

- Verify `delivery_lng` and `delivery_lat` are included in request
- Check order creation endpoint accepts these fields (it does ✅)
- Debug: Log the request/response from order creation API

---

## What the Customer Sees (UX Flow)

```
1. Booking Flow - Step 5 (Address)
   ├─ Option A: "Pickup at Store"
   │  └─ Location: Pre-pinned store location
   └─ Option B: "Delivery to Address"
      ├─ Text input: Enter address
      ├─ Button: "📍 Pin Location on Map"
      └─ Map loads → User taps to pin → Distance shows → Confirm

2. Order Summary (Before Payment)
   ├─ Delivery Address: "123 Main St"
   ├─ Distance: 5.25 km
   ├─ Duration: 15 minutes
   └─ Delivery Fee: ₱55.00

3. Order Confirmation
   ├─ Confirmation message
   └─ Location saved to order
```

---

## Questions?

Contact the backend team for:

- Changes to API response format
- Modifications to coordinate storage
- Integration with distance-based pricing
- Real-time order tracking features

---

**Implementation Estimate**: 4-6 hours  
**Priority**: High - Required for delivery routing and rider app

Good luck! 🚀
