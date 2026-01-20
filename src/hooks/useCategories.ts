/**
 * React Query hooks for categories and subcategories management
 */

import { useRef } from 'react';
import { useApiQuery, useApiMutation } from './index';
import { 
  getCategories, 
  getSubcategories, 
  getCategoriesWithSubcategories,
  getUserSubcategoryRequests,
  getIncrementalUpdates,
  Category,
  Subcategory,
  CategoriesResponse,
  SubcategoriesResponse,
  UserSubcategoryRequestsResponse,
} from '../services/api/v2/categories';
import { 
  getUserCategories, 
  getUserSubcategories,
  updateUserCategories,
  updateUserSubcategories,
  removeUserCategory,
  removeUserSubcategories,
} from '../services/api/v2/profile';
import {
  getCachedUserCategories,
  saveCachedUserCategories,
  getLastUpdatedOn as getCategoriesLastUpdatedOn,
  isCacheValid as isCategoriesCacheValid,
  mergeIncrementalUserCategoriesUpdates,
  clearUserCategoriesCache,
} from '../services/cache/userCategoriesCache';
import {
  getCachedUserSubcategories,
  saveCachedUserSubcategories,
  getLastUpdatedOn as getSubcategoriesLastUpdatedOn,
  isCacheValid as isSubcategoriesCacheValid,
  mergeIncrementalUserSubcategoriesUpdates,
  clearUserSubcategoriesCache,
} from '../services/cache/userSubcategoriesCache';
import {
  getCachedSubcategories,
  saveCachedSubcategories,
  getLastUpdatedOn as getSubcategoriesLastUpdatedOnGeneral,
  isCacheValid as isSubcategoriesCacheValidGeneral,
  mergeIncrementalSubcategoriesUpdates,
  clearSubcategoriesCache,
} from '../services/cache/subcategoriesCache';
import { queryClient } from '../services/api/queryClient';
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

// Global ref to prevent duplicate incremental update calls for subcategories
const incrementalUpdateFetchingRefsSubcategories = new Map<string, boolean>();

/**
 * Hook to get subcategories
 * Uses 365-day persistent cache with AsyncStorage and incremental updates
 */
