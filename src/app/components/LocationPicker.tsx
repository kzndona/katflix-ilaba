"use client";

import { useEffect, useRef, useState } from "react";

export interface LocationCoords {
  lat: number;
  lng: number;
  address?: string;
}

interface LocationPickerProps {
  onSelect: (coords: LocationCoords) => void;
  onClose: () => void;
  title?: string;
  defaultLocation?: LocationCoords;
  storeLocation?: LocationCoords;
}

declare global {
  interface Window {
    google: any;
  }
}

export function LocationPicker({
  onSelect,
  onClose,
  title = "Pin Delivery Location",
  defaultLocation,
  storeLocation: propStoreLocation,
}: LocationPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const polylineRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | undefined>(undefined);
  
  const [selectedLocation, setSelectedLocation] = useState<LocationCoords | null>(defaultLocation || null);
  const [distance, setDistance] = useState<number | null>(null);
  const [duration, setDuration] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  const storeLocation = propStoreLocation || {
    lat: parseFloat(process.env.NEXT_PUBLIC_KATFLIX_LATITUDE || "14.5994"),
    lng: parseFloat(process.env.NEXT_PUBLIC_KATFLIX_LONGITUDE || "120.9842"),
  };

  // Helper function to check if location is at store (within 100m)
  const isAtStore = (coords: LocationCoords) => {
    const R = 6371; // Earth radius in km
    const dLat = (coords.lat - storeLocation.lat) * (Math.PI / 180);
    const dLng = (coords.lng - storeLocation.lng) * (Math.PI / 180);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(storeLocation.lat * (Math.PI / 180)) *
        Math.cos(coords.lat * (Math.PI / 180)) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c * 1000; // in meters
    return distance < 100; // Within 100 meters
  };

  // Load Google Maps script as fallback if not already loaded globally
  useEffect(() => {
    const loadGoogleMapsScript = () => {
      if (window.google && window.google.maps) {
        console.log("Google Maps already loaded globally");
        setScriptLoaded(true);
        return;
      }

      // Check if script already exists
      if (document.querySelector('script[src*="maps.googleapis.com"]')) {
        console.log("Google Maps script already in DOM");
        // Wait for it to load
        const checkAPI = () => {
          if (window.google && window.google.maps) {
            setScriptLoaded(true);
          } else {
            setTimeout(checkAPI, 100);
          }
        };
        checkAPI();
        return;
      }

      // Load the script
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error("Google Maps API key not found in environment variables");
        setError("Google Maps API key is not configured");
        setLoading(false);
        return;
      }

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
      script.async = true;
      script.defer = true;

      script.onload = () => {
        console.log("Google Maps script loaded successfully");
        setScriptLoaded(true);
      };

      script.onerror = () => {
        console.error("Failed to load Google Maps script");
        setError("Failed to load Google Maps");
        setLoading(false);
      };

      document.head.appendChild(script);
    };

    loadGoogleMapsScript();
  }, []);

  // Initialize Google Maps
  useEffect(() => {
    if (!scriptLoaded) {
      console.log("Waiting for Google Maps script to load...");
      return;
    }

    console.log("Script loaded, initializing map...");

    const initializeMap = () => {
      if (!mapRef.current) {
        console.error("Map container ref is not available");
        return;
      }

      if (!window.google || !window.google.maps) {
        console.error("Google Maps API is not loaded");
        setError("Google Maps API failed to load");
        setLoading(false);
        return;
      }

      try {
        // Start at store location
        const mapCenter = storeLocation;

        const map = new window.google.maps.Map(mapRef.current, {
          zoom: 15,
          center: mapCenter,
          mapTypeControl: true,
          fullscreenControl: true,
          streetViewControl: false,
        });

        mapInstanceRef.current = map;

        // Setup Places Autocomplete
        if (searchInputRef.current) {
          // Caloocan bounds (approximate)
          const caloocanBounds = new window.google.maps.LatLngBounds(
            new window.google.maps.LatLng(14.5800, 120.8900), // SW corner
            new window.google.maps.LatLng(14.7600, 121.0800)   // NE corner
          );

          const autocomplete = new window.google.maps.places.Autocomplete(
            searchInputRef.current,
            {
              fields: ["geometry", "formatted_address", "name"],
              bounds: caloocanBounds,
              strictBounds: false, // Allow results outside but prefer within bounds
              componentRestrictions: { country: "ph" }, // Philippines only
            }
          );

          autocompleteRef.current = autocomplete;
          autocomplete.setBounds(caloocanBounds);

          // Handle place selection
          autocomplete.addListener("place_changed", () => {
            const place = autocomplete.getPlace();
            if (!place.geometry || !place.geometry.location) {
              console.error("No geometry found for selected place");
              return;
            }

            const coords = {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
              address: place.formatted_address,
            };

            console.log("Selected location from search:", coords);
            setSelectedLocation(coords);
            map.panTo(coords);
            map.setZoom(15);
          });

          // Real-time search on input change
          searchInputRef.current.addEventListener("input", () => {
            // Clear previous search timer
            if (debounceTimerRef.current) {
              clearTimeout(debounceTimerRef.current);
            }

            // Debounce: wait 500ms after user stops typing
            debounceTimerRef.current = setTimeout(() => {
              const inputValue = searchInputRef.current?.value.trim();
              if (!inputValue || inputValue.length < 3) return;

              // Use Places Service for real-time search
              const service = new window.google.maps.places.PlacesService(map);
              const request = {
                query: inputValue,
                locationBias: caloocanBounds,
                fields: ["geometry", "formatted_address", "name", "place_id"],
              };

              service.textSearch(request, (results: any, status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && results && results.length > 0) {
                  const firstResult = results[0];
                  if (firstResult.geometry && firstResult.geometry.location) {
                    const coords = {
                      lat: firstResult.geometry.location.lat(),
                      lng: firstResult.geometry.location.lng(),
                      address: firstResult.formatted_address,
                    };

                    console.log("Auto-search found location:", coords);
                    setSelectedLocation(coords);
                    map.panTo(coords);
                    map.setZoom(15);
                  }
                }
              });
            }, 500);
          });
        }

        // Listen to idle event to calculate distance after 3 seconds
        map.addListener("idle", () => {
          console.log("Map idle, scheduling distance calculation...");
          
          // Clear previous timer
          if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
          }

          // Wait 3 seconds then calculate
          debounceTimerRef.current = setTimeout(() => {
            const center = map.getCenter();
            const coords = {
              lat: center.lat(),
              lng: center.lng(),
            };
            console.log("Calculating distance for:", coords);
            setSelectedLocation(coords);
            
            // Don't calculate distance if at store
            if (isAtStore(coords)) {
              console.log("Location is at store, skipping distance calculation");
              setDistance(null);
              setDuration(null);
              if (polylineRef.current) {
                polylineRef.current.setMap(null);
              }
            } else {
              calculateDistanceAndRoute(coords, map);
            }
          }, 3000);
        });

        // Initial distance calculation only if not at store
        if (!isAtStore(storeLocation)) {
          calculateDistanceAndRoute(storeLocation, map);
        } else {
          setDistance(null);
          setDuration(null);
        }

        setLoading(false);
        setError(null);
        console.log("Google Maps initialized successfully");
      } catch (err) {
        console.error("Failed to initialize Google Maps:", err);
        setError("Failed to initialize map");
        setLoading(false);
      }
    };

    initializeMap();

    // Cleanup
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current = null;
      }
    };
  }, [scriptLoaded]);

  const calculateDistanceAndRoute = async (coords: LocationCoords, map: any) => {
    try {
      const res = await fetch("/api/maps/distance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery: coords,
          store: storeLocation,
        }),
      });

      if (!res.ok) throw new Error("Failed to calculate distance");

      const data = await res.json();
      setDistance(data.distance);
      setDuration(data.duration);
      console.log("Distance calculated:", data);

      // Draw polyline on map
      if (data.polyline) {
        drawRoute(data.polyline, map);
      }
    } catch (err) {
      console.error("Distance calculation error:", err);
    }
  };

  const drawRoute = (polylineEncoded: string, map: any) => {
    // Remove existing polyline
    if (polylineRef.current) {
      polylineRef.current.setMap(null);
    }

    try {
      // Decode polyline
      const polylinePath = window.google.maps.geometry.encoding.decodePath(polylineEncoded);

      // Draw new polyline
      const polyline = new window.google.maps.Polyline({
        path: polylinePath,
        geodesic: true,
        strokeColor: "#4F46E5",
        strokeOpacity: 0.8,
        strokeWeight: 3,
        map: map,
      });

      polylineRef.current = polyline;

      // Adjust map bounds to show entire route
      const bounds = new window.google.maps.LatLngBounds();
      polylinePath.forEach((point: any) => bounds.extend(point));
      // map.fitBounds(bounds); // Optional: uncomment to auto-fit

      console.log("Route polyline drawn");
    } catch (err) {
      console.error("Failed to draw route:", err);
    }
  };

  const handleConfirm = () => {
    if (!selectedLocation) {
      setError("Please select a location on the map");
      return;
    }
    onSelect(selectedLocation);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div
        className="bg-white shadow-2xl rounded-lg w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 py-2.5 border-b border-gray-200 bg-blue-50 flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-base font-bold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Drag the map or search for a location
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl font-bold transition"
          >
            ✕
          </button>
        </div>

        {/* Search Bar */}
        <div className="px-4 py-2 border-b border-gray-200 bg-white shrink-0">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search for a location..."
            className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Map Container */}
        <div className="flex-1 relative overflow-hidden min-h-0">
          {loading && (
            <div className="absolute inset-0 bg-gray-100 flex items-center justify-center z-10">
              <div className="text-gray-600">Loading map...</div>
            </div>
          )}
          <div 
            ref={mapRef} 
            className="w-full h-full" 
            style={{ minHeight: '400px' }}
          />
          {/* Fixed Pin at Map Center */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex flex-col items-center">
              {/* Pin Icon */}
              <div className="text-red-500 text-4xl drop-shadow-lg">📍</div>
              {/* Crosshair */}
              <div className="absolute w-0 h-0 border-2 border-red-400 rounded-full opacity-40" 
                   style={{ width: '60px', height: '60px' }} />
            </div>
          </div>
        </div>

        {/* Info Bar */}
        <div className="px-4 py-2 border-t border-gray-200 bg-gray-50">
          {error && (
            <div className="text-red-600 text-xs font-medium mb-1">{error}</div>
          )}
          {selectedLocation && distance !== null && duration !== null && (
            <div className="space-y-2 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-600 text-xs">Latitude:</span>
                  <p className="font-mono font-medium text-gray-900">
                    {selectedLocation.lat.toFixed(6)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-600 text-xs">Longitude:</span>
                  <p className="font-mono font-medium text-gray-900">
                    {selectedLocation.lng.toFixed(6)}
                  </p>
                </div>
              </div>
              <div className="bg-blue-50 rounded p-2 border border-blue-200 mt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-600 text-xs">Distance:</span>
                      <p className="font-bold text-green-700 text-base">
                        {(distance / 1000).toFixed(2)} km
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 text-xs">Time:</span>
                      <p className="font-bold text-blue-700 text-base">
                        {Math.round(duration / 60)} min
                      </p>
                    </div>
                  </div>
                </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-200 flex justify-end gap-2 shrink-0">
          <button
            onClick={onClose}
            className="px-3 py-1.5 border border-gray-300 rounded text-gray-900 text-sm font-medium hover:bg-gray-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selectedLocation}
            className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Confirm Location
          </button>
        </div>
      </div>
    </div>
  );
}
