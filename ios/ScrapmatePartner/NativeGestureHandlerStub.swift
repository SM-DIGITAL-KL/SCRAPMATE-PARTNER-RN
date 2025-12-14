import UIKit
import React

// Stub ViewGroup for React Navigation compatibility
@objc(GestureHandlerRootView)
class GestureHandlerRootView: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }
}

@objc(GestureHandlerRootViewManager)
class GestureHandlerRootViewManager: RCTViewManager {
  override func view() -> UIView! {
    return GestureHandlerRootView()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

// Stub for PanGestureHandler
@objc(PanGestureHandler)
class PanGestureHandler: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }
}

@objc(PanGestureHandlerManager)
class PanGestureHandlerManager: RCTViewManager {
  override func view() -> UIView! {
    return PanGestureHandler()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}

// Stub for TapGestureHandler
@objc(TapGestureHandler)
class TapGestureHandler: UIView {
  override init(frame: CGRect) {
    super.init(frame: frame)
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
  }
}

@objc(TapGestureHandlerManager)
class TapGestureHandlerManager: RCTViewManager {
  override func view() -> UIView! {
    return TapGestureHandler()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}



