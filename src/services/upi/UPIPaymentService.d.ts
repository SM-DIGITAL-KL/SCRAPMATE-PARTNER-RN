/**
 * TypeScript definitions for UPI Payment Service
 * 
 * This service uses React Native's native Linking API to open UPI deep links.
 * No external packages are required.
 */

export interface UPIPaymentParams {
  upiId: string; // Payee VPA (pa) - Mandatory
  merchantName: string; // Payee Name (pn) - Mandatory
  amount: string; // Amount (am) - Mandatory for Dynamic mode, Optional for Static
  transactionId: string; // Transaction Reference ID (tr) - Mandatory for Merchant transactions
  transactionNote?: string; // Transaction note (tn) - Optional
  merchantCode?: string; // Merchant Code (mc) - Optional
  merchantId?: string; // Merchant ID (mid) - Optional, max 20 digits
  storeId?: string; // Store ID (msid) - Optional, max 20 digits
  terminalId?: string; // Terminal ID (mtid) - Optional, max 20 digits
  billUrl?: string; // Bill URL (url) - Optional, must start with http/https
  signature?: string; // Digital signature (sign) - Mandatory, Base64 encoded (can be empty)
  minimumAmount?: string; // Minimum amount (mam) - Conditional
}

export interface UPIPaymentResult {
  status: 'success' | 'failed' | 'cancelled' | 'app_launched';
  transactionId?: string;
  responseCode?: string;
  approvalRefNo?: string;
  message?: string;
}

