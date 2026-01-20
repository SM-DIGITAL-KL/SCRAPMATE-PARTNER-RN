/**
 * User Subcategories Cache Service
 * Manages 365-day local cache for user's operating subcategories
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Cache keys are user-specific
const getCacheKey = async (userId: string | number): Promise<string> => {
  return `@user_subcategories_cache_${userId}`;
};

const getLastUpdatedKey = async (userId: string | number): Promise<string> => {
  return `@user_subcategories_last_updated_${userId}`;
};

const CACHE_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 365 days

interface UserSubcategory {
  subcategory_id: number;
  name: string;
  image: string;
  main_category_id: number;
  default_price: string;
  price_unit: string;
  custom_price: string;
  display_price: string;
  display_price_unit: string;
}

interface UserSubcategoriesData {
  user_id: string | number;
  subcategories: UserSubcategory[];
}

interface CachedData {
  data: UserSubcategoriesData;
  cachedAt: string;
  lastUpdatedOn: string;
}

/**
 * Get cached user subcategories
 */
export const getCachedUserSubcategories = async (
  userId: string | number
): Promise<UserSubcategoriesData | null> => {
  try {
    const cacheKey = await getCacheKey(userId);
    const cachedDataString = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedDataString) {
      console.log(`⚠️ [getCachedUserSubcategories] No cached data found for user: ${userId}`);
      return null;
    }

    const cachedData: CachedData = JSON.parse(cachedDataString);
    const cachedAt = new Date(cachedData.cachedAt);
    const now = new Date();
    const age = now.getTime() - cachedAt.getTime();

    if (age > CACHE_DURATION_MS) {
      console.log('📦 User subcategories cache expired, clearing...');
      await clearUserSubcategoriesCache(userId);
      return null;
    }

    console.log(`✅ [getCachedUserSubcategories] Cache found and is valid for user: ${userId}`);
    return cachedData.data;
  } catch (error) {
    console.error('Error reading user subcategories cache:', error);
    return null;
  }
};

/**
 * Save user subcategories data to cache
 */
