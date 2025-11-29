import { NativeModules, Platform } from 'react-native';

const { UPIPaymentModule } = NativeModules;

export interface UPIPaymentParams {
  upiId: string;
  amount: string;
  transactionId: string;
  merchantName: string;
}

export interface UPIPaymentResult {
  status: 'success' | 'failed' | 'cancelled';
  transactionId?: string;
  responseCode?: string;
  approvalRefNo?: string;
  message?: string;
}

class UPIPaymentService {
  /**
   * Initiate UPI payment
   * @param params Payment parameters
   * @returns Promise with payment result
   */
  async initiatePayment(params: UPIPaymentParams): Promise<UPIPaymentResult> {
    if (!UPIPaymentModule) {
      throw new Error('UPI Payment module is not available');
    }

    try {
      const result = await UPIPaymentModule.initiatePayment(
        params.upiId,
        params.amount,
        params.transactionId,
        params.merchantName
      );

      return {
        status: result.status || 'success',
        transactionId: result.transactionId,
        responseCode: result.responseCode,
        approvalRefNo: result.approvalRefNo,
      };
    } catch (error: any) {
      // Handle different error types
      if (error.code === 'PAYMENT_CANCELLED') {
        return {
          status: 'cancelled',
          message: error.message || 'Payment was cancelled',
        };
      }

      if (error.code === 'PAYMENT_FAILED') {
        return {
          status: 'failed',
          message: error.message || 'Payment failed',
        };
      }

      if (error.code === 'NO_UPI_APP') {
        throw new Error('No UPI app found. Please install a UPI app like Google Pay, PhonePe, or Paytm.');
      }

      throw error;
    }
  }

  /**
   * Check if UPI payment is available on this device
   */
  isAvailable(): boolean {
    return !!UPIPaymentModule;
  }
}

export default new UPIPaymentService();

