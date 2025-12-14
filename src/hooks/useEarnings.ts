import { useQuery } from '@tanstack/react-query';
import { getMonthlyBreakdown, MonthlyBreakdownResponse } from '../services/api/v2/earnings';
import { queryKeys } from '../services/api/queryKeys';

/**
 * Hook to fetch monthly earnings breakdown for a user
 * @param userId - User ID
 * @param type - Type of user: 'customer', 'shop', or 'delivery'
 * @param months - Number of months to include (default: 6)
 * @param enabled - Whether the query should run
 */
export const useMonthlyBreakdown = (
  userId: number | undefined,
  type: 'customer' | 'shop' | 'delivery' = 'customer',
  months: number = 6,
  enabled: boolean = true
) => {
  return useQuery<MonthlyBreakdownResponse>({
    queryKey: queryKeys.earnings.monthlyBreakdown(userId, type, months),
    queryFn: () => getMonthlyBreakdown(userId!, type, months),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
};



