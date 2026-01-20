/**
 * User Categories Cache Service
 * Manages 365-day local cache for user's operating categories
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserData } from '../auth/authService';

// Cache keys are user-specific
const getCacheKey = async (userId: string | number): Promise<string> => {
  return `@user_categories_cache_${userId}`;
};

const getLastUpdatedKey = async (userId: string | number): Promise<string> => {
  return `@user_categories_last_updated_${userId}`;
};

const CACHE_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 365 days

interface UserCategoriesData {
  user_id: string | number;
  category_ids: number[];
  categories: Array<{
    id: number;
    name: string;
    image: string;
  }>;
  categories_count: number;
}

interface CachedData {
  data: UserCategoriesData;
  cachedAt: string;
  lastUpdatedOn: string;
}

/**
 * Get cached user categories
 */
export const getCachedUserCategories = async (
  userId: string | number
): Promise<UserCategoriesData | null> => {
  try {
    const cacheKey = await getCacheKey(userId);
    const cachedDataString = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedDataString) {
      console.log(`⚠️ [getCachedUserCategories] No cached data found for user: ${userId}`);
      return null;
    }

    const cachedData: CachedData = JSON.parse(cachedDataString);
    const cachedAt = new Date(cachedData.cachedAt);
    const now = new Date();
    const age = now.getTime() - cachedAt.getTime();

    if (age > CACHE_DURATION_MS) {
      console.log('📦 User categories cache expired, clearing...');
      await clearUserCategoriesCache(userId);
      return null;
    }

    console.log(`✅ [getCachedUserCategories] Cache found and is valid for user: ${userId}`);
    return cachedData.data;
  } catch (error) {
    console.error('Error reading user categories cache:', error);
    return null;
  }
};

/**
 * Save user categories data to cache
 */
export const saveCachedUserCategories = async (
  data: UserCategoriesData,
  lastUpdatedOn: string,
  userId: string | number
): Promise<void> => {
  try {
    const cacheKey = await getCacheKey(userId);
    const lastUpdatedKey = await getLastUpdatedKey(userId);
    
    const cachedData: CachedData = {
      data,
      cachedAt: new Date().toISOString(),
      lastUpdatedOn,
    };

    await Promise.all([
      AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData)),
      AsyncStorage.setItem(lastUpdatedKey, lastUpdatedOn)
    ]);
    
    console.log(`✅ [saveCachedUserCategories] User categories cached successfully for user: ${userId}`);
  } catch (error) {
    console.error('Error saving user categories cache:', error);
  }
};

/**
 * Get last updated timestamp
 */
export const getLastUpdatedOn = async (userId: string | number): Promise<string | null> => {
  try {
    const lastUpdatedKey = await getLastUpdatedKey(userId);
    return await AsyncStorage.getItem(lastUpdatedKey);
  } catch (error) {
    console.error('Error reading last updated timestamp:', error);
    return null;
  }
};

/**
 * Update last updated timestamp
 */
export const updateLastUpdatedOn = async (
  userId: string | number,
  lastUpdatedOn: string
): Promise<void> => {
  try {
    const lastUpdatedKey = await getLastUpdatedKey(userId);
    await AsyncStorage.setItem(lastUpdatedKey, lastUpdatedOn);
  } catch (error) {
    console.error('Error updating last updated timestamp:', error);
  }
};

/**
 * Check if cache is valid
 */
export const isCacheValid = async (userId: string | number): Promise<boolean> => {
  try {
    const cacheKey = await getCacheKey(userId);
    const cachedDataString = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedDataString) {
      return false;
    }

    const cachedData: CachedData = JSON.parse(cachedDataString);
    const cachedAt = new Date(cachedData.cachedAt);
    const now = new Date();
    const age = now.getTime() - cachedAt.getTime();

    return age <= CACHE_DURATION_MS;
  } catch (error) {
    console.error('Error checking cache validity:', error);
    return false;
  }
};

/**
 * Merge incremental updates with cached user categories
 * Updates category names, images, etc. when admin makes changes
 */
