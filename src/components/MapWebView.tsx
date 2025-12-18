import React, { useRef, useEffect, useCallback, useState } from 'react';
import { View, StyleSheet, Platform, PermissionsAndroid, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import { NativeModules } from 'react-native';

const { NativeMapViewModule } = NativeModules;

interface LocationData {
  latitude: number;
  longitude: number;
}

interface MapWebViewProps {
  style?: any;
  onLocationUpdate?: (location: LocationData) => void;
  onMapReady?: () => void;
  destination?: { latitude: number; longitude: number };
  routeProfile?: 'driving' | 'cycling' | 'walking';
}

const getMapHtmlContent = (): string => {
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
                position: fixed; 
                top: 0; 
                left: 0; 
                background-color: #e0e0e0;
                z-index: 1;
            }
            .loading {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                color: #666;
                font-family: Arial, sans-serif;
                z-index: 1000;
            }
            .navigation-instruction {
                position: absolute;
                bottom: 20px;
                left: 20px;
                right: 20px;
                background: rgba(255, 255, 255, 0.95);
                padding: 16px;
                border-radius: 12px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                z-index: 1000;
                font-family: Arial, sans-serif;
            }
            .navigation-distance {
                font-size: 24px;
                font-weight: bold;
                color: #1a73e8;
                margin-bottom: 4px;
            }
            .navigation-text {
                font-size: 16px;
                color: #333;
            }
            .compass-container {
                position: absolute;
                bottom: 100px;
                right: 20px;
                width: 50px;
                height: 50px;
                background: rgba(255, 255, 255, 0.95);
                border-radius: 25px;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                cursor: pointer;
            }
            .compass-needle {
                width: 3px;
                height: 20px;
                background: #d32f2f;
                position: absolute;
                top: 5px;
                left: 50%;
                transform-origin: bottom center;
                transform: translateX(-50%);
                border-radius: 2px;
            }
            .compass-n {
                position: absolute;
                top: 8px;
                left: 50%;
                transform: translateX(-50%);
                font-size: 12px;
                font-weight: bold;
                color: #d32f2f;
            }
            .compass-circle {
                width: 40px;
                height: 40px;
                border: 2px solid #666;
                border-radius: 20px;
                position: relative;
            }
            .recenter-button {
                position: absolute;
                bottom: 100px;
                left: 20px;
                background: rgba(255, 255, 255, 0.95);
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                z-index: 1000;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: #333;
                font-family: Arial, sans-serif;
            }
            .recenter-button:active {
                background: rgba(240, 240, 240, 0.95);
            }
        </style>
    </head>
    <body>
        <div class="loading" id="loading">Loading map...</div>
        <div id="map"></div>
        <div class="compass-container" id="compassContainer" onclick="toggleMapRotation()">
            <div class="compass-circle">
                <div class="compass-needle" id="compassNeedle"></div>
                <div class="compass-n">N</div>
            </div>
        </div>
        <div class="recenter-button" id="recenterButton" onclick="recenterMap()">Re-center</div>
        <div class="navigation-instruction" id="navigationInstruction" style="display: none;">
            <div class="navigation-distance" id="navDistance">--</div>
            <div class="navigation-text" id="navText">Calculating route...</div>
        </div>
        <script>
            (function() {
                var map = null;
                var marker = null;
                var routeLayer = null;
                var loadingEl = document.getElementById('loading');
                var routeSteps = null;
                var currentStepIndex = 0;
                var routeCoordinates = [];
                var currentHeading = 0;
                var mapRotationEnabled = false;
                var lastLocation = null;
                var userHasPanned = false;
                var autoCenterEnabled = true;
                
                // Create truck icon for current location
                var truckIcon = L.icon({
                    iconUrl: 'https://cdn-icons-png.flaticon.com/512/3448/3448339.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40],
                    popupAnchor: [0, -40],
                    shadowSize: [41, 41]
                });
                
                // Fallback to blue marker if truck icon fails to load
                var truckIconFallback = L.icon({
                    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
                    iconSize: [30, 46],
                    iconAnchor: [15, 46],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });
                
                function initMap() {
                    try {
                        if (typeof L === 'undefined') {
                            if (loadingEl) loadingEl.textContent = 'Error: Map library failed to load';
                            return;
                        }
                        
                        var mapDiv = document.getElementById('map');
                        if (!mapDiv) return;
                        
                        map = L.map('map', {
                            zoomControl: true,
                            attributionControl: true,
                            minZoom: 2,
                            maxZoom: 19
                        });
                        
                        // Initialize compass to show north (0 degrees)
                        updateCompass(0);
                        
                        // Track if user manually pans the map
                        map.on('dragstart', function() {
                            userHasPanned = true;
                        });
                        
                        // Re-enable auto-center after a delay if user stops panning
                        map.on('dragend', function() {
                            setTimeout(function() {
                                if (!userHasPanned) {
                                    autoCenterEnabled = true;
                                }
                            }, 3000); // Re-enable after 3 seconds
                        });
                        
                        var tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap contributors',
                            minZoom: 2,
                            maxZoom: 19,
                            subdomains: ['a', 'b', 'c']
                        });
                        
                        tileLayer.addTo(map);
                        
                        map.setView([20.5937, 78.9629], 13);
                        
                        // Fix for "Incomplete map until resize" issue
                        setTimeout(function() {
                            if (map) {
                                map.invalidateSize(true);
                                console.log('Map size invalidated after container ready');
                                // Notify React Native that map is ready
                                if (window.ReactNativeWebView) {
                                    window.ReactNativeWebView.postMessage(JSON.stringify({
                                        type: 'mapReady'
                                    }));
                                }
                            }
                        }, 100);
                        
                        if (loadingEl) {
                            loadingEl.style.display = 'none';
                        }
                        
                        window.map = map;
                        window.marker = marker;
                        
                        console.log('Map initialized');
                    } catch (e) {
                        console.error('Map initialization error:', e);
                        if (loadingEl) {
                            loadingEl.textContent = 'Error: ' + e.message;
                        }
                    }
                }
                
                // Calculate distance between two coordinates (Haversine formula)
                function calculateDistance(lat1, lon1, lat2, lon2) {
                    var R = 6371e3; // Earth radius in meters
                    var φ1 = lat1 * Math.PI / 180;
                    var φ2 = lat2 * Math.PI / 180;
                    var Δφ = (lat2 - lat1) * Math.PI / 180;
                    var Δλ = (lon2 - lon1) * Math.PI / 180;
                    var a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                            Math.cos(φ1) * Math.cos(φ2) *
                            Math.sin(Δλ/2) * Math.sin(Δλ/2);
                    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    return R * c;
                }
                
                // Update navigation instruction based on current location
                function updateNavigationInstruction(currentLat, currentLng) {
                    if (!routeSteps || routeSteps.length === 0) {
                        var navEl = document.getElementById('navigationInstruction');
                        if (navEl) navEl.style.display = 'none';
                        return;
                    }
                    
                    // Find closest step to current position
                    var minDistance = Infinity;
                    var closestStepIndex = currentStepIndex;
                    
                    for (var i = currentStepIndex; i < routeSteps.length; i++) {
                        if (routeSteps[i].location) {
                            var dist = calculateDistance(
                                currentLat, currentLng,
                                routeSteps[i].location[0], routeSteps[i].location[1]
                            );
                            if (dist < minDistance) {
                                minDistance = dist;
                                closestStepIndex = i;
                            }
                        }
                    }
                    
                    currentStepIndex = closestStepIndex;
                    
                    // Get next step (maneuver)
                    var nextStepIndex = closestStepIndex + 1;
                    if (nextStepIndex < routeSteps.length) {
                        var nextStep = routeSteps[nextStepIndex];
                        var stepLocation = nextStep.location;
                        
                        if (stepLocation) {
                            var distanceToTurn = calculateDistance(
                                currentLat, currentLng,
                                stepLocation[0], stepLocation[1]
                            );
                            
                            var navEl = document.getElementById('navigationInstruction');
                            var navDistanceEl = document.getElementById('navDistance');
                            var navTextEl = document.getElementById('navText');
                            
                            if (navEl && navDistanceEl && navTextEl) {
                                // Format distance
                                var distanceText = '';
                                if (distanceToTurn < 1000) {
                                    distanceText = Math.round(distanceToTurn) + ' m';
                                } else {
                                    distanceText = (distanceToTurn / 1000).toFixed(1) + ' km';
                                }
                                
                                // Format instruction
                                var instructionText = nextStep.instruction || getInstructionFromType(nextStep.type, nextStep.modifier);
                                
                                navDistanceEl.textContent = distanceText;
                                navTextEl.textContent = instructionText;
                                navEl.style.display = 'block';
                            }
                        }
                    } else {
                        // Reached destination
                        var navEl = document.getElementById('navigationInstruction');
                        var navDistanceEl = document.getElementById('navDistance');
                        var navTextEl = document.getElementById('navText');
                        
                        if (navEl && navDistanceEl && navTextEl) {
                            navDistanceEl.textContent = 'Arrived';
                            navTextEl.textContent = 'You have reached your destination';
                            navEl.style.display = 'block';
                        }
                    }
                }
                
                // Get instruction text from maneuver type
                function getInstructionFromType(type, modifier) {
                    var instructions = {
                        'turn': modifier ? 'Turn ' + modifier : 'Turn',
                        'new name': 'Continue',
                        'depart': 'Start',
                        'arrive': 'Arrive',
                        'merge': 'Merge ' + (modifier || ''),
                        'ramp': 'Take ramp',
                        'on ramp': 'Take on ramp',
                        'off ramp': 'Take off ramp',
                        'fork': 'Take fork ' + (modifier || ''),
                        'end of road': 'End of road',
                        'use lane': 'Use lane',
                        'continue': 'Continue',
                        'roundabout': 'Enter roundabout',
                        'rotary': 'Enter rotary',
                        'roundabout turn': 'Exit roundabout',
                        'notification': 'Continue'
                    };
                    
                    return instructions[type] || 'Continue';
                }
                
                // Calculate bearing (heading) between two points
                function calculateBearing(lat1, lon1, lat2, lon2) {
                    var dLon = (lon2 - lon1) * Math.PI / 180;
                    var lat1Rad = lat1 * Math.PI / 180;
                    var lat2Rad = lat2 * Math.PI / 180;
                    var y = Math.sin(dLon) * Math.cos(lat2Rad);
                    var x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - 
                            Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
                    var bearing = Math.atan2(y, x) * 180 / Math.PI;
                    return (bearing + 360) % 360;
                }
                
                // Update compass needle
                function updateCompass(heading) {
                    var compassNeedle = document.getElementById('compassNeedle');
                    if (compassNeedle) {
                        compassNeedle.style.transform = 'translateX(-50%) rotate(' + heading + 'deg)';
                    }
                }
                
                // Toggle map rotation (for future use - currently just updates compass)
                window.toggleMapRotation = function() {
                    mapRotationEnabled = !mapRotationEnabled;
                    console.log('Compass clicked - Map rotation:', mapRotationEnabled ? 'enabled' : 'disabled');
                    
                    // Visual feedback - change compass background color
                    var compassContainer = document.getElementById('compassContainer');
                    if (compassContainer) {
                        if (mapRotationEnabled) {
                            compassContainer.style.background = 'rgba(76, 175, 80, 0.95)';
                        } else {
                            compassContainer.style.background = 'rgba(255, 255, 255, 0.95)';
                        }
                    }
                };
                
                // Re-center map on current location
                window.recenterMap = function() {
                    if (map && marker && lastLocation) {
                        userHasPanned = false;
                        autoCenterEnabled = true;
                        map.setView([lastLocation.lat, lastLocation.lng], map.getZoom());
                    }
                };
                
                window.updateLocation = function(lat, lng, heading) {
                    if (!map) return;
                    
                    // Validate coordinates
                    if (typeof lat !== 'number' || typeof lng !== 'number' || 
                        isNaN(lat) || isNaN(lng) ||
                        lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                        console.error('Invalid coordinates:', lat, lng);
                        return;
                    }
                    
                    // Calculate heading if not provided
                    if (heading === undefined || heading === null || isNaN(heading)) {
                        if (lastLocation) {
                            heading = calculateBearing(
                                lastLocation.lat, lastLocation.lng,
                                lat, lng
                            );
                        } else {
                            heading = 0;
                        }
                    }
                    currentHeading = heading;
                    
                    // Update marker position first
                    if (marker) {
                        marker.setLatLng([lat, lng]);
                    } else {
                        // Try truck icon, fallback to blue marker if it fails
                        try {
                            marker = L.marker([lat, lng], { icon: truckIcon }).addTo(map);
                        } catch (e) {
                            marker = L.marker([lat, lng], { icon: truckIconFallback }).addTo(map);
                        }
                    }
                    
                    // Only update map center if:
                    // 1. Auto-center is enabled (user hasn't manually panned)
                    // 2. Location has changed significantly (more than 20 meters)
                    var shouldCenterMap = autoCenterEnabled;
                    if (shouldCenterMap && lastLocation) {
                        var distance = calculateDistance(lastLocation.lat, lastLocation.lng, lat, lng);
                        // Only center if moved more than 20 meters
                        shouldCenterMap = distance > 20;
                    } else if (!lastLocation) {
                        // Always center on first location
                        shouldCenterMap = true;
                    }
                    
                    // Update map center only if needed (to prevent jumping)
                    if (shouldCenterMap) {
                        // Use panTo for smoother movement instead of setView
                        map.panTo([lat, lng], { animate: true, duration: 0.3 });
                    }
                    
                    // Update compass
                    updateCompass(heading);
                    
                    // Store last location
                    lastLocation = { lat: lat, lng: lng };
                    
                    console.log('Location updated to:', lat, lng, 'Heading:', heading);
                    
                    // Update navigation instruction
                    updateNavigationInstruction(lat, lng);
                    
                    // Notify React Native
                    if (window.ReactNativeWebView) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'locationUpdate',
                            latitude: lat,
                            longitude: lng,
                            heading: heading
                        }));
                    }
                };
                
                window.drawRoute = function(fromLat, fromLng, toLat, toLng, profile, isUpdate) {
                    if (!map) {
                        console.error('Map not initialized');
                        return;
                    }
                    
                    profile = profile || 'driving';
                    
                    if (routeLayer) {
                        map.removeLayer(routeLayer);
                    }
                    
                    // Request route with steps for navigation instructions
                    var url = 'https://router.project-osrm.org/route/v1/' + profile + '/' + 
                              fromLng + ',' + fromLat + ';' + toLng + ',' + toLat + 
                              '?overview=full&geometries=geojson&steps=true';
                    
                    fetch(url)
                        .then(function(response) { return response.json(); })
                        .then(function(data) {
                            if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                                var route = data.routes[0];
                                var geometry = route.geometry;
                                
                                routeCoordinates = geometry.coordinates.map(function(coord) {
                                    return [coord[1], coord[0]];
                                });
                                
                                // Store route steps for navigation
                                if (route.legs && route.legs.length > 0) {
                                    routeSteps = [];
                                    route.legs.forEach(function(leg) {
                                        if (leg.steps) {
                                            leg.steps.forEach(function(step) {
                                                routeSteps.push({
                                                    distance: step.distance,
                                                    duration: step.duration,
                                                    instruction: step.maneuver ? step.maneuver.instruction : '',
                                                    type: step.maneuver ? step.maneuver.type : '',
                                                    modifier: step.maneuver ? step.maneuver.modifier : '',
                                                    location: step.maneuver ? [step.maneuver.location[1], step.maneuver.location[0]] : null
                                                });
                                            });
                                        }
                                    });
                                    currentStepIndex = 0;
                                }
                                
                                routeLayer = L.polyline(routeCoordinates, {
                                    color: '#3b82f6',
                                    weight: 5,
                                    opacity: 0.7
                                }).addTo(map);
                                
                                // Only fit bounds on initial draw, not on updates
                                if (!isUpdate) {
                                    var bounds = routeLayer.getBounds();
                                    map.fitBounds(bounds, { padding: [50, 50] });
                                }
                                
                                var distance = (route.distance / 1000).toFixed(2);
                                var duration = Math.round(route.duration / 60);
                                console.log('Route drawn successfully - Distance: ' + distance + ' km, Duration: ~' + duration + ' min');
                                
                                if (!isUpdate) {
                                    // Use truck icon for start marker (current location)
                                    if (!marker) {
                                        try {
                                            marker = L.marker([fromLat, fromLng], { icon: truckIcon }).addTo(map);
                                        } catch (e) {
                                            marker = L.marker([fromLat, fromLng], { icon: truckIconFallback }).addTo(map);
                                        }
                                    } else {
                                        marker.setLatLng([fromLat, fromLng]);
                                    }
                                    
                                    var endMarker = L.marker([toLat, toLng]).addTo(map);
                                }
                                
                                // Update navigation instruction
                                updateNavigationInstruction(fromLat, fromLng);
                            }
                        })
                        .catch(function(error) {
                            console.error('Route error:', error);
                        });
                };
                
                // Setup button event listeners
                function setupButtonListeners() {
                    var compassContainer = document.getElementById('compassContainer');
                    var recenterButton = document.getElementById('recenterButton');
                    
                    if (compassContainer) {
                        compassContainer.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.toggleMapRotation) {
                                window.toggleMapRotation();
                            }
                        });
                        compassContainer.addEventListener('touchstart', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.toggleMapRotation) {
                                window.toggleMapRotation();
                            }
                        });
                    }
                    
                    if (recenterButton) {
                        recenterButton.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.recenterMap) {
                                window.recenterMap();
                            }
                        });
                        recenterButton.addEventListener('touchstart', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            if (window.recenterMap) {
                                window.recenterMap();
                            }
                        });
                    }
                }
                
                // Initialize map when page loads
                if (document.readyState === 'loading') {
                    document.addEventListener('DOMContentLoaded', function() {
                        initMap();
                        setupButtonListeners();
                    });
                } else {
                    initMap();
                    setupButtonListeners();
                }
            })();
        </script>
    </body>
    </html>
  `;
};

export const MapWebView: React.FC<MapWebViewProps> = ({
  style,
  onLocationUpdate,
  onMapReady,
  destination,
  routeProfile = 'driving'
}) => {
  const webViewRef = useRef<WebView>(null);
  const mapReadyRef = useRef(false);
  const currentLocationRef = useRef<{ latitude: number; longitude: number; heading?: number } | null>(null);
  const routeDrawnRef = useRef(false);
  const [hasPermission, setHasPermission] = useState(false);
  const locationUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Request location permission and get initial location (same as small map)
  useEffect(() => {
    let mounted = true;
    
    const requestLocation = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.requestMultiple([
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
          ]);

          if (
            granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
              PermissionsAndroid.RESULTS.GRANTED ||
            granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
              PermissionsAndroid.RESULTS.GRANTED
          ) {
            setHasPermission(true);
            if (NativeMapViewModule && mounted) {
              await NativeMapViewModule.requestLocationPermission();
              
              // Get current location (same as small map does)
              try {
                const location = await NativeMapViewModule.getCurrentLocation();
                if (location && webViewRef.current && mounted) {
                  currentLocationRef.current = {
                    latitude: location.latitude,
                    longitude: location.longitude,
                    heading: location.heading || 0
                  };
                  
                  console.log('🎯 Fullscreen Map - Destination received:', destination);
                  console.log('📍 Fullscreen Map - Current location:', location);
                  
                  // Update map location with heading - ensure coordinates are valid
                  const lat = Number(location.latitude);
                  const lng = Number(location.longitude);
                  
                  if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
                    webViewRef.current.injectJavaScript(`
                      (function() {
                        if (window.updateLocation) {
                          window.updateLocation(${lat}, ${lng}, ${location.heading || 0});
                        }
                      })();
                    `);
                  } else {
                    console.error('Invalid location coordinates:', lat, lng);
                  }
                  
                  // Draw route if destination is available and map is ready (only once)
                  if (destination && mapReadyRef.current && !routeDrawnRef.current && mounted) {
                    setTimeout(() => {
                      if (mounted) {
                        drawRouteToDestination(location.latitude, location.longitude);
                      }
                    }, 500);
                  }
                  
                  onLocationUpdate?.(location);
                  
                  // Start continuous location updates every 5 seconds
                  if (mounted && !locationUpdateIntervalRef.current) {
                    locationUpdateIntervalRef.current = setInterval(async () => {
                      if (!mounted || !webViewRef.current) return;
                      
                      try {
                        const updatedLocation = await NativeMapViewModule.getCurrentLocation();
                        if (updatedLocation && webViewRef.current && mounted) {
                          currentLocationRef.current = {
                            latitude: updatedLocation.latitude,
                            longitude: updatedLocation.longitude,
                            heading: updatedLocation.heading || 0
                          };
                          
                          // Update map with new location and heading - ensure coordinates are valid
                          const updatedLat = Number(updatedLocation.latitude);
                          const updatedLng = Number(updatedLocation.longitude);
                          
                          if (!isNaN(updatedLat) && !isNaN(updatedLng) && 
                              updatedLat >= -90 && updatedLat <= 90 && 
                              updatedLng >= -180 && updatedLng <= 180) {
                            webViewRef.current.injectJavaScript(`
                              (function() {
                                if (window.updateLocation) {
                                  window.updateLocation(${updatedLat}, ${updatedLng}, ${updatedLocation.heading || 0});
                                }
                              })();
                            `);
                          } else {
                            console.error('Invalid updated location coordinates:', updatedLat, updatedLng);
                          }
                          
                          onLocationUpdate?.(updatedLocation);
                        }
                      } catch (error) {
                        console.warn('Error updating location:', error);
                      }
                    }, 5000); // Update every 5 seconds
                  }
                }
              } catch (error) {
                console.warn('Error getting location:', error);
              }
            }
          }
        } catch (err) {
          console.warn('Location permission error:', err);
        }
      }
    };

    requestLocation();
    
    return () => {
      mounted = false;
    };
  }, []); // Only run once on mount

  const drawRouteToDestination = useCallback((fromLat: number, fromLng: number) => {
    if (destination && webViewRef.current) {
      const isUpdate = routeDrawnRef.current;
      console.log('🎯 Fullscreen Map - Destination:', destination);
      console.log(`🗺️ Fullscreen Map - Drawing route from [${fromLat}, ${fromLng}] to [${destination.latitude}, ${destination.longitude}] (isUpdate: ${isUpdate})`);
      webViewRef.current.injectJavaScript(`
        (function() {
          if (window.drawRoute && window.map) {
            console.log('🎯 Fullscreen drawRoute called with destination:', ${destination.latitude}, ${destination.longitude});
            window.drawRoute(${fromLat}, ${fromLng}, ${destination.latitude}, ${destination.longitude}, '${routeProfile}', ${isUpdate});
          }
        })();
      `);
      if (!routeDrawnRef.current) {
        routeDrawnRef.current = true;
      }
    }
  }, [destination, routeProfile]);

  const handleMessage = useCallback((event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      
      if (data.type === 'mapReady') {
        mapReadyRef.current = true;
        onMapReady?.();
        
        // Draw route if we have both current location and destination (only once)
        if (destination && currentLocationRef.current && !routeDrawnRef.current) {
          setTimeout(() => {
            if (!routeDrawnRef.current) {
              drawRouteToDestination(currentLocationRef.current!.latitude, currentLocationRef.current!.longitude);
            }
          }, 500);
        }
      } else if (data.type === 'locationUpdate') {
        const location = {
          latitude: data.latitude,
          longitude: data.longitude,
          heading: data.heading || 0
        };
        currentLocationRef.current = location;
        onLocationUpdate?.(location);
        
        // Don't redraw route on location updates - only update marker position
        // Route is already drawn, just update the marker
      }
    } catch (error) {
      console.error('Error parsing WebView message:', error);
    }
  }, [onLocationUpdate, onMapReady, destination, drawRouteToDestination]);

  // Expose methods to update location and draw route
  const updateLocation = useCallback((latitude: number, longitude: number) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          if (window.updateLocation) {
            window.updateLocation(${latitude}, ${longitude});
          }
        })();
      `);
    }
  }, []);

  const drawRoute = useCallback((
    fromLat: number,
    fromLng: number,
    toLat: number,
    toLng: number,
    profile: string = 'driving',
    isUpdate: boolean = false
  ) => {
    if (webViewRef.current) {
      webViewRef.current.injectJavaScript(`
        (function() {
          if (window.drawRoute) {
            window.drawRoute(${fromLat}, ${fromLng}, ${toLat}, ${toLng}, '${profile}', ${isUpdate});
          }
        })();
      `);
    }
  }, []);


  return (
    <View style={[styles.container, style]}>
      <WebView
        ref={webViewRef}
        source={{ html: getMapHtmlContent() }}
        style={styles.webview}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        scalesPageToFit={true}
        onMessage={handleMessage}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error: ', nativeEvent);
        }}
        onLoadEnd={() => {
          // Invalidate size after load
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
        originWhitelist={['*']}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
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






