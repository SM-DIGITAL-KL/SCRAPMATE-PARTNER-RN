declare module 'react-native' {
  interface NativeModulesStatic {
    UPIPaymentModule: {
      initiatePayment(
        upiId: string,
        amount: string
      ): Promise<{
        status: 'success' | 'failed';
        resultCode?: number;
        message?: string;
      }>;
      openQRCodeInUPIApps(filePath: string): Promise<boolean>;
    };
  }
}

