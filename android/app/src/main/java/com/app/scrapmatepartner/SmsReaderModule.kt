package com.app.scrapmatepartner

import android.Manifest
import android.content.ContentResolver
import android.content.Context
import android.content.pm.PackageManager
import android.database.Cursor
import android.net.Uri
import android.provider.Telephony
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule

class SmsReaderModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String {
        return "SmsReader"
    }

    /**
     * Check if READ_SMS permission is granted
     */
    @ReactMethod
    fun hasReadSmsPermission(promise: Promise) {
        try {
            val context = reactApplicationContext
            val granted = context.checkSelfPermission(Manifest.permission.READ_SMS) == PackageManager.PERMISSION_GRANTED
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", "Failed to check SMS permission: ${e.message}", e)
        }
    }

    /**
     * Get recent SMS messages
     * @param maxCount Maximum number of messages to retrieve
     * @param minutesAgo How many minutes back to look (default: 5)
     */
    @ReactMethod
    fun getRecentSms(maxCount: Int, minutesAgo: Int, promise: Promise) {
        try {
            val context = reactApplicationContext

            // Check permission
            if (context.checkSelfPermission(Manifest.permission.READ_SMS) != PackageManager.PERMISSION_GRANTED) {
                promise.reject("PERMISSION_DENIED", "READ_SMS permission not granted")
                return
            }

            val contentResolver: ContentResolver = context.contentResolver
            val uri: Uri = Telephony.Sms.Inbox.CONTENT_URI
            
            // Calculate timestamp for filtering
            val currentTime = System.currentTimeMillis()
            val timeThreshold = currentTime - (minutesAgo * 60 * 1000)
            
            // Query SMS inbox, ordered by date descending
            val cursor: Cursor? = contentResolver.query(
                uri,
                arrayOf(
                    Telephony.Sms._ID,
                    Telephony.Sms.ADDRESS,
                    Telephony.Sms.BODY,
                    Telephony.Sms.DATE,
                    Telephony.Sms.DATE_SENT
                ),
                "${Telephony.Sms.DATE} >= ?",
                arrayOf(timeThreshold.toString()),
                "${Telephony.Sms.DATE} DESC LIMIT $maxCount"
            )

            val messages = WritableNativeArray()

            cursor?.use {
                val idIndex = it.getColumnIndex(Telephony.Sms._ID)
                val addressIndex = it.getColumnIndex(Telephony.Sms.ADDRESS)
                val bodyIndex = it.getColumnIndex(Telephony.Sms.BODY)
                val dateIndex = it.getColumnIndex(Telephony.Sms.DATE)
                val dateSentIndex = it.getColumnIndex(Telephony.Sms.DATE_SENT)

                while (it.moveToNext()) {
                    val message = WritableNativeMap()
                    message.putString("id", it.getString(idIndex))
                    message.putString("address", it.getString(addressIndex) ?: "")
                    message.putString("body", it.getString(bodyIndex) ?: "")
                    message.putDouble("date", it.getLong(dateIndex).toDouble())
                    message.putDouble("dateSent", if (dateSentIndex >= 0) it.getLong(dateSentIndex).toDouble() else it.getLong(dateIndex).toDouble())
                    messages.pushMap(message)
                }
            }

            promise.resolve(messages)
        } catch (e: Exception) {
            promise.reject("SMS_READ_ERROR", "Failed to read SMS: ${e.message}", e)
        }
    }

    companion object {
        private const val TAG = "SmsReaderModule"
    }
}

