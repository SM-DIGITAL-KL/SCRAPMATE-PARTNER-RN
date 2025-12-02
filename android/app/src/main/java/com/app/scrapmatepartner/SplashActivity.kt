package com.app.scrapmatepartner

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteException
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.view.WindowManager
import com.app.scrapmatepartner.R
import com.app.scrapmatepartner.MainActivity

class SplashActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.splash_screen)
        
        // Read theme preference from AsyncStorage (stored in SharedPreferences)
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
        
        // Update layout background color programmatically
        // The layout is loaded via setContentView, so we can find it by ID
        try {
            val rootLayout = findViewById<android.widget.RelativeLayout>(R.id.splash_root_layout)
            rootLayout?.setBackgroundColor(backgroundColor)
        } catch (e: Exception) {
            // Fallback: set background on the content view
            val contentView = window.decorView.findViewById<android.view.View>(android.R.id.content)
            contentView?.setBackgroundColor(backgroundColor)
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
        
        // Wait 2 seconds then navigate to MainActivity
        Handler(Looper.getMainLooper()).postDelayed({
            val intent = Intent(this, MainActivity::class.java)
            startActivity(intent)
            finish()
        }, 2000)
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
                            
                            android.util.Log.d("SplashActivity", "Found theme in $dbName: $themeValue")
                            
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
                    android.util.Log.e("SplashActivity", "Error reading $dbName: ${e.message}")
                } catch (e: Exception) {
                    android.util.Log.e("SplashActivity", "Error accessing $dbName: ${e.message}")
                }
            }
            
            android.util.Log.d("SplashActivity", "No theme found in database, using default")
            null
        } catch (e: Exception) {
            android.util.Log.e("SplashActivity", "Error in getStoredTheme: ${e.message}")
            null
        }
    }
}

