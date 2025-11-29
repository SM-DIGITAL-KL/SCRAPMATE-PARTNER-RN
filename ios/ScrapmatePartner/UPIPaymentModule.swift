import Foundation
import UIKit
import React

@objc(UPIPaymentModule)
class UPIPaymentModule: NSObject, RCTBridgeModule {
    
    private var paymentPromise: RCTPromiseResolveBlock?
    private var paymentReject: RCTPromiseRejectBlock?
    
    static func moduleName() -> String! {
        return "UPIPaymentModule"
    }
    
    static func requiresMainQueueSetup() -> Bool {
        return true
    }
    
    override init() {
        super.init()
        // Listen for payment response notifications
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePaymentResponseNotification(_:)),
            name: NSNotification.Name("UPIPaymentResponse"),
            object: nil
        )
    }
    
    deinit {
        NotificationCenter.default.removeObserver(self)
    }
    
    @objc
    private func handlePaymentResponseNotification(_ notification: Notification) {
        if let userInfo = notification.userInfo,
           let response = userInfo["response"] as? String {
            handlePaymentResponse(response)
        }
    }
    
    @objc
    func initiatePayment(
        _ upiId: String,
        amount: String,
        transactionId: String,
        merchantName: String,
        resolver: @escaping RCTPromiseResolveBlock,
        rejecter: @escaping RCTPromiseRejectBlock
    ) {
        DispatchQueue.main.async {
            self.paymentPromise = resolver
            self.paymentReject = rejecter
            
            // Create UPI payment URL
            let encodedUPIId = upiId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? upiId
            let encodedMerchantName = merchantName.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? merchantName
            let encodedTransactionNote = "Subscription Payment".addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? "Subscription Payment"
            
            let upiURLString = "upi://pay?pa=\(encodedUPIId)&pn=\(encodedMerchantName)&am=\(amount)&tid=\(transactionId)&tr=\(transactionId)&tn=\(encodedTransactionNote)&cu=INR"
            
            guard let upiURL = URL(string: upiURLString) else {
                rejecter("INVALID_URL", "Invalid UPI URL", nil)
                return
            }
            
            // Check if any app can handle UPI URL
            if UIApplication.shared.canOpenURL(upiURL) {
                // Open UPI app
                UIApplication.shared.open(upiURL, options: [:]) { success in
                    if !success {
                        rejecter("OPEN_FAILED", "Failed to open UPI app", nil)
                    }
                    // Payment result will be handled via URL scheme callback in AppDelegate
                }
            } else {
                // Try alternative UPI apps
                let alternativeApps = [
                    "phonepe://pay",
                    "paytmmp://pay",
                    "gpay://pay",
                    "bhim://pay"
                ]
                
                var appOpened = false
                for appScheme in alternativeApps {
                    if let appURL = URL(string: appScheme),
                       UIApplication.shared.canOpenURL(appURL) {
                        UIApplication.shared.open(upiURL, options: [:]) { _ in }
                        appOpened = true
                        break
                    }
                }
                
                if !appOpened {
                    rejecter("NO_UPI_APP", "No UPI app found. Please install a UPI app like Google Pay, PhonePe, or Paytm.", nil)
                }
            }
        }
    }
    
    @objc
    func handlePaymentResponse(_ response: String) {
        // Parse UPI response
        let responseDict = parseUPIResponse(response)
        let status = responseDict["Status"] ?? "Unknown"
        
        if let resolver = paymentPromise {
            if status.uppercased() == "SUCCESS" {
                let result: [String: Any] = [
                    "status": "success",
                    "transactionId": responseDict["TxnId"] ?? "",
                    "responseCode": responseDict["ResponseCode"] ?? "",
                    "approvalRefNo": responseDict["ApprovalRefNo"] ?? ""
                ]
                resolver(result)
            } else {
                let result: [String: Any] = [
                    "status": "failed",
                    "message": responseDict["Status"] ?? "Payment failed"
                ]
                paymentReject?("PAYMENT_FAILED", "Payment failed", NSError(domain: "UPIPayment", code: 1, userInfo: result))
            }
            paymentPromise = nil
            paymentReject = nil
        }
    }
    
    private func parseUPIResponse(_ response: String) -> [String: String] {
        var dict: [String: String] = [:]
        let pairs = response.components(separatedBy: "&")
        for pair in pairs {
            let keyValue = pair.components(separatedBy: "=")
            if keyValue.count == 2 {
                let key = keyValue[0]
                let value = keyValue[1].removingPercentEncoding ?? keyValue[1]
                dict[key] = value
            }
        }
        return dict
    }
}

