package com.app.scrapmatepartner

import android.content.Context
import android.view.GestureDetector
import android.view.MotionEvent
import android.view.View
import android.view.ViewGroup
import android.widget.FrameLayout
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewGroupManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter

class NativeGestureHandlerView(context: ThemedReactContext) : FrameLayout(context) {
    private var enablePanGesture = false
    private var enableTapGesture = false
    private var enableLongPressGesture = false
    private var lastX = 0f
    private var lastY = 0f
    
    private val gestureDetector = GestureDetector(context, object : GestureDetector.SimpleOnGestureListener() {
        override fun onSingleTapUp(e: MotionEvent): Boolean {
            if (enableTapGesture) {
                sendGestureEvent("tap", e.x, e.y, 0f, 0f, 0)
                return true
            }
            return false
        }
        
        override fun onLongPress(e: MotionEvent) {
            if (enableLongPressGesture) {
                sendGestureEvent("longPress", e.x, e.y, 0f, 0f, 1)
            }
        }
    })
    
    override fun onTouchEvent(event: MotionEvent): Boolean {
        if (enablePanGesture) {
            when (event.action) {
                MotionEvent.ACTION_DOWN -> {
                    lastX = event.x
                    lastY = event.y
                    sendGestureEvent("pan", event.x, event.y, 0f, 0f, 0)
                    return true
                }
                MotionEvent.ACTION_MOVE -> {
                    val translationX = event.x - lastX
                    val translationY = event.y - lastY
                    val velocityX = event.x - lastX
                    val velocityY = event.y - lastY
                    sendGestureEvent("pan", event.x, event.y, translationX, translationY, 2)
                    lastX = event.x
                    lastY = event.y
                    return true
                }
                MotionEvent.ACTION_UP -> {
                    val translationX = event.x - lastX
                    val translationY = event.y - lastY
                    sendGestureEvent("pan", event.x, event.y, translationX, translationY, 3)
                    return true
                }
            }
        }
        
        if (enableTapGesture || enableLongPressGesture) {
            return gestureDetector.onTouchEvent(event) || super.onTouchEvent(event)
        }
        
        return super.onTouchEvent(event)
    }
    
    private fun sendGestureEvent(
        type: String,
        x: Float,
        y: Float,
        translationX: Float,
        translationY: Float,
        state: Int
    ) {
        val event = Arguments.createMap()
        event.putString("type", type)
        event.putInt("state", state)
        event.putDouble("x", x.toDouble())
        event.putDouble("y", y.toDouble())
        event.putDouble("translationX", translationX.toDouble())
        event.putDouble("translationY", translationY.toDouble())
        
        val reactContext = context as? ReactApplicationContext
        reactContext?.let {
            val viewTag = id
            it.getJSModule(RCTEventEmitter::class.java)
                .receiveEvent(viewTag, "onGestureEvent", event)
        }
    }
    
    fun setEnablePanGesture(enabled: Boolean) {
        enablePanGesture = enabled
    }
    
    fun setEnableTapGesture(enabled: Boolean) {
        enableTapGesture = enabled
    }
    
    fun setEnableLongPressGesture(enabled: Boolean) {
        enableLongPressGesture = enabled
    }
}

class NativeGestureHandlerViewManager(reactApplicationContext: ReactApplicationContext) :
    ViewGroupManager<NativeGestureHandlerView>() {

    override fun getName(): String {
        return "NativeGestureHandlerView"
    }

    override fun createViewInstance(reactContext: ThemedReactContext): NativeGestureHandlerView {
        return NativeGestureHandlerView(reactContext)
    }

    @ReactProp(name = "enablePanGesture")
    fun setEnablePanGesture(view: NativeGestureHandlerView, enabled: Boolean) {
        view.setEnablePanGesture(enabled)
    }

    @ReactProp(name = "enableTapGesture")
    fun setEnableTapGesture(view: NativeGestureHandlerView, enabled: Boolean) {
        view.setEnableTapGesture(enabled)
    }

    @ReactProp(name = "enableLongPressGesture")
    fun setEnableLongPressGesture(view: NativeGestureHandlerView, enabled: Boolean) {
        view.setEnableLongPressGesture(enabled)
    }
}



