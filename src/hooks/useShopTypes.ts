/**
 * React Query hooks for Shop Types and Dashboard Management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getShopTypes,
  getUserDashboards,
  validateDashboard,
  switchDashboard,
  ShopType,
  UserDashboardInfo,
  DashboardValidation,
  DashboardSwitchResult,
} from '../services/api/v2/shopTypes';
import { queryKeys } from '../services/api/queryKeys';
import { useApiQuery } from './useApiQuery';
import { useApiMutation } from './useApiMutation';

/**
 * Hook to get all shop types
 */
export const useShopTypes = () => {
  return useApiQuery({
    queryKey: queryKeys.shopTypes.all(),
    queryFn: () => getShopTypes(),
    staleTime: 5 * 60 * 1000, // 5 minutes - shop types don't change often
  });
};

/**
 * Hook to get user's allowed dashboards
 */
export const useUserDashboards = (userId: number | string | null) => {
  return useApiQuery({
    queryKey: queryKeys.shopTypes.userDashboards(userId),
    queryFn: () => {
      if (!userId) {
        throw new Error('User ID is required');
      }
      return getUserDashboards(userId);
    },
    enabled: !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
};

/**
 * Hook to validate dashboard access
 */
export const useValidateDashboard = () => {
  return useApiMutation({
    mutationFn: ({
      userId,
      dashboardType,
    }: {
      userId: number | string;
      dashboardType: 'b2b' | 'b2c' | 'delivery';
    }) => validateDashboard(userId, dashboardType),
  });
};

/**
 * Hook to switch dashboard
 */
export const useSwitchDashboard = () => {
  const queryClient = useQueryClient();

  return useApiMutation({
    mutationFn: ({
      userId,
      targetDashboard,
    }: {
      userId: number | string;
      targetDashboard: 'b2b' | 'b2c' | 'delivery';
    }) => switchDashboard(userId, targetDashboard),
    invalidateQueries: [
      queryKeys.shopTypes.userDashboards(null), // Invalidate all user dashboard queries
    ],
    onSuccess: (data, variables) => {
      // Invalidate specific user's dashboard query
      queryClient.invalidateQueries({
        queryKey: queryKeys.shopTypes.userDashboards(variables.userId),
      });
    },
  });
};

