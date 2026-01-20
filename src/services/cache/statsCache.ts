/**
 * Dashboard Stats Cache Service
 * Manages 365-day local cache with incremental updates
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { DashboardStats } from '../api/v2/stats';
import { getUserData } from '../auth/authService';

// Cache keys are user-specific to support multiple users on the same device
const getCacheKey = async (userType: string = 'customer'): Promise<string> => {
  const userData = await getUserData();
  const userId = userData?.id || 'anonymous';
  return `@dashboard_stats_cache_${userType}_${userId}`;
};

const getLastUpdatedKey = async (userType: string = 'customer'): Promise<string> => {
  const userData = await getUserData();
  const userId = userData?.id || 'anonymous';
  return `@dashboard_stats_last_updated_${userType}_${userId}`;
};

const CACHE_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 365 days

interface CachedData {
  data: DashboardStats;
  cachedAt: string;
  lastUpdatedOn: string;
}

/**
 * Get cached dashboard stats data
 */
export const getCachedStats = async (userType: string = 'customer'): Promise<DashboardStats | null> => {
  try {
    const cacheKey = await getCacheKey(userType);
    console.log('🔑 [getCachedStats] Cache key:', cacheKey);
    const cachedDataString = await AsyncStorage.getItem(cacheKey);
    if (!cachedDataString) {
      console.log('⚠️ [getCachedStats] No cached data found for key:', cacheKey);
      return null;
    }

    const cachedData: CachedData = JSON.parse(cachedDataString);
    const cachedAt = new Date(cachedData.cachedAt);
    const now = new Date();
    const age = now.getTime() - cachedAt.getTime();

    console.log('📅 [getCachedStats] Cache age check:', {
      cachedAt: cachedData.cachedAt,
      now: now.toISOString(),
      ageDays: Math.floor(age / (1000 * 60 * 60 * 24)),
      ageMs: age,
      cacheDurationMs: CACHE_DURATION_MS,
      isValid: age <= CACHE_DURATION_MS,
    });

    // Check if cache is expired (older than 365 days)
    if (age > CACHE_DURATION_MS) {
      console.log('📦 Stats cache expired, clearing...');
      await clearCache(userType);
      return null;
    }

    console.log('✅ [getCachedStats] Cache is valid, returning data');
    return cachedData.data;
  } catch (error) {
    console.error('❌ [getCachedStats] Error reading stats cache:', error);
    return null;
  }
};

/**
 * Save dashboard stats data to cache
 */
export const saveCachedStats = async (
  data: DashboardStats,
  lastUpdatedOn: string,
  userType: string = 'customer'
): Promise<void> => {
  try {
    const cacheKey = await getCacheKey(userType);
    const lastUpdatedKey = await getLastUpdatedKey(userType);
    console.log('💾 [saveCachedStats] Saving to cache:', {
      cacheKey,
      lastUpdatedKey,
      userType,
      lastUpdatedOn,
      data: {
        totalRecycled: data.totalRecycled,
        carbonOffset: data.carbonOffset,
        totalOrderValue: data.totalOrderValue,
        operatingCategories: data.operatingCategories,
      },
    });
    
    const cachedData: CachedData = {
      data,
      cachedAt: new Date().toISOString(),
      lastUpdatedOn,
    };

    // Save both keys atomically
    await Promise.all([
      AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData)),
      AsyncStorage.setItem(lastUpdatedKey, lastUpdatedOn)
    ]);
    console.log('✅ [saveCachedStats] Dashboard stats cached successfully (user-specific)');
    
    // Verify the save worked immediately
    const [verifyCache, verifyLastUpdated] = await Promise.all([
      AsyncStorage.getItem(cacheKey),
      AsyncStorage.getItem(lastUpdatedKey)
    ]);
    
    if (verifyCache && verifyLastUpdated) {
      console.log('✅ [saveCachedStats] Cache verification: Both keys saved successfully');
      const parsedCache = JSON.parse(verifyCache);
      console.log('✅ [saveCachedStats] Verified cache data:', {
        hasData: !!parsedCache.data,
        cachedAt: parsedCache.cachedAt,
        lastUpdatedOn: parsedCache.lastUpdatedOn,
        dataKeys: parsedCache.data ? Object.keys(parsedCache.data) : [],
      });
    } else {
      console.error('❌ [saveCachedStats] Cache verification FAILED:', {
        hasCache: !!verifyCache,
        hasLastUpdated: !!verifyLastUpdated,
        cacheKey,
        lastUpdatedKey,
      });
    }
  } catch (error) {
    console.error('❌ [saveCachedStats] Error saving stats cache:', error);
  }
};

/**
 * Get last updated timestamp
 */