export const mergeIncrementalUserCategoriesUpdates = (
  cachedData: UserCategoriesData,
  updates: {
    categories?: Array<{
      id: number;
      name: string;
      image: string;
    }>;
    deleted?: {
      categories?: Array<{ id: number; deleted: boolean }>;
    };
    lastUpdatedOn: string;
  }
): UserCategoriesData => {
  console.log('🔄 [mergeIncrementalUserCategoriesUpdates] Starting merge...');
  console.log(`   Cached categories: ${cachedData.categories.length}`);
  console.log(`   Updated categories: ${updates.categories?.length || 0}`);
  
  // Create a map of cached categories by ID
  const categoryMap = new Map<number, typeof cachedData.categories[0]>();
  cachedData.categories.forEach(cat => {
    categoryMap.set(cat.id, { ...cat });
  });
  
  // First, remove deleted categories
  if (updates.deleted?.categories && updates.deleted.categories.length > 0) {
    console.log(`   🗑️  [DELETE] Removing ${updates.deleted.categories.length} deleted category/categories`);
    let removedCount = 0;
    updates.deleted.categories.forEach(deletedCat => {
      if (categoryMap.has(deletedCat.id)) {
        const categoryName = categoryMap.get(deletedCat.id)?.name || 'Unknown';
        console.log(`   🗑️  [DELETE] Removing deleted category ID ${deletedCat.id} (${categoryName})`);
        categoryMap.delete(deletedCat.id);
        removedCount++;
      }
    });
    console.log(`   ✅ [DELETE] Removed ${removedCount} deleted category/categories from cache`);
  }
  
  // Process updated categories
  if (updates.categories && updates.categories.length > 0) {
    updates.categories.forEach(updatedCat => {
      const existingCat = categoryMap.get(updatedCat.id);
      
      if (existingCat) {
        // Update existing category (name, image, etc.)
        const oldName = existingCat.name;
        const newName = updatedCat.name;
        const oldImage = existingCat.image || '';
        const newImage = updatedCat.image || '';
        const imageChanged = oldImage !== newImage;
        
        console.log(`   📝 Updating category ID ${updatedCat.id}: "${oldName}" → "${newName}"`);
        if (imageChanged) {
          console.log(`   🖼️  Image changed for category ${updatedCat.id}`);
        }
        
        // Apply cache-busting to image URL if category was updated
        let imageUrl = updatedCat.image || existingCat.image || '';
        if (imageUrl && imageUrl.trim().length > 0 && (imageChanged || updatedCat.image)) {
          try {
            if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
              let cleanUrl = imageUrl.trim();
              cleanUrl = cleanUrl.replace(/[?&]_t=\d+/g, '');
              cleanUrl = cleanUrl.replace(/\/(\?|$)/, (match, p1) => p1 === '?' ? '?' : '');
              cleanUrl = cleanUrl.replace(/\?$/, '');
              const timestamp = Date.now();
              const hasQuery = cleanUrl.includes('?');
              const separator = hasQuery ? '&' : '?';
              imageUrl = `${cleanUrl}${separator}_t=${timestamp}`;
              console.log(`   🔄 [Cache Bust] Added timestamp to category image URL`);
            }
          } catch (urlError) {
            console.warn(`   ⚠️  [Cache Bust] Could not add cache-busting parameter:`, urlError);
          }
        }
        
        categoryMap.set(updatedCat.id, {
          ...existingCat,
          name: updatedCat.name,
          image: imageUrl,
        });
      } else {
        // New category - only add if user has this category ID in their list
        if (cachedData.category_ids.includes(updatedCat.id)) {
          console.log(`   ➕ Adding new category ID ${updatedCat.id}: "${updatedCat.name}"`);
          categoryMap.set(updatedCat.id, {
            id: updatedCat.id,
            name: updatedCat.name,
            image: updatedCat.image || '',
          });
        }
      }
    });
  }
  
  // Convert map back to array and update category_ids
  const updatedCategories = Array.from(categoryMap.values());
  const updatedCategoryIds = updatedCategories.map(cat => cat.id);
  
  console.log(`   ✅ [mergeIncrementalUserCategoriesUpdates] Merge complete. Final categories: ${updatedCategories.length}`);
  
  return {
    user_id: cachedData.user_id,
    category_ids: updatedCategoryIds,
    categories: updatedCategories,
    categories_count: updatedCategories.length,
  };
};

/**
 * Clear user categories cache
 */
export const clearUserCategoriesCache = async (userId: string | number): Promise<void> => {
  try {
    const cacheKey = await getCacheKey(userId);
    const lastUpdatedKey = await getLastUpdatedKey(userId);
    
    await Promise.all([
      AsyncStorage.removeItem(cacheKey),
      AsyncStorage.removeItem(lastUpdatedKey)
    ]);
    
    console.log(`🗑️ [clearUserCategoriesCache] Cache cleared for user: ${userId}`);
  } catch (error) {
    console.error('Error clearing user categories cache:', error);
  }
};
