/**
 * React Query hooks for live prices
 */

import { useQuery } from '@tanstack/react-query';
import { getLivePrices, LivePrice, LivePricesResponse } from '../services/api/v2/livePrices';
import { queryKeys } from '../services/api/queryKeys';

/**
 * Hook to fetch live prices
 * @param location - Optional filter by location
 * @param category - Optional filter by category
 * @param enabled - Whether the query should run
 * @param refresh - Whether to force refresh from server (bypass cache)
 */
export const useLivePrices = (
  location?: string,
  category?: string,
  enabled: boolean = true,
  refresh: boolean = false
) => {
  return useQuery<LivePricesResponse>({
    queryKey: queryKeys.livePrices.list(location, category, refresh),
    queryFn: () => getLivePrices(location, category, refresh),
    enabled,
    staleTime: refresh ? 0 : 5 * 60 * 1000, // No stale time if refreshing, otherwise 5 minutes (data considered fresh)
    gcTime: 12 * 60 * 60 * 1000, // 12 hours - keep data in cache for 12 hours when new data arrives
    refetchOnMount: true,
    refetchOnWindowFocus: true, // Refetch when app comes to foreground to get latest data
    // Note: Data will be cached for 12 hours. When new data arrives from server, it will be cached for another 12 hours.
    // App will get fresh data on next mount or when coming to foreground, but cached data persists for 12 hours.
  });
};