export const saveCachedUserSubcategories = async (
  data: UserSubcategoriesData,
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
    
    console.log(`✅ [saveCachedUserSubcategories] User subcategories cached successfully for user: ${userId}`);
  } catch (error) {
    console.error('Error saving user subcategories cache:', error);
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
 * Merge incremental updates with cached user subcategories
 * Updates subcategory names, images, rates, etc. when admin makes changes
 */
export const mergeIncrementalUserSubcategoriesUpdates = (
  cachedData: UserSubcategoriesData,
  updates: {
    subcategories?: Array<{
      id: number;
      name: string;
      image: string;
      default_price: string;
      price_unit: string;
      main_category_id: number;
    }>;
    deleted?: {
      subcategories?: Array<{ id: number; deleted: boolean }>;
    };
    lastUpdatedOn: string;
  }
): UserSubcategoriesData => {
  console.log('🔄 [mergeIncrementalUserSubcategoriesUpdates] Starting merge...');
  console.log(`   Cached subcategories: ${cachedData.subcategories.length}`);
  console.log(`   Updated subcategories: ${updates.subcategories?.length || 0}`);
  
  // Create a map of cached subcategories by ID
  const subcategoryMap = new Map<number, UserSubcategory>();
  cachedData.subcategories.forEach(sub => {
    subcategoryMap.set(sub.subcategory_id, { ...sub });
  });
  
  // First, remove deleted subcategories
  if (updates.deleted?.subcategories && updates.deleted.subcategories.length > 0) {
    console.log(`   🗑️  [DELETE] Removing ${updates.deleted.subcategories.length} deleted subcategory/subcategories`);
    let removedCount = 0;
    updates.deleted.subcategories.forEach(deletedSub => {
      if (subcategoryMap.has(deletedSub.id)) {
        const subName = subcategoryMap.get(deletedSub.id)?.name || 'Unknown';
        console.log(`   🗑️  [DELETE] Removing deleted subcategory ID ${deletedSub.id} (${subName})`);
        subcategoryMap.delete(deletedSub.id);
        removedCount++;
      }
    });
    console.log(`   ✅ [DELETE] Removed ${removedCount} deleted subcategory/subcategories from cache`);
  }
  
  // Process updated subcategories
  if (updates.subcategories && updates.subcategories.length > 0) {
    updates.subcategories.forEach(updatedSub => {
      // API returns 'id', but cached data uses 'subcategory_id' - they should match
      const subcategoryId = updatedSub.id;
      const existingSub = subcategoryMap.get(subcategoryId);
      
      console.log(`   🔍 Looking up subcategory ID ${subcategoryId} in cache...`);
      console.log(`      Found in cache: ${existingSub ? 'YES' : 'NO'}`);
      if (existingSub) {
        console.log(`      Cached name: "${existingSub.name}", Cached image: ${existingSub.image ? 'present' : 'missing'}`);
      }
      
      if (existingSub) {
        // Update existing subcategory (name, image, rates, etc.)
        const oldName = existingSub.name;
        const newName = updatedSub.name;
        const oldImage = existingSub.image || '';
        const newImage = updatedSub.image || '';
        const imageChanged = oldImage !== newImage;
        const priceChanged = existingSub.default_price !== updatedSub.default_price;
        
        console.log(`   📝 Updating subcategory ID ${updatedSub.id}: "${oldName}" → "${newName}"`);
        if (imageChanged) {
          console.log(`   🖼️  Image changed for subcategory ${updatedSub.id}`);
        }
        if (priceChanged) {
          console.log(`   💰 Price changed for subcategory ${updatedSub.id}: ${existingSub.default_price} → ${updatedSub.default_price}`);
        }
        
        // Apply cache-busting to image URL if subcategory was updated
        let imageUrl = updatedSub.image || existingSub.image || '';
        if (imageUrl && imageUrl.trim().length > 0 && (imageChanged || updatedSub.image)) {
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
              console.log(`   🔄 [Cache Bust] Added timestamp to subcategory image URL`);
            }
          } catch (urlError) {
            console.warn(`   ⚠️  [Cache Bust] Could not add cache-busting parameter:`, urlError);
          }
        }
        
        // Update subcategory - preserve custom_price if user has set one
        // Keep subcategory_id from existing data (don't overwrite with 'id')
        subcategoryMap.set(subcategoryId, {
          ...existingSub,
          subcategory_id: existingSub.subcategory_id, // Preserve the original subcategory_id
          name: updatedSub.name,
          image: imageUrl,
          default_price: updatedSub.default_price,
          price_unit: updatedSub.price_unit,
          // Update display_price if no custom_price is set
          display_price: existingSub.custom_price || updatedSub.default_price,
          display_price_unit: existingSub.custom_price ? existingSub.price_unit : updatedSub.price_unit,
        });
        
        // Verify the update
        const updated = subcategoryMap.get(subcategoryId);
        console.log(`   ✅ Updated subcategory ID ${subcategoryId}:`);
        console.log(`      Name: "${updated?.name}"`);
        console.log(`      Image: ${updated?.image ? 'present' : 'missing'}`);
        console.log(`      Default Price: ${updated?.default_price}`);
      } else {
        // New subcategory - only add if user has this subcategory ID in their list
        const userHasSubcategory = cachedData.subcategories.some(
          sub => sub.subcategory_id === subcategoryId
        );
        if (userHasSubcategory) {
          console.log(`   ➕ Adding new subcategory ID ${subcategoryId}: "${updatedSub.name}"`);
          subcategoryMap.set(subcategoryId, {
            subcategory_id: subcategoryId, // Use the ID from API as subcategory_id
            name: updatedSub.name,
            image: updatedSub.image || '',
            main_category_id: updatedSub.main_category_id,
            default_price: updatedSub.default_price,
            price_unit: updatedSub.price_unit,
            custom_price: '',
            display_price: updatedSub.default_price,
            display_price_unit: updatedSub.price_unit,
          });
        } else {
          console.log(`   ⚠️  Subcategory ID ${subcategoryId} not found in user's subcategories list - skipping`);
        }
      }
    });
  }
  
  // Convert map back to array
  const updatedSubcategories = Array.from(subcategoryMap.values());
  
  console.log(`   ✅ [mergeIncrementalUserSubcategoriesUpdates] Merge complete. Final subcategories: ${updatedSubcategories.length}`);
  
  return {
    user_id: cachedData.user_id,
    subcategories: updatedSubcategories,
  };
};

/**
 * Clear user subcategories cache
 */
export const clearUserSubcategoriesCache = async (userId: string | number): Promise<void> => {
  try {
    const cacheKey = await getCacheKey(userId);
    const lastUpdatedKey = await getLastUpdatedKey(userId);
    
    await Promise.all([
      AsyncStorage.removeItem(cacheKey),
      AsyncStorage.removeItem(lastUpdatedKey)
    ]);
    
    console.log(`🗑️ [clearUserSubcategoriesCache] Cache cleared for user: ${userId}`);
  } catch (error) {
    console.error('Error clearing user subcategories cache:', error);
  }
};
