/**
 * V2 Location API
 * Handles location tracking for orders
 */

import { API_BASE_URL, API_KEY } from '../apiConfig';

export interface OrderLocation {
  order_id: number;
  vendor: {
    user_id: number;
    user_type: string;
    latitude: number;
    longitude: number;
    timestamp: number;
  };
}

/**
 * Get location of vendor assigned to specific order
 * GET /api/v2/location/order/:orderId
 */
export const getLocationByOrder = async (
  orderId: number | string
): Promise<OrderLocation | null> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v2/location/order/${orderId}`,
      {
        method: 'GET',
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        // Location not found - vendor may not have started tracking yet
        return null;
      }
      throw new Error(`Failed to get location: ${response.statusText}`);
    }

    const result = await response.json();

    if (result.status === 'error') {
      return null;
    }

    return result.data || null;
  } catch (error: any) {
    console.error('Error getting location by order:', error);
    return null;
  }
};




