declare module 'react-native' {
  interface NativeModulesStatic {
    SmsReader: {
      hasReadSmsPermission(): Promise<boolean>;
      getRecentSms(maxCount: number, minutesAgo: number): Promise<Array<{
        id: string;
        address: string;
        body: string;
        date: number;
        dateSent: number;
      }>>;
    };
  }
}

export {};


