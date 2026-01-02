import { Platform, Linking, NativeEventEmitter, NativeModules, AppState, AppStateStatus } from 'react-native';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { UPIQR } from '@adityavijay21/upiqr';

export interface UPIPaymentParams {
  upiId: string; // Payee VPA (pa) - Mandatory (e.g., "merchant@upi")
  merchantName: string; // Payee Name (pn) - Mandatory
  amount: string; // Amount (am) - Mandatory (e.g., "100.00")
}

export interface UPIPaymentResult {
  status: 'success' | 'failed' | 'cancelled' | 'app_launched' | 'qr_generated';
  transactionId?: string;
  responseCode?: string;
  approvalRefNo?: string;
  message?: string;
  qrCodeBase64?: string; // Base64 PNG data URL of the QR code
  qrCodeFilePath?: string; // File path where QR code PNG is saved
  upiIntentUrl?: string; // UPI intent URL (for generating QR code)
  rawResponse?: string; // Raw UPI response string
}

export interface UPIPaymentCallback {
  status: 'success' | 'failed';
  transactionId?: string;
  responseCode?: string;
  approvalRefNo?: string;
  message?: string;
  rawResponse?: string;
}

type PaymentCallback = (result: UPIPaymentCallback) => void;

class UPIPaymentService {
  private paymentCallback: PaymentCallback | null = null;
  private eventEmitter: NativeEventEmitter | null = null;
  private linkingSubscription: any = null;
  private appStateSubscription: any = null;
  private appState: AppStateStatus = AppState.currentState;

  constructor() {
    console.log('🚀 UPIPaymentService constructor called');
    console.log('🚀 Platform:', Platform.OS);
    
    if (Platform.OS === 'android') {
      // Listen for native module events
      try {
        console.log('🔧 Initializing native module event emitter...');
        const { UPIPaymentModule } = NativeModules;
        if (UPIPaymentModule) {
          console.log('✅ UPIPaymentModule found');
          this.eventEmitter = new NativeEventEmitter(UPIPaymentModule);
          this.eventEmitter.addListener('UPIPaymentResponse', this.handleNativePaymentResponse);
          console.log('✅ Native event listener added for UPIPaymentResponse');
        } else {
          console.warn('⚠️ UPIPaymentModule not found in NativeModules');
        }
      } catch (e) {
        console.error('❌ Could not initialize UPI payment event emitter:', e);
      }

      // Listen for deep links from UPI apps
      this.setupDeepLinkListener();
      
      // Listen for app state changes to check for deep links when app comes to foreground
      this.setupAppStateListener();
    } else {
      console.log('⚠️ UPI payment only supported on Android');
    }
    
    console.log('✅ UPIPaymentService initialization complete');
  }

  /**
   * Setup deep link listener for UPI payment callbacks
   */
  private setupDeepLinkListener() {
    console.log('🔗 Setting up deep link listener for UPI payment callbacks');
    
    // Handle initial URL if app was opened via deep link
    Linking.getInitialURL().then((url: string | null) => {
      console.log('🔗 Initial URL:', url);
      if (url) {
        this.handleDeepLink(url);
      }
    }).catch((err: any) => {
      console.error('❌ Error getting initial URL:', err);
    });

    // Listen for deep links while app is running
    this.linkingSubscription = Linking.addEventListener('url', (event: { url: string }) => {
      console.log('🔗 Deep link event received via Linking API:', event.url);
      this.handleDeepLink(event.url);
    });
    
    console.log('✅ Deep link listener setup complete');
  }

