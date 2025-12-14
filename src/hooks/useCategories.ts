/**
 * React Query hooks for categories and subcategories management
 */

import { useApiQuery, useApiMutation } from './index';
import { 
  getCategories, 
  getSubcategories, 
  getCategoriesWithSubcategories,
  Category,
  Subcategory,
  CategoriesResponse,
  SubcategoriesResponse,
} from '../services/api/v2/categories';
import { 
  getUserCategories, 
  getUserSubcategories,
  updateUserCategories,
  updateUserSubcategories,
  removeUserCategory,
  removeUserSubcategories,
} from '../services/api/v2/profile';
import { queryKeys } from '../services/api/queryKeys';

/**
 * Hook to get all categories
 */
export const useCategories = (userType?: 'b2b' | 'b2c' | 'all', enabled = true) => {
  return useApiQuery<CategoriesResponse>({
    queryKey: queryKeys.categories.byUserType(userType),
    queryFn: () => getCategories(userType),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
  });
};

/**
 * Hook to get subcategories
 */
export const useSubcategories = (
  categoryId?: number,
  userType?: 'b2b' | 'b2c' | 'all',
  enabled = true
) => {
  return useApiQuery<SubcategoriesResponse>({
    queryKey: queryKeys.subcategories.byCategory(categoryId || 0, userType),
    queryFn: () => getSubcategories(categoryId, userType),
    enabled: enabled && !!categoryId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to get categories with subcategories
 */
export const useCategoriesWithSubcategories = (
  userType?: 'b2b' | 'b2c' | 'all',
  enabled = true
) => {
  return useApiQuery({
    queryKey: [...queryKeys.categories.all, 'withSubcategories', userType || 'all'],
    queryFn: () => getCategoriesWithSubcategories(userType),
    enabled,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

/**
 * Hook to get user's operating categories
 */
export const useUserCategories = (
  userId: string | number | null | undefined,
  enabled = true
) => {
  return useApiQuery({
    queryKey: queryKeys.userCategories.byUser(userId!),
    queryFn: () => getUserCategories(userId!),
    enabled: enabled && !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
};

/**
 * Hook to get user's operating subcategories
 */
export const useUserSubcategories = (
  userId: string | number | null | undefined,
  enabled = true
) => {
  return useApiQuery({
    queryKey: queryKeys.userSubcategories.byUser(userId!),
    queryFn: () => getUserSubcategories(userId!),
    enabled: enabled && !!userId,
    staleTime: 2 * 60 * 1000, // 2 minutes
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true, // Always refetch when component mounts
    refetchOnWindowFocus: true, // Refetch when window regains focus
  });
};

/**
 * Hook to update user's operating categories
 */
export const useUpdateUserCategories = (userId: string | number) => {
  return useApiMutation({
    mutationFn: (categoryIds: number[]) => updateUserCategories(userId, categoryIds),
    invalidateQueries: [
      ['userCategories'],
      ['categories'],
    ],
  });
};

/**
 * Hook to update user's operating subcategories
 */
export const useUpdateUserSubcategories = (userId: string | number) => {
  return useApiMutation({
    mutationFn: (subcategories: Array<{ subcategoryId: number; customPrice: string; priceUnit: string }>) => 
      updateUserSubcategories(userId, subcategories),
    invalidateQueries: [
      queryKeys.userSubcategories.byUser(userId),
      queryKeys.userCategories.byUser(userId),
    ],
  });
};

/**
 * Hook to remove a category and all its subcategories
 */
export const useRemoveUserCategory = (userId: string | number) => {
  return useApiMutation({
    mutationFn: (categoryId: string | number) => 
      removeUserCategory(userId, categoryId),
    invalidateQueries: [
      queryKeys.userSubcategories.byUser(userId),
      queryKeys.userCategories.byUser(userId),
    ],
  });
};

/**
 * Hook to remove specific subcategories
 */
export const useRemoveUserSubcategories = (userId: string | number) => {
  return useApiMutation({
    mutationFn: (subcategoryIds: number[]) => 
      removeUserSubcategories(userId, subcategoryIds),
    invalidateQueries: [
      queryKeys.userSubcategories.byUser(userId),
      queryKeys.userCategories.byUser(userId),
    ],
  });
};
