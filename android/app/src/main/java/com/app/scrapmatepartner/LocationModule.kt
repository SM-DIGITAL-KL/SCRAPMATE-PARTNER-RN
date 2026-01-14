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
import androidx.core.app.ActivityCompat
import java.net.HttpURLConnection
import java.net.URL
import java.io.BufferedReader
import java.io.InputStreamReader
import org.json.JSONObject
import org.json.JSONException
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise

class LocationModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    private val locationManager: LocationManager = reactContext.getSystemService(Context.LOCATION_SERVICE) as LocationManager
    private var currentLocation: Location? = null
    private var locationListener: LocationListener? = null
    
    override fun getName(): String {
        return "LocationModule"
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
    fun getCurrentLocation(promise: Promise) {
        android.util.Log.d("LocationModule", "getCurrentLocation: Called")
        try {
            // Ensure location updates are started
            if (ActivityCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.ACCESS_FINE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED ||
                ActivityCompat.checkSelfPermission(
                    reactApplicationContext,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ) == PackageManager.PERMISSION_GRANTED
            ) {
                // Start location updates if not already started
                if (locationListener == null) {
                    startLocationUpdates()
                }
            }

            if (currentLocation != null) {
                android.util.Log.d("LocationModule", "getCurrentLocation: Location available - lat=${currentLocation!!.latitude}, lng=${currentLocation!!.longitude}")
                try {
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
                    android.util.Log.d("LocationModule", "getCurrentLocation: Resolving promise with location")
                    promise.resolve(locationMap)
                    android.util.Log.d("LocationModule", "getCurrentLocation: Promise resolved successfully")
                } catch (e: Exception) {
                    android.util.Log.e("LocationModule", "getCurrentLocation: Error creating location map: ${e.javaClass.simpleName} - ${e.message}", e)
                    e.printStackTrace()
                    promise.reject("ERROR", "Error creating location map: ${e.message}", e)
                } catch (e: Throwable) {
                    android.util.Log.e("LocationModule", "getCurrentLocation: CRASH PREVENTED - Throwable: ${e.javaClass.simpleName} - ${e.message}", e)
                    e.printStackTrace()
                    promise.reject("ERROR", "Error creating location map: ${e.message}", e)
                }
            } else {
                android.util.Log.w("LocationModule", "getCurrentLocation: Location not available, trying last known location")
                // Try to get last known location as fallback
                try {
                    if (ActivityCompat.checkSelfPermission(
                            reactApplicationContext,
                            Manifest.permission.ACCESS_FINE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED ||
                        ActivityCompat.checkSelfPermission(
                            reactApplicationContext,
                            Manifest.permission.ACCESS_COARSE_LOCATION
                        ) == PackageManager.PERMISSION_GRANTED
                    ) {
                        val lastKnownLocation = locationManager.getLastKnownLocation(LocationManager.GPS_PROVIDER)
                            ?: locationManager.getLastKnownLocation(LocationManager.NETWORK_PROVIDER)
                        
                        if (lastKnownLocation != null) {
                            android.util.Log.d("LocationModule", "getCurrentLocation: Using last known location - lat=${lastKnownLocation.latitude}, lng=${lastKnownLocation.longitude}")
                            currentLocation = lastKnownLocation
                            val locationMap = Arguments.createMap()
                            locationMap.putDouble("latitude", lastKnownLocation.latitude)
                            locationMap.putDouble("longitude", lastKnownLocation.longitude)
                            locationMap.putDouble("accuracy", lastKnownLocation.accuracy.toDouble())
                            locationMap.putDouble("timestamp", lastKnownLocation.time.toDouble())
                            if (lastKnownLocation.hasBearing()) {
                                locationMap.putDouble("heading", lastKnownLocation.bearing.toDouble())
                            } else {
                                locationMap.putDouble("heading", 0.0)
                            }
                            promise.resolve(locationMap)
                            return
                        }
                    }
                } catch (e: SecurityException) {
                    android.util.Log.w("LocationModule", "getCurrentLocation: SecurityException getting last known location: ${e.message}")
                } catch (e: Exception) {
                    android.util.Log.w("LocationModule", "getCurrentLocation: Exception getting last known location: ${e.message}")
                }
                
                android.util.Log.w("LocationModule", "getCurrentLocation: Location not available")
                promise.reject("NO_LOCATION", "Location not available. Please ensure location services are enabled and try again.")
            }
        } catch (e: Exception) {
            android.util.Log.e("LocationModule", "getCurrentLocation: Exception: ${e.javaClass.simpleName} - ${e.message}", e)
            e.printStackTrace()
            promise.reject("ERROR", "Error getting location: ${e.message}", e)
        } catch (e: Throwable) {
            android.util.Log.e("LocationModule", "getCurrentLocation: CRASH PREVENTED - Throwable: ${e.javaClass.simpleName} - ${e.message}", e)
            e.printStackTrace()
            promise.reject("ERROR", "Error getting location: ${e.message}", e)
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
                        
                        // Build a complete address string with all components
                        val addressParts = mutableListOf<String>()
                        
                        // Road/Street (e.g., "Enathu - Ezhamkulam road")
                        if (address.optString("road", "").isNotEmpty()) {
                            addressParts.add(address.optString("road"))
                        }
                        
                        // Village/Town/City (e.g., "Parakode")
                        if (address.optString("village", "").isNotEmpty()) {
                            addressParts.add(address.optString("village"))
                        } else if (address.optString("town", "").isNotEmpty()) {
                            addressParts.add(address.optString("town"))
                        } else if (address.optString("city", "").isNotEmpty()) {
                            addressParts.add(address.optString("city"))
                        }
                        
                        // State (e.g., "Kerala")
                        if (address.optString("state", "").isNotEmpty()) {
                            addressParts.add(address.optString("state"))
                        }
                        
                        // Postcode (e.g., "691526")
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
                android.util.Log.e("LocationModule", "Error getting address: ${e.message}", e)
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
    
    @ReactMethod
    fun requestBackgroundLocationPermission(promise: Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity")
            return
        }
        
        // Check if foreground location permissions are granted first
        val fineLocationGranted = ActivityCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        val coarseLocationGranted = ActivityCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        if (!fineLocationGranted && !coarseLocationGranted) {
            promise.reject("FOREGROUND_PERMISSION_REQUIRED", "Foreground location permission must be granted first")
            return
        }
        
        // Check if background location is already granted
        val backgroundLocationGranted = ActivityCompat.checkSelfPermission(
            reactApplicationContext,
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
        
        if (backgroundLocationGranted) {
            promise.resolve(true)
            return
        }
        
        // Request background location permission
        // Note: This should only be called after showing the prominent disclosure
        val permissions = arrayOf(
            Manifest.permission.ACCESS_BACKGROUND_LOCATION
        )
        ActivityCompat.requestPermissions(activity as android.app.Activity, permissions, 101)
        promise.resolve(false)
    }
}

