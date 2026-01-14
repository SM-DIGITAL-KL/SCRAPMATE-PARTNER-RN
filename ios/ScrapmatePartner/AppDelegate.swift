import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import UserNotifications

// FirebaseMessaging will be handled by React Native Firebase module
// We only need FirebaseCore for initialization

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // Initialize Firebase
    FirebaseApp.configure()
    
    // Configure push notifications
    // Note: Firebase Messaging is handled by React Native Firebase module
    UNUserNotificationCenter.current().delegate = self
    let authOptions: UNAuthorizationOptions = [.alert, .badge, .sound]
    UNUserNotificationCenter.current().requestAuthorization(
      options: authOptions,
      completionHandler: { _, _ in }
    )
    application.registerForRemoteNotifications()
    
    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory

    window = UIWindow(frame: UIScreen.main.bounds)
    
    // Read theme preference from UserDefaults (AsyncStorage uses UserDefaults on iOS)
    let themeName = getStoredTheme()
    
    // Determine background color based on theme
    let backgroundColor: UIColor
    let isDarkTheme: Bool
    
    switch themeName {
    case "dark", "darkGreen":
      // Dark themes: black background (#000000)
      backgroundColor = UIColor.black
      isDarkTheme = true
    case "whitePurple":
      // White purple theme: white background (#FFFFFF)
      backgroundColor = UIColor.white
      isDarkTheme = false
    case "light":
      // Light theme: light green background (#F6FFF6)
      backgroundColor = UIColor(red: 0.965, green: 1.0, blue: 0.965, alpha: 1.0)
      isDarkTheme = false
    case nil:
      // Default to darkGreen (forest night) theme: black background (#000000)
      backgroundColor = UIColor.black
      isDarkTheme = true
    default:
      // Default to darkGreen (forest night) theme: black background (#000000)
      backgroundColor = UIColor.black
      isDarkTheme = true
    }
    
    // Set window background color to match theme
    if #available(iOS 13.0, *) {
      if isDarkTheme {
        window?.overrideUserInterfaceStyle = .dark
      } else {
        window?.overrideUserInterfaceStyle = .light
      }
      window?.backgroundColor = backgroundColor
    } else {
      // For iOS < 13, use theme background
      window?.backgroundColor = backgroundColor
      UIApplication.shared.statusBarStyle = isDarkTheme ? .lightContent : .default
    }

    factory.startReactNative(
      withModuleName: "ScrapmatePartner",
      in: window,
      launchOptions: launchOptions
    )

    return true
  }
  
  private func getStoredTheme() -> String? {
    // AsyncStorage on iOS stores data in files in Application Support directory
    // The storage directory is: Application Support/[bundleID]/RCTAsyncLocalStorage_V1
    // Data is stored in manifest.json and individual files
    
    let fileManager = FileManager.default
    
    // Get Application Support directory
    guard let appSupportDir = fileManager.urls(for: .applicationSupportDirectory, in: .userDomainMask).first else {
      return nil
    }
    
    let bundleID = Bundle.main.bundleIdentifier ?? "com.scrapmatebusiness"
    let storageDirs = [
      "RCTAsyncLocalStorage_V1",
      "RNCAsyncLocalStorage_V1",
      "RCTAsyncLocalStorage"
    ]
    
    for storageDir in storageDirs {
      let storagePath = appSupportDir
        .appendingPathComponent(bundleID)
        .appendingPathComponent(storageDir)
      
      // Try to read manifest.json
      let manifestPath = storagePath.appendingPathComponent("manifest.json")
      if fileManager.fileExists(atPath: manifestPath.path) {
        if let manifestData = try? Data(contentsOf: manifestPath),
           let manifest = try? JSONSerialization.jsonObject(with: manifestData) as? [String: Any],
           let themeEntry = manifest["@app_theme"] as? [String: Any] {
          
          // Check if value is inline or in a separate file
          if let inlineValue = themeEntry["value"] as? String {
            return parseAsyncStorageValue(inlineValue)
          } else if let filename = themeEntry["filename"] as? String {
            // Value is in a separate file
            let valuePath = storagePath.appendingPathComponent(filename)
            if let valueData = try? Data(contentsOf: valuePath),
               let value = String(data: valueData, encoding: .utf8) {
              return parseAsyncStorageValue(value)
            }
          }
        }
      }
      
      // Also try reading the key file directly (some versions store keys as files)
      let keyFile = storagePath.appendingPathComponent("@app_theme")
      if fileManager.fileExists(atPath: keyFile.path),
         let valueData = try? Data(contentsOf: keyFile),
         let value = String(data: valueData, encoding: .utf8) {
        return parseAsyncStorageValue(value)
      }
    }
    
    return nil
  }
  
  private func parseAsyncStorageValue(_ value: String) -> String {
    // AsyncStorage stores string values as JSON strings (with quotes)
    // Remove quotes, whitespace, and newlines
    var cleaned = value.trimmingCharacters(in: .whitespacesAndNewlines)
    cleaned = cleaned.trimmingCharacters(in: CharacterSet(charactersIn: "\"'"))
    return cleaned
  }
  
  // Handle URL callbacks from UPI apps
  func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    // Check if this is a UPI payment response
    if url.scheme == "upi" || url.scheme == "scrapmatepartner" {
      // Extract response from URL
      let response = url.query ?? url.absoluteString
      if !response.isEmpty {
        // Post notification to React Native module
        NotificationCenter.default.post(
          name: NSNotification.Name("UPIPaymentResponse"),
          object: nil,
          userInfo: ["response": response]
        )
      }
      return true
    }
    return false
  }
  
  // MARK: - Remote Notifications
  
  func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data) {
    // Pass device token to React Native Firebase module
    // The React Native Firebase module will handle this automatically
    let tokenString = deviceToken.map { String(format: "%02.2hhx", $0) }.joined()
    print("✅ Device token (APNS) registered: \(tokenString)")
    
    // Notify React Native that APNS token is ready
    // This helps ensure FCM token is only requested after APNS token is available
    NotificationCenter.default.post(
      name: NSNotification.Name("APNSTokenRegistered"),
      object: nil,
      userInfo: ["deviceToken": tokenString]
    )
  }
  
  func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) {
    print("❌ Failed to register for remote notifications: \(error.localizedDescription)")
    
    // Notify React Native of the error
    NotificationCenter.default.post(
      name: NSNotification.Name("APNSTokenRegistrationFailed"),
      object: nil,
      userInfo: ["error": error.localizedDescription]
    )
  }
}

// MARK: - UNUserNotificationCenterDelegate

extension AppDelegate: UNUserNotificationCenterDelegate {
  // Receive displayed notifications for iOS 10 devices.
  func userNotificationCenter(_ center: UNUserNotificationCenter,
                              willPresent notification: UNNotification,
                              withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void) {
    let userInfo = notification.request.content.userInfo
    print("Notification received in foreground: \(userInfo)")
    
    // Show notification even when app is in foreground
    if #available(iOS 14.0, *) {
      completionHandler([[.banner, .badge, .sound]])
    } else {
      completionHandler([[.alert, .badge, .sound]])
    }
  }
  
  func userNotificationCenter(_ center: UNUserNotificationCenter,
                              didReceive response: UNNotificationResponse,
                              withCompletionHandler completionHandler: @escaping () -> Void) {
    let userInfo = response.notification.request.content.userInfo
    print("Notification tapped: \(userInfo)")
    completionHandler()
  }
}

// MARK: - FCM Token Handling
// Note: FCM token is handled by React Native Firebase module
// The token will be available in JavaScript via messaging().getToken()

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
