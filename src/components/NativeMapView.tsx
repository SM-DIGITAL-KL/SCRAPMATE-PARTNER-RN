import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, PermissionsAndroid, Alert, UIManager } from 'react-native';
import { requireNativeComponent, NativeModules, findNodeHandle } from 'react-native';
import { WebView } from 'react-native-webview';

const { NativeMapViewModule } = NativeModules;

// Export function to get address from coordinates (FREE - uses OpenStreetMap Nominatim API)
export const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<{
  formattedAddress?: string;
  address?: string;
  houseNumber?: string;
  road?: string;
  neighborhood?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
}> => {
  // Try native module first (Android)
  if (Platform.OS === 'android' && NativeMapViewModule) {
    try {
      const address = await NativeMapViewModule.getAddressFromCoordinates(latitude, longitude);
      return address;
    } catch (error) {
      // Network errors are expected and handled by callers - don't log as error
      // Only log if it's not a network timeout/connection error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('failed to connect') && !errorMessage.includes('timeout')) {
        console.warn('Address lookup error:', error);
      }
      throw error;
    }
  }
  
  // For iOS, use Nominatim API directly
  if (Platform.OS === 'ios') {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'ScrapmatePartner/1.0',
          },
        }
      );
      
      if (!response.ok) {
        throw new Error(`Nominatim API error: ${response.status}`);
      }
      
      const data = await response.json();
      const address = data.address || {};
      
      return {
        formattedAddress: data.display_name,
        address: data.display_name,
        houseNumber: address.house_number,
        road: address.road,
        neighborhood: address.neighbourhood || address.suburb,
        suburb: address.suburb,
        city: address.city || address.town || address.village,
        state: address.state,
        postcode: address.postcode,
        country: address.country,
        countryCode: address.country_code?.toUpperCase(),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('failed to connect') && !errorMessage.includes('timeout')) {
        console.warn('Address lookup error (iOS):', error);
      }
      throw error;
    }
  }
  
  throw new Error('Address lookup not available on this platform');
};

// Convenience function to get current location with address
export const getCurrentLocationWithAddress = async (): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: {
    formattedAddress?: string;
    address?: string;
    houseNumber?: string;
    road?: string;
    neighborhood?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
}> => {
  // Try native module first (Android)
  if (Platform.OS === 'android' && NativeMapViewModule) {
    try {
      // Get current location
      const location = await NativeMapViewModule.getCurrentLocation();
      
      // Get address from coordinates
      try {
        const address = await NativeMapViewModule.getAddressFromCoordinates(
          location.latitude,
          location.longitude
        );
        return {
          ...location,
          address,
        };
      } catch (addressError) {
        // If address lookup fails, still return location
        console.warn('Address lookup failed:', addressError);
        return location;
      }
    } catch (error) {
      console.error('Error getting location with address:', error);
      throw error;
    }
  }
  
  // For iOS, use Geolocation API
  if (Platform.OS === 'ios') {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy || 0,
            timestamp: position.timestamp,
          };
          
          // Get address from coordinates
          try {
            const address = await getAddressFromCoordinates(
              location.latitude,
              location.longitude
            );
            resolve({
              ...location,
              address,
            });
          } catch (addressError) {
            // If address lookup fails, still return location
            console.warn('Address lookup failed:', addressError);
            resolve(location);
          }
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 10000,
        }
      );
    });
  }
  
  throw new Error('Location lookup not available on this platform');
};

interface NativeMapViewProps {
  style?: any;
  onLocationUpdate?: (event: { nativeEvent: { latitude: number; longitude: number; accuracy: number; timestamp: number } }) => void;
  onMapReady?: () => void;
}

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

const NativeMapViewComponent = Platform.OS === 'android' 
  ? requireNativeComponent<NativeMapViewProps>('NativeMapView', {
  nativeOnly: {
    // Event handlers are handled automatically by React Native bridge
  }
    })
  : null;