export const getLastUpdatedOn = async (userType: string = 'customer'): Promise<string | null> => {
  try {
    const lastUpdatedKey = await getLastUpdatedKey(userType);
    console.log('🔑 [getLastUpdatedOn] Key:', lastUpdatedKey);
    const value = await AsyncStorage.getItem(lastUpdatedKey);
    console.log('📅 [getLastUpdatedOn] Value:', value);
    return value;
  } catch (error) {
    console.error('❌ [getLastUpdatedOn] Error reading stats lastUpdatedOn:', error);
    return null;
  }
};

/**
 * Update last updated timestamp
 */
export const updateLastUpdatedOn = async (timestamp: string, userType: string = 'customer'): Promise<void> => {
  try {
    const lastUpdatedKey = await getLastUpdatedKey(userType);
    await AsyncStorage.setItem(lastUpdatedKey, timestamp);
  } catch (error) {
    console.error('Error updating stats lastUpdatedOn:', error);
  }
};

/**
 * Merge incremental updates with cached data
 */
export const mergeIncrementalStatsUpdates = (
  cachedData: DashboardStats,
  updates: {
    totalRecycled?: number;
    carbonOffset?: number;
    totalOrderValue?: number;
    operatingCategories?: number;
    lastUpdatedOn: string;
  }
): DashboardStats => {
  console.log('🔄 [mergeIncrementalStatsUpdates] Starting merge...');
  
  const mergedData: DashboardStats = {
    totalRecycled: updates.totalRecycled !== undefined ? updates.totalRecycled : cachedData.totalRecycled,
    carbonOffset: updates.carbonOffset !== undefined ? updates.carbonOffset : cachedData.carbonOffset,
    totalOrderValue: updates.totalOrderValue !== undefined ? updates.totalOrderValue : cachedData.totalOrderValue,
    operatingCategories: updates.operatingCategories !== undefined ? updates.operatingCategories : cachedData.operatingCategories,
    lastUpdatedOn: updates.lastUpdatedOn,
  };
  
  console.log('✅ [mergeIncrementalStatsUpdates] Merge complete');
  console.log(`   Total Recycled: ${mergedData.totalRecycled}kg`);
  console.log(`   Carbon Offset: ${mergedData.carbonOffset}kg CO2`);
  console.log(`   Total Order Value: ₹${mergedData.totalOrderValue}`);
  console.log(`   Operating Categories: ${mergedData.operatingCategories}`);
  
  return mergedData;
};

/**
 * Clear cache (for current user and userType)
 */
export const clearCache = async (userType: string = 'customer'): Promise<void> => {
  try {
    const cacheKey = await getCacheKey(userType);
    const lastUpdatedKey = await getLastUpdatedKey(userType);
    await AsyncStorage.removeItem(cacheKey);
    await AsyncStorage.removeItem(lastUpdatedKey);
    console.log('🗑️ Stats cache cleared (user-specific)');
    
    // Also invalidate React Query cache for stats
    try {
      const { queryClient } = require('../api/queryClient');
      const { queryKeys } = require('../api/queryKeys');
      
      // Invalidate all stats-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.stats() });
      console.log('🔄 React Query cache invalidated for stats');
    } catch (queryError) {
      console.warn('Could not invalidate React Query cache:', queryError);
    }
  } catch (error) {
    console.error('Error clearing stats cache:', error);
  }
};

/**
 * Check if cache exists and is valid
 */
export const isCacheValid = async (userType: string = 'customer'): Promise<boolean> => {
  try {
    const cacheKey = await getCacheKey(userType);
    const cachedDataString = await AsyncStorage.getItem(cacheKey);
    if (!cachedDataString) {
      console.log('⚠️ [isCacheValid] No cache data found for key:', cacheKey);
      return false;
    }

    const cachedData: CachedData = JSON.parse(cachedDataString);
    const cachedAt = new Date(cachedData.cachedAt);
    const now = new Date();
    const age = now.getTime() - cachedAt.getTime();
    const isValid = age <= CACHE_DURATION_MS;

    console.log('🔍 [isCacheValid] Cache validation:', {
      cacheKey,
      cachedAt: cachedData.cachedAt,
      ageDays: Math.floor(age / (1000 * 60 * 60 * 24)),
      isValid,
    });

    return isValid;
  } catch (error) {
    console.error('❌ [isCacheValid] Error checking cache validity:', error);
    return false;
  }
};

/**
 * Force refresh by clearing cache and lastUpdatedOn
 * This will force a full fetch from the API on next request
 */
export const forceRefreshCache = async (userType: string = 'customer'): Promise<void> => {
  try {
    await clearCache(userType);
    console.log('🔄 Stats cache force refreshed - next fetch will get fresh data from API');
  } catch (error) {
    console.error('Error force refreshing stats cache:', error);
  }
};
