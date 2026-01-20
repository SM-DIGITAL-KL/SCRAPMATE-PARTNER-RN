/**
 * React Query hooks for dashboard statistics management
 * Uses 365-day persistent cache with incremental updates via AsyncStorage
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import { useApiQuery } from './index';
import { queryClient } from '../services/api/queryClient';
import { 
  getDashboardStats,
  getIncrementalStatsUpdates,
  DashboardStatsResponse,
  DashboardStats,
} from '../services/api/v2/stats';
import {
  getCachedStats,
  saveCachedStats,
  getLastUpdatedOn,
  updateLastUpdatedOn,
  mergeIncrementalStatsUpdates,
  isCacheValid,
} from '../services/cache/statsCache';
import { getUserData } from '../services/auth/authService';
import { queryKeys } from '../services/api/queryKeys';

/**
 * Hook to get dashboard statistics
 * Uses 365-day persistent cache with incremental updates via AsyncStorage
 */
export const useDashboardStats = (
  userType: 'customer' | 'b2c' | 'b2b' | 'delivery' = 'customer',
  enabled = true,
  refetchOnMount = true
) => {
  // Get current user ID for user-specific caching
  const [userId, setUserId] = useState<string | number | null>(null);
  
  useEffect(() => {
    getUserData().then(userData => {
      setUserId(userData?.id || null);
    });
  }, []);
  
  // Memoize queryKey to prevent recreating it on every render
  // Include userId and userType to ensure user-specific React Query cache
  const queryKey = useMemo(
    () => [...queryKeys.dashboard.stats(), userType, userId || 'anonymous'],
    [userType, userId]
  );
  
  // Track if we're currently fetching to prevent duplicate calls
  const isFetchingRef = useRef(false);
  
  // If refetchOnMount is false, load data directly from AsyncStorage
  const [asyncStorageData, setAsyncStorageData] = useState<any>(null);
  const [isLoadingAsyncStorage, setIsLoadingAsyncStorage] = useState(false);
  const hasLoadedRef = useRef(false);
  
  useEffect(() => {
    // Only load once if refetchOnMount is false and we haven't loaded yet
    if (!refetchOnMount && enabled && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setIsLoadingAsyncStorage(true);
      console.log('📦 [useDashboardStats] Loading from AsyncStorage (NO API CALL)');
      // Load directly from AsyncStorage without any API calls
      getCachedStats(userType)
        .then((cached) => {
          if (cached) {
            console.log(`✅ [useDashboardStats] Data loaded from AsyncStorage`);
            console.log('🔄 [useDashboardStats] Data Source: CACHE ONLY (AsyncStorage, no API call)');
            console.log('📊 [useDashboardStats] Cached Stats:', {
              totalRecycled: cached.totalRecycled,
              carbonOffset: cached.carbonOffset,
              totalOrderValue: cached.totalOrderValue,
              operatingCategories: cached.operatingCategories,
              lastUpdatedOn: cached.lastUpdatedOn,
            });
            const response: DashboardStatsResponse = {
              status: 'success',
              msg: 'Dashboard stats retrieved successfully (AsyncStorage)',
              data: cached,
              meta: {
                lastUpdatedOn: cached.lastUpdatedOn,
              },
            };
            setAsyncStorageData(response);
            // Also update React Query cache so other components can use it
            queryClient.setQueryData(queryKey, response);
          } else {
            console.log('⚠️ [useDashboardStats] No cached data found in AsyncStorage');
          }
          setIsLoadingAsyncStorage(false);
        })
        .catch((error) => {
          console.warn('⚠️ [useDashboardStats] Error loading from AsyncStorage:', error);
          setIsLoadingAsyncStorage(false);
        });
    }
  }, [refetchOnMount, enabled, queryKey, userType]);
  
  // If refetchOnMount is false, use data from AsyncStorage directly
  if (!refetchOnMount) {
    return {
      data: asyncStorageData,
      isLoading: isLoadingAsyncStorage,
      isError: false,
      error: null,
      refetch: async () => {
        // No-op: we don't refetch when refetchOnMount is false
        return { data: asyncStorageData, error: null };
      },
    } as any;
  }
  
  // Normal flow: use React Query with API calls for dashboard
  return useApiQuery({
    queryKey,
    // Disable structural sharing to ensure React Query detects all changes
    structuralSharing: false,
    // Refetch on mount based on parameter (default: true for dashboard)
    refetchOnMount: refetchOnMount,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    // Use long staleTime like categories to prevent unnecessary refetches
    // But still allow incremental updates to be checked
    staleTime: 365 * 24 * 60 * 60 * 1000, // 365 days - data is considered fresh for 365 days
    gcTime: 365 * 24 * 60 * 60 * 1000, // 365 days - keep in React Query cache for 365 days
    queryFn: async () => {
      // Prevent duplicate calls
      if (isFetchingRef.current) {
        console.log('⏸️ [useDashboardStats] Already fetching, skipping duplicate call');
        // Return cached data if available to prevent duplicate API calls
        const cachedData = await getCachedStats(userType);
        const lastUpdatedOn = await getLastUpdatedOn(userType);
        if (cachedData && lastUpdatedOn) {
          return {
            status: 'success',
            msg: 'Dashboard stats retrieved successfully (cached, duplicate call prevented)',
            data: cachedData,
            meta: { lastUpdatedOn, hasUpdates: false },
          };
        }
        throw new Error('Already fetching and no cache available');
      }
      
      isFetchingRef.current = true;
      try {
        console.log('🔄 [useDashboardStats] Dashboard: Starting query (checking cache first)...');
        
        // Check AsyncStorage cache first (365-day persistence)
        console.log('🔍 [useDashboardStats] Checking cache for userType:', userType);
        const cachedData = await getCachedStats(userType);
        const lastUpdatedOn = await getLastUpdatedOn(userType);
        const cacheIsValid = await isCacheValid(userType);

      console.log('🔍 [useDashboardStats] Cache check results:', {
        hasCachedData: !!cachedData,
        hasLastUpdatedOn: !!lastUpdatedOn,
        cacheIsValid,
        userType,
      });

      // If we have valid cache, return it immediately and check for updates in background
      // This prevents React Query from calling the API unnecessarily
      // CRITICAL: Return cached data immediately to prevent React Query from thinking there's no data
      if (cachedData && cacheIsValid && lastUpdatedOn) {
        console.log('📦 [useDashboardStats] Dashboard: Found cached data in AsyncStorage');
        console.log('📊 [useDashboardStats] Cached Stats Data:', {
          totalRecycled: cachedData.totalRecycled,
          carbonOffset: cachedData.carbonOffset,
          totalOrderValue: cachedData.totalOrderValue,
          operatingCategories: cachedData.operatingCategories,
          lastUpdatedOn: cachedData.lastUpdatedOn,
        });
        // Try to get incremental updates in background
        try {
          // Subtract 5 seconds from lastUpdatedOn to ensure we don't miss updates
          const lastUpdatedDate = new Date(lastUpdatedOn);
          const adjustedTimestamp = new Date(lastUpdatedDate.getTime() - 5000).toISOString(); // 5 seconds buffer
          
          console.log('🌐 [useDashboardStats] Dashboard: Calling API for incremental updates...');
          console.log(`   userType: ${userType}`);
          console.log(`   lastUpdatedOn (original): ${lastUpdatedOn}`);
          console.log(`   lastUpdatedOn (adjusted): ${adjustedTimestamp} (5s buffer)`);
          console.log(`   userId: ${userId || 'not provided'}`);
          
          const updates = await getIncrementalStatsUpdates(
            userType,
            adjustedTimestamp,
            userId ? Number(userId) : undefined
          );
          
          console.log('📥 [useDashboardStats] Dashboard: Incremental updates API response received');
          console.log(`   hasUpdates: ${updates.meta?.hasUpdates}`);
          console.log('📊 [useDashboardStats] API Incremental Updates:', {
            totalRecycled: updates.data.totalRecycled,
            carbonOffset: updates.data.carbonOffset,
            totalOrderValue: updates.data.totalOrderValue,
            operatingCategories: updates.data.operatingCategories,
            lastUpdatedOn: updates.data.lastUpdatedOn,
          });
          
          if (updates.meta.hasUpdates) {
            console.log('✅ [useDashboardStats] Dashboard: Updates found - merging with cached data');
            console.log('🔄 [useDashboardStats] Data Source: CACHE + API (Incremental Updates)');
            
            // Merge incremental updates with cached data
            const mergedData = mergeIncrementalStatsUpdates(cachedData, updates.data);
            
            // Save merged data back to cache
            await saveCachedStats(mergedData, updates.meta.lastUpdatedOn, userType);
            
            // Return merged data
            const response: DashboardStatsResponse = {
              status: 'success',
              msg: 'Dashboard stats retrieved successfully (cached + incremental updates)',
              data: mergedData,
              meta: {
                lastUpdatedOn: updates.meta.lastUpdatedOn,
                hasUpdates: true,
              },
            };
            
            console.log('✅ [useDashboardStats] Dashboard: Returning merged data');
            console.log('📊 [useDashboardStats] Final Merged Stats:', {
              totalRecycled: mergedData.totalRecycled,
              carbonOffset: mergedData.carbonOffset,
              totalOrderValue: mergedData.totalOrderValue,
              operatingCategories: mergedData.operatingCategories,
            });
            return response;
          } else {
            console.log('ℹ️ [useDashboardStats] Dashboard: No updates - using cached data');
            console.log('🔄 [useDashboardStats] Data Source: CACHE ONLY (No API updates)');
            // No updates, return cached data immediately
            // This is the key: return cached data first to prevent React Query from calling API
            const response: DashboardStatsResponse = {
              status: 'success',
              msg: 'Dashboard stats retrieved successfully (cached)',
              data: cachedData,
              meta: {
                lastUpdatedOn,
                hasUpdates: false,
              },
            };
            console.log('📊 [useDashboardStats] Returning Cached Stats (NO API CALL):', {
              totalRecycled: cachedData.totalRecycled,
              carbonOffset: cachedData.carbonOffset,
              totalOrderValue: cachedData.totalOrderValue,
              operatingCategories: cachedData.operatingCategories,
            });
            return response;
          }
        } catch (updateError: any) {
          console.warn('⚠️ [useDashboardStats] Dashboard: Error getting incremental updates, using cached data:', updateError?.message || updateError);
          console.log('🔄 [useDashboardStats] Data Source: CACHE ONLY (API call failed)');
          // If incremental update fails, return cached data
          const response: DashboardStatsResponse = {
            status: 'success',
            msg: 'Dashboard stats retrieved successfully (cached, incremental update failed)',
            data: cachedData,
            meta: {
              lastUpdatedOn,
              hasUpdates: false,
            },
          };
          console.log('📊 [useDashboardStats] Returning Cached Stats (fallback):', {
            totalRecycled: cachedData.totalRecycled,
            carbonOffset: cachedData.carbonOffset,
            totalOrderValue: cachedData.totalOrderValue,
            operatingCategories: cachedData.operatingCategories,
          });
          return response;
        }
      } else {
        // No cache or cache expired, fetch from API
        console.log('🌐 [useDashboardStats] Dashboard: No valid cache - fetching from API...');
        console.log('🔄 [useDashboardStats] Data Source: API (Full Fetch)');
        console.log('🔍 [useDashboardStats] Cache check details:', {
          cachedData: cachedData ? 'exists' : 'null',
          lastUpdatedOn: lastUpdatedOn || 'null',
          cacheIsValid,
          reason: !cachedData ? 'No cached data' : !lastUpdatedOn ? 'No lastUpdatedOn' : !cacheIsValid ? 'Cache expired' : 'Unknown',
        });
        
        try {
          console.log('🌐 [useDashboardStats] Calling getDashboardStats API...', {
            userType,
            userId: userId ? Number(userId) : undefined,
          });
          
          const response = await getDashboardStats(userType, userId ? Number(userId) : undefined);
          
          console.log('📥 [useDashboardStats] API Response Received:', {
            status: response.status,
            hasData: !!response.data,
            hasMeta: !!response.meta,
            totalRecycled: response.data?.totalRecycled,
            carbonOffset: response.data?.carbonOffset,
            totalOrderValue: response.data?.totalOrderValue,
            operatingCategories: response.data?.operatingCategories,
            dataLastUpdatedOn: response.data?.lastUpdatedOn,
            metaLastUpdatedOn: response.meta?.lastUpdatedOn,
          });
          
          // Use lastUpdatedOn from data if meta doesn't have it, or generate one if neither exists
          let lastUpdatedOnToSave = response.meta?.lastUpdatedOn || response.data?.lastUpdatedOn;
          if (!lastUpdatedOnToSave) {
            // Generate timestamp if API doesn't provide one
            lastUpdatedOnToSave = new Date().toISOString();
            console.log('⚠️ [useDashboardStats] API did not provide lastUpdatedOn, generating timestamp:', lastUpdatedOnToSave);
          }
          
          // Always try to save to cache if we have data
          // Even if lastUpdatedOn is missing, we'll generate one
          if (response.data) {
            // Save to cache - CRITICAL: This must happen before returning
            console.log('💾 [useDashboardStats] Saving API response to cache...');
            console.log('💾 [useDashboardStats] Save parameters:', {
              userType,
              lastUpdatedOn: lastUpdatedOnToSave,
              dataExists: !!response.data,
              dataKeys: Object.keys(response.data || {}),
              dataValues: {
                totalRecycled: response.data.totalRecycled,
                carbonOffset: response.data.carbonOffset,
                totalOrderValue: response.data.totalOrderValue,
                operatingCategories: response.data.operatingCategories,
              },
            });
            
            try {
              // Ensure data has all required fields before saving
              const dataToSave: DashboardStats = {
                totalRecycled: response.data.totalRecycled ?? 0,
                carbonOffset: response.data.carbonOffset ?? 0,
                totalOrderValue: response.data.totalOrderValue ?? 0,
                operatingCategories: response.data.operatingCategories ?? 0,
                lastUpdatedOn: lastUpdatedOnToSave,
              };
              
              await saveCachedStats(dataToSave, lastUpdatedOnToSave, userType);
              console.log('✅ [useDashboardStats] Dashboard: Data saved to cache');
              
              // Verify cache was saved immediately - wait a bit for AsyncStorage to complete
              await new Promise<void>(resolve => setTimeout(() => resolve(), 100));
              const verifyCache = await getCachedStats(userType);
              if (verifyCache) {
                console.log('✅ [useDashboardStats] Cache verification: Data is now in cache');
                console.log('📊 [useDashboardStats] Verified cached data:', {
                  totalRecycled: verifyCache.totalRecycled,
                  carbonOffset: verifyCache.carbonOffset,
                  totalOrderValue: verifyCache.totalOrderValue,
                  operatingCategories: verifyCache.operatingCategories,
                });
              } else {
                console.error('❌ [useDashboardStats] Cache verification FAILED: Data NOT in cache after save!');
                // Try to read all AsyncStorage keys to debug
                try {
                  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
                  const allKeys = await AsyncStorage.getAllKeys();
                  const statsKeys = allKeys.filter((k: string) => k.includes('dashboard_stats'));
                  console.log('🔍 [useDashboardStats] All stats cache keys:', statsKeys);
                  // Try to read the specific key
                  const cacheKey = `@dashboard_stats_cache_${userType}_${userId || 'anonymous'}`;
                  const directRead = await AsyncStorage.getItem(cacheKey);
                  console.log('🔍 [useDashboardStats] Direct read of cache key:', {
                    cacheKey,
                    hasData: !!directRead,
                    dataLength: directRead?.length,
                  });
                } catch (e) {
                  console.error('❌ [useDashboardStats] Could not read AsyncStorage keys:', e);
                }
              }
            } catch (saveError: any) {
              console.error('❌ [useDashboardStats] Error saving to cache:', saveError);
              console.error('❌ [useDashboardStats] Save error details:', {
                message: saveError?.message,
                stack: saveError?.stack,
                name: saveError?.name,
              });
            }
          } else {
            console.warn('⚠️ [useDashboardStats] Cannot save to cache - missing data:', {
              hasData: !!response.data,
              hasMeta: !!response.meta,
              responseStatus: response.status,
              fullResponse: JSON.stringify(response, null, 2).substring(0, 500),
            });
          }
          
          console.log('📊 [useDashboardStats] Returning API Stats:', {
            totalRecycled: response.data?.totalRecycled,
            carbonOffset: response.data?.carbonOffset,
            totalOrderValue: response.data?.totalOrderValue,
            operatingCategories: response.data?.operatingCategories,
          });
          
          return response;
        } catch (apiError: any) {
          console.error('❌ [useDashboardStats] API call failed:', apiError);
          console.error('❌ [useDashboardStats] API error details:', {
            message: apiError?.message,
            name: apiError?.name,
            stack: apiError?.stack,
          });
          
          // If API fails but we have cached data, return cached data instead of throwing
          // This allows the app to work offline or when API is down
          if (cachedData && lastUpdatedOn) {
            console.warn('⚠️ [useDashboardStats] API failed, but using cached data as fallback');
            return {
              status: 'success',
              msg: 'Dashboard stats retrieved successfully (cached, API unavailable)',
              data: cachedData,
              meta: {
                lastUpdatedOn,
                hasUpdates: false,
              },
            };
          }
          
          // No cache available, throw the error
          throw apiError;
        }
      }
    } finally {
      isFetchingRef.current = false;
    }
    },
    enabled,
  });
};
