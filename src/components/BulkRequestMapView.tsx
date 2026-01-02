import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, Platform, PermissionsAndroid, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeModules } from 'react-native';

const { NativeMapViewModule } = NativeModules;

interface Marker {
  id: string;
  latitude: number;
  longitude: number;
  title: string;
  description?: string;
  pinColor?: string;
}

interface RoutePoint {
  latitude: number;
  longitude: number;
  title: string;
}

interface BulkRequestMapViewProps {
  style?: any;
  markers?: Marker[];
  routePoints?: RoutePoint[];
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
}

const getMapHtmlContent = (markers: Marker[] = [], routePoints: RoutePoint[] = [], currentLocation: { latitude: number; longitude: number } | null = null): string => {
  const markersJson = JSON.stringify(markers);
  const routePointsJson = JSON.stringify(routePoints);
  const currentLocationJson = currentLocation ? JSON.stringify(currentLocation) : 'null';
  
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
                var markers = ${markersJson};
                var routePoints = ${routePointsJson};
                var currentLocation = ${currentLocationJson};
                var polylines = [];
                var currentLocationMarker = null;
                
                function initMap() {
                    try {
                        if (typeof L === 'undefined') {
                            console.error('Leaflet not loaded');
                            return;
                        }
                        
                        // Initialize map
                        map = L.map('map', {
                            zoomControl: true,
                            scrollWheelZoom: false,
                            doubleClickZoom: false,
                            boxZoom: false,
                            keyboard: false,
                            dragging: true,
                            touchZoom: true
                        });
                        
                        // Add OpenStreetMap tile layer
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap contributors',
                            maxZoom: 19
                        }).addTo(map);
                        
                        // Add current location marker (mobile icon) if available
                        if (currentLocation && currentLocation.latitude && currentLocation.longitude) {
                            // Create a mobile/phone icon marker for current location
                            var mobileIcon = L.divIcon({
                                className: 'current-location-marker',
                                html: '<div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #2196F3; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"><svg style="width: 18px; height: 18px; fill: white;" viewBox="0 0 24 24"><path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H7V4h10v16z"/></svg></div>',
                                iconSize: [32, 32],
                                iconAnchor: [16, 16]
                            });
                            
                            currentLocationMarker = L.marker([currentLocation.latitude, currentLocation.longitude], { 
                                icon: mobileIcon,
                                zIndexOffset: 1000 // Ensure it appears on top
                            })
                                .addTo(map)
                                .bindPopup('<b>Your Location</b>');
                            // Make it available globally for updates
                            window.currentLocationMarker = currentLocationMarker;
                        }
                        
                        // Add markers
                        var mapMarkers = [];
                        markers.forEach(function(marker) {
                            var iconColor = marker.pinColor || '#3388ff';
                            var customIcon = L.divIcon({
                                className: 'custom-marker',
                                html: '<div style="background-color: ' + iconColor + '; width: 20px; height: 20px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>',
                                iconSize: [20, 20],
                                iconAnchor: [10, 10]
                            });
                            
                            var m = L.marker([marker.latitude, marker.longitude], { icon: customIcon })
                                .addTo(map)
                                .bindPopup('<b>' + marker.title + '</b><br>' + (marker.description || ''));
                            mapMarkers.push(m);
                        });
                        
                        // Draw routes from request location to each vendor (hub-and-spoke pattern)
                        if (routePoints.length > 1) {
                            var requestLocation = routePoints[0];
                            var vendorPoints = routePoints.slice(1);
                            var routesLoaded = 0;
                            var totalRoutes = vendorPoints.length;
                            
                            // Draw route from request location to each vendor
                            vendorPoints.forEach(function(vendor, index) {
                                // Use OSRM to get route from request location to vendor
                                var osrmUrl = 'https://router.project-osrm.org/route/v1/driving/' + 
                                              requestLocation.longitude + ',' + requestLocation.latitude + ';' + 
                                              vendor.longitude + ',' + vendor.latitude + 
                                              '?overview=full&geometries=geojson&alternatives=false';
                                
                                fetch(osrmUrl)
                                    .then(function(response) { return response.json(); })
                                    .then(function(data) {
                                        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                                            var coordinates = data.routes[0].geometry.coordinates;
                                            var latLngs = coordinates.map(function(coord) {
                                                return [coord[1], coord[0]];
                                            });
                                            
                                            // Use different colors: red for first route, teal for others
                                            var routeColor = index === 0 ? '#FF6B6B' : '#4ECDC4';
                                            var polyline = L.polyline(latLngs, {
                                                color: routeColor,
                                                weight: 4,
                                                opacity: 0.7
                                            }).addTo(map);
                                            polylines.push(polyline);
                                            
                                            routesLoaded++;
                                            // Fit bounds when all routes are loaded
                                            if (routesLoaded === totalRoutes) {
                                                var allFeatures = [...mapMarkers, ...polylines];
                                                if (currentLocationMarker) {
                                                    allFeatures.push(currentLocationMarker);
                                                }
                                                var group = new L.featureGroup(allFeatures);
                                                map.fitBounds(group.getBounds().pad(0.1));
                                            }
                                        } else {
                                            routesLoaded++;
                                            if (routesLoaded === totalRoutes) {
                                                var allFeatures = [...mapMarkers, ...polylines];
                                                if (currentLocationMarker) {
                                                    allFeatures.push(currentLocationMarker);
                                                }
                                                var group = new L.featureGroup(allFeatures);
                                                map.fitBounds(group.getBounds().pad(0.1));
                                            }
                                        }
                                    })
                                    .catch(function(error) {
                                        console.error('Route error for vendor ' + index + ':', error);
                                        routesLoaded++;
                                        // Draw straight line if route fails
                                        var routeColor = index === 0 ? '#FF6B6B' : '#4ECDC4';
                                        var polyline = L.polyline([
                                            [requestLocation.latitude, requestLocation.longitude],
                                            [vendor.latitude, vendor.longitude]
                                        ], {
                                            color: routeColor,
                                            weight: 4,
                                            opacity: 0.5,
                                            dashArray: '10, 10'
                                        }).addTo(map);
                                        polylines.push(polyline);
                                        
                                        // Fit bounds when all routes are loaded (including failed ones)
                                        if (routesLoaded === totalRoutes) {
                                            var allFeatures = [...mapMarkers, ...polylines];
                                            if (currentLocationMarker) {
                                                allFeatures.push(currentLocationMarker);
                                            }
                                            var group = new L.featureGroup(allFeatures);
                                            map.fitBounds(group.getBounds().pad(0.1));
                                        }
                                    });
                            });
                        } else if (mapMarkers.length > 0 || currentLocationMarker) {
                            // Fit bounds to show all markers if no routes
                            var allFeatures = [...mapMarkers];
                            if (currentLocationMarker) {
                                allFeatures.push(currentLocationMarker);
                            }
                            var group = new L.featureGroup(allFeatures);
                            map.fitBounds(group.getBounds().pad(0.1));
                        }
                        
                        // Make map available globally for location updates
                        window.map = map;
                        
                        // Notify React Native that map is ready
                        if (window.ReactNativeWebView) {
                            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'mapReady' }));
                        }
                    } catch (e) {
                        console.error('Map initialization error:', e);
                    }
                }
                
                // Initialize map when page loads
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

