import { NextRequest, NextResponse } from "next/server";

interface DistanceRequest {
  delivery: {
    lat: number;
    lng: number;
  };
  store?: {
    lat: number;
    lng: number;
  };
}

const DEFAULT_STORE_LAT = parseFloat(process.env.NEXT_PUBLIC_KATFLIX_LATITUDE || "14.7548665");
const DEFAULT_STORE_LNG = parseFloat(process.env.NEXT_PUBLIC_KATFLIX_LONGITUDE || "121.0258515");

export async function POST(request: NextRequest) {
  try {
    const body: DistanceRequest = await request.json();

    if (!body.delivery || !body.delivery.lat || !body.delivery.lng) {
      return NextResponse.json(
        { error: "Missing delivery coordinates" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Google Maps API key not configured" },
        { status: 500 }
      );
    }

    // Use provided store location or defaults
    const storeLat = body.store?.lat || DEFAULT_STORE_LAT;
    const storeLng = body.store?.lng || DEFAULT_STORE_LNG;

    // Call Google Directions API
    const origin = `${storeLat},${storeLng}`;
    const destination = `${body.delivery.lat},${body.delivery.lng}`;

    const directionsUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=${origin}&destination=${destination}&key=${apiKey}`;

    const response = await fetch(directionsUrl);
    if (!response.ok) {
      throw new Error("Failed to fetch directions from Google");
    }

    const data = await response.json();

    if (data.status !== "OK") {
      return NextResponse.json(
        {
          error: `Directions API error: ${data.status}`,
          distance: null,
        },
        { status: 400 }
      );
    }

    // Extract distance from first route
    const route = data.routes[0];
    if (!route) {
      return NextResponse.json(
        { error: "No routes found", distance: null },
        { status: 400 }
      );
    }

    const leg = route.legs[0];
    const distance = leg.distance.value; // in meters
    const duration = leg.duration.value; // in seconds

    return NextResponse.json({
      success: true,
      distance, // meters
      duration, // seconds
      distanceKm: (distance / 1000).toFixed(2),
      durationMinutes: Math.round(duration / 60),
      polyline: route.overview_polyline.points,
    });
  } catch (error) {
    console.error("Distance calculation error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Internal server error",
      },
      { status: 500 }
    );
  }
}
