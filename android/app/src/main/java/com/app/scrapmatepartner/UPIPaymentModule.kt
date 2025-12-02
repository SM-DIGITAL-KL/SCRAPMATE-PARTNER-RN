package com.app.scrapmatepartner

import android.app.Activity
import android.content.Intent
import android.net.Uri
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class UPIPaymentModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext), ActivityEventListener {
    
    private var paymentPromise: Promise? = null
    
    init {
        reactContext.addActivityEventListener(this)
    }

    override fun getName(): String {
        return "UPIPaymentModule"
    }

    @ReactMethod
    fun initiatePayment(upiId: String, amount: String, transactionId: String, merchantName: String, promise: Promise) {
        try {
            // Store promise for later use
            paymentPromise = promise
            
            // Create UPI payment URI
            val uriString = buildString {
                append("upi://pay?")
                append("pa=").append(Uri.encode(upiId))
                append("&pn=").append(Uri.encode(merchantName))
                append("&am=").append(Uri.encode(amount))
                append("&tid=").append(Uri.encode(transactionId))
                append("&tr=").append(Uri.encode(transactionId))
                append("&tn=").append(Uri.encode("Subscription Payment"))
                append("&cu=INR")
            }
            
            val uri = Uri.parse(uriString)
            val intent = Intent(Intent.ACTION_VIEW)
            intent.data = uri
            
            // Check if any UPI app can handle this intent
            val chooser = Intent.createChooser(intent, "Pay with UPI")
            
            val activity = reactApplicationContext.currentActivity
            if (activity != null) {
                try {
                    activity.startActivityForResult(chooser, UPI_PAYMENT_REQUEST_CODE)
                } catch (e: Exception) {
                    promise.reject("NO_UPI_APP", "No UPI app found. Please install a UPI app like Google Pay, PhonePe, or Paytm.")
                }
            } else {
                promise.reject("NO_ACTIVITY", "Activity not available")
            }
        } catch (e: Exception) {
            promise.reject("PAYMENT_ERROR", e.message ?: "Failed to initiate payment")
        }
    }

    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == UPI_PAYMENT_REQUEST_CODE) {
            paymentPromise?.let { promise ->
                when (resultCode) {
                    Activity.RESULT_OK -> {
                        // Payment might be successful, but we need to check the response
                        val response = data?.getStringExtra("response")
                        if (response != null) {
                            // Parse UPI response
                            val responseMap = parseUPIResponse(response)
                            val status = responseMap["Status"] ?: "Unknown"
                            
                            if (status.equals("SUCCESS", ignoreCase = true)) {
                                val result = Arguments.createMap().apply {
                                    putString("status", "success")
                                    putString("transactionId", responseMap["TxnId"])
                                    putString("responseCode", responseMap["ResponseCode"])
                                    putString("approvalRefNo", responseMap["ApprovalRefNo"])
                                }
                                promise.resolve(result)
                            } else {
                                val result = Arguments.createMap().apply {
                                    putString("status", "failed")
                                    putString("message", responseMap["Status"] ?: "Payment failed")
                                }
                                promise.reject("PAYMENT_FAILED", "Payment failed", result)
                            }
                        } else {
                            // No response data, check if payment was cancelled
                            val result = Arguments.createMap().apply {
                                putString("status", "cancelled")
                                putString("message", "Payment was cancelled")
                            }
                            promise.reject("PAYMENT_CANCELLED", "Payment was cancelled", result)
                        }
                    }
                    Activity.RESULT_CANCELED -> {
                        val result = Arguments.createMap().apply {
                            putString("status", "cancelled")
                            putString("message", "Payment was cancelled by user")
                        }
                        promise.reject("PAYMENT_CANCELLED", "Payment was cancelled", result)
                    }
                    else -> {
                        val result = Arguments.createMap().apply {
                            putString("status", "failed")
                            putString("message", "Payment failed")
                        }
                        promise.reject("PAYMENT_FAILED", "Payment failed", result)
                    }
                }
                paymentPromise = null
            }
        }
    }

    private fun parseUPIResponse(response: String): Map<String, String> {
        val map = mutableMapOf<String, String>()
        val pairs = response.split("&")
        for (pair in pairs) {
            val keyValue = pair.split("=", limit = 2)
            if (keyValue.size == 2) {
                map[keyValue[0]] = Uri.decode(keyValue[1])
            }
        }
        return map
    }

    override fun onNewIntent(intent: Intent) {
        // Handle deep link intents from UPI apps
        intent.data?.let { uri ->
            if (uri.scheme == "upi" || uri.scheme == "scrapmatepartner") {
                val response = uri.query ?: uri.toString()
                if (response.isNotEmpty()) {
                    handlePaymentResponse(response)
                }
            }
        }
    }
  
    // Public method to handle payment response from MainActivity
    fun handlePaymentResponse(response: String) {
        paymentPromise?.let { promise ->
            val responseMap = parseUPIResponse(response)
            val status = responseMap["Status"] ?: "Unknown"
            
            if (status.equals("SUCCESS", ignoreCase = true)) {
                val result = Arguments.createMap().apply {
                    putString("status", "success")
                    putString("transactionId", responseMap["TxnId"])
                    putString("responseCode", responseMap["ResponseCode"])
                    putString("approvalRefNo", responseMap["ApprovalRefNo"])
                }
                promise.resolve(result)
            } else {
                val result = Arguments.createMap().apply {
                    putString("status", "failed")
                    putString("message", responseMap["Status"] ?: "Payment failed")
                }
                promise.reject("PAYMENT_FAILED", "Payment failed", result)
            }
            paymentPromise = null
        }
    }

    companion object {
        private const val UPI_PAYMENT_REQUEST_CODE = 1001
    }
}

