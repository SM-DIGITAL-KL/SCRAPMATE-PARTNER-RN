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
 */
export const useLivePrices = (
  location?: string,
  category?: string,
  enabled: boolean = true
) => {
  return useQuery<LivePricesResponse>({
    queryKey: queryKeys.livePrices.list(location, category),
    queryFn: () => getLivePrices(location, category),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: false,
  });
};
