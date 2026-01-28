# Mobile Booking App - Location Picker Implementation Guide

**Date**: January 29, 2026  
**Target**: Flutter Mobile App  
**Status**: Ready for Implementation

---

## 📋 Table of Contents

1. [Routes Needed by Mobile App](#routes-needed-by-mobile-app)
2. [Location Picker Flow](#location-picker-flow)
3. [How to Add Map Input (Like POS)](#how-to-add-map-input-like-pos)
4. [Data Structure for Handling JSONB](#data-structure-for-handling-jsonb)
5. [How to Send Data to Web API](#how-to-send-data-to-web-api)
6. [What Web API Expects](#what-web-api-expects)
7. [Implementation Checklist](#implementation-checklist)

---

## 🛣️ Routes Needed by Mobile App

Your mobile app needs to communicate with these backend API endpoints:

### 1. **GET `/api/pos/services`** - Fetch Laundry Services

- **Purpose**: Get all available laundry services (wash, dry, iron, etc.)
- **Authentication**: None required (public)
- **Response**: Services with pricing, tiers, and modifiers
- **Usage**: Load services when booking starts

```dart
// Example Dart call
final response = await http.get(
  Uri.parse('$API_BASE_URL/api/pos/services'),
  headers: {'Content-Type': 'application/json'},
);
```

---

### 2. **GET `/api/pos/products`** - Fetch Products

- **Purpose**: Get all available products (plastic bags, detergent, etc.)
- **Authentication**: None required (public)
- **Response**: Products with pricing and inventory
- **Usage**: Load products when booking starts

```dart
final response = await http.get(
  Uri.parse('$API_BASE_URL/api/pos/products'),
  headers: {'Content-Type': 'application/json'},
);
```

---

### 3. **GET `/api/pos/customers/search?query=<search>&limit=10`** - Search Customers

- **Purpose**: Search existing customers by name or phone
- **Authentication**: None required (public)
- **Query Parameters**:
  - `query` (required, min 2 chars)
  - `limit` (optional, default 10)
- **Response**: List of matching customers
- **Usage**: Find returning customers

```dart
final response = await http.get(
  Uri.parse('$API_BASE_URL/api/pos/customers/search?query=John&limit=10'),
  headers: {'Content-Type': 'application/json'},
);
```

---

### 4. **POST `/api/maps/distance`** - Calculate Distance & Duration ⭐ MAPS

- **Purpose**: Calculate delivery distance and duration from store to customer location
- **Authentication**: None required (public)
- **Request**: Delivery coordinates + optional store location
- **Response**: Distance (meters/km), duration (seconds/minutes), polyline for route visualization
- **Usage**: Called after customer pins delivery location to show distance & estimated delivery time

```dart
// Example Dart call
final response = await http.post(
  Uri.parse('$API_BASE_URL/api/maps/distance'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({
    'delivery': {
      'lat': 14.5850,
      'lng': 120.9950,
    },
    // Optional: override store location (defaults to .env)
    'store': {
      'lat': 14.7548665,
      'lng': 121.0258515,
    }
  }),
);
```

**Response Example**:

```json
{
  "success": true,
  "distance": 5250, // meters
  "duration": 900, // seconds
  "distanceKm": "5.25", // formatted km
  "durationMinutes": 15, // formatted minutes
  "polyline": "..." // encoded polyline for route visualization
}
```

---

### 5. **POST `/api/orders/mobile/create`** - Create Order ⭐ ORDER CREATION

- **Purpose**: Create order with breakdown, handling (location), and payment info
- **Authentication**: None required (optional)
- **Request**: Customer data, breakdown (items/baskets/fees), handling (addresses/coordinates), payment
- **Response**: Order ID, success confirmation
- **Usage**: Final step after customer confirms order

```dart
final response = await http.post(
  Uri.parse('$API_BASE_URL/api/orders/mobile/create'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode(orderPayload),
);
```

---

### 6. **GET `/api/orders`** - Fetch Order History (Optional)

- **Purpose**: Fetch all orders for a customer (if authentication available)
- **Authentication**: Optional (requires Supabase session)
- **Response**: Order list with details
- **Usage**: Show order history screen

---

## 🗺️ Location Picker Flow

### For **DELIVERY** Orders:

```
1. Customer selects "Delivery" option
   ↓
2. Show LocationPickerWidget
   ├─ Display Google Map
   ├─ Default center = Store location
   └─ Allow tap/drag to pin location
   ↓
3. User pins location on map
   └─ Gets: latitude, longitude, address
   ↓
4. Call POST /api/maps/distance with coordinates
   ├─ Show distance: "5.25 km"
   └─ Show duration: "15 minutes"
   ↓
5. Show delivery fee (based on distance or fixed)
   ↓
6. User confirms location
   └─ Save to provider:
      - delivery_address = "123 Main St, City"
      - delivery_lat = 14.5850
      - delivery_lng = 120.9950
   ↓
7. Continue with order creation
```

### For **PICKUP** Orders:

```
1. Customer selects "Pickup" option
   ↓
2. Show store location (no map picker needed)
   └─ Set to store location from .env
   ↓
3. Pickup address = "Store" (fixed)
   └─ No coordinates needed (store has fixed address)
   ↓
4. Continue with order creation
```

---

## 📍 How to Add Map Input (Like POS)

Your POS already has this. Here's what the mobile app needs:

### Step 1: Install Google Maps Flutter Package

**File**: `pubspec.yaml`

```yaml
dependencies:
  google_maps_flutter: ^2.5.0
  google_maps_webservice: ^3.8.4
  geolocator: ^9.0.2
  location: ^5.1.0
```

Run:

```bash
flutter pub get
```

---

### Step 2: Create Location Picker Widget

**File**: `lib/widgets/location_picker_widget.dart`

```dart
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

typedef LocationCallback = void Function(double lat, double lng, String address);

class LocationPickerWidget extends StatefulWidget {
  final LocationCallback onLocationSelected;
  final String title;
  final LatLng? initialLocation;
  final LatLng storeLocation;

  const LocationPickerWidget({
    required this.onLocationSelected,
    required this.title,
    this.initialLocation,
    required this.storeLocation,
  });

  @override
  State<LocationPickerWidget> createState() => _LocationPickerWidgetState();
}

class _LocationPickerWidgetState extends State<LocationPickerWidget> {
  late GoogleMapController mapController;
  late LatLng selectedLocation;
  Marker? deliveryMarker;
  double? distance;
  int? duration;
  bool loading = false;

  @override
  void initState() {
    super.initState();
    selectedLocation = widget.initialLocation ?? widget.storeLocation;
    _updateMarker();
  }

  void _updateMarker() {
    setState(() {
      deliveryMarker = Marker(
        markerId: MarkerId('delivery'),
        position: selectedLocation,
        infoWindow: InfoWindow(
          title: 'Delivery Location',
          snippet: '${selectedLocation.latitude.toStringAsFixed(4)}, '
              '${selectedLocation.longitude.toStringAsFixed(4)}',
        ),
      );
    });
    _calculateDistance();
  }

  Future<void> _calculateDistance() async {
    setState(() => loading = true);

    try {
      final response = await http.post(
        Uri.parse('$API_BASE_URL/api/maps/distance'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'delivery': {
            'lat': selectedLocation.latitude,
            'lng': selectedLocation.longitude,
          }
        }),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          distance = double.parse(data['distanceKm']);
          duration = data['durationMinutes'];
        });
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error calculating distance: $e')),
      );
    } finally {
      setState(() => loading = false);
    }
  }

  void _onMapCreated(GoogleMapController controller) {
    mapController = controller;
  }

  void _onMapTapped(LatLng position) {
    setState(() => selectedLocation = position);
    _updateMarker();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      insetPadding: EdgeInsets.all(12),
      child: Column(
        children: [
          // Header
          Container(
            padding: EdgeInsets.all(16),
            color: Colors.blue,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  widget.title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                Text(
                  'Tap or drag to select location',
                  style: TextStyle(
                    fontSize: 12,
                    color: Colors.white70,
                  ),
                ),
              ],
            ),
          ),

          // Map
          Expanded(
            child: Stack(
              children: [
                GoogleMap(
                  onMapCreated: _onMapCreated,
                  initialCameraPosition: CameraPosition(
                    target: selectedLocation,
                    zoom: 15,
                  ),
                  onTap: _onMapTapped,
                  markers: {if (deliveryMarker != null) deliveryMarker!},
                  compassEnabled: true,
                  myLocationEnabled: true,
                ),
                // Center pin indicator
                Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(Icons.location_on, size: 40, color: Colors.red),
                      SizedBox(height: 8),
                      Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.red.withOpacity(0.4),
                            width: 2,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          // Distance & Duration Display
          if (distance != null && duration != null)
            Container(
              padding: EdgeInsets.all(12),
              color: Colors.blue[50],
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  Column(
                    children: [
                      Text('Distance', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      Text('$distance km', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Column(
                    children: [
                      Text('Time', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      Text('$duration min', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  Column(
                    children: [
                      Text('Lat', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      Text(
                        selectedLocation.latitude.toStringAsFixed(4),
                        style: TextStyle(fontSize: 12, fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                  Column(
                    children: [
                      Text('Lng', style: TextStyle(fontSize: 12, color: Colors.grey[600])),
                      Text(
                        selectedLocation.longitude.toStringAsFixed(4),
                        style: TextStyle(fontSize: 12, fontFamily: 'monospace'),
                      ),
                    ],
                  ),
                ],
              ),
            ),

          // Buttons
          Padding(
            padding: EdgeInsets.all(16),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              gap: 12,
              children: [
                OutlinedButton(
                  onPressed: () => Navigator.pop(context),
                  child: Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: loading
                      ? null
                      : () {
                          Navigator.pop(context);
                          // Get address from coordinates (optional: use reverse geocoding)
                          final address = '${selectedLocation.latitude.toStringAsFixed(4)}, '
                              '${selectedLocation.longitude.toStringAsFixed(4)}';
                          widget.onLocationSelected(
                            selectedLocation.latitude,
                            selectedLocation.longitude,
                            address,
                          );
                        },
                  child: Text('Confirm Location'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    mapController.dispose();
    super.dispose();
  }
}
```

---

### Step 3: Use Location Picker in Booking Flow

**File**: `lib/screens/booking_screen.dart` (or similar)

```dart
class BookingDeliveryStep extends StatefulWidget {
  @override
  State<BookingDeliveryStep> createState() => _BookingDeliveryStepState();
}

class _BookingDeliveryStepState extends State<BookingDeliveryStep> {
  String? deliveryAddress;
  double? deliveryLat;
  double? deliveryLng;
  double? distance;
  int? durationMinutes;

  void _openLocationPicker() async {
    showDialog(
      context: context,
      builder: (context) => LocationPickerWidget(
        title: 'Pin Delivery Location',
        storeLocation: LatLng(14.7548665, 121.0258515),
        initialLocation: deliveryLat != null && deliveryLng != null
            ? LatLng(deliveryLat!, deliveryLng!)
            : null,
        onLocationSelected: (lat, lng, address) {
          setState(() {
            deliveryLat = lat;
            deliveryLng = lng;
            deliveryAddress = address;
          });
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        // Handling type selection
        Row(
          children: [
            Expanded(
              child: ElevatedButton(
                onPressed: () => setState(() => deliveryType = 'pickup'),
                child: Text('📍 Pickup'),
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: ElevatedButton(
                onPressed: () => setState(() => deliveryType = 'delivery'),
                child: Text('🚚 Delivery'),
              ),
            ),
          ],
        ),

        if (deliveryType == 'delivery') ...[
          SizedBox(height: 16),

          // Address text field
          TextField(
            controller: addressController,
            decoration: InputDecoration(
              labelText: 'Delivery Address',
              border: OutlineInputBorder(),
            ),
          ),
          SizedBox(height: 12),

          // Location picker button
          ElevatedButton.icon(
            onPressed: _openLocationPicker,
            icon: Icon(Icons.location_on),
            label: Text('📍 Pin Location'),
          ),

          // Show distance if pinned
          if (deliveryLat != null && deliveryLng != null)
            Padding(
              padding: EdgeInsets.only(top: 12),
              child: Container(
                padding: EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.blue[50],
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.blue[200]!),
                ),
                child: Text(
                  '✓ Location pinned: $distance km away, ~$durationMinutes min drive',
                  style: TextStyle(color: Colors.green[700]),
                ),
              ),
            ),
        ],
      ],
    );
  }
}
```

---

## 📦 Data Structure for Handling JSONB

### What You Need to Send to Backend

The `handling` field in your order payload should look like this:

```typescript
interface OrderHandling {
  // ===== DELIVERY TYPE & ADDRESSES =====
  handling_type: "pickup" | "delivery";
  pickup_address: "Store" | null; // Always "Store" for pickup
  delivery_address: "123 Main St, City"; // User-entered or from map

  // ===== COORDINATES (NEW) =====
  delivery_lng: 120.995 | null; // Delivery location longitude
  delivery_lat: 14.585 | null; // Delivery location latitude

  // ===== FEES & NOTES =====
  delivery_fee_override: 55.0 | null; // Optional override
  special_instructions: "Leave at door"; // Customer notes

  // ===== PAYMENT =====
  payment_method: "cash" | "gcash";
  amount_paid: 500.0;
  gcash_reference: "ref123" | null; // If GCash
}
```

### Real Example

**For Delivery**:

```json
{
  "handling_type": "delivery",
  "pickup_address": null,
  "delivery_address": "123 Main St, Caloocan City",
  "delivery_lng": 120.995,
  "delivery_lat": 14.585,
  "delivery_fee_override": 55.0,
  "special_instructions": "Leave at gate",
  "payment_method": "cash",
  "amount_paid": 500.0
}
```

**For Pickup**:

```json
{
  "handling_type": "pickup",
  "pickup_address": "Store",
  "delivery_address": null,
  "delivery_lng": null,
  "delivery_lat": null,
  "delivery_fee_override": null,
  "special_instructions": null,
  "payment_method": "gcash",
  "amount_paid": 250.0,
  "gcash_reference": "gcash_ref_123"
}
```

---

## 🚀 How to Send Data to Web API

### Complete Order Creation Payload

When user confirms order, build and send this payload:

```dart
// File: lib/services/order_service.dart

class OrderService {
  static const String API_BASE_URL = 'https://your-api.com';

  static Future<CreateOrderResponse> createMobileOrder({
    required CustomerData customerData,
    required OrderBreakdown breakdown,
    required OrderHandling handling,
    required OrderLoyalty loyalty,
    String? gcashReceiptUrl,
  }) async {
    final payload = {
      'customer_data': {
        'first_name': customerData.firstName,
        'last_name': customerData.lastName,
        'phone_number': customerData.phoneNumber,
        'email': customerData.email,
      },
      'breakdown': {
        'items': breakdown.items.map((item) => {
          'product_id': item.productId,
          'product_name': item.productName,
          'quantity': item.quantity,
          'unit_price': item.unitPrice,
          'total_price': item.totalPrice,
        }).toList(),
        'baskets': breakdown.baskets.map((basket) => {
          'basket_number': basket.basketNumber,
          'weight_kg': basket.weightKg,
          'services': {
            'wash': basket.wash,
            'wash_cycles': basket.washCycles,
            'dry': basket.dry,
            'spin': basket.spin,
            'iron_weight_kg': basket.ironWeightKg,
            'fold': basket.fold,
            'additional_dry_time_minutes': basket.additionalDryTimeMinutes,
            'plastic_bags': basket.plasticBags,
          },
          'subtotal': basket.subtotal,
        }).toList(),
        'fees': breakdown.fees.map((fee) => {
          'type': fee.type,
          'amount': fee.amount,
          'description': fee.description,
        }).toList(),
        'summary': {
          'subtotal_products': breakdown.summary.subtotalProducts,
          'subtotal_services': breakdown.summary.subtotalServices,
          'staff_service_fee': breakdown.summary.staffServiceFee,
          'delivery_fee': breakdown.summary.deliveryFee,
          'subtotal_before_vat': breakdown.summary.subtotalBeforeVat,
          'vat_amount': breakdown.summary.vatAmount,
          'loyalty_discount': breakdown.summary.loyaltyDiscount,
          'total': breakdown.summary.total,
        },
      },
      'handling': {
        'handling_type': handling.handlingType,
        'pickup_address': handling.pickupAddress,
        'delivery_address': handling.deliveryAddress,
        'delivery_lng': handling.deliveryLng,  // ⭐ NEW
        'delivery_lat': handling.deliveryLat,  // ⭐ NEW
        'delivery_fee_override': handling.deliveryFeeOverride,
        'special_instructions': handling.specialInstructions,
        'payment_method': handling.paymentMethod,
        'amount_paid': handling.amountPaid,
        'gcash_reference': handling.gcashReference,
      },
      'loyalty': {
        'discount_tier': loyalty.discountTier,
      },
      'gcash_receipt_url': gcashReceiptUrl,
    };

    try {
      final response = await http.post(
        Uri.parse('$API_BASE_URL/api/orders/mobile/create'),
        headers: {
          'Content-Type': 'application/json',
        },
        body: jsonEncode(payload),
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return CreateOrderResponse.fromJson(data);
      } else {
        throw Exception('Failed to create order: ${response.body}');
      }
    } catch (e) {
      throw Exception('Order creation error: $e');
    }
  }
}
```

---

## 🔍 What Web API Expects

### Endpoint: `POST /api/orders/mobile/create`

#### Request Headers

```
Content-Type: application/json
```

#### Request Body Structure

```json
{
  "customer_data": {
    "first_name": "John",
    "last_name": "Doe",
    "phone_number": "+639123456789",
    "email": "john@example.com"
  },
  "breakdown": {
    "items": [
      {
        "product_id": "uuid",
        "product_name": "Plastic Bags",
        "quantity": 3,
        "unit_price": 0.5,
        "total_price": 1.5
      }
    ],
    "baskets": [
      {
        "basket_number": 1,
        "weight_kg": 5.5,
        "services": {
          "wash": "basic",
          "wash_cycles": 2,
          "dry": "basic",
          "spin": true,
          "iron_weight_kg": 0,
          "fold": false,
          "additional_dry_time_minutes": 0,
          "plastic_bags": 2
        },
        "subtotal": 150.0
      }
    ],
    "fees": [
      {
        "type": "staff_service_fee",
        "amount": 40.0,
        "description": "Staff service fee"
      },
      {
        "type": "delivery_fee",
        "amount": 50.0,
        "description": "Delivery to customer"
      },
      {
        "type": "vat",
        "amount": 24.0,
        "description": "VAT (12%)"
      }
    ],
    "summary": {
      "subtotal_products": 1.5,
      "subtotal_services": 150.0,
      "staff_service_fee": 40.0,
      "delivery_fee": 50.0,
      "subtotal_before_vat": 241.5,
      "vat_amount": 24.0,
      "loyalty_discount": 0.0,
      "total": 265.5
    }
  },
  "handling": {
    "handling_type": "delivery",
    "pickup_address": null,
    "delivery_address": "123 Main St, Caloocan City",
    "delivery_lng": 120.995, // ⭐ COORDINATES
    "delivery_lat": 14.585, // ⭐ COORDINATES
    "delivery_fee_override": null,
    "special_instructions": "Leave at gate",
    "payment_method": "gcash",
    "amount_paid": 300.0,
    "gcash_reference": "gcash_ref_20260129_001"
  },
  "loyalty": {
    "discount_tier": null
  },
  "gcash_receipt_url": null
}
```

#### Expected Response (Success - 200 OK)

```json
{
  "success": true,
  "order_id": "550e8400-e29b-41d4-a716-446655440000",
  "customer_id": "660e8400-e29b-41d4-a716-446655440001",
  "message": "Order created successfully",
  "order": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "customer_id": "660e8400-e29b-41d4-a716-446655440001",
    "source": "mobile",
    "status": "pending",
    "total_amount": 265.5,
    "created_at": "2026-01-29T10:30:00Z"
  }
}
```

#### Expected Response (Error - 400/500)

```json
{
  "success": false,
  "error": "Customer data required for mobile orders"
}
```

---

## ✅ Implementation Checklist

### Phase 1: Setup & Dependencies

- [ ] Add Google Maps Flutter package to `pubspec.yaml`
- [ ] Configure Google Maps API key in `android/app/build.gradle` and `ios/Runner/Info.plist`
- [ ] Test Google Maps loads in test widget

### Phase 2: Location Picker Widget

- [ ] Create `LocationPickerWidget` component
- [ ] Test map displays and allows tapping
- [ ] Test marker appears at center and updates when map moves
- [ ] Add distance calculation endpoint call
- [ ] Display distance and duration from API response

### Phase 3: Booking Flow Integration

- [ ] Add handling type selection (Pickup vs Delivery)
- [ ] Show location picker when "Delivery" selected
- [ ] Save selected location to state/provider
- [ ] Display location confirmation with coordinates
- [ ] Calculate delivery fee based on distance

### Phase 4: API Integration

- [ ] Load services from `GET /api/pos/services`
- [ ] Load products from `GET /api/pos/products`
- [ ] Search customers with `GET /api/pos/customers/search`
- [ ] Build complete order payload with handling coordinates
- [ ] Send order to `POST /api/orders/mobile/create`
- [ ] Handle error responses gracefully

### Phase 5: Testing

- [ ] Test delivery location picker
- [ ] Test distance calculation accuracy
- [ ] Test order creation with coordinates
- [ ] Verify coordinates stored in database handling JSONB
- [ ] Test pickup orders (no location picker needed)
- [ ] Test GCash payment flow

### Phase 6: QA & Deployment

- [ ] Code review with team
- [ ] Integration testing with backend
- [ ] User acceptance testing
- [ ] Deploy to test environment
- [ ] Final production deployment

---

## 🔗 Database Structure (Backend - FYI)

Orders are stored with location data in `handling` JSONB:

```sql
CREATE TABLE orders (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL,
  source TEXT,        -- 'pos' or 'mobile'
  status TEXT,
  breakdown JSONB,    -- Items, baskets, fees, summary
  handling JSONB,     -- ⭐ Includes delivery_lng, delivery_lat
  total_amount DECIMAL,
  created_at TIMESTAMP DEFAULT NOW(),
  -- ... other fields
);
```

**Sample handling JSONB**:

```json
{
  "handling_type": "delivery",
  "pickup_address": null,
  "delivery_address": "123 Main St, Caloocan City",
  "delivery_lng": 120.995,
  "delivery_lat": 14.585,
  "delivery_fee_override": null,
  "special_instructions": "Leave at gate",
  "payment_method": "gcash",
  "amount_paid": 300.0,
  "gcash_reference": "gcash_ref_20260129_001",
  "status": "pending",
  "started_at": null,
  "completed_at": null
}
```

---

## 🆘 Troubleshooting

| Issue                      | Solution                                                                        |
| -------------------------- | ------------------------------------------------------------------------------- |
| Google Maps API key error  | Ensure API key is set in `android/app/build.gradle` and `ios/Runner/Info.plist` |
| Map doesn't load           | Check that Google Maps API is enabled in Google Cloud Console                   |
| Distance calculation fails | Verify coordinates are valid and `/api/maps/distance` endpoint is reachable     |
| Order creation fails       | Check all required fields in handling JSONB are present                         |
| Coordinates not saved      | Verify `delivery_lng` and `delivery_lat` are being sent in payload              |

---

## 📞 Support

For questions or issues:

1. Check this guide's implementation checklist
2. Review `MOBILE_MAPS_INTEGRATION_HANDOFF.md` for additional context
3. Check API response errors in network logs
4. Verify coordinates format (lat/lng as numbers, not strings)

---

**Created**: January 29, 2026  
**Last Updated**: January 29, 2026  
**Status**: Ready for Implementation
