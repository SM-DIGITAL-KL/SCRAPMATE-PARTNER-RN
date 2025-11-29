/**
 * Custom hook for API queries with React Query
 */

import { useQuery, UseQueryOptions, UseQueryResult } from '@tanstack/react-query';
import { parseError, ApiError } from '../services/api/client';

export interface UseApiQueryOptions<TData, TError = ApiError> 
  extends Omit<UseQueryOptions<TData, TError>, 'queryFn'> {
  queryFn: () => Promise<TData>;
}

/**
 * Enhanced useQuery hook with automatic error parsing
 */
export function useApiQuery<TData = unknown, TError = ApiError>(
  options: UseApiQueryOptions<TData, TError>
): UseQueryResult<TData, TError> {
  return useQuery<TData, TError>({
    ...options,
    queryFn: async () => {
      try {
        return await options.queryFn();
      } catch (error) {
        const parsedError = parseError(error) as TError;
        throw parsedError;
      }
    },
  });
}

