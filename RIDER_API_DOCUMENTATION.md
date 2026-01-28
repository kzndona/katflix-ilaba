# 🚚 Rider Delivery API Documentation

**Base URL:** `http://localhost:3000/api` (or production URL)

---

## 1. Get All Deliveries

**Endpoint:** `GET /deliveries/list`

**Query Parameters (Optional):**
- `status` - Filter by status: `pending` or `processing`

**Response:**
```json
{
  "success": true,
  "count": 5,
  "deliveries": [
    {
      "id": "uuid",
      "customer_id": "uuid",
      "customer_name": "Juan Dela Cruz",
      "customer_phone": "+63917123456",
      "address": "123 Maginhawa St, Caloocan",
      "lat": 14.5948,
      "lng": 120.9892,
      "items_count": 3,
      "total_amount": 1250.50,
      "status": "pending",
      "created_at": "2026-01-29T10:30:00Z",
      "handling_type": "delivery"
    }
  ]
}
```

**Usage (Mobile App):**
```dart
// Dart example
final response = await http.get(
  Uri.parse('http://localhost:3000/api/deliveries/list?status=pending'),
);
final data = jsonDecode(response.body);
List<Delivery> deliveries = data['deliveries'];
```

---

## 2. Get Delivery Details

**Endpoint:** `GET /orders/delivery-details/:orderId`

**Path Parameters:**
- `orderId` - UUID of the order

**Response:**
```json
{
  "success": true,
  "order": {
    "id": "uuid",
    "customer_id": "uuid",
    "customer_name": "Juan Dela Cruz",
    "customer_phone": "+63917123456",
    "customer_email": "juan@example.com",
    "address": "123 Maginhawa St, Caloocan",
    "lat": 14.5948,
    "lng": 120.9892,
    "handling_type": "delivery",
    "payment_method": "cash",
    "special_instructions": "Ring doorbell twice",
    "total_amount": 1250.50,
    "status": "pending",
    "created_at": "2026-01-29T10:30:00Z",
    "updated_at": "2026-01-29T10:30:00Z",
    "baskets": [
      {
        "number": 1,
        "total": 600.00,
        "items": [
          {
            "product_id": "uuid",
            "name": "Shirts (5 pcs)",
            "quantity": 5,
            "unit_price": 120
          }
        ],
        "services_progress": [
          {
            "id": "uuid",
            "service_type": "wash",
            "status": "pending",
            "started_at": null,
            "completed_at": null,
            "started_by": null,
            "completed_by": null,
            "notes": null
          },
          {
            "id": "uuid",
            "service_type": "dry",
            "status": "pending",
            "started_at": null,
            "completed_at": null
          }
        ]
      },
      {
        "number": 2,
        "total": 650.50,
        "items": [...]
      }
    ]
  }
}
```

**Error Response (404):**
```json
{
  "error": "Order not found"
}
```

**Usage (Mobile App):**
```dart
final response = await http.get(
  Uri.parse('http://localhost:3000/api/orders/delivery-details/$orderId'),
);
final data = jsonDecode(response.body);
DeliveryOrder order = data['order'];

// Access basket services
for (var basket in order.baskets) {
  print('Basket ${basket.number} services:');
  for (var service in basket.services_progress) {
    print('  - ${service.serviceType}: ${service.status}');
  }
}
```

---

## 3. Update Order Status

**Endpoint:** `PATCH /orders/update-status/:orderId`

**Path Parameters:**
- `orderId` - UUID of the order

**Request Body:**
```json
{
  "status": "completed"
}
```

**Valid Status Values:**
- `pending` - Order created, waiting to start
- `processing` - Rider picked up order
- `completed` - Delivery completed
- `cancelled` - Order cancelled

**Response (Success):**
```json
{
  "success": true,
  "message": "Order status updated to completed",
  "order": {
    "id": "uuid",
    "status": "completed",
    "updated_at": "2026-01-29T14:45:30Z"
  }
}
```

**Error Response (400):**
```json
{
  "error": "Invalid status. Must be one of: pending, processing, completed, cancelled"
}
```

**Error Response (404):**
```json
{
  "error": "Order not found"
}
```

**Usage (Mobile App):**
```dart
// Mark order as picked up
final response = await http.patch(
  Uri.parse('http://localhost:3000/api/orders/update-status/$orderId'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'status': 'processing'}),
);

// Mark order as delivered
final response = await http.patch(
  Uri.parse('http://localhost:3000/api/orders/update-status/$orderId'),
  headers: {'Content-Type': 'application/json'},
  body: jsonEncode({'status': 'completed'}),
);
```

---

## 📱 Typical Mobile Workflow

1. **App Opens:**
   - Call `GET /deliveries/list` → Shows map with all deliveries

2. **Rider Taps Delivery Pin:**
   - Call `GET /orders/delivery-details/:orderId` → Shows full details & services

3. **Rider Picks Up Order:**
   - Call `PATCH /orders/update-status/:orderId` with `status: "processing"`

4. **Rider Delivers & Takes Photo:**
   - Call `PATCH /orders/update-status/:orderId` with `status: "completed"`

---

## 🗺️ Map Integration

The API returns `lat` and `lng` for each delivery. Use Google Maps or your preferred map SDK to:
- Display pins for all deliveries
- Draw route from rider → delivery location
- Show distance and ETA

**Example (Flutter):**
```dart
// Fetch deliveries
final deliveries = await getDeliveries();

// Add markers
for (var delivery in deliveries) {
  Marker(
    position: LatLng(delivery.lat, delivery.lng),
    infoWindow: InfoWindow(title: delivery.customer_name),
  );
}

// Route calculation (optional - app can use Google Maps API directly)
// Or use the stored lat/lng to calculate in the app
```

---

## ⚠️ Error Handling

All endpoints return standard HTTP status codes:
- `200` - Success
- `400` - Bad request (invalid parameters)
- `404` - Not found
- `500` - Server error

Always check `response.statusCode` before processing the response.

---

## 🔄 Real-time Updates (Future)

Current implementation:
- Pull model: App polls `/deliveries/list` every 30 seconds

Future enhancement:
- Push model: WebSocket for real-time order updates
- GPS tracking: `POST /deliveries/location` for rider location

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- Amounts are in PHP (₱)
- No authentication required for MVP (add JWT later)
- Coordinates are in WGS84 decimal format (lat/lng)
