package com.app.scrapmatepartner

import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ResolveInfo
import android.net.Uri
import android.os.Build
import android.util.Log
import androidx.core.content.FileProvider
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.io.File

class UPIPaymentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    private var paymentPromise: Promise? = null
    
    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "UPIPaymentModule"
    }

    @ReactMethod
    fun initiatePayment(sVPA: String, amount: String, promise: Promise) {
        try {
            // Store promise for later use
            paymentPromise = promise
            
            // Transaction ID Generation - exact code from image
            val tsLong = System.currentTimeMillis() / 1000
            val transaction_ref_id = tsLong.toString() + "UPI"
            val sOrderId = tsLong.toString() + "UPI"
            
            Log.e("TR Reference ID==>", transaction_ref_id)
            
            // Build UPI Deep Link - exact code from image
            val myAction = Uri.parse(
                "upi://pay?pa=" + Uri.encode(sVPA) +
                "&pn=" + Uri.encode("Merchant Finance") +
                "&mc=" +
                "&tid=" + Uri.encode(transaction_ref_id) +
                "&tr=" + Uri.encode(transaction_ref_id) +
                "&tn=" + Uri.encode("Pay to Merchant Finance Assets") +
                "&am=" + Uri.encode(amount) +
                "&mam=null" +
                "&cu=INR" +
                "&url=" + Uri.encode("https://mystar.com/orderid=$sOrderId")
            )
            
            // Intent Creation and Launch - exact code from image
            val packageManager = reactApplicationContext.packageManager
            
            // Comment line - if you want to open specific application then you can pass that package name
            // For example if you want to open Bhim app then pass Bhim app package name
            // Intent intent = packageManager.getLaunchIntentForPackage("com.mgs.induspsp");
            
            val intent = Intent()
            if (intent != null) {
                intent.action = Intent.ACTION_VIEW
                intent.data = myAction
                
                // startActivity(intent); // Commented out - using chooser instead
                val chooser = Intent.createChooser(intent, "Pay with...")
                
                val activity = reactApplicationContext.currentActivity
                if (activity != null) {
                    try {
                        // Using Build.VERSION.SDK_INT check - exact code from image
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
                            activity.startActivityForResult(chooser, UPI_PAYMENT_REQUEST_CODE, null)
                        } else {
                            activity.startActivityForResult(chooser, UPI_PAYMENT_REQUEST_CODE)
                        }
                    } catch (e: Exception) {
                        promise.reject("NO_UPI_APP", "No UPI app found. Please install a UPI app like Google Pay, PhonePe, or Paytm.")
                    }
                } else {
                    promise.reject("NO_ACTIVITY", "Activity not available")
                }
            }
        } catch (e: Exception) {
            Log.e("UPI Payment Error", e.message ?: "Failed to initiate payment")
            promise.reject("PAYMENT_ERROR", e.message ?: "Failed to initiate payment")
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        // Note: In React Native ActivityEventListener, there's no super.onActivityResult to call
        // (unlike Activity.onActivityResult in native Android)
        
        try {
            // Logging - exact code from image
            Log.e("UPI RESULT REQUEST CODE-->", requestCode.toString())
            Log.e("UPI RESULT RESULT CODE-->", resultCode.toString())
            Log.e("UPI RESULT DATA-->", data?.toString() ?: "null")
            
            if (requestCode == UPI_PAYMENT_REQUEST_CODE) {
                paymentPromise?.let { promise ->
                    // Result Interpretation - exact code from image
                    // resultCode == -1 means Activity.RESULT_OK (200 Success)
                    if (resultCode == -1) {
                        // 200 Success
                        val result = Arguments.createMap().apply {
                            putString("status", "success")
                            putInt("resultCode", resultCode)
                        }
                        promise.resolve(result)
                    } else {
                        // 400 Failed
                        val result = Arguments.createMap().apply {
                            putString("status", "failed")
                            putInt("resultCode", resultCode)
                            putString("message", "Payment failed")
                        }
                        promise.reject("PAYMENT_FAILED", "Payment failed", result)
                    }
                    paymentPromise = null
                }
            }
        } catch (e: Exception) {
            // Exception Logging - exact code from image
            Log.e("Error in UPI onActivityResult->", e.message ?: "Unknown error")
            paymentPromise?.let { promise ->
                val result = Arguments.createMap().apply {
                    putString("status", "failed")
                    putString("message", e.message ?: "Unknown error")
                }
                promise.reject("PAYMENT_ERROR", e.message ?: "Unknown error", result)
                paymentPromise = null
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        Log.e("UPIPaymentModule", "========================================")
        Log.e("UPIPaymentModule", "onNewIntent called")
        Log.e("UPIPaymentModule", "Intent: ${intent.toString()}")
        Log.e("UPIPaymentModule", "Intent data: ${intent.data?.toString()}")
        Log.e("UPIPaymentModule", "Intent scheme: ${intent.data?.scheme}")
        Log.e("UPIPaymentModule", "Intent query: ${intent.data?.query}")
        
        // Handle deep link intents from UPI apps
        intent.data?.let { uri ->
            Log.e("UPIPaymentModule", "URI scheme: ${uri.scheme}")
            Log.e("UPIPaymentModule", "URI query: ${uri.query}")
            Log.e("UPIPaymentModule", "URI toString: ${uri.toString()}")
            
            if (uri.scheme == "upi" || uri.scheme == "scrapmatepartner") {
                Log.e("UPIPaymentModule", "✅ URI matches UPI callback scheme")
                val response = uri.query ?: uri.toString()
                Log.e("UPIPaymentModule", "Extracted response: $response")
                Log.e("UPIPaymentModule", "Response length: ${response.length}")
                
                if (response.isNotEmpty()) {
                    Log.e("UPIPaymentModule", "✅ Response is not empty, calling handlePaymentResponse")
                    handlePaymentResponse(response)
                } else {
                    Log.e("UPIPaymentModule", "❌ Response is empty")
                }
            } else {
                Log.e("UPIPaymentModule", "❌ URI scheme does not match (upi or scrapmatepartner)")
            }
        } ?: run {
            Log.e("UPIPaymentModule", "❌ Intent data is null")
        }
        Log.e("UPIPaymentModule", "========================================")
    }
  
    // Public method to handle payment response from MainActivity
    fun handlePaymentResponse(response: String) {
        Log.e("UPIPaymentModule", "========================================")
        Log.e("UPIPaymentModule", "handlePaymentResponse called")
        Log.e("UPIPaymentModule", "Response string: $response")
        Log.e("UPIPaymentModule", "Response length: ${response.length}")
        
        try {
            val responseMap = parseUPIResponse(response)
            Log.e("UPIPaymentModule", "Parsed response map: $responseMap")
            val status = responseMap["Status"] ?: responseMap["status"] ?: ""
            Log.e("UPIPaymentModule", "Payment status: $status")
            Log.e("UPIPaymentModule", "Payment promise exists: ${paymentPromise != null}")
            
            paymentPromise?.let { promise ->
                Log.e("UPIPaymentModule", "✅ Payment promise found, creating result map")
                val result = Arguments.createMap().apply {
                    if (status.equals("SUCCESS", ignoreCase = true) || status.equals("success", ignoreCase = true)) {
                        putString("status", "success")
                        putString("transactionId", responseMap["TxnId"] ?: responseMap["txnId"] ?: "")
                        putString("responseCode", responseMap["ResponseCode"] ?: responseMap["responseCode"] ?: "")
                        putString("approvalRefNo", responseMap["ApprovalRefNo"] ?: responseMap["approvalRefNo"] ?: "")
                        putString("transactionRefId", responseMap["TxnRef"] ?: responseMap["txnRef"] ?: "")
                    } else {
                        putString("status", "failed")
                        putString("message", status.ifEmpty { "Payment failed" })
                        putString("responseCode", responseMap["ResponseCode"] ?: responseMap["responseCode"] ?: "")
                    }
                    // Include full response for debugging
                    putString("rawResponse", response)
                }
                
                if (status.equals("SUCCESS", ignoreCase = true) || status.equals("success", ignoreCase = true)) {
                    Log.e("UPIPaymentModule", "✅ Payment successful, resolving promise")
                    promise.resolve(result)
                } else {
                    Log.e("UPIPaymentModule", "❌ Payment failed, rejecting promise")
                    promise.reject("PAYMENT_FAILED", status.ifEmpty { "Payment failed" }, result)
                }
                paymentPromise = null
                Log.e("UPIPaymentModule", "Payment promise cleared")
            } ?: run {
                Log.e("UPIPaymentModule", "⚠️ No payment promise found, sending event only")
            }
            
            // Also send event to JavaScript listeners
            Log.e("UPIPaymentModule", "Sending payment response event to JavaScript")
            sendPaymentResponseEvent(responseMap)
            Log.e("UPIPaymentModule", "✅ Event sent")
        } catch (e: Exception) {
            Log.e("UPIPaymentModule", "❌ Exception in handlePaymentResponse")
            Log.e("UPI Payment Response Error", e.message ?: "Failed to parse response")
            Log.e("UPI Payment Response Error", "Exception: ${e.toString()}")
            paymentPromise?.let { promise ->
                val result = Arguments.createMap().apply {
                    putString("status", "failed")
                    putString("message", e.message ?: "Failed to parse payment response")
                    putString("rawResponse", response)
                }
                promise.reject("PARSE_ERROR", e.message ?: "Failed to parse response", result)
                paymentPromise = null
            }
        }
    }
    
    private fun parseUPIResponse(response: String): Map<String, String> {
        val map = mutableMapOf<String, String>()
        try {
            // UPI response format: key1=value1&key2=value2 or upi://pay?response=key1=value1&key2=value2
            var queryString = response
            
            // Extract query string if it's a full URI
            if (response.contains("?")) {
                queryString = response.substringAfter("?")
            }
            
            // Remove URL encoding and split by &
            val pairs = queryString.split("&")
            for (pair in pairs) {
                val keyValue = pair.split("=", limit = 2)
                if (keyValue.size == 2) {
                    val key = Uri.decode(keyValue[0])
                    val value = Uri.decode(keyValue[1])
                    map[key] = value
                }
            }
        } catch (e: Exception) {
            Log.e("UPI Parse Error", e.message ?: "Failed to parse UPI response")
        }
        return map
    }
    
    private fun sendPaymentResponseEvent(responseMap: Map<String, String>) {
        Log.e("UPIPaymentModule", "sendPaymentResponseEvent called")
        Log.e("UPIPaymentModule", "Response map: $responseMap")
        try {
            val status = responseMap["Status"] ?: responseMap["status"] ?: ""
            Log.e("UPIPaymentModule", "Event status: $status")
            val params = Arguments.createMap().apply {
                putString("status", if (status.equals("SUCCESS", ignoreCase = true) || status.equals("success", ignoreCase = true)) "success" else "failed")
                putString("transactionId", responseMap["TxnId"] ?: responseMap["txnId"] ?: "")
                putString("responseCode", responseMap["ResponseCode"] ?: responseMap["responseCode"] ?: "")
                putString("approvalRefNo", responseMap["ApprovalRefNo"] ?: responseMap["approvalRefNo"] ?: "")
                putString("message", status.ifEmpty { "Payment completed" })
                putString("rawResponse", responseMap.toString())
            }
            
            Log.e("UPIPaymentModule", "Emitting UPIPaymentResponse event to JavaScript")
            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("UPIPaymentResponse", params)
            Log.e("UPIPaymentModule", "✅ Event emitted successfully")
        } catch (e: Exception) {
            Log.e("UPIPaymentModule", "❌ Exception in sendPaymentResponseEvent")
            Log.e("UPI Event Error", e.message ?: "Failed to send payment event")
            Log.e("UPI Event Error", "Exception: ${e.toString()}")
            e.printStackTrace()
        }
    }

    /**
     * Open QR code image in UPI apps only
     * Filters the app chooser to show only UPI apps by creating individual intents for each UPI app
     */
    @ReactMethod
    fun openQRCodeInUPIApps(filePath: String, promise: Promise) {
        try {
            Log.d("UPI QR Share", "Opening QR code in UPI apps: $filePath")
            
            val activity = reactApplicationContext.currentActivity
            if (activity == null) {
                Log.e("UPI QR Share", "Activity not available")
                promise.reject("NO_ACTIVITY", "Activity not available")
                return
            }

            val file = File(filePath)
            if (!file.exists()) {
                Log.e("UPI QR Share", "File not found: $filePath")
                promise.reject("FILE_NOT_FOUND", "QR code file not found: $filePath")
                return
            }
            
            Log.d("UPI QR Share", "File exists, size: ${file.length()} bytes")

            // Get file URI - try FileProvider first, fallback to file URI
            val fileUri: Uri = try {
                val authority = "${reactApplicationContext.packageName}.fileprovider"
                FileProvider.getUriForFile(reactApplicationContext, authority, file)
            } catch (e: Exception) {
                // Fallback to file URI for older Android versions
                Uri.fromFile(file)
            }

            val packageManager = reactApplicationContext.packageManager

            // Find all apps that can handle UPI URLs
            val upiIntent = Intent(Intent.ACTION_VIEW, Uri.parse("upi://pay"))
            val upiApps: List<ResolveInfo> = packageManager.queryIntentActivities(upiIntent, PackageManager.MATCH_DEFAULT_ONLY)

            Log.d("UPI QR Share", "Found ${upiApps.size} UPI apps")
            
            if (upiApps.isEmpty()) {
                Log.e("UPI QR Share", "No UPI apps found")
                promise.reject("NO_UPI_APP", "No UPI app found. Please install a UPI app like Google Pay, PhonePe, or Paytm.")
                return
            }

            // Get all UPI app package names
            val upiPackageNames = upiApps.mapNotNull { it.activityInfo?.packageName }.toSet()
            Log.d("UPI QR Share", "UPI app packages: ${upiPackageNames.joinToString(", ")}")

            // Create individual intents for each UPI app
            // Try to create intents targeting each UPI app specifically
            val intentList = ArrayList<Intent>()
            
            for (resolveInfo in upiApps) {
                val packageName = resolveInfo.activityInfo?.packageName
                if (packageName != null) {
                    try {
                        // Create intent targeting this specific UPI app
                        val appIntent = Intent(Intent.ACTION_SEND).apply {
                            type = "image/png"
                            putExtra(Intent.EXTRA_STREAM, fileUri)
                            setPackage(packageName)  // Target specific app
                            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                        }
                        
                        // Add the intent for this UPI app
                        // Android's chooser will automatically filter out apps that can't handle it
                        // But by including all UPI apps, we ensure maximum compatibility
                        intentList.add(appIntent)
                        Log.d("UPI QR Share", "Added intent for: $packageName")
                    } catch (e: Exception) {
                        Log.w("UPI QR Share", "Error creating intent for $packageName: ${e.message}")
                    }
                }
            }
            
            // If no intents were created, create a general share intent
            if (intentList.isEmpty()) {
                Log.w("UPI QR Share", "No intents created, using general share intent")
                val generalShareIntent = Intent(Intent.ACTION_SEND).apply {
                    type = "image/png"
                    putExtra(Intent.EXTRA_STREAM, fileUri)
                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                }
                intentList.add(generalShareIntent)
            }
            
            Log.d("UPI QR Share", "Created ${intentList.size} intents for ${upiPackageNames.size} UPI apps")

            // Create chooser with only UPI apps
            val chooserIntent = Intent.createChooser(intentList[0], "Share QR Code with UPI App")
            if (intentList.size > 1) {
                chooserIntent.putExtra(Intent.EXTRA_INITIAL_INTENTS, intentList.subList(1, intentList.size).toTypedArray())
            }

            Log.d("UPI QR Share", "Starting chooser with ${intentList.size} UPI apps")
            activity.startActivity(chooserIntent)
            Log.d("UPI QR Share", "Chooser started successfully")
            promise.resolve(true)
        } catch (e: Exception) {
            Log.e("UPI QR Code Share Error", e.message ?: "Failed to share QR code", e)
            promise.reject("SHARE_ERROR", e.message ?: "Failed to share QR code with UPI apps")
        }
    }

    companion object {
        private const val UPI_PAYMENT_REQUEST_CODE = 1 // Using 1 as in the image code
    }
}

