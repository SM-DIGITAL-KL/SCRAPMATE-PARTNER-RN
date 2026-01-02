package com.app.scrapmatepartner

import android.content.Context
import android.content.res.Configuration
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowManager
import android.content.Intent
import android.net.Uri
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.ReactInstanceManager
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "ScrapmatePartner"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null) // Call super.onCreate(null) to avoid issues with saved instance state
    
    // Read theme preference from AsyncStorage and set background to match splash screen
    val themeName = getStoredTheme()
    
    // Determine background color based on theme
    val backgroundColor: Int
    val isDarkTheme: Boolean
    
    when (themeName) {
      "dark", "darkGreen" -> {
        // Dark themes: black background (#000000)
        backgroundColor = 0xFF000000.toInt()
        isDarkTheme = true
      }
      "whitePurple" -> {
        // White purple theme: white background (#FFFFFF)
        backgroundColor = 0xFFFFFFFF.toInt()
        isDarkTheme = false
      }
      "light" -> {
        // Light theme: light green background (#F6FFF6)
        backgroundColor = 0xFF6FFF6.toInt()
        isDarkTheme = false
      }
      null -> {
        // Default to darkGreen (forest night) theme: black background (#000000)
        backgroundColor = 0xFF000000.toInt()
        isDarkTheme = true
      }
      else -> {
        // Default to darkGreen (forest night) theme: black background (#000000)
        backgroundColor = 0xFF000000.toInt()
        isDarkTheme = true
      }
    }
    
    // Set status bar and navigation bar colors to match theme
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
      val window = window
      window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS)
      
      window.statusBarColor = backgroundColor
      window.navigationBarColor = backgroundColor
      
      if (isDarkTheme) {
        // Light content for dark background
        window.decorView.systemUiVisibility = window.decorView.systemUiVisibility and View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR.inv()
      } else {
        // Dark content for light background
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
          window.decorView.systemUiVisibility = window.decorView.systemUiVisibility or View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR
        }
      }
    }
    
    // Set window background color to prevent flash
    window.setBackgroundDrawableResource(android.R.color.transparent)
    window.decorView.setBackgroundColor(backgroundColor)
  }
  
  private fun getStoredTheme(): String? {
    return try {
      // AsyncStorage uses SQLite database
      // Try both database names (old: RKStorage, new: AsyncStorage)
      val databaseNames = listOf("RKStorage", "AsyncStorage")
      
      for (dbName in databaseNames) {
        try {
          val dbPath = getDatabasePath(dbName)
          if (!dbPath.exists()) {
            continue
          }
          
          val db = SQLiteDatabase.openDatabase(
            dbPath.absolutePath,
            null,
            SQLiteDatabase.OPEN_READONLY
          )
          
          try {
            // Query the catalystLocalStorage table
            val cursor: Cursor = db.query(
              "catalystLocalStorage",
              arrayOf("value"),
              "key = ?",
              arrayOf("@app_theme"),
              null,
              null,
              null
            )
            
            if (cursor.moveToFirst()) {
              val themeValue = cursor.getString(0)
              cursor.close()
              db.close()
              
              // AsyncStorage stores string values as JSON strings (with quotes)
              // Remove quotes and whitespace
              val cleaned = themeValue.trim('"', '\'', ' ', '\n', '\t')
              
              // If it looks like JSON string, extract the value
              if (cleaned.startsWith("\"") && cleaned.endsWith("\"")) {
                return cleaned.substring(1, cleaned.length - 1)
              }
              
              return cleaned
            }
            
            cursor.close()
          } finally {
            db.close()
          }
        } catch (e: SQLiteException) {
          // Database might be locked or doesn't exist yet
        } catch (e: Exception) {
          // Ignore errors
        }
      }
      
      null
    } catch (e: Exception) {
      null
    }
  }
  
  // Handle deep links from UPI apps
  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    setIntent(intent)
    
    android.util.Log.e("MainActivity", "========================================")
    android.util.Log.e("MainActivity", "onNewIntent called")
    android.util.Log.e("MainActivity", "Intent: ${intent?.toString()}")
    android.util.Log.e("MainActivity", "Intent data: ${intent?.data?.toString()}")
    android.util.Log.e("MainActivity", "Intent scheme: ${intent?.data?.scheme}")
    android.util.Log.e("MainActivity", "Intent query: ${intent?.data?.query}")
    
    checkAndHandleUPIIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    android.util.Log.e("MainActivity", "========================================")
    android.util.Log.e("MainActivity", "onResume called")
    android.util.Log.e("MainActivity", "Checking current intent for UPI callback")
    
    // Check current intent when app resumes (in case onNewIntent wasn't called)
    val currentIntent = intent
    checkAndHandleUPIIntent(currentIntent)
  }

  private fun checkAndHandleUPIIntent(intent: Intent?) {
    android.util.Log.e("MainActivity", "checkAndHandleUPIIntent called")
    android.util.Log.e("MainActivity", "Intent: ${intent?.toString()}")
    android.util.Log.e("MainActivity", "Intent data: ${intent?.data?.toString()}")
    android.util.Log.e("MainActivity", "Intent scheme: ${intent?.data?.scheme}")
    android.util.Log.e("MainActivity", "Intent query: ${intent?.data?.query}")
    
    // Check if this is a UPI payment response
    intent?.data?.let { uri ->
      android.util.Log.e("MainActivity", "URI scheme: ${uri.scheme}")
      android.util.Log.e("MainActivity", "URI query: ${uri.query}")
      android.util.Log.e("MainActivity", "URI toString: ${uri.toString()}")
      
      if (uri.scheme == "upi" || uri.scheme == "scrapmatepartner") {
        android.util.Log.e("MainActivity", "✅ URI matches UPI callback scheme")
        // Extract response from URI
        val response = uri.query ?: uri.toString()
        android.util.Log.e("MainActivity", "Extracted response: $response")
        android.util.Log.e("MainActivity", "Response length: ${response.length}")
        
        if (response.isNotEmpty()) {
          android.util.Log.e("MainActivity", "✅ Response is not empty, getting React Native context")
          // Get React Native context and module
          val reactContext = reactInstanceManager?.currentReactContext
          if (reactContext != null) {
            android.util.Log.e("MainActivity", "✅ React Native context found")
            val module = reactContext.getNativeModule(UPIPaymentModule::class.java)
            if (module != null) {
              android.util.Log.e("MainActivity", "✅ UPIPaymentModule found, calling handlePaymentResponse")
              module.handlePaymentResponse(response)
              // Clear the intent data after handling to avoid processing it again
              intent.data = null
            } else {
              android.util.Log.e("MainActivity", "❌ UPIPaymentModule not found")
            }
          } else {
            android.util.Log.e("MainActivity", "❌ React Native context is null")
          }
        } else {
          android.util.Log.e("MainActivity", "❌ Response is empty")
        }
      } else {
        android.util.Log.e("MainActivity", "❌ URI scheme does not match (upi or scrapmatepartner), scheme: ${uri.scheme}")
      }
    } ?: run {
      android.util.Log.e("MainActivity", "❌ Intent data is null")
    }
    android.util.Log.e("MainActivity", "========================================")
  }

}