export const BulkRequestMapView: React.FC<BulkRequestMapViewProps> = ({
  style,
  markers = [],
  routePoints = [],
  initialRegion
}) => {
  const webViewRef = useRef<WebView>(null);
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const watchIdRef = useRef<number | null>(null);

  // Get current location and watch for updates
  useEffect(() => {
    let isMounted = true;

    const getLocation = async () => {
      try {
        // Request location permission
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ]);

          if (
            granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED &&
            granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] !== PermissionsAndroid.RESULTS.GRANTED
          ) {
            console.warn('Location permission not granted');
            return;
          }
        }

        // Get initial location
        if (NativeMapViewModule) {
          try {
            const location = await NativeMapViewModule.getCurrentLocation();
            if (isMounted && location && location.latitude && location.longitude) {
              setCurrentLocation({
                latitude: location.latitude,
                longitude: location.longitude
              });
            }
          } catch (error) {
            console.warn('Error getting initial location:', error);
          }
        }
      } catch (error) {
        console.warn('Error requesting location permission:', error);
      }
    };

    getLocation();

    return () => {
      isMounted = false;
      if (watchIdRef.current !== null) {
        watchIdRef.current = null;
      }
    };
  }, []);

  // Update map when current location changes
  useEffect(() => {
    if (currentLocation && webViewRef.current) {
      // Inject JavaScript to update current location marker on the map
      webViewRef.current.injectJavaScript(`
        (function() {
          if (window.map && window.currentLocationMarker) {
            // Update existing marker position
            window.currentLocationMarker.setLatLng([${currentLocation.latitude}, ${currentLocation.longitude}]);
          } else if (window.map) {
            // Create new marker if map is ready but marker doesn't exist
            if (typeof L !== 'undefined') {
              var mobileIcon = L.divIcon({
                className: 'current-location-marker',
                html: '<div style="display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; background-color: #2196F3; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"><svg style="width: 18px; height: 18px; fill: white;" viewBox="0 0 24 24"><path d="M17 2H7c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 18H7V4h10v16z"/></svg></div>',
                iconSize: [32, 32],
                iconAnchor: [16, 16]
              });
              window.currentLocationMarker = L.marker([${currentLocation.latitude}, ${currentLocation.longitude}], { 
                icon: mobileIcon,
                zIndexOffset: 1000
              }).addTo(window.map).bindPopup('<b>Your Location</b>');
            }
          }
        })();
      `);
    }
  }, [currentLocation]);

  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: getMapHtmlContent(markers, routePoints, currentLocation) }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        onLoadEnd={() => {
          if (webViewRef.current) {
            setTimeout(() => {
              webViewRef.current?.injectJavaScript(`
                (function() {
                  if (window.map) {
                    window.map.invalidateSize(true);
                  }
                })();
              `);
            }, 100);
          }
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  webview: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
});

