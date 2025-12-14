import UIKit
import React

@objc(KeyboardControllerModule)
class KeyboardControllerModule: RCTEventEmitter {
    
    private var keyboardVisible = false
    private var keyboardHeight: CGFloat = 0
    
    override static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override func supportedEvents() -> [String]! {
        return ["keyboardDidChangeFrame"]
    }
    
    override init() {
        super.init()
        // Delay setup to ensure bridge is ready
        DispatchQueue.main.async { [weak self] in
            self?.setupKeyboardObservers()
        }
    }
    
    deinit {
        removeKeyboardObservers()
    }
    
    private func setupKeyboardObservers() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillShow(_:)),
            name: UIResponder.keyboardWillShowNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardWillHide(_:)),
            name: UIResponder.keyboardWillHideNotification,
            object: nil
        )
        
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(keyboardDidChangeFrame(_:)),
            name: UIResponder.keyboardDidChangeFrameNotification,
            object: nil
        )
    }
    
    private func removeKeyboardObservers() {
        NotificationCenter.default.removeObserver(self)
    }
    
    @objc private func keyboardWillShow(_ notification: Notification) {
        if let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect {
            keyboardHeight = keyboardFrame.height
            keyboardVisible = true
            sendKeyboardEvent(visible: true, height: Int(keyboardHeight))
        }
    }
    
    @objc private func keyboardWillHide(_ notification: Notification) {
        keyboardHeight = 0
        keyboardVisible = false
        sendKeyboardEvent(visible: false, height: 0)
    }
    
    @objc private func keyboardDidChangeFrame(_ notification: Notification) {
        if let keyboardFrame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect {
            keyboardHeight = keyboardFrame.height
            sendKeyboardEvent(visible: keyboardVisible, height: Int(keyboardHeight))
        }
    }
    
    private func sendKeyboardEvent(visible: Bool, height: Int) {
        guard bridge != nil else {
            print("KeyboardController: Bridge not ready, skipping event")
            return
        }
        
        let params: [String: Any] = [
            "visible": visible,
            "height": height
        ]
        
        DispatchQueue.main.async { [weak self] in
            self?.sendEvent(withName: "keyboardDidChangeFrame", body: params)
        }
    }
    
    @objc func dismissKeyboard(_ resolve: @escaping RCTPromiseResolveBlock, rejecter reject: @escaping RCTPromiseRejectBlock) {
        DispatchQueue.main.async {
            UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil)
            resolve(true)
        }
    }
    
    @objc func setEnabled(_ enabled: Bool) {
        // iOS handles keyboard automatically, this is mainly for Android compatibility
    }
}



