import { API_BASE_URL, API_KEY } from '../apiConfig';

export interface MonthlyBreakdownItem {
  month: number;
  monthName: string;
  year: number;
  earnings: number;
  orderCount: number;
}

export interface MonthlyBreakdownResponse {
  monthlyBreakdown: MonthlyBreakdownItem[];
  totalEarnings: number;
  totalOrders: number;
  currency: 'INR' | 'USD';
  period: string;
}

/**
 * Get monthly earnings breakdown for a user
 * @param userId - User ID
 * @param type - Type of user: 'customer', 'shop', or 'delivery'
 * @param months - Number of months to include (default: 6)
 */
export const getMonthlyBreakdown = async (
  userId: number | undefined,
  type: 'customer' | 'shop' | 'delivery' = 'customer',
  months: number = 6
): Promise<MonthlyBreakdownResponse> => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const response = await fetch(
    `${API_BASE_URL}/v2/earnings/monthly-breakdown/${userId}?type=${type}&months=${months}`,
    {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch monthly breakdown: ${response.statusText}`);
  }

  const data = await response.json();
  
  if (data.status === 'error') {
    throw new Error(data.msg || 'Failed to fetch monthly breakdown');
  }

  return data.data;
};





