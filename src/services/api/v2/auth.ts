/**
 * V2 Auth API Service
 * Handles authentication with phone number and OTP
 */

import { buildApiUrl, getApiHeaders, API_ROUTES, fetchWithLogging } from '../apiConfig';

export interface LoginResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    otp: string;
    isNewUser: boolean;
    userType: 'b2b' | 'b2c' | 'delivery' | null;
    userId: number | null;
  } | null;
}

export interface VerifyOtpResponse {
  status: 'success' | 'error';
  message: string;
  data: {
    user: any;
    token: string;
    dashboardType: 'b2b' | 'b2c' | 'delivery';
    allowedDashboards: ('b2b' | 'b2c' | 'delivery')[];
    b2bStatus?: 'new_user' | 'pending' | 'approved' | 'rejected' | null; // B2B signup status
  } | null;
}

/**
 * Send OTP to phone number
 */
export const sendOtp = async (phoneNumber: string): Promise<LoginResponse> => {
  try {
    const url = buildApiUrl(API_ROUTES.v2.auth.login);
    const response = await fetchWithLogging(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({ phoneNumber }),
    });

    // Check if response is OK before parsing
    if (!response.ok) {
      // Try to parse error response as JSON
      let errorMessage = `Failed to send OTP (Status: ${response.status})`;
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch (e) {
        // If not JSON, try to get text
        try {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        } catch (e2) {
          // If that also fails, use default message
        }
      }
      throw new Error(errorMessage);
    }

    // Parse successful response
    let data: LoginResponse;
    try {
      data = await response.json();
    } catch (e) {
      throw new Error('Invalid response format from server');
    }

    // Check for error status in response (even if HTTP status is 200)
    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to send OTP');
    }

    return data;
  } catch (error: any) {
    console.error('Send OTP error:', error);
    // Preserve the original error message if it exists
    if (error.message) {
      throw error;
    }
    throw new Error('Network error occurred. Please check your connection and try again.');
  }
};

/**
 * Verify OTP and complete login
 */
export const verifyOtp = async (
  phoneNumber: string,
  otp: string,
  joinType?: 'b2b' | 'b2c' | 'delivery'
): Promise<VerifyOtpResponse> => {
  try {
    const url = buildApiUrl(API_ROUTES.v2.auth.verifyOtp);
    const response = await fetchWithLogging(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        phoneNumber,
        otp,
        joinType,
      }),
    });

    const data = await response.json();

    // Log the response to help debug
    console.log('📥 Verify OTP Response:', JSON.stringify(data, null, 2));
    if (data.data && data.data.b2bStatus) {
      console.log('✅ b2bStatus found in response:', data.data.b2bStatus);
    } else {
      console.log('⚠️  b2bStatus NOT found in response');
      console.log('   Response data keys:', data.data ? Object.keys(data.data) : 'No data');
    }

    // Check for error status in response (even if HTTP status is 200)
    if (data.status === 'error') {
      throw new Error(data.message || 'Failed to verify OTP');
    }

    if (!response.ok) {
      throw new Error(data.message || 'Failed to verify OTP');
    }

    return data;
  } catch (error: any) {
    throw new Error(error.message || 'Network error occurred');
  }
};