export const useSubcategories = (
  categoryId?: number,
  userType?: 'b2b' | 'b2c' | 'all',
  enabled = true
) => {
  const userTypeStr = userType || 'all';
  const cacheKey = `${categoryId || 'all'}_${userTypeStr}`;
  
  return useApiQuery<SubcategoriesResponse>({
    queryKey: queryKeys.subcategories.byCategory(categoryId || 0, userType),
    structuralSharing: false,
    queryFn: async () => {
      console.log('🔄 [useSubcategories] Starting query (checking cache first)...');
      console.log(`   categoryId: ${categoryId}, userType: ${userTypeStr}`);
      
      // Check AsyncStorage cache first (365-day persistence)
      const cachedData = await getCachedSubcategories(categoryId, userTypeStr);
      const lastUpdatedOn = await getSubcategoriesLastUpdatedOnGeneral(categoryId, userTypeStr);
      const cacheIsValid = await isSubcategoriesCacheValidGeneral(categoryId, userTypeStr);

      if (cachedData && cacheIsValid && lastUpdatedOn) {
        console.log('📦 [useSubcategories] Found cached data in AsyncStorage');
        console.log(`   📊 Cached subcategories: ${cachedData.length}`);
        
        // Check if we're already fetching incremental updates
        const isFetching = incrementalUpdateFetchingRefsSubcategories.get(cacheKey);
        if (isFetching) {
          console.log('⏸️ [useSubcategories] Already fetching incremental updates - skipping duplicate call');
          return {
            status: 'success',
            msg: 'Subcategories retrieved successfully (cached, duplicate call prevented)',
            data: cachedData,
            hitBy: 'Cache',
          };
        }
        
        // Try to get incremental updates in background
        try {
          // Mark as fetching
          incrementalUpdateFetchingRefsSubcategories.set(cacheKey, true);
          
          // Subtract 5 seconds from lastUpdatedOn to ensure we don't miss updates
          const lastUpdatedDate = new Date(lastUpdatedOn);
          const adjustedTimestamp = new Date(lastUpdatedDate.getTime() - 5000).toISOString(); // 5 seconds buffer
          
          console.log('🌐 [useSubcategories] Calling API for incremental updates...');
          console.log(`   lastUpdatedOn (original): ${lastUpdatedOn}`);
          console.log(`   lastUpdatedOn (adjusted): ${adjustedTimestamp} (5s buffer)`);
          
          const updates = await getIncrementalUpdates('all', adjustedTimestamp);
          
          console.log('📥 [useSubcategories] Incremental updates API response received');
          console.log(`   hasUpdates: ${updates.meta?.hasUpdates}`);
          console.log(`   subcategories_count: ${updates.data?.subcategories?.length || 0}`);
          console.log(`   deleted_subcategories_count: ${updates.data?.deleted?.subcategories?.length || 0}`);
          
          if (updates.meta.hasUpdates || (updates.data?.deleted?.subcategories?.length || 0) > 0) {
            console.log('✅ [useSubcategories] Updates found - merging with cached data');
            console.log(`   📊 Cached subcategories before merge: ${cachedData.length}`);
            console.log(`   📊 Updates to merge: ${updates.data?.subcategories?.length || 0} subcategories`);
            
            // Log which subcategories are in cache vs in updates
            if (updates.data?.subcategories && updates.data.subcategories.length > 0) {
              updates.data.subcategories.forEach(updateSub => {
                const inCache = cachedData.find(c => c.id === updateSub.id);
                console.log(`   🔍 Subcategory ID ${updateSub.id} (${updateSub.name}): ${inCache ? '✅ IN CACHE' : '❌ NOT IN CACHE'}`);
                if (inCache) {
                  console.log(`      Cached name: "${inCache.name}", Update name: "${updateSub.name}"`);
                  console.log(`      Cached price: "${inCache.default_price}", Update price: "${updateSub.default_price}"`);
                }
              });
            }
            
            // Merge incremental updates with cached data
            const mergedData = mergeIncrementalSubcategoriesUpdates(cachedData, {
              subcategories: updates.data?.subcategories || [],
              deleted: updates.data?.deleted,
              lastUpdatedOn: updates.meta.lastUpdatedOn,
            }, categoryId);
            
            console.log(`   📊 Merged subcategories after merge: ${mergedData.length}`);
            
            // Verify merged data has the updates
            if (updates.data?.subcategories && updates.data.subcategories.length > 0) {
              updates.data.subcategories.forEach(updateSub => {
                const mergedSub = mergedData.find(m => m.id === updateSub.id);
                if (mergedSub) {
                  const nameMatch = mergedSub.name === updateSub.name;
                  const priceMatch = mergedSub.default_price === updateSub.default_price;
                  console.log(`   ✅ Verification - Subcategory ID ${updateSub.id}:`);
                  console.log(`      Name match: ${nameMatch ? '✅' : '❌'} ("${mergedSub.name}" vs "${updateSub.name}")`);
                  console.log(`      Price match: ${priceMatch ? '✅' : '❌'} ("${mergedSub.default_price}" vs "${updateSub.default_price}")`);
                  if (!nameMatch || !priceMatch) {
                    console.error(`   ❌ ERROR: Merge verification failed for subcategory ID ${updateSub.id}!`);
                  }
                } else {
                  console.warn(`   ⚠️  Subcategory ID ${updateSub.id} not found in merged data!`);
                }
              });
            }
            
            // Save merged data back to cache
            await saveCachedSubcategories(mergedData, updates.meta.lastUpdatedOn, categoryId, userTypeStr);
            
            // Create a new merged response with new object references
            // This ensures React Query detects the change and triggers a re-render
            // We create new object references for all nested data to ensure React Query sees it as changed
            const updatedResponse = {
              status: 'success' as const,
              msg: 'Subcategories retrieved successfully (cached + incremental updates)',
              data: mergedData.map(sub => ({
                ...sub,
                // Create new object reference for main_category if it exists
                main_category: sub.main_category ? { ...sub.main_category } : undefined,
              })),
              hitBy: 'Cache+Incremental',
            };
            
            // Log specific changes for debugging
            if (updates.data?.subcategories && updates.data.subcategories.length > 0) {
              console.log(`   📋 Updated subcategories from API:`, updates.data.subcategories.map(sub => {
                const cachedSub = cachedData.find(cached => cached.id === sub.id);
                const nameChanged = cachedSub && cachedSub.name !== sub.name;
                const imageChanged = cachedSub && cachedSub.image !== sub.image;
                const priceChanged = cachedSub && cachedSub.default_price !== sub.default_price;
                return {
                  id: sub.id,
                  name: sub.name,
                  hasImage: !!sub.image,
                  nameChanged: nameChanged ? 'YES ⚠️' : 'NO',
                  imageChanged: imageChanged ? 'YES ⚠️' : 'NO',
                  priceChanged: priceChanged ? 'YES ⚠️' : 'NO',
                  cachedName: cachedSub?.name,
                  cachedImage: cachedSub?.image ? 'present' : 'missing',
                  cachedPrice: cachedSub?.default_price,
                };
              }));
            }
            
            console.log('✅ [useSubcategories] Incremental update merged, saved, and React Query cache updated');
            console.log(`   📊 Final merged subcategories: ${mergedData.length}`);
            
            // Force React Query to update the cache immediately with new data
            // This ensures UI updates even if React Query doesn't detect the change automatically
            queryClient.setQueryData(queryKeys.subcategories.byCategory(categoryId || 0, userType), updatedResponse);
            
            // Always notify subscribers when incremental updates are received
            // This is important for image changes, name changes, price changes, deletions, and any other updates
            const hasAnyUpdates = (updates.data?.subcategories?.length || 0) > 0 ||
                                 (updates.data?.deleted?.subcategories?.length || 0) > 0;
            if (hasAnyUpdates) {
              const nameChanges = updates.data?.subcategories?.filter(updatedSub => {
                const existingSub = cachedData.find(c => c.id === updatedSub.id);
                return existingSub && existingSub.name !== updatedSub.name;
              }) || [];
              const imageChanges = updates.data?.subcategories?.filter(updatedSub => {
                const existingSub = cachedData.find(c => c.id === updatedSub.id);
                return existingSub && existingSub.image !== updatedSub.image;
              }) || [];
              const priceChanges = updates.data?.subcategories?.filter(updatedSub => {
                const existingSub = cachedData.find(c => c.id === updatedSub.id);
                return existingSub && existingSub.default_price !== updatedSub.default_price;
              }) || [];
              
              if (nameChanges.length > 0 || imageChanges.length > 0 || priceChanges.length > 0) {
                console.log(`🔄 [useSubcategories] Updates detected:`);
                console.log(`   - Name changes: ${nameChanges.length}`);
                console.log(`   - Image changes: ${imageChanges.length}`);
                console.log(`   - Price changes: ${priceChanges.length}`);
              }
              
              // Clear fetching flag
              incrementalUpdateFetchingRefsSubcategories.set(cacheKey, false);
              
              // Notify subscribers by invalidating with refetchType: 'none'
              // This ensures components re-render without triggering a refetch
              // The fetching guard prevents recursive calls
              queryClient.invalidateQueries({ 
                queryKey: queryKeys.subcategories.byCategory(categoryId || 0, userType),
                refetchType: 'none' // Don't refetch, just notify subscribers
              });
              
              console.log(`✅ [useSubcategories] Cache updated and subscribers notified (no refetch)`);
            } else {
              // Clear fetching flag if no updates
              incrementalUpdateFetchingRefsSubcategories.set(cacheKey, false);
            }
            
            // Return the updated response - React Query will automatically update the cache with this value
            return updatedResponse;
            
            return updatedResponse;
          } else {
            console.log('ℹ️ [useSubcategories] No updates - using cached data');
            // Clear fetching flag
            incrementalUpdateFetchingRefsSubcategories.set(cacheKey, false);
            // No updates, return cached data
            return {
              status: 'success',
              msg: 'Subcategories retrieved successfully (cached)',
              data: cachedData,
              hitBy: 'Cache',
            };
          }
        } catch (updateError: any) {
          console.warn('⚠️ [useSubcategories] Error getting incremental updates, using cached data:', updateError?.message || updateError);
          // Clear fetching flag on error
          incrementalUpdateFetchingRefsSubcategories.set(cacheKey, false);
          // If incremental update fails, return cached data
          return {
            status: 'success',
            msg: 'Subcategories retrieved successfully (cached, update failed)',
            data: cachedData,
            hitBy: 'Cache',
          };
        }
      } else {
        // No cache or cache expired, fetch from API
        console.log('🌐 [useSubcategories] No valid cache - fetching from API...');
        const response = await getSubcategories(categoryId, userType);
        
        // Save to AsyncStorage (365-day persistence)
        if (response.data) {
          const currentTimestamp = new Date().toISOString();
          await saveCachedSubcategories(response.data, currentTimestamp, categoryId, userTypeStr);
          console.log('💾 [useSubcategories] Data saved to AsyncStorage');
        }
        
        return {
          ...response,
          hitBy: 'API',
        };
      }
    },
    enabled: enabled,
    // Use long staleTime to prevent unnecessary refetches
    staleTime: 365 * 24 * 60 * 60 * 1000, // 365 days - data is considered fresh for 365 days
    gcTime: 365 * 24 * 60 * 60 * 1000, // 365 days - keep in React Query cache for 365 days
    // Don't refetch on mount/window focus by default - use cache instead
    // But the queryFn will check for incremental updates when cache exists
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
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
 * Uses 365-day persistent cache with AsyncStorage
 */
// Global refs to prevent duplicate incremental update calls
const incrementalUpdateFetchingRefs = {
  categories: new Map<string | number, boolean>(),
  subcategories: new Map<string | number, boolean>(),
};

export const useUserCategories = (
  userId: string | number | null | undefined,
  enabled = true,
  refetchOnMount = false // Default to false to use cache
) => {
  return useApiQuery({
    queryKey: queryKeys.userCategories.byUser(userId!),
    structuralSharing: false,
    queryFn: async () => {
      console.log('🔄 [useUserCategories] Starting query (checking cache first)...');
      
      // Check AsyncStorage cache first (365-day persistence)
      const cachedData = await getCachedUserCategories(userId!);
      const lastUpdatedOn = await getCategoriesLastUpdatedOn(userId!);
      const cacheIsValid = await isCategoriesCacheValid(userId!);

      if (cachedData && cacheIsValid && lastUpdatedOn) {
        console.log('📦 [useUserCategories] Found cached data in AsyncStorage');
        console.log(`   📊 Cached categories: ${cachedData.categories_count}`);
        
        // Check if we're already fetching incremental updates for this user
        const isFetching = incrementalUpdateFetchingRefs.categories.get(userId!);
        if (isFetching) {
          console.log('⏸️ [useUserCategories] Already fetching incremental updates - skipping duplicate call');
          return {
            status: 'success',
            msg: 'Operating categories retrieved successfully (cached, duplicate call prevented)',
            data: cachedData,
            hitBy: 'Cache',
          };
        }
        
        // Try to get incremental updates in background
        try {
          // Mark as fetching
          incrementalUpdateFetchingRefs.categories.set(userId!, true);
          // Subtract 5 seconds from lastUpdatedOn to ensure we don't miss updates
          const lastUpdatedDate = new Date(lastUpdatedOn);
          const adjustedTimestamp = new Date(lastUpdatedDate.getTime() - 5000).toISOString(); // 5 seconds buffer
          
          console.log('🌐 [useUserCategories] Calling API for incremental updates...');
          console.log(`   lastUpdatedOn (original): ${lastUpdatedOn}`);
          console.log(`   lastUpdatedOn (adjusted): ${adjustedTimestamp} (5s buffer)`);
          
          const updates = await getIncrementalUpdates('all', adjustedTimestamp);
          
          console.log('📥 [useUserCategories] Incremental updates API response received');
          console.log(`   hasUpdates: ${updates.meta?.hasUpdates}`);
          console.log(`   categories_count: ${updates.data?.categories?.length || 0}`);
          console.log(`   deleted_categories_count: ${updates.data?.deleted?.categories?.length || 0}`);
          
          if (updates.meta.hasUpdates || (updates.data?.deleted?.categories?.length || 0) > 0) {
            console.log('✅ [useUserCategories] Updates found - merging with cached data');
            
            // Merge incremental updates with cached data
            const mergedData = mergeIncrementalUserCategoriesUpdates(cachedData, {
              categories: updates.data?.categories || [],
              deleted: updates.data?.deleted,
              lastUpdatedOn: updates.meta.lastUpdatedOn,
            });
            
            // Save merged data back to cache
            await saveCachedUserCategories(mergedData, updates.meta.lastUpdatedOn, userId!);
            
            // Create a new merged response with new object references
            // This ensures React Query detects the change and triggers a re-render
            const updatedResponse = {
              status: 'success' as const,
              msg: 'Operating categories retrieved successfully (cached + incremental updates)',
              data: {
                ...mergedData,
                // Create new array references for categories
                categories: mergedData.categories.map(cat => ({ ...cat })),
                category_ids: [...mergedData.category_ids],
              },
              hitBy: 'Cache+Incremental',
            };
            
            // Log specific changes for debugging
            if (updates.data?.categories && updates.data.categories.length > 0) {
              console.log(`   📋 Updated categories from API:`, updates.data.categories.map(cat => {
                const cachedCat = cachedData.categories.find(cached => cached.id === cat.id);
                const nameChanged = cachedCat && cachedCat.name !== cat.name;
                const imageChanged = cachedCat && cachedCat.image !== cat.image;
                return {
                  id: cat.id,
                  name: cat.name,
                  hasImage: !!cat.image,
                  nameChanged: nameChanged ? 'YES ⚠️' : 'NO',
                  imageChanged: imageChanged ? 'YES ⚠️' : 'NO',
                  cachedName: cachedCat?.name,
                  cachedImage: cachedCat?.image ? 'present' : 'missing',
                };
              }));
            }
            
            console.log('✅ [useUserCategories] Incremental update merged, saved, and React Query cache updated');
            console.log(`   📊 Final merged categories: ${mergedData.categories_count}`);
            
            // Force React Query to update the cache immediately with new data
            // setQueryData automatically notifies all subscribers, so no need to invalidate
            // This prevents recursive API calls while ensuring UI updates
            queryClient.setQueryData(queryKeys.userCategories.byUser(userId!), updatedResponse);
            
            console.log(`✅ [useUserCategories] Cache updated via setQueryData - subscribers notified automatically`);
            
            // Clear fetching flag AFTER setting data
            incrementalUpdateFetchingRefs.categories.set(userId!, false);
            
            // Return the updated response - React Query will automatically update the cache with this value
            return updatedResponse;
          } else {
            console.log('ℹ️ [useUserCategories] No updates - using cached data');
            // Clear fetching flag
            incrementalUpdateFetchingRefs.categories.set(userId!, false);
            // No updates, return cached data
            return {
              status: 'success',
              msg: 'Operating categories retrieved successfully (cached)',
              data: cachedData,
              hitBy: 'Cache',
            };
          }
        } catch (updateError: any) {
          console.warn('⚠️ [useUserCategories] Error getting incremental updates, using cached data:', updateError?.message || updateError);
          // Clear fetching flag on error
          incrementalUpdateFetchingRefs.categories.set(userId!, false);
          // If incremental update fails, return cached data
          return {
            status: 'success',
            msg: 'Operating categories retrieved successfully (cached, update failed)',
            data: cachedData,
            hitBy: 'Cache',
          };
        }
      } else {
        // No cache or cache expired, fetch from API
        console.log('🌐 [useUserCategories] No valid cache - fetching from API...');
        const response = await getUserCategories(userId!);
        
        // Save to AsyncStorage (365-day persistence)
        if (response.data) {
          const currentTimestamp = new Date().toISOString();
          await saveCachedUserCategories(response.data, currentTimestamp, userId!);
          console.log('💾 [useUserCategories] Data saved to AsyncStorage');
        }
        
        return {
          ...response,
          hitBy: 'API',
        };
      }
    },
    enabled: enabled && !!userId,
    // Use long staleTime to prevent unnecessary refetches
    staleTime: 365 * 24 * 60 * 60 * 1000, // 365 days - data is considered fresh for 365 days
    gcTime: 365 * 24 * 60 * 60 * 1000, // 365 days - keep in React Query cache for 365 days
    // Don't refetch on mount/window focus by default - use cache instead
    refetchOnMount: refetchOnMount,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook to get user's operating subcategories
 * Uses 365-day persistent cache with AsyncStorage
 */
export const useUserSubcategories = (
  userId: string | number | null | undefined,
  enabled = true,
  refetchOnMount = false // Default to false to use cache
) => {
  return useApiQuery({
    queryKey: queryKeys.userSubcategories.byUser(userId!),
    structuralSharing: false,
    queryFn: async () => {
      console.log('🔄 [useUserSubcategories] Starting query (checking cache first)...');
      
      // Check AsyncStorage cache first (365-day persistence)
      const cachedData = await getCachedUserSubcategories(userId!);
      const lastUpdatedOn = await getSubcategoriesLastUpdatedOn(userId!);
      const cacheIsValid = await isSubcategoriesCacheValid(userId!);

      if (cachedData && cacheIsValid && lastUpdatedOn) {
        console.log('📦 [useUserSubcategories] Found cached data in AsyncStorage');
        console.log(`   📊 Cached subcategories: ${cachedData.subcategories.length}`);
        
        // Check if we're already fetching incremental updates for this user
        const isFetching = incrementalUpdateFetchingRefs.subcategories.get(userId!);
        if (isFetching) {
          console.log('⏸️ [useUserSubcategories] Already fetching incremental updates - skipping duplicate call');
          return {
            status: 'success',
            msg: 'Operating subcategories retrieved successfully (cached, duplicate call prevented)',
            data: cachedData,
            hitBy: 'Cache',
          };
        }
        
        // Try to get incremental updates in background
        try {
          // Mark as fetching
          incrementalUpdateFetchingRefs.subcategories.set(userId!, true);
          // Subtract 5 seconds from lastUpdatedOn to ensure we don't miss updates
          const lastUpdatedDate = new Date(lastUpdatedOn);
          const adjustedTimestamp = new Date(lastUpdatedDate.getTime() - 5000).toISOString(); // 5 seconds buffer
          
          console.log('🌐 [useUserSubcategories] Calling API for incremental updates...');
          console.log(`   lastUpdatedOn (original): ${lastUpdatedOn}`);
          console.log(`   lastUpdatedOn (adjusted): ${adjustedTimestamp} (5s buffer)`);
          
          const updates = await getIncrementalUpdates('all', adjustedTimestamp);
          
          console.log('📥 [useUserSubcategories] Incremental updates API response received');
          console.log(`   hasUpdates: ${updates.meta?.hasUpdates}`);
          console.log(`   subcategories_count: ${updates.data?.subcategories?.length || 0}`);
          console.log(`   deleted_subcategories_count: ${updates.data?.deleted?.subcategories?.length || 0}`);
          
          // Log which subcategories are being updated
          if (updates.data?.subcategories && updates.data.subcategories.length > 0) {
            console.log(`   📋 Updated subcategories from API:`, updates.data.subcategories.map(sub => ({
              id: sub.id,
              name: sub.name,
              hasImage: !!sub.image,
            })));
          }
          
          if (updates.meta.hasUpdates || (updates.data?.deleted?.subcategories?.length || 0) > 0) {
            console.log('✅ [useUserSubcategories] Updates found - merging with cached data');
            
            // Merge incremental updates with cached data
            const mergedData = mergeIncrementalUserSubcategoriesUpdates(cachedData, {
              subcategories: updates.data?.subcategories || [],
              deleted: updates.data?.deleted,
              lastUpdatedOn: updates.meta.lastUpdatedOn,
            });
            
            // Save merged data back to cache
            await saveCachedUserSubcategories(mergedData, updates.meta.lastUpdatedOn, userId!);
            
            // Create a new merged response with new object references
            // This ensures React Query detects the change and triggers a re-render
            const updatedResponse = {
              status: 'success' as const,
              msg: 'Operating subcategories retrieved successfully (cached + incremental updates)',
              data: {
                ...mergedData,
                // Create new array references for subcategories
                subcategories: mergedData.subcategories.map(sub => ({ ...sub })),
              },
              hitBy: 'Cache+Incremental',
            };
            
            // Log specific changes for debugging
            if (updates.data?.subcategories && updates.data.subcategories.length > 0) {
              console.log(`   📋 Updated subcategories from API:`, updates.data.subcategories.map(sub => {
                const cachedSub = cachedData.subcategories.find(cached => cached.subcategory_id === sub.id);
                const nameChanged = cachedSub && cachedSub.name !== sub.name;
                const imageChanged = cachedSub && cachedSub.image !== sub.image;
                const priceChanged = cachedSub && cachedSub.default_price !== sub.default_price;
                return {
                  id: sub.id,
                  name: sub.name,
                  hasImage: !!sub.image,
                  nameChanged: nameChanged ? 'YES ⚠️' : 'NO',
                  imageChanged: imageChanged ? 'YES ⚠️' : 'NO',
                  priceChanged: priceChanged ? 'YES ⚠️' : 'NO',
                  cachedName: cachedSub?.name,
                  cachedImage: cachedSub?.image ? 'present' : 'missing',
                  cachedPrice: cachedSub?.default_price,
                };
              }));
            }
            
            console.log('✅ [useUserSubcategories] Incremental update merged, saved, and React Query cache updated');
            console.log(`   📊 Final merged subcategories: ${mergedData.subcategories.length}`);
            
            // Force React Query to update the cache immediately with new data
            // setQueryData automatically notifies all subscribers, so no need to invalidate
            // This prevents recursive API calls while ensuring UI updates
            queryClient.setQueryData(queryKeys.userSubcategories.byUser(userId!), updatedResponse);
            
            console.log(`✅ [useUserSubcategories] Cache updated via setQueryData - subscribers notified automatically`);
            
            // Clear fetching flag AFTER setting data
            incrementalUpdateFetchingRefs.subcategories.set(userId!, false);
            
            // Return the updated response - React Query will automatically update the cache with this value
            return updatedResponse;
          } else {
            console.log('ℹ️ [useUserSubcategories] No updates - using cached data');
            // Clear fetching flag
            incrementalUpdateFetchingRefs.subcategories.set(userId!, false);
            // No updates, return cached data
            return {
              status: 'success',
              msg: 'Operating subcategories retrieved successfully (cached)',
              data: cachedData,
              hitBy: 'Cache',
            };
          }
        } catch (updateError: any) {
          console.warn('⚠️ [useUserSubcategories] Error getting incremental updates, using cached data:', updateError?.message || updateError);
          // Clear fetching flag on error
          incrementalUpdateFetchingRefs.subcategories.set(userId!, false);
          // If incremental update fails, return cached data
          return {
            status: 'success',
            msg: 'Operating subcategories retrieved successfully (cached, update failed)',
            data: cachedData,
            hitBy: 'Cache',
          };
        }
      } else {
        // No cache or cache expired, fetch from API
        console.log('🌐 [useUserSubcategories] No valid cache - fetching from API...');
        const response = await getUserSubcategories(userId!);
        
        // Save to AsyncStorage (365-day persistence)
        if (response.data) {
          const currentTimestamp = new Date().toISOString();
          await saveCachedUserSubcategories(response.data, currentTimestamp, userId!);
          console.log('💾 [useUserSubcategories] Data saved to AsyncStorage');
        }
        
        return {
          ...response,
          hitBy: 'API',
        };
      }
    },
    enabled: enabled && !!userId,
    // Use long staleTime to prevent unnecessary refetches
    staleTime: 365 * 24 * 60 * 60 * 1000, // 365 days - data is considered fresh for 365 days
    gcTime: 365 * 24 * 60 * 60 * 1000, // 365 days - keep in React Query cache for 365 days
    // Don't refetch on mount/window focus by default - use cache instead
    refetchOnMount: refetchOnMount,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
};

/**
 * Hook to update user's operating categories
 */
export const useUpdateUserCategories = (userId: string | number) => {
  return useApiMutation({
    mutationFn: async (categoryIds: number[]) => {
      const result = await updateUserCategories(userId, categoryIds);
      // Clear cache when categories are updated
      await clearUserCategoriesCache(userId);
      return result;
    },
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
    mutationFn: async (subcategories: Array<{ subcategoryId: number; customPrice: string; priceUnit: string }>) => {
      const result = await updateUserSubcategories(userId, subcategories);
      // Clear user subcategories cache when updated
      await clearUserSubcategoriesCache(userId);
      // Note: We don't clear general subcategories cache as those are admin-managed
      return result;
    },
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
    mutationFn: async (categoryId: string | number) => {
      const result = await removeUserCategory(userId, categoryId);
      // Clear cache when category is removed
      await clearUserCategoriesCache(userId);
      return result;
    },
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
    mutationFn: async (subcategoryIds: number[]) => {
      const result = await removeUserSubcategories(userId, subcategoryIds);
      // Clear cache when subcategories are removed
      await clearUserSubcategoriesCache(userId);
      return result;
    },
    invalidateQueries: [
      queryKeys.userSubcategories.byUser(userId),
      queryKeys.userCategories.byUser(userId),
    ],
  });
};

/**
 * Hook to get user's subcategory requests (pending, approved, rejected)
 */
export const useUserSubcategoryRequests = (
  userId: string | number | null | undefined,
  enabled = true
) => {
  return useApiQuery<UserSubcategoryRequestsResponse>({
    queryKey: ['userSubcategoryRequests', userId],
    queryFn: () => getUserSubcategoryRequests(Number(userId!)),
    enabled: enabled && !!userId,
    staleTime: 1 * 60 * 1000, // 1 minute (frequent updates)
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
};
