import { useQuery } from '@tanstack/react-query';
import { getRecyclingStats, getVendorRecyclingStats, RecyclingStats } from '../services/api/v2/recycling';
import { queryKeys } from '../services/api/queryKeys';

/**
 * Hook to fetch recycling statistics for a user
 * @param userId - User ID
 * @param type - Type of user: 'customer', 'shop', or 'delivery'
 * @param enabled - Whether the query should run
 */
export const useRecyclingStats = (
  userId: number | undefined,
  type: 'customer' | 'shop' | 'delivery' = 'customer',
  enabled: boolean = true
) => {
  return useQuery<RecyclingStats>({
    queryKey: queryKeys.recycling.stats(userId, type),
    queryFn: () => getRecyclingStats(userId!, type),
    enabled: enabled && !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
};

/**
 * Hook to fetch vendor recycling statistics for B2C vendors
 * Uses actual_weight from completed orders (status 5)
 * @param userId - User ID
 * @param enabled - Whether the query should run
 */
export const useVendorRecyclingStats = (
  userId: number | undefined,
  enabled: boolean = true
) => {
  return useQuery<RecyclingStats>({
    queryKey: [...queryKeys.recycling.stats(userId, 'shop'), 'vendor'],
    queryFn: () => getVendorRecyclingStats(userId!),
    enabled: enabled && !!userId,
    staleTime: 0, // Always consider data stale - refresh on every fetch to show latest completed orders
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window comes into focus
  });
};





