package com.app.scrapmatepartner

import android.app.Activity
import android.graphics.Rect
import android.view.View
import android.view.ViewTreeObserver
import android.view.WindowManager
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.LifecycleEventListener
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule

class KeyboardControllerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext), LifecycleEventListener {

    private var keyboardVisible = false
    private var keyboardHeight = 0
    private var rootView: View? = null
    private var globalLayoutListener: ViewTreeObserver.OnGlobalLayoutListener? = null

    init {
        reactContext.addLifecycleEventListener(this)
    }

    override fun getName(): String {
        return "KeyboardControllerModule"
    }

    override fun onHostResume() {
        setupKeyboardListener()
    }

    override fun onHostPause() {
        removeKeyboardListener()
    }

    override fun onHostDestroy() {
        removeKeyboardListener()
    }

    private fun setupKeyboardListener() {
        val activity = reactApplicationContext.currentActivity ?: return
        
        // Remove existing listener first to avoid duplicates
        removeKeyboardListener()
        
        android.os.Handler(android.os.Looper.getMainLooper()).post {
            try {
                rootView = activity.window.decorView.rootView
                
                rootView?.viewTreeObserver?.let { observer ->
                    globalLayoutListener = ViewTreeObserver.OnGlobalLayoutListener {
                        try {
                            val rect = Rect()
                            rootView?.getWindowVisibleDisplayFrame(rect)
                            val screenHeight = rootView?.height ?: 0
                            val keypadHeight = screenHeight - rect.bottom

                            val wasVisible = keyboardVisible
                            keyboardVisible = keypadHeight > screenHeight * 0.15 // Threshold for keyboard visibility
                            keyboardHeight = if (keyboardVisible) keypadHeight else 0

                            if (wasVisible != keyboardVisible) {
                                sendKeyboardEvent(keyboardVisible, keyboardHeight)
                            }
                        } catch (e: Exception) {
                            android.util.Log.e("KeyboardController", "Error in keyboard listener: ${e.message}")
                        }
                    }
                    
                    globalLayoutListener?.let { listener ->
                        if (observer.isAlive) {
                            observer.addOnGlobalLayoutListener(listener)
                        }
                    }
                }
            } catch (e: Exception) {
                android.util.Log.e("KeyboardController", "Error setting up keyboard listener: ${e.message}")
            }
        }
    }

    private fun removeKeyboardListener() {
        try {
            rootView?.viewTreeObserver?.let { observer ->
                if (observer.isAlive && globalLayoutListener != null) {
                    globalLayoutListener?.let { listener ->
                        observer.removeOnGlobalLayoutListener(listener)
                    }
                }
            }
        } catch (e: Exception) {
            android.util.Log.e("KeyboardController", "Error removing keyboard listener: ${e.message}")
        } finally {
            globalLayoutListener = null
            rootView = null
        }
    }

    private fun sendKeyboardEvent(isVisible: Boolean, height: Int) {
        try {
            val params: WritableMap = Arguments.createMap()
            params.putBoolean("visible", isVisible)
            params.putInt("height", height)

            reactApplicationContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                .emit("keyboardDidChangeFrame", params)
        } catch (e: Exception) {
            android.util.Log.e("KeyboardController", "Error sending keyboard event: ${e.message}")
        }
    }

    @ReactMethod
    fun dismissKeyboard(promise: com.facebook.react.bridge.Promise) {
        val activity = reactApplicationContext.currentActivity
        if (activity != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                try {
                    val view = activity.currentFocus
                    view?.clearFocus()
                    val imm = activity.getSystemService(Activity.INPUT_METHOD_SERVICE) as android.view.inputmethod.InputMethodManager
                    val windowToken = view?.windowToken ?: activity.window.decorView.windowToken
                    imm.hideSoftInputFromWindow(windowToken, 0)
                    promise.resolve(true)
                } catch (e: Exception) {
                    android.util.Log.e("KeyboardController", "Error dismissing keyboard: ${e.message}")
                    promise.reject("DISMISS_ERROR", "Failed to dismiss keyboard: ${e.message}")
                }
            }
        } else {
            promise.reject("NO_ACTIVITY", "No current activity")
        }
    }

    @ReactMethod
    fun setEnabled(enabled: Boolean) {
        val activity = reactApplicationContext.currentActivity
        if (activity != null) {
            android.os.Handler(android.os.Looper.getMainLooper()).post {
                try {
                    if (enabled) {
                        activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE)
                    } else {
                        activity.window.setSoftInputMode(WindowManager.LayoutParams.SOFT_INPUT_ADJUST_NOTHING)
                    }
                } catch (e: Exception) {
                    android.util.Log.e("KeyboardController", "Error setting keyboard enabled: ${e.message}")
                }
            }
        }
    }
}



