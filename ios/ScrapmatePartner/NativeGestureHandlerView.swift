import UIKit
import React

@objc(NativeGestureHandlerView)
class NativeGestureHandlerView: UIView {
  private var panGesture: UIPanGestureRecognizer?
  private var tapGesture: UITapGestureRecognizer?
  private var longPressGesture: UILongPressGestureRecognizer?
  
  @objc var onGestureEvent: RCTDirectEventBlock?
  @objc var enablePanGesture: Bool = false {
    didSet {
      updateGestures()
    }
  }
  
  @objc var enableTapGesture: Bool = false {
    didSet {
      updateGestures()
    }
  }
  
  @objc var enableLongPressGesture: Bool = false {
    didSet {
      updateGestures()
    }
  }
  
  override init(frame: CGRect) {
    super.init(frame: frame)
    setupGestures()
  }
  
  required init?(coder: NSCoder) {
    super.init(coder: coder)
    setupGestures()
  }
  
  private func setupGestures() {
    updateGestures()
  }
  
  private func updateGestures() {
    // Remove existing gestures
    if let pan = panGesture {
      removeGestureRecognizer(pan)
      panGesture = nil
    }
    if let tap = tapGesture {
      removeGestureRecognizer(tap)
      tapGesture = nil
    }
    if let longPress = longPressGesture {
      removeGestureRecognizer(longPress)
      longPressGesture = nil
    }
    
    // Add enabled gestures
    if enablePanGesture {
      let pan = UIPanGestureRecognizer(target: self, action: #selector(handlePan(_:)))
      addGestureRecognizer(pan)
      panGesture = pan
    }
    
    if enableTapGesture {
      let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
      addGestureRecognizer(tap)
      tapGesture = tap
    }
    
    if enableLongPressGesture {
      let longPress = UILongPressGestureRecognizer(target: self, action: #selector(handleLongPress(_:)))
      addGestureRecognizer(longPress)
      longPressGesture = longPress
    }
  }
  
  @objc private func handlePan(_ gesture: UIPanGestureRecognizer) {
    let translation = gesture.translation(in: self)
    let velocity = gesture.velocity(in: self)
    let state = gesture.state.rawValue
    
    onGestureEvent?([
      "type": "pan",
      "state": state,
      "translationX": translation.x,
      "translationY": translation.y,
      "velocityX": velocity.x,
      "velocityY": velocity.y,
      "absoluteX": gesture.location(in: self).x,
      "absoluteY": gesture.location(in: self).y
    ])
  }
  
  @objc private func handleTap(_ gesture: UITapGestureRecognizer) {
    let location = gesture.location(in: self)
    
    onGestureEvent?([
      "type": "tap",
      "state": gesture.state.rawValue,
      "x": location.x,
      "y": location.y,
      "numberOfTaps": gesture.numberOfTapsRequired
    ])
  }
  
  @objc private func handleLongPress(_ gesture: UILongPressGestureRecognizer) {
    let location = gesture.location(in: self)
    
    onGestureEvent?([
      "type": "longPress",
      "state": gesture.state.rawValue,
      "x": location.x,
      "y": location.y
    ])
  }
  
  override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
    let view = super.hitTest(point, with: event)
    // Allow touches to pass through if no gestures are enabled
    if !enablePanGesture && !enableTapGesture && !enableLongPressGesture {
      return nil
    }
    return view
  }
}

@objc(NativeGestureHandlerViewManager)
class NativeGestureHandlerViewManager: RCTViewManager {
  override func view() -> UIView! {
    return NativeGestureHandlerView()
  }
  
  override static func requiresMainQueueSetup() -> Bool {
    return true
  }
}



