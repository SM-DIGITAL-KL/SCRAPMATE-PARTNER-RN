import { Platform, DeviceEventEmitter } from 'react-native';
import PayUSdk from 'payu-core-pg-react';

export interface PayUPaymentParams {
  key: string; // Merchant key
  transactionId: string; // Transaction ID (txnId)
  amount: string; // Amount in string format
  productInfo: string; // Product information
  firstName: string; // Customer first name
  email: string; // Customer email
  phone: string; // Customer phone number
  surl: string; // Success URL
  furl: string; // Failure URL
  environment: string; // "1" for Stage, "0" for production
  salt: string; // Salt for hash generation
  hash: string; // Payment hash generated on server (PayU expects 'hash' not 'paymentHash')
  paymentType?: string; // Payment type: 'Net Banking', 'Credit / Debit Cards', 'UPI', 'PayU Money'
  bankCode?: string; // For Net Banking or UPI
  // Card payment params (optional)
  cardNumber?: string;
  cvv?: string;
  expiryYear?: string;
  expiryMonth?: string;
  nameOnCard?: string;
  storeCard?: string; // "0" or "1"
}

export interface PayUPaymentResult {
  status: 'success' | 'failed' | 'cancelled';
  transactionId?: string;
  responseCode?: string;
  approvalRefNo?: string;
  message?: string;
  merchantResponse?: string;
  errorCode?: string;
  errorMessage?: string;
  data?: any; // Full response data
}

class PayUPaymentService {
  private eventListener: any = null;

  /**
   * Check if PayU SDK is available
   */
  isAvailable(): boolean {
    if (Platform.OS !== 'android') {
      console.log('⚠️ PayU SDK is only available on Android');
      return false;
    }
    
    try {
      // Check if PayUSdk is available and has makePayment method
      const isAvailable = PayUSdk !== null && PayUSdk !== undefined && typeof PayUSdk.makePayment === 'function';
      
      if (!isAvailable) {
        console.error('❌ PayU SDK not available:', {
          PayUSdk: PayUSdk,
          hasMakePayment: PayUSdk && typeof PayUSdk.makePayment,
        });
      }
      
      return isAvailable;
    } catch (error) {
      console.error('❌ Error checking PayU SDK availability:', error);
      return false;
    }
  }

