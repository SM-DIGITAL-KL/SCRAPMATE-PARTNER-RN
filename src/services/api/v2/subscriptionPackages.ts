/**
 * V2 Subscription Packages API Service
 * Handles fetching subscription packages for B2B and B2C users
 */

import { buildApiUrl, getApiHeaders, fetchWithLogging, API_ROUTES } from '../apiConfig';

export interface SubscriptionPackage {
  id: string;
  name: string;
  displayname?: string; // Display name from API (preferred over name if available)
  price: number;
  duration: string; // 'month' | 'year' | 'order'
  description?: string;
  features?: string[];
  popular?: boolean;
  userType?: 'B2B' | 'B2C';
  upiId?: string;
  merchantName?: string;
  isActive?: boolean;
  pricePercentage?: number; // For percentage-based pricing (e.g., 0.5 for 0.5%)
  isPercentageBased?: boolean; // Flag to indicate if pricing is percentage-based
  originalPrice?: number; // Original price for reference
}

export interface SubscriptionPackagesResponse {
  status: 'success' | 'error';
  msg: string;
  data: SubscriptionPackage[];
}

/**
 * Get subscription packages for a specific user type
 * @param userType - 'b2b' or 'b2c' (lowercase as required by API)
 * @param language - Language code (e.g., 'en', 'hi', 'ta', etc.) - optional, defaults to 'en'
 * @returns Promise with subscription packages
 */
export const getSubscriptionPackages = async (
  userType: 'b2b' | 'b2c' = 'b2c',
  language: string = 'en'
): Promise<SubscriptionPackagesResponse> => {
  try {
    const url = buildApiUrl(`${API_ROUTES.V2}/subscription-packages?userType=${userType}&language=${language}`);
    const headers = getApiHeaders();

    console.log('📦 Fetching subscription packages for:', userType);

    const response = await fetchWithLogging(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || 'Failed to fetch subscription packages');
    }

    const data: SubscriptionPackagesResponse = await response.json();
    
    console.log('✅ Subscription packages fetched:', data.data?.length || 0, 'packages');
    
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching subscription packages:', error);
    throw error;
  }
};

/**
 * Generate PayU payment hash
 * @param hashParams - Parameters for hash generation
 * @returns Promise with hash
 */
export const generatePayUHash = async (hashParams: {
  key: string;
  txnid: string;
  amount: string;
  productinfo: string;
  firstname: string;
  email: string;
  udf1?: string;
  udf2?: string;
  udf3?: string;
  udf4?: string;
  udf5?: string;
  salt: string;
}): Promise<{ status: 'success' | 'error'; msg: string; data?: { hash: string } }> => {
  try {
    const url = buildApiUrl('/generatePayUHash');
    const headers = getApiHeaders();

    console.log('💳 Generating PayU hash:', {
      txnid: hashParams.txnid,
      amount: hashParams.amount,
    });

    const response = await fetchWithLogging(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(hashParams),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || 'Failed to generate PayU hash');
    }

    const data = await response.json();

    console.log('✅ PayU hash generated successfully');

    return data;
  } catch (error: any) {
    console.error('❌ Error generating PayU hash:', error);
    throw error;
  }
};


/**
 * Save user subscription package after payment
 * @param userId - User ID
 * @param packageId - Package ID
 * @param paymentDetails - Payment details from PayU
 * @returns Promise with save result
 */
export const saveUserSubscription = async (
  userId: string | number,
  packageId: string,
  paymentDetails: {
    transactionId: string;
    responseCode?: string;
    approvalRefNo?: string;
    amount: string;
    paymentMethod?: string;
  }
): Promise<{ status: 'success' | 'error'; msg: string; data?: any }> => {
  try {
    // Use v2 API endpoint for saving subscriptions
    const url = buildApiUrl(`${API_ROUTES.V2}/subscription-packages/save`);
    const headers = getApiHeaders();

    const requestBody = {
      user_id: String(userId),
      package_id: packageId,
      payment_moj_id: paymentDetails.transactionId, // UPI transaction ID
      payment_req_id: paymentDetails.approvalRefNo || paymentDetails.transactionId, // Use approval ref or transaction ID
      pay_details: JSON.stringify({
        transactionId: paymentDetails.transactionId,
        responseCode: paymentDetails.responseCode,
        approvalRefNo: paymentDetails.approvalRefNo,
        amount: paymentDetails.amount,
        paymentMethod: paymentDetails.paymentMethod || 'UPI',
        timestamp: new Date().toISOString(),
      }),
    };

    console.log('💳 Saving subscription package:', {
      userId,
      packageId,
      transactionId: paymentDetails.transactionId,
    });

    const response = await fetchWithLogging(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.msg || 'Failed to save subscription');
    }

    const data = await response.json();

    console.log('✅ Subscription saved successfully:', data);

    return data;
  } catch (error: any) {
    console.error('❌ Error saving subscription:', error);
    throw error;
  }
};

/**
 * Check subscription expiry and update is_subscribed status
 * @param userId - User ID
 * @returns Promise with expiry check result
 */
export const checkSubscriptionExpiry = async (
  userId: string | number
): Promise<{
  status: 'success' | 'error';
  msg: string;
  data: {
    expired: boolean;
    updated?: boolean;
    endDate?: string;
  } | null;
}> => {
  try {
    const url = buildApiUrl(`${API_ROUTES.V2}/subscription-packages/check-expiry`);
    const headers = getApiHeaders();

    console.log('🔍 Checking subscription expiry for user:', userId);

    const response = await fetchWithLogging(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        user_id: String(userId),
      }),
    });

    const responseData = await response.json();

    if (responseData.status === 'success') {
      console.log('✅ Subscription expiry check completed:', responseData);
      return responseData;
    } else {
      throw new Error(responseData.msg || 'Failed to check subscription expiry');
    }
  } catch (error: any) {
    console.error('❌ Error checking subscription expiry:', error);
    throw error;
  }
};
