package com.app.scrapmatepartner

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.app.ActivityCompat
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedReader
import java.io.InputStreamReader
import org.json.JSONObject
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import java.util.HashMap
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.ReadableArray
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

class NativeMapViewModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val locationManager: LocationManager = reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var currentLocation: Location? = null
    private var locationListener: LocationListener? = null
    
    override fun getName(): String {
        return "NativeMapViewModule"
    }
    
    @ReactMethod
    fun requestLocationPermission(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        
        val fineLocationGranted = ActivityCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val coarseLocationGranted = ActivityCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        if (fineLocationGranted && coarseLocationGranted) {
            startLocationUpdates()
            promise.resolve(true)
        } else {
            val permissions = arrayOf(
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION
            )
            ActivityCompat.requestPermissions(activity as android.app.Activity, permissions, 100)
            promise.resolve(false)
        }
    }
    
    @ReactMethod
    fun isLocationEnabled(promise: Promise) {
        try {
            val isEnabled = locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER) || 
                           locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER)
            promise.resolve(isEnabled)
        } catch (e: Exception) {
            promise.reject("ERROR", "Failed to check location status: ${e.message}")
        }
    }
    
    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        if (currentLocation != null) {
            val locationMap = Arguments.createMap()
            locationMap.putDouble("latitude", currentLocation!!.latitude)
            locationMap.putDouble("longitude", currentLocation!!.longitude)
            locationMap.putDouble("accuracy", currentLocation!!.accuracy.toDouble())
            locationMap.putDouble("timestamp", currentLocation!!.time.toDouble())
            // Add bearing/heading if available
            if (currentLocation!!.hasBearing()) {
                locationMap.putDouble("heading", currentLocation!!.bearing.toDouble())
            } else {
                locationMap.putDouble("heading", 0.0)
            }
            promise.resolve(locationMap)
        } else {
            promise.reject("NO_LOCATION", "Location not available")
        }
    }
    
    @ReactMethod
    fun getAddressFromCoordinates(latitude: Double, longitude: Double, promise: Promise) {
        // Use a background thread for network request
        Thread {
            try {
                // Use OpenStreetMap Nominatim API (free, no API key required)
                val urlString = "https://nominatim.openstreetmap.org/reverse?format=json&lat=$latitude&lon=$longitude&zoom=18&addressdetails=1"
                val url = URL(urlString)
                val connection = url.openConnection() as HttpURLConnection
                
                // Set user agent (required by Nominatim)
                connection.setRequestProperty("User-Agent", "ScrapmatePartner/1.0")
                connection.requestMethod = "GET"
                connection.connectTimeout = 10000
                connection.readTimeout = 10000
                
                val responseCode = connection.responseCode
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    val reader = BufferedReader(InputStreamReader(connection.inputStream))
                    val response = StringBuilder()
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        response.append(line)
                    }
                    reader.close()
                    
                    val jsonResponse = JSONObject(response.toString())
                    val address = jsonResponse.optJSONObject("address")
                    
                    if (address != null) {
                        val addressMap = Arguments.createMap()
                        
                        // Extract address components
                        val formattedAddress = jsonResponse.optString("display_name", "")
                        addressMap.putString("formattedAddress", formattedAddress)
                        
                        // Extract individual components
                        addressMap.putString("houseNumber", address.optString("house_number", ""))
                        addressMap.putString("road", address.optString("road", ""))
                        addressMap.putString("neighborhood", address.optString("neighbourhood", ""))
                        addressMap.putString("suburb", address.optString("suburb", ""))
                        addressMap.putString("city", address.optString("city", address.optString("town", address.optString("village", ""))))
                        addressMap.putString("state", address.optString("state", ""))
                        addressMap.putString("postcode", address.optString("postcode", ""))
                        addressMap.putString("country", address.optString("country", ""))
                        addressMap.putString("countryCode", address.optString("country_code", ""))
                        
                        // Build a simple address string
                        val addressParts = mutableListOf<String>()
                        if (address.optString("house_number", "").isNotEmpty()) {
                            addressParts.add(address.optString("house_number"))
                        }
                        if (address.optString("road", "").isNotEmpty()) {
                            addressParts.add(address.optString("road"))
                        }
                        if (address.optString("suburb", "").isNotEmpty()) {
                            addressParts.add(address.optString("suburb"))
                        }
                        if (address.optString("city", "").isNotEmpty()) {
                            addressParts.add(address.optString("city"))
                        } else if (address.optString("town", "").isNotEmpty()) {
                            addressParts.add(address.optString("town"))
                        }
                        if (address.optString("state", "").isNotEmpty()) {
                            addressParts.add(address.optString("state"))
                        }
                        if (address.optString("postcode", "").isNotEmpty()) {
                            addressParts.add(address.optString("postcode"))
                        }
                        
                        val simpleAddress = if (addressParts.isNotEmpty()) {
                            addressParts.joinToString(", ")
                        } else {
                            formattedAddress
                        }
                        addressMap.putString("address", simpleAddress)
                        
                        Handler(Looper.getMainLooper()).post {
                            promise.resolve(addressMap)
                        }
                    } else {
                        Handler(Looper.getMainLooper()).post {
                            promise.reject("NO_ADDRESS", "Address not found for this location")
                        }
                    }
                } else {
                    Handler(Looper.getMainLooper()).post {
                        promise.reject("API_ERROR", "Failed to fetch address: HTTP $responseCode")
                    }
                }
                connection.disconnect()
            } catch (e: Exception) {
                android.util.Log.e("NativeMapView", "Error getting address: ${e.message}", e)
                Handler(Looper.getMainLooper()).post {
                    promise.reject("ERROR", "Error getting address: ${e.message}")
                }
            }
        }.start()
    }
    
    
    private fun startLocationUpdates() {
        if (ActivityCompat.checkSelfPermission(
                reactApplicationContext,
                Manifest.permission.ACCESS_FINE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED &&
            ActivityCompat.checkSelfPermission(
                reactApplicationContext,
                Manifest.permission.ACCESS_COARSE_LOCATION
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }
        
        locationListener = object : LocationListener {
            override fun onLocationChanged(location: Location) {
                currentLocation = location
            }
            
            override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
            override fun onProviderEnabled(provider: String) {}
            override fun onProviderDisabled(provider: String) {}
        }
        
        locationManager.requestLocationUpdates(
            LocationManager.GPS_PROVIDER,
            5000L, // 5 seconds for more frequent updates
            10f, // 10 meters minimum distance change
            locationListener!!
        )
        
        // Also try network provider
        locationManager.requestLocationUpdates(
            LocationManager.NETWORK_PROVIDER,
            5000L, // 5 seconds for more frequent updates
            10f, // 10 meters minimum distance change
            locationListener!!
        )
        
        // Try to get last known location
        try {
            val lastKnownLocation = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
            if (lastKnownLocation != null) {
                currentLocation = lastKnownLocation
            } else {
                val networkLocation = locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                if (networkLocation != null) {
                    currentLocation = networkLocation
                }
            }
        } catch (e: SecurityException) {
            // Permission not granted
        }
    }
}

class NativeMapViewManager(private val reactApplicationContext: ReactApplicationContext) : ViewGroupManager<WebView>() {
    private val webViewMap = mutableMapOf<Int, WebView>()
    private var viewTagCounter = 1000
    
    override fun getName(): String {
        return "NativeMapView"
    }
    
    override fun getExportedCustomDirectEventTypeConstants(): Map<String, Any> {
        val eventMap: MutableMap<String, Any> = HashMap()
        eventMap["onMapReady"] = createMap("registrationName", "onMapReady")
        eventMap["onLocationUpdate"] = createMap("registrationName", "onLocationUpdate")
        return eventMap
    }
    
    private fun createMap(vararg keysAndValues: Any): Map<String, String> {
        val map: MutableMap<String, String> = HashMap()
        var i = 0
        while (i < keysAndValues.size) {
            map[keysAndValues[i] as String] = keysAndValues[i + 1] as String
            i += 2
        }
        return map
    }
    
    override fun createViewInstance(reactContext: ThemedReactContext): WebView {
        val webView = WebView(reactContext)
        val viewTag = viewTagCounter++
        webView.tag = viewTag
        webViewMap[viewTag] = webView
        
        // Clear any previous state
        webView.clearHistory()
        webView.clearCache(true)
        
        webView.setLayerType(View.LAYER_TYPE_HARDWARE, null)
        
        val settings = webView.settings
        settings.javaScriptEnabled = true
        settings.domStorageEnabled = true
        settings.setGeolocationEnabled(true)
        settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW
        settings.cacheMode = android.webkit.WebSettings.LOAD_DEFAULT
        
        webView.setBackgroundColor(0xFFF0F0F0.toInt())
        
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                if (view == null) {
                    android.util.Log.w("NativeMapView", "onPageFinished: view is null")
                    return
                }
                
                val currentViewTag = view.tag as? Int
                if (currentViewTag == null) {
                    android.util.Log.w("NativeMapView", "onPageFinished: viewTag is null")
                    return
                }
                
                if (!webViewMap.containsKey(currentViewTag)) {
                    android.util.Log.w("NativeMapView", "onPageFinished: viewTag $currentViewTag not in webViewMap")
                    return
                }
                
                android.util.Log.d("NativeMapView", "onPageFinished: viewTag=$currentViewTag, url=$url")
                
                // Send onMapReady event with better error handling
                Handler(Looper.getMainLooper()).postDelayed({
                    try {
                        // Re-check viewTag is still valid
                        val checkViewTag = view?.tag as? Int
                        if (checkViewTag == null || checkViewTag != currentViewTag) {
                            android.util.Log.w("NativeMapView", "onPageFinished delayed: viewTag changed or null")
                            return@postDelayed
                        }
                        
                        // Re-check view is still in map
                        if (!webViewMap.containsKey(currentViewTag)) {
                            android.util.Log.w("NativeMapView", "onPageFinished delayed: viewTag removed from map")
                            return@postDelayed
                        }
                        
                        val currentView = webViewMap[currentViewTag]
                        if (currentView == null) {
                            android.util.Log.w("NativeMapView", "onPageFinished delayed: view is null in map")
                            return@postDelayed
                        }
                        
                        if (currentView != view) {
                            android.util.Log.w("NativeMapView", "onPageFinished delayed: view instance changed")
                            return@postDelayed
                        }
                        
                        // Check React context is valid
                        try {
                            if (!reactApplicationContext.hasActiveCatalystInstance()) {
                                android.util.Log.w("NativeMapView", "onPageFinished: No active catalyst instance")
                                return@postDelayed
                            }
                        } catch (e: Exception) {
                            android.util.Log.e("NativeMapView", "Error checking catalyst instance: ${e.message}", e)
                            return@postDelayed
                        }
                        
                        // Send event with full error handling
                        try {
                            // Final check: ensure view still exists and is valid
                            val finalCheckView = webViewMap[currentViewTag]
                            if (finalCheckView == null || finalCheckView != view) {
                                android.util.Log.w("NativeMapView", "onPageFinished: View removed before sending event (viewTag=$currentViewTag)")
                                return@postDelayed
                            }
                            
                            // Verify view tag hasn't changed
                            val finalViewTag = view.tag as? Int
                            if (finalViewTag != currentViewTag) {
                                android.util.Log.w("NativeMapView", "onPageFinished: View tag changed from $currentViewTag to $finalViewTag")
                                return@postDelayed
                            }
                            
                            // Verify React context one more time
                            try {
                                if (!reactApplicationContext.hasActiveCatalystInstance()) {
                                    android.util.Log.w("NativeMapView", "onPageFinished: Catalyst instance became inactive")
                                    return@postDelayed
                                }
                            } catch (e: Exception) {
                                android.util.Log.e("NativeMapView", "onPageFinished: Error checking catalyst instance: ${e.message}", e)
                                return@postDelayed
                            }
                            
                            // Create event and get emitter
                            val event = Arguments.createMap()
                            val eventEmitter = try {
                                reactApplicationContext.getJSModule(RCTEventEmitter::class.java)
                            } catch (e: Exception) {
                                android.util.Log.e("NativeMapView", "onPageFinished: Error getting event emitter: ${e.message}", e)
                                return@postDelayed
                            }
                            
                            if (eventEmitter == null) {
                                android.util.Log.e("NativeMapView", "onPageFinished: Event emitter is null")
                                return@postDelayed
                            }
                            
                            // Try to send event - this is where crashes happen
                            // Wrap in try-catch to prevent app crash
                            try {
                                eventEmitter.receiveEvent(currentViewTag, "onMapReady", event)
                                android.util.Log.d("NativeMapView", "onPageFinished: onMapReady event sent successfully for viewTag=$currentViewTag")
                            } catch (e: Throwable) {
                                // Catch all throwables including errors
                                android.util.Log.e("NativeMapView", "onPageFinished: CRASH PREVENTED - Error in receiveEvent (viewTag=$currentViewTag): ${e.javaClass.simpleName} - ${e.message}", e)
                                // Don't rethrow - prevent crash
                            }
                        } catch (e: Throwable) {
                            // Catch all throwables in outer try-catch
                            android.util.Log.e("NativeMapView", "onPageFinished: CRASH PREVENTED - Outer exception (viewTag=$currentViewTag): ${e.javaClass.simpleName} - ${e.message}", e)
                            // Don't rethrow - prevent crash
                        }
                    } catch (e: Exception) {
                        android.util.Log.e("NativeMapView", "Error in onPageFinished delayed handler: ${e.javaClass.simpleName} - ${e.message}", e)
                    }
                }, 50)
                
                // Wait for layout, then invalidate size multiple times
                try {
                    view.post {
                        try {
                            val currentViewTagCheck = view?.tag as? Int
                            if (currentViewTagCheck == null || !webViewMap.containsKey(currentViewTagCheck)) {
                                android.util.Log.w("NativeMapView", "onPageFinished post: viewTag invalid or removed")
                                return@post
                            }
                            
                            val currentView = webViewMap[currentViewTagCheck]
                            if (currentView == null || currentView != view) {
                                android.util.Log.w("NativeMapView", "onPageFinished post: view instance changed")
                                return@post
                            }
                            
                            currentView.evaluateJavascript("""
                                (function() {
                                    try {
                                        var mapDiv = document.getElementById('map');
                                        if (mapDiv) {
                                            var width = window.innerWidth || document.documentElement.clientWidth || mapDiv.offsetWidth;
                                            var height = window.innerHeight || document.documentElement.clientHeight || mapDiv.offsetHeight;
                                            if (width === 0 || height === 0) {
                                                width = screen.width;
                                                height = screen.height;
                                            }
                                            mapDiv.style.width = width + 'px';
                                            mapDiv.style.height = height + 'px';
                                        }
                                        if (window.map) {
                                            window.map.invalidateSize(true);
                                        }
                                    } catch (e) {
                                        console.error('Error in dimension fix:', e);
                                    }
                                })();
                            """.trimIndent(), null)
                            
                            // Additional invalidateSize calls after delays
                            Handler(Looper.getMainLooper()).postDelayed({
                                try {
                                    val checkViewTag = view?.tag as? Int
                                    if (checkViewTag != null && webViewMap.containsKey(checkViewTag)) {
                                        val checkView = webViewMap[checkViewTag]
                                        if (checkView == view) {
                                            checkView?.evaluateJavascript("if (window.map) { window.map.invalidateSize(true); }", null)
                                        }
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e("NativeMapView", "Error in invalidateSize delay 200ms: ${e.message}")
                                }
                            }, 200)
                            
                            Handler(Looper.getMainLooper()).postDelayed({
                                try {
                                    val checkViewTag = view?.tag as? Int
                                    if (checkViewTag != null && webViewMap.containsKey(checkViewTag)) {
                                        val checkView = webViewMap[checkViewTag]
                                        if (checkView == view) {
                                            checkView?.evaluateJavascript("if (window.map) { window.map.invalidateSize(true); }", null)
                                        }
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e("NativeMapView", "Error in invalidateSize delay 400ms: ${e.message}")
                                }
                            }, 400)
                        } catch (e: Exception) {
                            android.util.Log.e("NativeMapView", "Error in onPageFinished post: ${e.message}", e)
                        }
                    }
                } catch (e: Exception) {
                    android.util.Log.e("NativeMapView", "Error posting to view: ${e.message}", e)
                }
            }
        }
        
        val htmlContent = getMapHtmlContent()
        webView.loadDataWithBaseURL("https://unpkg.com/", htmlContent, "text/html", "UTF-8", null)
        
        return webView
    }
    
    override fun onAfterUpdateTransaction(view: WebView) {
        super.onAfterUpdateTransaction(view)
        view.requestLayout()
        
        // Invalidate map size after layout update
        val viewTag = view.tag as? Int
        if (viewTag != null && webViewMap.containsKey(viewTag)) {
            view.post {
                if (view != null && webViewMap.containsKey(viewTag)) {
                    try {
                        view.evaluateJavascript("""
                            (function() {
                                var mapDiv = document.getElementById('map');
                                if (mapDiv && mapDiv.offsetWidth > 0 && mapDiv.offsetHeight > 0) {
                                    mapDiv.style.width = mapDiv.offsetWidth + 'px';
                                    mapDiv.style.height = mapDiv.offsetHeight + 'px';
                                }
                                if (window.map) {
                                    window.map.invalidateSize(true);
                                }
                            })();
                        """.trimIndent(), null)
                    } catch (e: Exception) {
                        // View might be destroyed, ignore error
                        android.util.Log.d("NativeMapView", "Error in onAfterUpdateTransaction: ${e.message}")
                    }
                }
            }
        }
    }
    
    private fun getMapHtmlContent(): String {
        return """
            <!DOCTYPE html>
            <html>
            <head>
                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                <meta http-equiv="Content-Security-Policy" content="default-src * 'unsafe-inline' 'unsafe-eval'; script-src * 'unsafe-inline' 'unsafe-eval'; connect-src *; img-src * data: blob:; style-src * 'unsafe-inline';">
                <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
                <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
                <style>
                    * { margin: 0; padding: 0; box-sizing: border-box; }
                    html, body { 
                        width: 100%; 
                        height: 100%; 
                        overflow: hidden; 
                        position: relative;
                    }
                    #map { 
                        width: 100%; 
                        height: 100%; 
                        position: absolute;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
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
                </style>
            </head>
            <body>
                <div class="loading" id="loading">Loading map...</div>
                <div id="map"></div>
                <script>
                    var map = null;
                    var currentMarker = null;
                    var destinationMarker = null;
                    var routePolyline = null;
                    
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
                                var loadingEl = document.getElementById('loading');
                                if (loadingEl) loadingEl.textContent = 'Error: Map library failed to load';
                                return;
                            }
                            
                            var mapDiv = document.getElementById('map');
                            if (!mapDiv) {
                                setTimeout(initMap, 100);
                                return;
                            }
                            
                            // Set dimensions
                            var width = window.innerWidth || document.documentElement.clientWidth || screen.width;
                            var height = window.innerHeight || document.documentElement.clientHeight || screen.height;
                            
                            mapDiv.style.width = width + 'px';
                            mapDiv.style.height = height + 'px';
                            document.body.style.width = width + 'px';
                            document.body.style.height = height + 'px';
                            document.documentElement.style.width = width + 'px';
                            document.documentElement.style.height = height + 'px';
                            
                            // Initialize map
                            map = L.map('map', {
                                zoomControl: true,
                                attributionControl: true,
                                minZoom: 2,
                                maxZoom: 19
                            }).setView([20.5937, 78.9629], 13);
                            
                            // Add tile layer
                            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                                attribution: '© OpenStreetMap contributors',
                                subdomains: ['a', 'b', 'c'],
                                maxZoom: 19
                            }).addTo(map);
                            
                            // Hide loading
                            var loadingEl = document.getElementById('loading');
                            if (loadingEl) loadingEl.style.display = 'none';
                            
                            // Store in window
                            window.map = map;
                            
                            // Invalidate size multiple times to ensure tiles load
                            setTimeout(function() { 
                                if (map) map.invalidateSize(true);
                            }, 100);
                            setTimeout(function() { 
                                if (map) map.invalidateSize(true);
                            }, 300);
                            setTimeout(function() { 
                                if (map) map.invalidateSize(true);
                            }, 500);
                            
                            console.log('Map initialized successfully');
                        } catch (e) {
                            console.error('Map initialization error:', e);
                            var loadingEl = document.getElementById('loading');
                            if (loadingEl) loadingEl.textContent = 'Error: ' + e.message;
                        }
                    }
                    
                    window.updateLocation = function(lat, lng) {
                        if (!map || !window.map) {
                            console.error('Map not initialized');
                            return;
                        }
                        try {
                            // Create or update marker first
                            if (currentMarker) {
                                // Marker exists, just update position
                                currentMarker.setLatLng([lat, lng]);
                            } else {
                                // Create new marker - try truck icon first, fallback to default blue marker
                                try {
                                    currentMarker = L.marker([lat, lng], { icon: truckIcon }).addTo(map);
                                    currentMarker.bindPopup('Current Location');
                                    console.log('Marker created with truck icon');
                                } catch (e1) {
                                    try {
                                        currentMarker = L.marker([lat, lng], { icon: truckIconFallback }).addTo(map);
                                        currentMarker.bindPopup('Current Location');
                                        console.log('Marker created with fallback icon');
                                    } catch (e2) {
                                        // Last resort: use default Leaflet marker
                                        currentMarker = L.marker([lat, lng]).addTo(map);
                                        currentMarker.bindPopup('Current Location');
                                        console.log('Marker created with default icon');
                                    }
                                }
                            }
                            
                            // Center and zoom the map to show the location with a good zoom level
                            // Do this after marker is created to ensure marker is visible
                            map.setView([lat, lng], 15, { animate: true, duration: 0.5 });
                            map.invalidateSize(true);
                            
                            console.log('Location updated: ' + lat + ', ' + lng);
                        } catch (e) {
                            console.error('Error updating location:', e);
                        }
                    };
                    
                    window.drawRoute = function(fromLat, fromLng, toLat, toLng, profile) {
                        if (!map || !window.map) return;
                        
                        try {
                            if (routePolyline) {
                                map.removeLayer(routePolyline);
                                routePolyline = null;
                            }
                            
                            var osrmProfile = profile === 'cycling' ? 'cycling' : (profile === 'walking' ? 'foot' : 'driving');
                            var url = 'https://router.project-osrm.org/route/v1/' + osrmProfile + '/' + 
                                      fromLng + ',' + fromLat + ';' + toLng + ',' + toLat + 
                                      '?overview=full&geometries=geojson';
                            
                            fetch(url)
                                .then(function(response) { return response.json(); })
                                .then(function(data) {
                                    if (!map || !window.map) return; // Check again after async
                                    
                                    if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
                                        var coordinates = data.routes[0].geometry.coordinates;
                                        var latLngs = coordinates.map(function(coord) {
                                            return [coord[1], coord[0]];
                                        });
                                        
                                        routePolyline = L.polyline(latLngs, {
                                            color: '#3388ff',
                                            weight: 5,
                                            opacity: 0.7
                                        }).addTo(map);
                                        
                                        if (!currentMarker) {
                                            // Try truck icon, fallback to blue marker if it fails
                                            try {
                                                currentMarker = L.marker([fromLat, fromLng], { icon: truckIcon }).addTo(map)
                                                    .bindPopup('Current Location');
                                            } catch (e) {
                                                currentMarker = L.marker([fromLat, fromLng], { icon: truckIconFallback }).addTo(map)
                                                    .bindPopup('Current Location');
                                            }
                                        } else {
                                            currentMarker.setLatLng([fromLat, fromLng]);
                                        }
                                        
                                        if (!destinationMarker) {
                                            destinationMarker = L.marker([toLat, toLng]).addTo(map)
                                                .bindPopup('Destination');
                                        }
                                        
                                        map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
                                    }
                                })
                                .catch(function(error) {
                                    console.error('Route error:', error);
                                });
                        } catch (e) {
                            console.error('Error drawing route:', e);
                        }
                    };
                    
                    // Clean up any existing map before initializing
                    if (window.map) {
                        try {
                            window.map.remove();
                            window.map = null;
                        } catch (e) {
                            console.log('Error cleaning up old map:', e);
                        }
                    }
                    
                    // Reset markers and route
                    currentMarker = null;
                    destinationMarker = null;
                    routePolyline = null;
                    
                    // Initialize map when Leaflet is ready
                    if (typeof L !== 'undefined') {
                        // Wait for DOM and dimensions
                        if (document.readyState === 'loading') {
                            document.addEventListener('DOMContentLoaded', function() {
                                setTimeout(initMap, 100);
                            });
                        } else {
                            setTimeout(initMap, 100);
                        }
                    } else {
                        var check = setInterval(function() {
                            if (typeof L !== 'undefined') {
                                clearInterval(check);
                                if (document.readyState === 'loading') {
                                    document.addEventListener('DOMContentLoaded', function() {
                                        setTimeout(initMap, 100);
                                    });
                                } else {
                                    setTimeout(initMap, 100);
                                }
                            }
                        }, 100);
                        setTimeout(function() { 
                            clearInterval(check); 
                            if (typeof L === 'undefined') {
                                var loadingEl = document.getElementById('loading');
                                if (loadingEl) loadingEl.textContent = 'Error: Map library failed to load';
                            }
                        }, 5000);
                    }
                    
                    // Handle window resize
                    window.addEventListener('resize', function() {
                        if (map) {
                            map.invalidateSize(true);
                        }
                    });
                </script>
            </body>
            </html>
        """.trimIndent()
    }
    
    override fun onDropViewInstance(view: WebView) {
        val viewTag = view.tag as? Int
        android.util.Log.d("NativeMapView", "onDropViewInstance: viewTag=$viewTag")
        
        if (viewTag != null) {
            // Remove from map first to prevent any delayed handlers from accessing it
            webViewMap.remove(viewTag)
            android.util.Log.d("NativeMapView", "Removed viewTag $viewTag from webViewMap")
        }
        
        try {
            // Clear WebView state before destroying
            view.clearHistory()
            view.clearCache(true)
            view.loadUrl("about:blank")
            view.onPause()
            view.pauseTimers()
            view.removeAllViews()
            view.destroy()
            android.util.Log.d("NativeMapView", "WebView destroyed successfully")
        } catch (e: Exception) {
            android.util.Log.e("NativeMapView", "Error during WebView cleanup: ${e.message}", e)
        }
        super.onDropViewInstance(view)
    }
    
    // Note: onLocationUpdate and onMapReady are event handlers, not props
    // They are handled through the event system via RCTEventEmitter
    
    override fun getCommandsMap(): Map<String, Int> {
        return mapOf("updateLocation" to 1, "drawRoute" to 2)
    }
    
    override fun receiveCommand(root: WebView, commandId: Int, args: ReadableArray?) {
        val viewTag = root.tag as? Int
        val webView = if (viewTag != null) webViewMap[viewTag] else root
        
        when (commandId) {
            1 -> { // updateLocation
                if (args != null && args.size() >= 2) {
                    val lat = args.getDouble(0)
                    val lng = args.getDouble(1)
                    Handler(Looper.getMainLooper()).post {
                        webView?.evaluateJavascript(
                            "if (window.updateLocation) window.updateLocation($lat, $lng);",
                            null
                        )
                    }
                }
            }
            2 -> { // drawRoute
                if (args != null && args.size() >= 4) {
                    val fromLat = args.getDouble(0)
                    val fromLng = args.getDouble(1)
                    val toLat = args.getDouble(2)
                    val toLng = args.getDouble(3)
                    val profile = if (args.size() >= 5) args.getString(4) else "driving"
                    Handler(Looper.getMainLooper()).post {
                        webView?.evaluateJavascript(
                            "if (window.drawRoute) window.drawRoute($fromLat, $fromLng, $toLat, $toLng, '$profile');",
                            null
                        )
                    }
                }
            }
        }
    }
    
}
