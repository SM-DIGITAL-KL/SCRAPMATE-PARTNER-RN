/**
 * V2 Subscription Packages API Service
 * Handles fetching subscription packages for B2B and B2C users
 */

import { buildApiUrl, getApiHeaders, API_ROUTES, fetchWithLogging } from '../apiConfig';

export interface SubscriptionPackage {
  id: string;
  name: string;
  price: number;
  duration: string; // 'month', 'year', 'order'
  description?: string;
  features: string[];
  popular?: boolean;
  upiId?: string;
  merchantName?: string;
  userType?: 'b2b' | 'b2c';
  isActive?: boolean;
}

export interface SubscriptionPackagesResponse {
  status: 'success' | 'error';
  message?: string;
  data: SubscriptionPackage[];
}

/**
 * Get subscription packages for a specific user type
 * @param userType - 'b2b' or 'b2c'
 * @returns Promise with subscription packages
 */
export const getSubscriptionPackages = async (
  userType: 'b2b' | 'b2c'
): Promise<SubscriptionPackagesResponse> => {
  try {
    const url = buildApiUrl(`${API_ROUTES.V2}/subscription-packages?userType=${userType}`);
    const headers = getApiHeaders();

    console.log('📦 Fetching subscription packages for:', userType);
    console.log('   URL:', url);

    const response = await fetchWithLogging(url, {
      method: 'GET',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    const data: SubscriptionPackagesResponse = await response.json();
    
    console.log('✅ Subscription packages fetched:', data.data?.length || 0, 'packages');
    
    return data;
  } catch (error: any) {
    console.error('❌ Error fetching subscription packages:', error);
    throw error;
  }
};

