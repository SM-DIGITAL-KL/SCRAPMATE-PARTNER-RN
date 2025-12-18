import { API_BASE_URL, API_KEY } from '../apiConfig';

export interface RecyclingStats {
  user_id: number;
  user_type: 'customer' | 'shop' | 'delivery';
  total_recycled_weight_kg: number;
  total_carbon_offset_kg: number;
  total_orders_completed: number;
  category_breakdown: Array<{
    category_id: number;
    category_name: string;
    weight: number;
    carbon_offset: number;
    order_count: number;
  }>;
  trees_equivalent: number;
  cars_off_road_days: number;
}

/**
 * Get recycling statistics for a user
 * @param userId - User ID
 * @param type - Type of user: 'customer', 'shop', or 'delivery'
 */
export const getRecyclingStats = async (
  userId: number,
  type: 'customer' | 'shop' | 'delivery' = 'customer'
): Promise<RecyclingStats> => {
  const response = await fetch(
    `${API_BASE_URL}/v2/recycling/stats/${userId}?type=${type}`,
    {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch recycling stats: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.status === 'error') {
    throw new Error(data.msg || 'Failed to fetch recycling stats');
  }

  return data.data;
};