// Generate HTML for iOS Leaflet map
const getIOSMapHTML = (): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src * 'unsafe-inline'; img-src * data: blob: 'unsafe-inline'; frame-src *; style-src * 'unsafe-inline';">
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin=""/>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
        <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html, body { 
                width: 100%; 
                height: 100%; 
                overflow: hidden; 
                background-color: #f0f0f0;
            }
            #map { 
                width: 100vw; 
                height: 100vh; 
            }
        </style>
    </head>
    <body>
        <div id="map"></div>
        <script>
            (function() {
                var map = null;
                var marker = null;
                var routeLayer = null;
                
                function initMap() {
                    try {
                        if (typeof L === 'undefined') {
                            console.error('Leaflet not loaded');
                            return;
                        }
                        
                        map = L.map('map', {
                            zoomControl: true,
                            scrollWheelZoom: false,
                            doubleClickZoom: false,
                            boxZoom: false,
                            keyboard: false,
                            dragging: true,
                            touchZoom: true
                        });
                        
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap contributors',
                            maxZoom: 19
                        }).addTo(map);
                        
                        map.setView([20.5937, 78.9629], 13);
                        
                        // Fix for "Incomplete map until resize" issue
                        setTimeout(function() {
                            if (map) {
                                map.invalidateSize(true);
                                if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
                                }
                            }
                        }, 100);
                        
                        window.map = map;
                        window.marker = marker;
                        window.updateLocation = function(lat, lng) {
                            if (map && lat && lng) {
                                if (!marker) {
                                    var icon = L.divIcon({
                                        className: 'current-location-marker',
                                        html: '<div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #2196F3; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"><svg style="width: 18px; height: 18px; fill: white;" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg></div>',
                                        iconSize: [32, 32],
                                        iconAnchor: [16, 16]
                                    });
                                    marker = L.marker([lat, lng], { icon: icon }).addTo(map);
                                } else {
                                    marker.setLatLng([lat, lng]);
                                }
                                map.setView([lat, lng], map.getZoom());
                                // Notify React Native of location update
                                if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                        type: 'locationUpdate',
                                        latitude: lat,
                                        longitude: lng,
                                        accuracy: 0,
                                        timestamp: Date.now()
                                    }));
                                }
                            }
                        };
                        
                        // Watch location using browser geolocation API
                        if (navigator.geolocation) {
                            navigator.geolocation.watchPosition(
                                function(position) {
                                    if (window.updateLocation) {
                                        window.updateLocation(position.coords.latitude, position.coords.longitude);
                                    }
                                },
                                function(error) {
                                    console.error('Geolocation error:', error);
                                },
                                {
                                    enableHighAccuracy: true,
                                    timeout: 15000,
                                    maximumAge: 10000
                                }
                            );
                        }
                        window.drawRoute = function(fromLat, fromLng, toLat, toLng, profile) {
                            if (!map || !fromLat || !fromLng || !toLat || !toLng) return;
                            
                            if (routeLayer) {
                                map.removeLayer(routeLayer);
                            }
                            
                            var osrmUrl = 'https://router.project-osrm.org/route/v1/' + profile + '/' + 
                                          fromLng + ',' + fromLat + ';' + toLng + ',' + toLat + 
                                          '?overview=full&geometries=geojson';
                            
                            fetch(osrmUrl)
                                .then(function(response) { return response.json(); })
                                .then(function(data) {
                                    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                                        var coordinates = data.routes[0].geometry.coordinates;
                                        var latLngs = coordinates.map(function(coord) {
                                            return [coord[1], coord[0]];
                                        });
                                        
                                        routeLayer = L.polyline(latLngs, {
                                            color: '#2196F3',
                                            weight: 4,
                                            opacity: 0.7
                                        }).addTo(map);
                                        
                                        var bounds = L.latLngBounds(latLngs);
                                        map.fitBounds(bounds, { padding: [50, 50] });
                                    }
                                })
                                .catch(function(error) {
                                    console.error('Route error:', error);
                                });
                        };
                    } catch (e) {
                        console.error('Map initialization error:', e);
                    }
                }
                
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', initMap);
                } else {
                    initMap();
                }
            })();
        </script>
    </body>
    </html>
  `;
};

export const NativeMapView: React.FC<{
  style?: any;
  onLocationUpdate?: (location: LocationData) => void;
  onMapReady?: () => void;
  destination?: { latitude: number; longitude: number };
  routeProfile?: 'driving' | 'cycling' | 'walking';
  disableLocationTracking?: boolean; // If true, don't request location permission or track location
}> = ({ 
  style, 
  onLocationUpdate, 
  onMapReady,
  destination,
  routeProfile = 'driving',
  disableLocationTracking = false
}) => {
  const mapRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Cleanup function to clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    try {
      const timeouts = [...timeoutRefs.current]; // Create a copy to avoid modification during iteration
      timeouts.forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      timeoutRefs.current = [];
    } catch (e) {
      console.warn('Error in clearAllTimeouts:', e);
      timeoutRefs.current = [];
    }
  }, []);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        if (!isMountedRef.current) return;

        if (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED
        ) {
          if (isMountedRef.current) {
            setHasPermission(true);
          }
          if (NativeMapViewModule && isMountedRef.current) {
            await NativeMapViewModule.requestLocationPermission();
          }
        } else {
          if (isMountedRef.current) {
            Alert.alert(
              'Location Permission',
              'Location permission is required to show your current location on the map.'
            );
          }
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      // iOS - permission is handled by the WebView's geolocation API
      // The WebView will request permission when geolocation is accessed
      if (isMountedRef.current) {
        setHasPermission(true); // Assume permission will be requested by WebView
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    // Only request location permission if location tracking is not disabled
    if (!disableLocationTracking) {
      requestLocationPermission();
    } else {
      // If location tracking is disabled, just set hasPermission to false
      // This prevents any location-related operations
      setHasPermission(false);
    }
    
    // Cleanup on unmount
    return () => {
      isMountedRef.current = false;
      // Clear all timeouts
      try {
        clearAllTimeouts();
      } catch (e) {
        console.warn('Error clearing timeouts:', e);
      }
      // Don't clear mapRef here as it might be needed during unmount
      // It will be cleared naturally when component unmounts
    };
  }, [requestLocationPermission, clearAllTimeouts, disableLocationTracking]);

  // Fetch location once when permission is granted (only if location tracking is enabled)
  useEffect(() => {
    if (!disableLocationTracking && hasPermission && Platform.OS === 'android' && isMountedRef.current) {
      // Small delay to ensure map is ready
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && mapRef.current) {
          fetchLocationOnce();
        }
      }, 1000);
      if (timeoutId) {
        timeoutRefs.current.push(timeoutId);
      }
      
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutRefs.current = timeoutRefs.current.filter(t => t !== timeoutId);
        }
      };
    }
  }, [hasPermission, disableLocationTracking]);

  // Fetch location once (no continuous polling)
  const fetchLocationOnce = async () => {
    if (!isMountedRef.current || !mapRef.current) {
      return;
    }
    
    if (Platform.OS === 'android' && NativeMapViewModule) {
      try {
        const location = await NativeMapViewModule.getCurrentLocation();
        
        if (!isMountedRef.current || !mapRef.current) {
          return;
        }
        
        if (location) {
          setCurrentLocation(location);
          onLocationUpdate?.(location);
          
          // Update map location immediately when fetched
          if (Platform.OS === 'android' && mapRef.current && isMountedRef.current) {
            try {
              const nodeHandle = findNodeHandle(mapRef.current);
              if (nodeHandle) {
                try {
                  const commandId = 1; // updateLocation command
                  console.log('📍 Dispatching updateLocation command:', location.latitude, location.longitude);
                  UIManager.dispatchViewManagerCommand(
                    nodeHandle,
                    commandId,
                    [location.latitude, location.longitude]
                  );
                  console.log('✅ updateLocation command dispatched successfully');
                } catch (error) {
                  console.error('❌ Error updating map location:', error);
                }
              } else {
                console.warn('⚠️ Could not find node handle for map');
              }
            } catch (error) {
              console.error('❌ Error finding map node handle:', error);
            }
          }
        } else {
          console.warn('⚠️ No location received from native module');
        }
      } catch (error) {
        console.log('Error fetching location:', error);
      }
    }
  };

  // Throttle location updates to prevent excessive calls
  const lastLocationUpdateTimeRef = useRef<number>(0);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const LOCATION_UPDATE_THROTTLE_MS = 10000; // 10 seconds minimum between updates
  const MIN_LOCATION_CHANGE_METERS = 20; // Only update if moved 20+ meters

  const handleLocationUpdate = (event: any) => {
    // Don't handle location updates if location tracking is disabled
    if (disableLocationTracking) {
      return;
    }
    
    // Check if component is still mounted
    if (!mapRef.current) {
      return;
    }
    
    const location = event.nativeEvent;
    const now = Date.now();
    const lastUpdate = lastLocationUpdateTimeRef.current;
    const lastLoc = lastLocationRef.current;
    
    // Calculate distance if we have a previous location
    let distanceChanged = true;
    if (lastLoc) {
      const R = 6371e3; // Earth radius in meters
      const φ1 = lastLoc.latitude * Math.PI / 180;
      const φ2 = location.latitude * Math.PI / 180;
      const Δφ = (location.latitude - lastLoc.latitude) * Math.PI / 180;
      const Δλ = (location.longitude - lastLoc.longitude) * Math.PI / 180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      distanceChanged = distance >= MIN_LOCATION_CHANGE_METERS;
    }
    
    // Only update if enough time has passed AND location changed significantly AND component is still mounted
    if ((now - lastUpdate >= LOCATION_UPDATE_THROTTLE_MS) && distanceChanged && mapRef.current) {
      setCurrentLocation(location);
      onLocationUpdate?.(location);
      lastLocationUpdateTimeRef.current = now;
      lastLocationRef.current = { latitude: location.latitude, longitude: location.longitude };
      
      // Update map for Android - double check mapRef is still valid
      if (Platform.OS === 'android' && mapRef.current && isMountedRef.current) {
        try {
          const nodeHandle = findNodeHandle(mapRef.current);
          if (nodeHandle) {
            try {
              console.log('📍 handleLocationUpdate: Dispatching updateLocation command:', location.latitude, location.longitude);
              UIManager.dispatchViewManagerCommand(
                nodeHandle,
                1, // updateLocation command
                [location.latitude, location.longitude]
              );
              console.log('✅ handleLocationUpdate: Command dispatched successfully');
            } catch (error: any) {
              // Map might be unmounting or WebView crashed, ignore error silently
              if (error?.message && !error.message.includes('ViewManager')) {
                console.error('❌ Error updating map location:', error.message);
              }
            }
          } else {
            console.warn('⚠️ handleLocationUpdate: Could not find node handle');
          }
        } catch (error: any) {
          // Map ref is invalid, component likely unmounted
          if (error?.message && !error.message.includes('ViewManager')) {
            console.error('❌ Map ref invalid:', error.message);
          }
        }
      }
    }
  };

  const handleMapReady = () => {
    if (!isMountedRef.current || !mapRef.current) {
      return;
    }
    
    console.log('🗺️ Map ready - handleMapReady called');
    onMapReady?.();
    
    // Only fetch location if location tracking is enabled
    if (!disableLocationTracking) {
      // Fetch location once when map is ready
      if (hasPermission && Platform.OS === 'android' && isMountedRef.current && mapRef.current) {
        console.log('📍 Map ready with permission - fetching location...');
        const timeoutId = setTimeout(() => {
          if (isMountedRef.current && mapRef.current) {
            fetchLocationOnce();
          }
        }, 500);
        if (timeoutId) {
          timeoutRefs.current.push(timeoutId);
        }
      } else if (currentLocation && isMountedRef.current && mapRef.current) {
        // If we already have location, center on it
        console.log('📍 Map ready with existing location - centering...');
        centerOnCurrentLocation();
      } else {
        console.log('⚠️ Map ready but no permission or location yet');
      }
    } else {
      console.log('📍 Map ready - location tracking disabled, showing destination only');
    }
  };

  const centerOnCurrentLocation = () => {
    if (!isMountedRef.current || !mapRef.current) {
      console.warn('⚠️ centerOnCurrentLocation: Component not mounted or map ref invalid');
      return;
    }
    
    if (!currentLocation) {
      console.warn('⚠️ centerOnCurrentLocation: No current location available');
      return;
    }
    
    try {
      const nodeHandle = findNodeHandle(mapRef.current);
      if (nodeHandle && isMountedRef.current) {
        if (Platform.OS === 'ios' && NativeMapViewModule) {
          NativeMapViewModule.centerOnCurrentLocation(nodeHandle);
        } else if (Platform.OS === 'android' && currentLocation && isMountedRef.current) {
          // For Android, use command to update location
          try {
            console.log('📍 centerOnCurrentLocation: Dispatching updateLocation command:', currentLocation.latitude, currentLocation.longitude);
            UIManager.dispatchViewManagerCommand(
              nodeHandle,
              1, // updateLocation command
              [currentLocation.latitude, currentLocation.longitude]
            );
            console.log('✅ centerOnCurrentLocation: Command dispatched successfully');
          } catch (error) {
            // Component may be unmounting, ignore error
            console.error('❌ Error centering map:', error);
          }
        }
      } else {
        console.warn('⚠️ centerOnCurrentLocation: Could not find node handle');
      }
    } catch (error) {
      // Component unmounted, ignore error
      console.error('❌ Error finding node handle:', error);
    }
  };

  // Draw route from current location to destination
  const drawRoute = (fromLat: number, fromLng: number, toLat: number, toLng: number, profile: string = 'driving', isUpdate: boolean = false) => {
    if (!isMountedRef.current || !mapRef.current || Platform.OS !== 'android') {
      return;
    }
    
    try {
      const nodeHandle = findNodeHandle(mapRef.current);
      if (nodeHandle && isMountedRef.current) {
        try {
          UIManager.dispatchViewManagerCommand(
            nodeHandle,
            2, // drawRoute command
            [fromLat, fromLng, toLat, toLng, profile, isUpdate]
          );
          if (!isUpdate && isMountedRef.current) {
            console.log(`🗺️ Requesting ${profile} route from [${fromLat}, ${fromLng}] to [${toLat}, ${toLng}]`);
          }
        } catch (error: any) {
          if (error?.message && !error.message.includes('ViewManager')) {
            console.warn('Error drawing route:', error.message);
          }
        }
      }
    } catch (error: any) {
      if (error?.message && !error.message.includes('ViewManager')) {
        console.warn('Error finding node handle for route:', error.message);
      }
    }
  };

  // Track last route draw location and time to throttle updates
  const lastRouteLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteDrawTimeRef = useRef<number>(0);
  const routeDrawnRef = useRef<boolean>(false);
  const ROUTE_UPDATE_THROTTLE_MS = 10000; // 10 seconds
  const MIN_DISTANCE_CHANGE_METERS = 30; // Only redraw if moved 30+ meters

  // Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // Draw route when destination and current location are available (throttled)
  // Skip route drawing if location tracking is disabled (e.g., for completed orders)
  useEffect(() => {
    // Don't draw route if location tracking is disabled
    if (disableLocationTracking) {
      console.log('📍 Route drawing disabled - location tracking is disabled');
      return;
    }
    
    if (destination && currentLocation && hasPermission && mapRef.current) {
      const now = Date.now();
      const lastLocation = lastRouteLocationRef.current;
      const shouldRedraw = 
        !routeDrawnRef.current || // First time drawing
        !lastLocation || // No previous location
        (now - lastRouteDrawTimeRef.current) >= ROUTE_UPDATE_THROTTLE_MS || // Throttle time passed
        calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          lastLocation.lat,
          lastLocation.lng
        ) >= MIN_DISTANCE_CHANGE_METERS; // Significant location change

      if (shouldRedraw && mapRef.current && isMountedRef.current) {
        // Small delay to ensure map is ready
        const timeoutId = setTimeout(() => {
          // Check again if component is still mounted before drawing route
          if (!isMountedRef.current || !mapRef.current) {
            return;
          }
          drawRoute(
            currentLocation.latitude,
            currentLocation.longitude,
            destination.latitude,
            destination.longitude,
            routeProfile,
            routeDrawnRef.current // Pass whether this is initial draw
          );
          if (isMountedRef.current) {
            lastRouteLocationRef.current = {
              lat: currentLocation.latitude,
              lng: currentLocation.longitude
            };
            lastRouteDrawTimeRef.current = now;
            routeDrawnRef.current = true;
            console.log(`🗺️ Drawing ${routeProfile} route from current location to destination`);
          }
        }, routeDrawnRef.current ? 500 : 1500); // Faster for updates, slower for initial
        if (timeoutId) {
          timeoutRefs.current.push(timeoutId);
        }
        
        // Cleanup timeout if component unmounts
        return () => {
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutRefs.current = timeoutRefs.current.filter(t => t !== timeoutId);
          }
        };
      }
    }
  }, [destination, currentLocation, hasPermission, routeProfile, disableLocationTracking]);

  // iOS: Use WebView with Leaflet
  if (Platform.OS === 'ios') {
    const webViewRef = useRef<WebView>(null);
    const [mapReady, setMapReady] = useState(false);
    const iosLocationWatchIdRef = useRef<number | null>(null);

    // Request location permission for iOS
    useEffect(() => {
      if (!disableLocationTracking) {
        requestLocationPermission();
      }
    }, [disableLocationTracking, requestLocationPermission]);

    // Handle location updates from WebView
    useEffect(() => {
      if (currentLocation && mapReady && webViewRef.current) {
        webViewRef.current.injectJavaScript(`
          if (window.updateLocation) {
            window.updateLocation(${currentLocation.latitude}, ${currentLocation.longitude});
          }
        `);
      }
    }, [currentLocation, mapReady]);

    // Handle route drawing for iOS
    useEffect(() => {
      if (destination && currentLocation && mapReady && webViewRef.current && !disableLocationTracking) {
        webViewRef.current.injectJavaScript(`
          if (window.drawRoute) {
            window.drawRoute(
              ${currentLocation.latitude}, 
              ${currentLocation.longitude}, 
              ${destination.latitude}, 
              ${destination.longitude}, 
              '${routeProfile}'
            );
          }
        `);
      }
    }, [destination, currentLocation, mapReady, routeProfile, disableLocationTracking]);

    // Cleanup location watch on unmount
    useEffect(() => {
      return () => {
        if (iosLocationWatchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.clearWatch(iosLocationWatchIdRef.current);
        }
      };
    }, []);

  return (
    <View style={[styles.container, style]}>
        <WebView
          ref={webViewRef}
          source={{ html: getIOSMapHTML() }}
          style={{ flex: 1 }}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={true}
          onMessage={(event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === 'mapReady') {
                setMapReady(true);
                handleMapReady();
              } else if (data.type === 'locationUpdate') {
                const location: LocationData = {
                  latitude: data.latitude,
                  longitude: data.longitude,
                  accuracy: data.accuracy || 0,
                  timestamp: data.timestamp || Date.now(),
                };
                setCurrentLocation(location);
                onLocationUpdate?.(location);
              }
            } catch (error) {
              console.warn('Error parsing WebView message:', error);
            }
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
        />
      </View>
    );
  }

  // Android: Use native component
  return (
    <View style={[styles.container, style]}>
      {NativeMapViewComponent && (
      <NativeMapViewComponent
        ref={mapRef}
        style={styles.map}
        onLocationUpdate={handleLocationUpdate}
        onMapReady={handleMapReady}
      />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
});

// Fullscreen Map View Component
const NativeMapViewFullscreenComponent = requireNativeComponent<NativeMapViewProps>('NativeMapViewFullscreen', {
  nativeOnly: {
    // Event handlers are handled automatically by React Native bridge
  }
});

export const NativeMapViewFullscreen: React.FC<{
  style?: any;
  onLocationUpdate?: (location: LocationData) => void;
  onMapReady?: () => void;
  destination?: { latitude: number; longitude: number };
  routeProfile?: 'driving' | 'cycling' | 'walking';
}> = ({ 
  style, 
  onLocationUpdate, 
  onMapReady,
  destination,
  routeProfile = 'driving'
}) => {
  const mapRef = useRef<any>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const isMountedRef = useRef(true);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);

  // Cleanup function to clear all timeouts
  const clearAllTimeouts = useCallback(() => {
    try {
      const timeouts = [...timeoutRefs.current]; // Create a copy to avoid modification during iteration
      timeouts.forEach(timeout => {
        if (timeout) {
          clearTimeout(timeout);
        }
      });
      timeoutRefs.current = [];
    } catch (e) {
      console.warn('Error in clearAllTimeouts:', e);
      timeoutRefs.current = [];
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    // Only request location permission if location tracking is not disabled
    if (!disableLocationTracking) {
      requestLocationPermission();
    } else {
      // If location tracking is disabled, just set hasPermission to false
      // This prevents any location-related operations
      setHasPermission(false);
    }
    
    return () => {
      isMountedRef.current = false;
      try {
        clearAllTimeouts();
      } catch (e) {
        console.warn('Error clearing timeouts (fullscreen):', e);
      }
    };
  }, [requestLocationPermission, clearAllTimeouts, disableLocationTracking]);

  useEffect(() => {
    if (hasPermission && Platform.OS === 'android' && isMountedRef.current) {
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && mapRef.current) {
          fetchLocationOnce();
        }
      }, 1500);  // Longer delay for fullscreen
      timeoutRefs.current.push(timeoutId);
      
      return () => {
        clearTimeout(timeoutId);
        timeoutRefs.current = timeoutRefs.current.filter(t => t !== timeoutId);
      };
    }
  }, [hasPermission]);

  const requestLocationPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        if (!isMountedRef.current) return;

        if (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED
        ) {
          setHasPermission(true);
          if (NativeMapViewModule && isMountedRef.current) {
            await NativeMapViewModule.requestLocationPermission();
          }
        } else {
          if (isMountedRef.current) {
            Alert.alert(
              'Location Permission',
              'Location permission is required to show your current location on the map.'
            );
          }
        }
      } catch (err) {
        console.warn(err);
      }
    } else {
      if (isMountedRef.current) {
        setHasPermission(true);
      }
    }
  }, []);

  const fetchLocationOnce = async () => {
    if (!isMountedRef.current || !mapRef.current) {
      return;
    }
    
    if (Platform.OS === 'android' && NativeMapViewModule) {
      try {
        const location = await NativeMapViewModule.getCurrentLocation();
        
        if (!isMountedRef.current || !mapRef.current) {
          return;
        }
        
        if (location) {
          setCurrentLocation(location);
          onLocationUpdate?.(location);
          
          if (Platform.OS === 'android' && mapRef.current && isMountedRef.current) {
            try {
              const nodeHandle = findNodeHandle(mapRef.current);
              if (nodeHandle) {
                try {
                  const commandId = 1;
                  UIManager.dispatchViewManagerCommand(
                    nodeHandle,
                    commandId,
                    [location.latitude, location.longitude]
                  );
                } catch (error) {
                  console.log('Error updating fullscreen map location:', error);
                }
              }
            } catch (error) {
              console.log('Error finding fullscreen map node handle:', error);
            }
          }
        }
      } catch (error) {
        console.log('Error fetching location for fullscreen map:', error);
      }
    }
  };

  const lastLocationUpdateTimeRef = useRef<number>(0);
  const lastLocationRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const LOCATION_UPDATE_THROTTLE_MS = 10000;
  const MIN_LOCATION_CHANGE_METERS = 20;

  const handleLocationUpdate = (event: any) => {
    if (!mapRef.current) {
      return;
    }
    
    const location = event.nativeEvent;
    const now = Date.now();
    const lastUpdate = lastLocationUpdateTimeRef.current;
    const lastLoc = lastLocationRef.current;
    
    let distanceChanged = true;
    if (lastLoc) {
      const R = 6371e3;
      const φ1 = lastLoc.latitude * Math.PI / 180;
      const φ2 = location.latitude * Math.PI / 180;
      const Δφ = (location.latitude - lastLoc.latitude) * Math.PI / 180;
      const Δλ = (location.longitude - lastLoc.longitude) * Math.PI / 180;
      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                Math.cos(φ1) * Math.cos(φ2) *
                Math.sin(Δλ/2) * Math.sin(Δλ/2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distance = R * c;
      distanceChanged = distance >= MIN_LOCATION_CHANGE_METERS;
    }
    
    if ((now - lastUpdate >= LOCATION_UPDATE_THROTTLE_MS) && distanceChanged && mapRef.current) {
      setCurrentLocation(location);
      onLocationUpdate?.(location);
      lastLocationUpdateTimeRef.current = now;
      lastLocationRef.current = { latitude: location.latitude, longitude: location.longitude };
      
      if (Platform.OS === 'android' && mapRef.current) {
        try {
          const nodeHandle = findNodeHandle(mapRef.current);
          if (nodeHandle) {
            try {
              UIManager.dispatchViewManagerCommand(
                nodeHandle,
                1,
                [location.latitude, location.longitude]
              );
            } catch (error) {
              console.log('Error updating fullscreen map location (may be unmounting):', error);
            }
          }
        } catch (error) {
          console.log('Fullscreen map ref invalid, component may be unmounting');
        }
      }
    }
  };

  const handleMapReady = () => {
    if (!isMountedRef.current || !mapRef.current) {
      return;
    }
    
    console.log('🗺️ Fullscreen map ready callback triggered');
    onMapReady?.();
    
    if (hasPermission && Platform.OS === 'android' && isMountedRef.current && mapRef.current) {
      const timeoutId = setTimeout(() => {
        if (isMountedRef.current && mapRef.current) {
          fetchLocationOnce();
        }
      }, 1000);
      timeoutRefs.current.push(timeoutId);
    } else if (currentLocation && isMountedRef.current && mapRef.current) {
      centerOnCurrentLocation();
    }
  };

  const centerOnCurrentLocation = () => {
    if (!isMountedRef.current || !mapRef.current) {
      return;
    }
    
    try {
      const nodeHandle = findNodeHandle(mapRef.current);
      if (nodeHandle && isMountedRef.current) {
        if (Platform.OS === 'ios' && NativeMapViewModule) {
          NativeMapViewModule.centerOnCurrentLocation(nodeHandle);
        } else if (Platform.OS === 'android' && currentLocation && isMountedRef.current) {
          try {
            UIManager.dispatchViewManagerCommand(
              nodeHandle,
              1,
              [currentLocation.latitude, currentLocation.longitude]
            );
          } catch (error) {
            console.log('Error centering fullscreen map (may be unmounting):', error);
          }
        }
      }
    } catch (error) {
      console.log('Error finding fullscreen map node handle (may be unmounting):', error);
    }
  };

  const drawRoute = (fromLat: number, fromLng: number, toLat: number, toLng: number, profile: string = 'driving', isUpdate: boolean = false) => {
    if (!isMountedRef.current || !mapRef.current || Platform.OS !== 'android') {
      return;
    }
    
    try {
      const nodeHandle = findNodeHandle(mapRef.current);
      if (nodeHandle && isMountedRef.current) {
        try {
          UIManager.dispatchViewManagerCommand(
            nodeHandle,
            2,
            [fromLat, fromLng, toLat, toLng, profile, isUpdate]
          );
          if (!isUpdate && isMountedRef.current) {
            console.log(`🗺️ Requesting ${profile} route in fullscreen from [${fromLat}, ${fromLng}] to [${toLat}, ${toLng}]`);
          }
        } catch (error) {
          console.log('Error drawing route in fullscreen (may be unmounting):', error);
        }
      }
    } catch (error) {
      console.log('Error finding node handle for fullscreen route (may be unmounting):', error);
    }
  };

  const lastRouteLocationRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastRouteDrawTimeRef = useRef<number>(0);
  const routeDrawnRef = useRef<boolean>(false);
  const ROUTE_UPDATE_THROTTLE_MS = 10000;
  const MIN_DISTANCE_CHANGE_METERS = 30;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3;
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  useEffect(() => {
    // Don't draw route if location tracking is disabled
    if (disableLocationTracking) {
      console.log('📍 Fullscreen route drawing disabled - location tracking is disabled');
      return;
    }
    
    if (destination && currentLocation && hasPermission && mapRef.current) {
      const now = Date.now();
      const lastLocation = lastRouteLocationRef.current;
      const shouldRedraw = 
        !routeDrawnRef.current ||
        !lastLocation ||
        (now - lastRouteDrawTimeRef.current) >= ROUTE_UPDATE_THROTTLE_MS ||
        calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          lastLocation.lat,
          lastLocation.lng
        ) >= MIN_DISTANCE_CHANGE_METERS;

      if (shouldRedraw && mapRef.current && isMountedRef.current) {
        const timeoutId = setTimeout(() => {
          if (!isMountedRef.current || !mapRef.current) {
            return;
          }
          drawRoute(
            currentLocation.latitude,
            currentLocation.longitude,
            destination.latitude,
            destination.longitude,
            routeProfile,
            routeDrawnRef.current
          );
          if (isMountedRef.current) {
            lastRouteLocationRef.current = {
              lat: currentLocation.latitude,
              lng: currentLocation.longitude
            };
            lastRouteDrawTimeRef.current = now;
            routeDrawnRef.current = true;
            console.log(`🗺️ Drawing ${routeProfile} route in fullscreen from current location to destination`);
          }
        }, routeDrawnRef.current ? 800 : 2000);  // Longer delays for fullscreen
        timeoutRefs.current.push(timeoutId);
        
        return () => {
          clearTimeout(timeoutId);
          timeoutRefs.current = timeoutRefs.current.filter(t => t !== timeoutId);
        };
      }
    }
  }, [destination, currentLocation, hasPermission, routeProfile, disableLocationTracking]);

  return (
    <View style={[styles.container, style]}>
      <NativeMapViewFullscreenComponent
        ref={mapRef}
        style={styles.map}
        onLocationUpdate={handleLocationUpdate}
        onMapReady={handleMapReady}
      />
    </View>
  );
};
