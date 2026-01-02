/**
 * SMS Service for reading OTP from SMS messages
 * NOTE: SMS reading functionality has been disabled to comply with Google Play Store policy.
 * Apps can only use SMS permissions if they are default SMS handlers.
 * OTP must now be entered manually by users.
 */

import { Platform, PermissionsAndroid, Alert, NativeModules } from 'react-native';

// SMS reading disabled for Play Store compliance
// Get the native SMS Reader module (will be undefined since module is removed)
const { SmsReader } = NativeModules || {};

export interface SmsMessage {
  id: string;
  address: string;
  body: string;
  date: number;
  dateSent: number;
}

class SmsService {
  private smsListener: any = null;
  private checkInterval: NodeJS.Timeout | null = null;
  private lastCheckedSmsId: string | null = null;

  /**
   * Request SMS read permission (Android only)
   * DISABLED: SMS permissions removed for Google Play Store compliance
   */
  async requestSmsPermission(): Promise<boolean> {
    console.warn('⚠️ SMS permission request disabled - not compliant with Google Play Store policy');
    return false;
  }

  /**
   * Check if SMS permission is granted
   * DISABLED: SMS permissions removed for Google Play Store compliance
   */
  async hasSmsPermission(): Promise<boolean> {
    // SMS functionality disabled for Play Store compliance
    return false;
  }

  /**
   * Extract OTP from SMS message
   * Looks for 6-digit OTP in messages containing "SCRAPMATE" or "OTP"
   */
  extractOtpFromSms(message: string): string | null {
    // Pattern 1: "Your SCRAPMATE application login One Time Password (OTP) is 123456"
    // Pattern 2: "OTP is 123456"
    // Pattern 3: "Your OTP is 123456"
    // Pattern 4: "123456 is your OTP"
    // Pattern 5: Just 6 digits in a row

    const patterns = [
      /(?:OTP|otp|One Time Password).*?(\d{6})/i,
      /(\d{6}).*?(?:OTP|otp|One Time Password)/i,
      /(?:is|code|password).*?(\d{6})/i,
      /(\d{6})/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match && match[1]) {
        const otp = match[1];
        // Validate it's exactly 6 digits
        if (/^\d{6}$/.test(otp)) {
          return otp;
        }
      }
    }

    return null;
  }

  /**
   * Get recent SMS messages (last 5 minutes)
   * DISABLED: SMS reading removed for Google Play Store compliance
   */
  async getRecentSms(maxCount: number = 10): Promise<SmsMessage[]> {
    // SMS reading disabled for Play Store compliance
    console.warn('⚠️ SMS reading disabled - not compliant with Google Play Store policy');
    return [];
  }

  /**
   * Start listening for new SMS messages and extract OTP
   * DISABLED: SMS listening removed for Google Play Store compliance
   * Users must manually enter OTP codes
   * @param onOtpReceived Callback when OTP is found (will never be called)
   */
  async startListeningForOtp(
    onOtpReceived: (otp: string) => void
  ): Promise<void> {
    // SMS listening disabled for Play Store compliance
    console.warn('⚠️ SMS listening disabled - not compliant with Google Play Store policy');
    console.warn('   Users must manually enter OTP codes');
    // Do not start listening - return immediately
    return;
  }

  /**
   * Stop listening for SMS
   */
  stopListening(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      console.log('✅ Stopped listening for SMS OTP');
    }
  }
}

export const smsService = new SmsService();

