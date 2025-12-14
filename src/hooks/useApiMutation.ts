/**
 * Custom hook for API mutations with React Query
 */

import { 
  useMutation, 
  UseMutationOptions, 
  UseMutationResult,
  useQueryClient,
} from '@tanstack/react-query';
import { parseError, ApiError } from '../services/api/client';

export interface UseApiMutationOptions<TData, TVariables, TError = ApiError>
  extends Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateQueries?: readonly unknown[][];
  onSuccess?: (data: TData, variables: TVariables, context: unknown) => void | Promise<void>;
  onError?: (error: TError, variables: TVariables, context: unknown) => void | Promise<void>;
}

/**
 * Enhanced useMutation hook with automatic error parsing and query invalidation
 */
export function useApiMutation<TData = unknown, TVariables = void, TError = ApiError>(
  options: UseApiMutationOptions<TData, TVariables, TError>
): UseMutationResult<TData, TError, TVariables> {
  const queryClient = useQueryClient();

  const { invalidateQueries, onSuccess, onError, ...mutationOptions } = options;

  return useMutation<TData, TError, TVariables>({
    ...mutationOptions,
    mutationFn: async (variables: TVariables) => {
      try {
        return await options.mutationFn(variables);
      } catch (error) {
        const parsedError = parseError(error) as TError;
        throw parsedError;
      }
    },
    onSuccess: async (data, variables, context) => {
      // Invalidate specified queries after successful mutation
      // Use refetchType: 'active' to only refetch queries that are currently being used
      if (invalidateQueries) {
        invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ 
            queryKey,
            refetchType: 'active' // Only refetch active queries for better performance
          });
        });
      }

      // Call custom onSuccess if provided
      if (onSuccess) {
        await onSuccess(data, variables, context);
      }
    },
    onError: async (error, variables, context) => {
      // Call custom onError if provided
      if (onError) {
        await onError(error, variables, context);
      }
    },
  });
}

