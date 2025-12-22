/**
 * FCM API Service
 * Handles FCM token storage and management API calls
 */

import { API_BASE_URL, API_KEY, getApiHeaders, buildApiUrl } from '../apiConfig';

/**
 * Store FCM token on the server
 * @param userId - User ID
 * @param fcmToken - FCM token to store
 */
export const storeFcmToken = async (
  userId: string | number,
  fcmToken: string
): Promise<void> => {
  try {
    const url = buildApiUrl('/fcm_token_store');
    
    const response = await fetch(url, {
      method: 'POST',
      headers: getApiHeaders(),
      body: JSON.stringify({
        user_id: userId,
        fcm_token: fcmToken,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.msg || `Failed to store FCM token: ${response.statusText}`
      );
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.msg || 'Failed to store FCM token');
    }

    console.log('✅ FCM token stored successfully');
  } catch (error: any) {
    console.error('❌ Error storing FCM token:', error);
    throw error;
  }
};

/**
 * Clear FCM token from the server
 * @param userId - User ID
 */
export const clearFcmToken = async (userId: string | number): Promise<void> => {
  try {
    const url = buildApiUrl(`/fcmTokenClear/${userId}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.msg || `Failed to clear FCM token: ${response.statusText}`
      );
    }

    const result = await response.json();
    
    if (result.status === 'error') {
      throw new Error(result.msg || 'Failed to clear FCM token');
    }

    console.log('✅ FCM token cleared successfully');
  } catch (error: any) {
    console.error('❌ Error clearing FCM token:', error);
    throw error;
  }
};