  /**
   * Initiate PayU payment
   * @param params Payment parameters
   * @param paymentType Payment type: 'Net Banking', 'Credit / Debit Cards', 'UPI', 'PayU Money'
   * @returns Promise with payment result
   */
  async initiatePayment(
    params: PayUPaymentParams,
    paymentType: string = 'UPI'
  ): Promise<PayUPaymentResult> {
    if (!this.isAvailable()) {
      const errorMsg = 'PayU SDK is not available. Please ensure the app is rebuilt after installing payu-core-pg-react.';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    // Double check PayUSdk is available before using it
    if (!PayUSdk || typeof PayUSdk.makePayment !== 'function') {
      const errorMsg = 'PayU SDK native module is not linked. Please rebuild the app: cd android && ./gradlew clean && cd .. && npm run android';
      console.error('❌', errorMsg, {
        PayUSdk: PayUSdk,
        type: typeof PayUSdk,
      });
      throw new Error(errorMsg);
    }

    return new Promise((resolve, reject) => {
      try {
        // Build payment parameters according to PayU SDK format
        // Note: PayU SDK expects 'hash' (not 'paymentHash') and 'firstname' (not 'firstName')
        const paymentData: any = {
          key: params.key,
          txnId: params.transactionId,
          amount: params.amount,
          productInfo: params.productInfo,
          firstname: params.firstName, // PayU expects 'firstname' (lowercase)
          email: params.email,
          phone: params.phone,
          surl: params.surl,
          furl: params.furl,
          environment: params.environment,
          salt: params.salt,
          hash: params.hash, // PayU expects 'hash' not 'paymentHash'
          paymentType: params.paymentType || paymentType,
        };

        // Add vpa for UPI payments (optional - if not provided, SDK shows UPI app chooser)
        if (params.vpa) {
          paymentData.vpa = params.vpa;
        }

        // Add bankCode if provided (for Net Banking)
        if (params.bankCode) {
          paymentData.bankCode = params.bankCode;
        }

        // Add card payment params if provided
        if (params.cardNumber) {
          paymentData.cardNumber = params.cardNumber;
          paymentData.CVV = params.cvv; // Note: PayU uses 'CVV' (uppercase)
          paymentData.expiryYear = params.expiryYear;
          paymentData.expiryMonth = params.expiryMonth;
          paymentData.nameOnCard = params.nameOnCard;
          paymentData.storeCard = params.storeCard || '0';
        }

        console.log('💳 Initiating PayU payment:', {
          transactionId: params.transactionId,
          amount: params.amount,
          paymentType,
        });

        // Register event listener for payment response
        this.registerEventListener((result: PayUPaymentResult) => {
          resolve(result);
        });

        // Start payment using PayU SDK
        // Note: PayUSdk.makePayment uses callbacks, not promises
        // The success callback receives a JSON string, error callback receives a string
        try {
          // Define callbacks as separate functions to ensure proper conversion
          const successCallback = (responseString: string) => {
            try {
              console.log('✅ PayU Payment Success Response (raw):', responseString);
              
              // PayU SDK returns a JSON string, parse it
              let response: any;
              try {
                response = typeof responseString === 'string' ? JSON.parse(responseString) : responseString;
              } catch (e) {
                // If parsing fails, treat as plain string
                response = { data: responseString };
              }
              
              // Extract payment details from response
              // PayU response format: { "url": "...", "data": "..." }
              const result: PayUPaymentResult = {
                status: 'success',
                transactionId: params.transactionId, // Use original transaction ID
                responseCode: '00', // Success
                approvalRefNo: params.transactionId,
                data: response,
              };

              this.removeEventListener();
              resolve(result);
            } catch (err: any) {
              console.error('❌ Error parsing PayU success response:', err);
              this.removeEventListener();
              resolve({
                status: 'success',
                transactionId: params.transactionId,
                data: responseString,
              });
            }
          };

          const errorCallback = (error: string | any) => {
            try {
              console.error('❌ PayU Payment Error:', error);
              
              // Parse error - PayU SDK passes error as string
              const errorMessage = typeof error === 'string' ? error : (error?.message || error?.errorMessage || JSON.stringify(error));
              const isCancelled = errorMessage.toLowerCase().includes('cancel') || 
                                 errorMessage.toLowerCase().includes('dismiss') ||
                                 errorMessage.toLowerCase().includes('user cancelled');
              
              const result: PayUPaymentResult = {
                status: isCancelled ? 'cancelled' : 'failed',
                message: errorMessage,
                errorMessage: errorMessage,
                data: error,
              };

              this.removeEventListener();
              resolve(result);
            } catch (err: any) {
              console.error('❌ Error handling PayU error callback:', err);
              this.removeEventListener();
              resolve({
                status: 'failed',
                message: 'Payment failed',
                data: error,
              });
            }
          };

          // Call PayU SDK with proper callbacks
          PayUSdk.makePayment(paymentData, successCallback, errorCallback);
        } catch (error: any) {
          console.error('❌ PayU makePayment Exception:', error);
          this.removeEventListener();
          
          const result: PayUPaymentResult = {
            status: 'failed',
            message: error?.message || 'Failed to initiate payment',
            errorMessage: error?.message,
            data: error,
          };
          
          resolve(result);
        }
      } catch (error: any) {
        console.error('❌ PayU Payment Exception:', error);
        this.removeEventListener();
        reject(error);
      }
    });
  }

  /**
   * Register event listener for payment response
   * PayU SDK may also send events via DeviceEventEmitter
   */
  private registerEventListener(callback: (result: PayUPaymentResult) => void) {
    this.removeEventListener(); // Remove existing listener if any

    // Listen for PayU payment events
    this.eventListener = DeviceEventEmitter.addListener('PayUPaymentResponse', (event: any) => {
      console.log('📱 PayU Event Received:', event);

      const result: PayUPaymentResult = {
        status: event.status === 'success' ? 'success' : 'failed',
        transactionId: event.txnId || event.transactionId,
        responseCode: event.responseCode || event.status,
        approvalRefNo: event.approvalRefNo,
        message: event.message || event.errorMessage,
        data: event,
      };

      this.removeEventListener();
      callback(result);
    });
  }

  /**
   * Remove event listener
   */
  private removeEventListener() {
    if (this.eventListener) {
      this.eventListener.remove();
      this.eventListener = null;
    }
  }
}

export default new PayUPaymentService();
