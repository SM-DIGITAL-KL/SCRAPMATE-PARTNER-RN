/**
 * TypeScript definitions for UPI Payment Module
 */

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

declare module 'react-native' {
  interface NativeModulesStatic {
    UPIPaymentModule: {
      initiatePayment: (
        upiId: string,
        amount: string,
        transactionId: string,
        merchantName: string
      ) => Promise<UPIPaymentResult>;
    };
  }
}