  /**
   * Setup app state listener to check for deep links when app comes to foreground
   * This is important because UPI apps might redirect back to our app, and the deep link
   * might be in the intent but not trigger the Linking event properly
   */
  private setupAppStateListener() {
    console.log('📱 Setting up app state listener for UPI payment callbacks');
    
    this.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      const wasInBackground = this.appState.match(/inactive|background/);
      const isNowActive = nextAppState === 'active';
      
      console.log('📱 App state changed:', {
        previous: this.appState,
        next: nextAppState,
        wasInBackground,
        isNowActive,
      });
      
      // When app comes to foreground, check for deep link URL
      if (wasInBackground && isNowActive) {
        console.log('📱 App came to foreground, checking for deep link URL...');
        this.checkForDeepLink();
      }
      
      this.appState = nextAppState;
    });
    
    console.log('✅ App state listener setup complete');
  }

  /**
   * Check for deep link URL when app comes to foreground
   * This helps catch deep links that might not trigger the Linking event
   */
  private async checkForDeepLink() {
    try {
      console.log('🔍 Checking for deep link URL...');
      const url = await Linking.getInitialURL();
      console.log('🔍 getInitialURL result:', url);
      
      // Also try to get current URL (this might work differently on Android)
      // Note: getInitialURL only works on app launch, so we need another approach
      // For Android, we'll rely on the native module to send events
      
      // For now, we'll rely on the native module's onNewIntent to handle this
      // But we can also try to request the current intent from native module
      if (Platform.OS === 'android') {
        const { UPIPaymentModule } = NativeModules;
        if (UPIPaymentModule && UPIPaymentModule.getCurrentIntentUrl) {
          try {
            const currentUrl = await UPIPaymentModule.getCurrentIntentUrl();
            console.log('🔍 Current intent URL from native module:', currentUrl);
            if (currentUrl) {
              this.handleDeepLink(currentUrl);
            }
          } catch (e) {
            console.log('🔍 getCurrentIntentUrl not available or error:', e);
          }
        }
      }
    } catch (error: any) {
      console.error('❌ Error checking for deep link:', error);
    }
  }

  /**
   * Handle deep link from UPI apps
   */
  private handleDeepLink(url: string) {
    try {
      console.log('📱 ========================================');
      console.log('📱 HANDLING DEEP LINK');
      console.log('📱 Raw URL:', url);
      console.log('📱 URL type:', typeof url);
      console.log('📱 ========================================');
      
      // UPI apps redirect back with upi:// scheme or our custom scheme
      if (url.startsWith('upi://') || url.startsWith('scrapmatepartner://')) {
        console.log('✅ URL matches UPI callback pattern');
        console.log('📱 Received UPI payment callback:', url);
        
        // Handle different callback formats
        let response = '';
        
        // Format 1: scrapmatepartner://payment/callback?response=Status=SUCCESS&TxnId=...
        if (url.includes('scrapmatepartner://payment/callback')) {
          const urlParts = url.split('?');
          if (urlParts.length > 1) {
            const queryString = urlParts[1];
            // Check if response is in a parameter
            if (queryString.includes('response=')) {
              const responseMatch = queryString.match(/response=([^&]*)/);
              if (responseMatch && responseMatch[1]) {
                response = decodeURIComponent(responseMatch[1]);
              }
            } else {
              // Response might be in the query string directly
              response = queryString;
            }
          }
        }
        // Format 2: upi://pay?response=Status=SUCCESS&TxnId=...
        else if (url.includes('response=')) {
          const responseMatch = url.match(/response=([^&]*)/);
          if (responseMatch && responseMatch[1]) {
            response = decodeURIComponent(responseMatch[1]);
          }
        }
        // Format 3: upi://pay?Status=SUCCESS&TxnId=... (direct UPI response)
        else if (url.includes('Status=') || url.includes('status=')) {
          const urlParts = url.split('?');
          if (urlParts.length > 1) {
            response = urlParts[1];
          }
        }
        // Format 4: Try to extract from query string
        else if (url.includes('?')) {
          const queryPart = url.split('?')[1];
          response = queryPart;
        }
        
        console.log('📱 Extracted response:', response);
        console.log('📱 Response length:', response.length);
        
        if (response) {
          console.log('✅ Response found, parsing...');
          const parsedResponse = this.parseUPIResponse(response);
          console.log('📱 Parsed payment response:', JSON.stringify(parsedResponse, null, 2));
          console.log('📱 Calling handlePaymentCallback...');
          this.handlePaymentCallback(parsedResponse);
          console.log('✅ handlePaymentCallback called');
        } else {
          console.warn('⚠️ UPI callback received but no response data found');
          console.warn('📱 Full URL:', url);
          console.warn('📱 URL parts:', url.split('?'));
        }
      } else {
        console.log('❌ URL does not match UPI callback pattern');
        console.log('📱 URL starts with:', url.substring(0, 20));
      }
    } catch (error: any) {
      console.error('❌ Error handling deep link:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error message:', error.message);
    }
    console.log('📱 ========================================');
  }

  /**
   * Handle payment response from native module event
   */
  private handleNativePaymentResponse = (data: any) => {
    console.log('📱 ========================================');
    console.log('📱 NATIVE UPI PAYMENT RESPONSE RECEIVED');
    console.log('📱 Data:', JSON.stringify(data, null, 2));
    console.log('📱 ========================================');
    this.handlePaymentCallback({
      status: data.status === 'success' ? 'success' : 'failed',
      transactionId: data.transactionId,
      responseCode: data.responseCode,
      approvalRefNo: data.approvalRefNo,
      message: data.message,
      rawResponse: data.rawResponse,
    });
  };

  /**
   * Parse UPI response string into object
   */
  private parseUPIResponse(response: string): UPIPaymentCallback {
    console.log('🔍 ========================================');
    console.log('🔍 PARSE UPI RESPONSE');
    console.log('🔍 Raw response:', response);
    console.log('🔍 Response type:', typeof response);
    console.log('🔍 ========================================');
    
    const result: UPIPaymentCallback = {
      status: 'failed',
      message: 'Payment failed',
    };

    try {
      // UPI response format: Status=SUCCESS&TxnId=123&ResponseCode=00&ApprovalRefNo=ABC123
      // Manually parse query string parameters
      const params: { [key: string]: string } = {};
      const pairs = response.split('&');
      console.log('🔍 Split into pairs:', pairs.length, 'pairs');
      
      for (const pair of pairs) {
        const [key, value] = pair.split('=');
        if (key && value) {
          const decodedValue = decodeURIComponent(value);
          params[key] = decodedValue;
          console.log(`🔍 Parsed: ${key} = ${decodedValue}`);
        } else {
          console.log(`🔍 Skipped invalid pair: ${pair}`);
        }
      }
      
      console.log('🔍 All parsed params:', JSON.stringify(params, null, 2));
      
      const status = params['Status'] || params['status'] || '';
      console.log('🔍 Status found:', status);
      result.status = status.toUpperCase() === 'SUCCESS' ? 'success' : 'failed';
      result.transactionId = params['TxnId'] || params['txnId'] || params['TxnRef'] || params['txnRef'] || '';
      result.responseCode = params['ResponseCode'] || params['responseCode'] || '';
      result.approvalRefNo = params['ApprovalRefNo'] || params['approvalRefNo'] || '';
      result.message = result.status === 'success' ? 'Payment successful' : status || 'Payment failed';
      result.rawResponse = response;
      
      console.log('🔍 Final parsed result:', JSON.stringify(result, null, 2));
      console.log('🔍 ========================================');
    } catch (error: any) {
      console.error('❌ Error parsing UPI response:', error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      result.message = error.message || 'Failed to parse payment response';
      result.rawResponse = response;
      console.log('🔍 ========================================');
    }

    return result;
  }

  /**
   * Handle payment callback and notify listener
   */
  private handlePaymentCallback(result: UPIPaymentCallback) {
    console.log('📱 ========================================');
    console.log('📱 HANDLE PAYMENT CALLBACK');
    console.log('📱 Result:', JSON.stringify(result, null, 2));
    console.log('📱 Callback function exists:', !!this.paymentCallback);
    console.log('📱 ========================================');
    
    if (this.paymentCallback) {
      console.log('✅ Calling registered payment callback...');
      try {
        this.paymentCallback(result);
        console.log('✅ Payment callback executed successfully');
      } catch (error: any) {
        console.error('❌ Error executing payment callback:', error);
        console.error('❌ Error stack:', error.stack);
      }
    } else {
      console.warn('⚠️ No payment callback registered!');
      console.warn('⚠️ Payment result will be lost:', result);
    }
  }

  /**
   * Set callback function to receive payment results
   * @param callback Function to call when payment completes
   */
  setPaymentCallback(callback: PaymentCallback | null) {
    console.log('📱 ========================================');
    console.log('📱 SET PAYMENT CALLBACK');
    console.log('📱 Callback:', callback ? 'Function provided' : 'null');
    console.log('📱 ========================================');
    this.paymentCallback = callback;
  }

  /**
   * Manually check for deep link URL (useful when app comes to foreground)
   * This can be called from components when they detect the app has returned from background
   */
  async checkForPaymentCallback() {
    console.log('🔍 Manual check for payment callback requested');
    await this.checkForDeepLink();
  }

  /**
   * Cleanup listeners
   */
  cleanup() {
    if (this.linkingSubscription) {
      this.linkingSubscription.remove();
      this.linkingSubscription = null;
    }
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
    if (this.eventEmitter) {
      this.eventEmitter.removeAllListeners('UPIPaymentResponse');
    }
    this.paymentCallback = null;
  }

  /**
   * Check if UPI payment is available on this device
   */
  isAvailable(): boolean {
    return Platform.OS === 'android';
  }

  /**
   * Save PNG from base64 data URL to file
   */
  private async savePngFromBase64(base64DataUrl: string): Promise<string> {
    const filePath = `${RNFS.CachesDirectoryPath}/upi_qr_${Date.now()}.png`;
    // Remove data:image/png;base64, prefix if present
    const base64Data = base64DataUrl.replace(/^data:image\/png;base64,/, '');
    
    await RNFS.writeFile(filePath, base64Data, 'base64');
    return filePath;
  }

  /**
   * Save PNG from base64 string (without data URL prefix) to file
   */
  async savePngFromBase64String(base64String: string): Promise<string> {
    const filePath = `${RNFS.CachesDirectoryPath}/upi_qr_${Date.now()}.png`;
    await RNFS.writeFile(filePath, base64String, 'base64');
    return filePath;
  }

  /**
   * Open QR image in UPI apps only using native module
   * This will filter the app chooser to show only UPI apps (GPay, PhonePe, Paytm, etc.)
   * @param filePath Path to the QR code PNG image file
   */
  async openQRCodeInApps(filePath: string): Promise<void> {
    if (Platform.OS !== 'android') {
      throw new Error('UPI payment is only available on Android');
    }

    try {
      const { UPIPaymentModule } = NativeModules;
      if (UPIPaymentModule && UPIPaymentModule.openQRCodeInUPIApps) {
        await UPIPaymentModule.openQRCodeInUPIApps(filePath);
      } else {
        // Fallback to react-native-share if native method not available
        console.warn('Native openQRCodeInUPIApps not available, using fallback');
        await Share.open({
          url: `file://${filePath}`,
          type: 'image/png',
          showAppsToView: true,
          failOnCancel: false,
        });
      }
    } catch (error: any) {
      console.error('Error opening QR code in UPI apps:', error);
      throw new Error(error.message || 'Failed to open QR code in UPI apps');
    }
  }

  /**
   * Generate UPI intent URL using @adityavijay21/upiqr
   * Basic implementation with only merchant name, UPI ID, and amount
   * Includes callback URL for payment status callbacks
   * Transaction ID will come from the UPI callback response
   */
  private async generateUPIIntentUrl(params: UPIPaymentParams): Promise<string> {
    const upiQR = new UPIQR();
    
    // Generate callback URL for payment status callback
    // UPI apps will redirect to this URL after payment completion
    // Transaction ID will be in the callback response, not in the callback URL
    const callbackUrl = 'scrapmatepartner://payment/callback';
    
    // Set parameters: UPI ID, merchant name, and amount
    upiQR.set({
      upiId: params.upiId,
      name: params.merchantName,
      amount: parseFloat(params.amount),
      currency: 'INR',
    });

    // Generate with SVG output (doesn't require canvas) to get intent URL
    // We use SVG output type to avoid canvas requirement in React Native
    const { intent } = await upiQR
      .setOptions({ outputType: 'svg' })
      .generate();
    
    // Manually add callback URL to the intent URL if not already included
    // UPI apps use the 'url' parameter for callback
    let intentUrl = intent;
    if (intentUrl && !intentUrl.includes('url=')) {
      const separator = intentUrl.includes('?') ? '&' : '?';
      intentUrl = `${intentUrl}${separator}url=${encodeURIComponent(callbackUrl)}`;
    }
    
    console.log('💳 Generated UPI intent URL with callback:', intentUrl);
    
    return intentUrl;
  }

  /**
   * Generate QR code and return UPI intent URL
   * Components should use this URL with react-native-qrcode-svg + ViewShot to generate PNG
   * @param params Payment parameters
   * @returns Promise with UPI intent URL
   */
  async generateQRCodeForDisplay(params: UPIPaymentParams): Promise<UPIPaymentResult> {
    if (Platform.OS !== 'android') {
      throw new Error('UPI Payment is only available on Android');
    }

    if (!this.isAvailable()) {
      throw new Error('UPI Payment is not available on this platform');
    }

    try {
      console.log('💳 Generating UPI intent URL:', {
        upiId: params.upiId,
        merchantName: params.merchantName,
        amount: params.amount,
      });

      // Generate UPI intent URL with callback URL
      // Transaction ID will come from the UPI callback response
      const intentUrl = await this.generateUPIIntentUrl(params);
      
      console.log('✅ UPI intent URL generated successfully');

      return {
        status: 'qr_generated',
        upiIntentUrl: intentUrl,
        message: 'UPI intent URL generated. Use with QRCode component to generate PNG.',
      };
    } catch (error: any) {
      console.error('❌ UPI Intent URL Generation Exception:', {
        error: error,
        errorMessage: error?.message,
        amount: params.amount,
      });
      
      return {
        status: 'failed',
        message: error.message || 'Failed to generate UPI intent URL. Please try again.',
      };
    }
  }

  /**
   * Initiate UPI payment using QR code approach
   * Generates intent URL, components should generate PNG and show QR code
   * @deprecated Use generateQRCodeForDisplay() and openQRCodeInApps() separately
   */
  async initiatePayment(params: UPIPaymentParams): Promise<UPIPaymentResult> {
    return this.generateQRCodeForDisplay(params);
  }

  /**
   * Launch UPI app with specific package name
   * @deprecated Package-specific launching is not currently supported
   */
  async launchWithApp(params: UPIPaymentParams, packageName?: string): Promise<UPIPaymentResult> {
    return this.initiatePayment(params);
  }
}

export default new UPIPaymentService();
