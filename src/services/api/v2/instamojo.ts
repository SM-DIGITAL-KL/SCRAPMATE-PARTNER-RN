/**
 * V2 Instamojo Payment API Service
 * Uses WebView approach with Instamojo payment requests
 */

import { buildApiUrl, getApiHeaders, fetchWithLogging, API_ROUTES } from '../apiConfig';

export interface InstamojoPaymentRequestData {
  purpose: string;
  amount: string | number;
  buyer_name: string;
  email: string;
  phone: string;
  redirect_url?: string; // Optional for SDK
  webhook_url?: string;
  send_email?: boolean;
  send_sms?: boolean;
  allow_repeated_payments?: boolean;
}


export interface InstamojoPaymentRequestResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    id: string;
    phone: string;
    email: string;
    buyer_name: string;
    amount: string;
    purpose: string;
    expires_at: string | null;
    status: string;
    send_sms: boolean;
    send_email: boolean;
    sms_status: string | null;
    email_status: string | null;
    shorturl: string | null;
    longurl: string;
    redirect_url: string;
    webhook: string | null;
    created_at: string;
    modified_at: string;
    allow_repeated_payments: boolean;
    mark_fulfilled: boolean;
    payment_request_id: string;
  } | null;
}

export interface InstamojoPaymentDetailsResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    payment_request: {
      id: string;
      phone: string;
      email: string;
      buyer_name: string;
      amount: string;
      purpose: string;
      expires_at: string | null;
      status: string;
      send_sms: boolean;
      send_email: boolean;
      sms_status: string | null;
      email_status: string | null;
      shorturl: string | null;
      longurl: string;
      redirect_url: string;
      webhook: string | null;
      created_at: string;
      modified_at: string;
      allow_repeated_payments: boolean;
      mark_fulfilled: boolean;
      payment_request_id: string;
    };
    payments: Array<{
      payment_id: string;
      status: string;
      buyer_name: string;
      buyer_phone: string;
      buyer_email: string;
      currency: string;
      unit_price: string;
      amount: string;
      fees: string;
      mac: string;
      quantity: number;
      created_at: string;
    }>;
  } | null;
}

/**
 * Create Instamojo payment request (for WebView)
 * This creates a payment request on the backend and returns longurl
 * @param paymentData - Payment request data
 * @returns Promise with payment request response containing longurl
 */
export const createInstamojoPaymentRequest = async (
  paymentData: InstamojoPaymentRequestData
): Promise<InstamojoPaymentRequestResponse> => {
  try {
    const url = buildApiUrl(API_ROUTES.v2.instamojo.createPaymentRequest);
    const headers = getApiHeaders();

    console.log('💳 Creating Instamojo payment request:', {
      purpose: paymentData.purpose,
      amount: paymentData.amount,
      buyer_name: paymentData.buyer_name,
      email: paymentData.email,
    });

    const response = await fetchWithLogging(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(paymentData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || 'Failed to create payment request');
    }

    const result: InstamojoPaymentRequestResponse = await response.json();

    if (result.status === 'error' || !result.data) {
      throw new Error(result.msg || 'Failed to create payment request');
    }

    console.log('✅ Instamojo payment request created:', {
      payment_request_id: result.data.payment_request_id,
      longurl: result.data.longurl,
    });

    return result;
  } catch (error: any) {
    console.error('❌ Error creating Instamojo payment request:', error);
    throw error;
  }
};

/**
 * Get payment details for a payment request
 * @param paymentRequestId - Payment request ID
 * @returns Promise with payment details
 */
export const getInstamojoPaymentDetails = async (
  paymentRequestId: string
): Promise<InstamojoPaymentDetailsResponse> => {
  try {
    const url = buildApiUrl(API_ROUTES.v2.instamojo.getPaymentDetails(paymentRequestId));
    const headers = getApiHeaders();

    console.log('🔍 Fetching Instamojo payment details:', paymentRequestId);

    const response = await fetchWithLogging(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || 'Failed to fetch payment details');
    }

    const result: InstamojoPaymentDetailsResponse = await response.json();

    if (result.status === 'error' || !result.data) {
      throw new Error(result.msg || 'Failed to fetch payment details');
    }

    console.log('✅ Instamojo payment details fetched:', {
      payment_request_id: paymentRequestId,
      payments_count: result.data.payments?.length || 0,
    });

    return result;
  } catch (error: any) {
    console.error('❌ Error fetching Instamojo payment details:', error);
    throw error;
  }
};

