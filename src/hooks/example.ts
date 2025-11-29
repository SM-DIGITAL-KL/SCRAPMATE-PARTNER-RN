/**
 * Example hooks using React Query
 * Replace these with your actual API hooks
 */

import { useApiQuery, useApiMutation, useInfiniteApiQuery } from './index';
import { queryKeys } from '../services/api/queryKeys';
import { fetchUserProfile, fetchShops, createOrder, updateUserProfile } from '../services/api/example';

// Example: Use user profile query
export const useUserProfile = (userId: string | number, enabled = true) => {
  return useApiQuery({
    queryKey: queryKeys.users.detail(userId),
    queryFn: () => fetchUserProfile(userId),
    enabled: enabled && !!userId,
  });
};

// Example: Use shops list query
export const useShops = (filters?: { shop_type?: number; location?: string }) => {
  return useApiQuery({
    queryKey: queryKeys.shops.list(filters),
    queryFn: () => fetchShops(filters),
  });
};

// Example: Use create order mutation
export const useCreateOrder = () => {
  return useApiMutation({
    mutationFn: createOrder,
    invalidateQueries: [
      queryKeys.orders.lists(),
      queryKeys.dashboard.stats(),
    ],
    onSuccess: (data) => {
      console.log('Order created successfully:', data);
    },
    onError: (error) => {
      console.error('Failed to create order:', error);
    },
  });
};

// Example: Use update profile mutation
export const useUpdateProfile = (userId: string | number) => {
  return useApiMutation({
    mutationFn: (profileData: { name?: string; email?: string; address?: string }) =>
      updateUserProfile(userId, profileData),
    invalidateQueries: [
      queryKeys.users.detail(userId),
      queryKeys.users.current(),
    ],
    onSuccess: () => {
      console.log('Profile updated successfully');
    },
  });
};

// Example: Use infinite query for paginated orders
export const useInfiniteOrders = (filters?: { status?: string }) => {
  return useInfiniteApiQuery({
    queryKey: queryKeys.orders.list(filters),
    queryFn: async (pageParam) => {
      // Replace with your actual paginated API call
      const response = await fetch(
        `${process.env.API_BASE_URL || 'https://api.scrapmate.co.in/api'}/orders?page=${pageParam || 1}`
      );
      const data = await response.json();
      return {
        data: data.orders || [],
        nextCursor: data.nextPage || null,
        hasMore: !!data.nextPage,
      };
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
};

