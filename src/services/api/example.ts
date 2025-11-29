/**
 * Example API service functions
 * Replace these with your actual API endpoints
 */

import { API_CONFIG, ApiException } from './client';
import { queryKeys } from './queryKeys';

// Example: Fetch user profile
export const fetchUserProfile = async (userId: string | number) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users/${userId}`, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new ApiException(
        `Failed to fetch user: ${response.statusText}`,
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    throw new ApiException('Network error occurred');
  }
};

// Example: Fetch shops list
export const fetchShops = async (filters?: { shop_type?: number; location?: string }) => {
  try {
    const queryParams = new URLSearchParams();
    if (filters?.shop_type) {
      queryParams.append('shop_type', filters.shop_type.toString());
    }
    if (filters?.location) {
      queryParams.append('location', filters.location);
    }

    const url = `${API_CONFIG.baseURL}/shops${queryParams.toString() ? `?${queryParams}` : ''}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: API_CONFIG.headers,
    });

    if (!response.ok) {
      throw new ApiException(
        `Failed to fetch shops: ${response.statusText}`,
        response.status
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    throw new ApiException('Network error occurred');
  }
};

// Example: Create order
export const createOrder = async (orderData: {
  shop_id: number;
  items: Array<{ product_id: number; quantity: number }>;
}) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/orders`, {
      method: 'POST',
      headers: API_CONFIG.headers,
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiException(
        errorData.message || `Failed to create order: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    throw new ApiException('Network error occurred');
  }
};

// Example: Update user profile
export const updateUserProfile = async (
  userId: string | number,
  profileData: { name?: string; email?: string; address?: string }
) => {
  try {
    const response = await fetch(`${API_CONFIG.baseURL}/users/${userId}`, {
      method: 'PUT',
      headers: API_CONFIG.headers,
      body: JSON.stringify(profileData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new ApiException(
        errorData.message || `Failed to update profile: ${response.statusText}`,
        response.status,
        errorData
      );
    }

    return await response.json();
  } catch (error) {
    if (error instanceof ApiException) {
      throw error;
    }
    throw new ApiException('Network error occurred');
  }
};

