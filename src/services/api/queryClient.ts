/**
 * React Query Client Configuration
 * Configured with optimal defaults for React Native
 */

import { QueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Create AsyncStorage persister for offline support
// Note: Install @tanstack/query-async-storage-persister for persistence
// npm install @tanstack/query-async-storage-persister
export let asyncStoragePersister: any = null;

try {
  const { createAsyncStoragePersister } = require('@tanstack/query-async-storage-persister');
  asyncStoragePersister = createAsyncStoragePersister({
    storage: AsyncStorage,
    key: 'REACT_QUERY_OFFLINE_CACHE',
    throttleTime: 1000, // Throttle writes to AsyncStorage
  });
} catch (e) {
  console.warn('@tanstack/query-async-storage-persister not installed. Persistence disabled.');
}

/**
 * Default query options
 */
const defaultQueryOptions = {
  queries: {
    // Cache time: 5 minutes
    gcTime: 1000 * 60 * 5,
    // Stale time: 1 minute (data is considered fresh for 1 minute)
    staleTime: 1000 * 60 * 1,
    // Retry failed requests 3 times
    retry: 3,
    // Retry delay increases exponentially
    retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
    // Refetch on window focus (useful for web, but also works for app coming to foreground)
    refetchOnWindowFocus: true,
    // Refetch on reconnect
    refetchOnReconnect: true,
    // Don't refetch on mount if data is fresh
    refetchOnMount: true,
    // Network mode: online (only fetch when online)
    networkMode: 'online' as const,
  },
  mutations: {
    // Retry failed mutations once
    retry: 1,
    // Retry delay
    retryDelay: 1000,
    // Network mode: online
    networkMode: 'online' as const,
  },
};

/**
 * Create and configure QueryClient
 */
export const queryClient = new QueryClient({
  defaultOptions: defaultQueryOptions,
});

/**
 * Reset query cache
 */
export const resetQueryCache = () => {
  queryClient.clear();
};

/**
 * Invalidate all queries
 */
export const invalidateAllQueries = () => {
  queryClient.invalidateQueries();
};

/**
 * Prefetch query data
 */
export const prefetchQuery = async <T>(
  queryKey: readonly unknown[],
  queryFn: () => Promise<T>
) => {
  await queryClient.prefetchQuery({
    queryKey,
    queryFn,
  });
};

