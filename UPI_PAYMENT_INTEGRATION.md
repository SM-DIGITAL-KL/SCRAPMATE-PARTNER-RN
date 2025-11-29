# UPI Payment Integration Guide

This document explains how the UPI payment integration works in the Scrapmate Partner app.

## 📁 Files Created

### Android (Kotlin)
- `android/app/src/main/java/com/app/scrapmatepartner/UPIPaymentModule.kt` - Main payment module
- `android/app/src/main/java/com/app/scrapmatepartner/UPIPaymentPackage.kt` - React Native package

### iOS (Swift)
- `ios/ScrapmatePartner/UPIPaymentModule.swift` - Main payment module

### React Native (TypeScript)
- `src/services/upi/UPIPaymentService.ts` - Service wrapper for React Native

## 🔧 Configuration

### 1. Update UPI ID

In `src/screens/B2B/SubscriptionPlansScreen.tsx`, replace the placeholder UPI ID:

```typescript
const upiId = 'your-merchant@upi'; // Replace with your actual UPI ID
```

### 2. Android Deep Link Configuration

The `AndroidManifest.xml` has been updated to handle UPI callbacks:
- Added intent filters for `upi://` and `scrapmatepartner://` schemes
- MainActivity handles deep links from UPI apps

### 3. iOS URL Scheme Configuration

The `Info.plist` has been updated with:
- URL schemes: `scrapmatepartner` and `upi`
- LSApplicationQueriesSchemes for UPI apps (PhonePe, Paytm, Google Pay, BHIM)

## 🚀 How It Works

### Flow:
1. User clicks "Subscribe" button
2. App generates transaction ID
3. Native module opens UPI app with payment details
4. User completes payment in UPI app
5. UPI app redirects back to our app with result
6. Native module parses response and returns to React Native
7. React Native shows success/failure message

### Android Implementation:
- Uses `Intent.ACTION_VIEW` with UPI URI scheme
- Handles `onActivityResult` for payment response
- Parses UPI response string to extract status

### iOS Implementation:
- Uses `UIApplication.shared.open()` with UPI URL
- Handles URL callbacks via `AppDelegate.application(_:open:options:)`
- Uses NotificationCenter to communicate with React Native module

## 📝 Usage Example

```typescript
import UPIPaymentService from '../../services/upi/UPIPaymentService';

const result = await UPIPaymentService.initiatePayment({
  upiId: 'merchant@upi',
  amount: '270',
  transactionId: 'TXN123456',
  merchantName: 'Scrapmate Partner',
});

if (result.status === 'success') {
  // Payment successful
  console.log('Transaction ID:', result.transactionId);
} else if (result.status === 'cancelled') {
  // User cancelled
} else {
  // Payment failed
}
```

## 🔍 Response Format

### Success Response:
```typescript
{
  status: 'success',
  transactionId: 'TXN123456',
  responseCode: '00',
  approvalRefNo: 'APP123'
}
```

### Failed Response:
```typescript
{
  status: 'failed',
  message: 'Payment failed'
}
```

### Cancelled Response:
```typescript
{
  status: 'cancelled',
  message: 'Payment was cancelled'
}
```

## ⚠️ Important Notes

1. **UPI ID**: Must be a valid UPI ID (e.g., `merchant@paytm`, `merchant@ybl`)
2. **Transaction ID**: Should be unique for each transaction
3. **Testing**: Requires actual UPI apps installed on device
4. **Deep Links**: App must be able to receive callbacks from UPI apps

## 🧪 Testing

1. Install a UPI app (Google Pay, PhonePe, Paytm, etc.)
2. Build and run the app on a physical device
3. Navigate to Subscription Plans
4. Click "Subscribe" on any plan
5. Complete payment in UPI app
6. Verify callback and result handling

## 🐛 Troubleshooting

### "No UPI app found"
- Install at least one UPI app on the device
- Check if UPI apps are enabled

### Payment callback not received
- Verify URL schemes in Info.plist (iOS) and AndroidManifest.xml (Android)
- Check if app can handle deep links
- Ensure UPI app is configured to redirect back

### Module not found
- Rebuild the app after adding native modules
- For iOS: Run `pod install` in `ios/` directory
- For Android: Clean and rebuild project

## 📚 Next Steps

1. Replace placeholder UPI ID with actual merchant UPI ID
2. Implement subscription API call after successful payment
3. Store transaction details in database
4. Add payment history screen
5. Handle subscription renewal logic

---

**Created**: $(date)
**Platform**: React Native (Android & iOS)
**Payment Method**: UPI (Unified Payments Interface)

