import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
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
}

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
