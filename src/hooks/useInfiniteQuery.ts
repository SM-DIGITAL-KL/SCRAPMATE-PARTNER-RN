/**
 * Custom hook for infinite queries (pagination) with React Query
 */

import { 
  useInfiniteQuery as useReactQueryInfiniteQuery,
  UseInfiniteQueryOptions,
  UseInfiniteQueryResult,
} from '@tanstack/react-query';
import { parseError, ApiError } from '../services/api/client';

export interface InfiniteQueryPage<TData> {
  data: TData[];
  nextCursor?: string | number | null;
  hasMore?: boolean;
}

export interface UseInfiniteApiQueryOptions<TData, TError = ApiError>
  extends Omit<
    UseInfiniteQueryOptions<InfiniteQueryPage<TData>, TError>,
    'queryFn' | 'getNextPageParam'
  > {
  queryFn: (pageParam?: string | number) => Promise<InfiniteQueryPage<TData>>;
  getNextPageParam?: (lastPage: InfiniteQueryPage<TData>) => string | number | undefined | null;
}

/**
 * Enhanced useInfiniteQuery hook with automatic error parsing
 */
export function useInfiniteApiQuery<TData = unknown, TError = ApiError>(
  options: UseInfiniteApiQueryOptions<TData, TError>
): UseInfiniteQueryResult<InfiniteQueryPage<TData>, TError> {
  return useReactQueryInfiniteQuery<InfiniteQueryPage<TData>, TError>({
    ...options,
    queryFn: async ({ pageParam }) => {
      try {
        return await options.queryFn(pageParam);
      } catch (error) {
        const parsedError = parseError(error) as TError;
        throw parsedError;
      }
    },
    getNextPageParam: options.getNextPageParam || ((lastPage) => lastPage.nextCursor),
  });
}

