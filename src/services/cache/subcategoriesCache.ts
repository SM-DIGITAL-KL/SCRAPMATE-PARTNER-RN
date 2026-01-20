/**
 * Subcategories Cache Service
 * Manages 365-day local cache for subcategories by category and userType
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Subcategory } from '../api/v2/categories';

// Cache keys are category-specific and userType-specific
const getCacheKey = (categoryId: number | undefined, userType: string = 'all'): string => {
  if (categoryId) {
    return `@subcategories_cache_${categoryId}_${userType}`;
  }
  return `@subcategories_cache_all_${userType}`;
};

const getLastUpdatedKey = (categoryId: number | undefined, userType: string = 'all'): string => {
  if (categoryId) {
    return `@subcategories_last_updated_${categoryId}_${userType}`;
  }
  return `@subcategories_last_updated_all_${userType}`;
};

const CACHE_DURATION_MS = 365 * 24 * 60 * 60 * 1000; // 365 days

interface CachedData {
  data: Subcategory[];
  cachedAt: string;
  lastUpdatedOn: string;
}

/**
 * Get cached subcategories
 */
export const getCachedSubcategories = async (
  categoryId: number | undefined,
  userType: string = 'all'
): Promise<Subcategory[] | null> => {
  try {
    const cacheKey = getCacheKey(categoryId, userType);
    const cachedDataString = await AsyncStorage.getItem(cacheKey);
    
    if (!cachedDataString) {
      console.log(`⚠️ [getCachedSubcategories] No cached data found for categoryId: ${categoryId}, userType: ${userType}`);
      return null;
    }

    const cachedData: CachedData = JSON.parse(cachedDataString);
    const cachedAt = new Date(cachedData.cachedAt);
    const now = new Date();
    const age = now.getTime() - cachedAt.getTime();

    if (age > CACHE_DURATION_MS) {
      console.log('📦 Subcategories cache expired, clearing...');
      await clearSubcategoriesCache(categoryId, userType);
      return null;
    }

    console.log(`✅ [getCachedSubcategories] Cache found and is valid for categoryId: ${categoryId}, userType: ${userType}`);
    return cachedData.data;
  } catch (error) {
    console.error('Error reading subcategories cache:', error);
    return null;
  }
};

/**
 * Save subcategories data to cache
 */
export const saveCachedSubcategories = async (
  data: Subcategory[],
  lastUpdatedOn: string,
  categoryId: number | undefined,
  userType: string = 'all'
): Promise<void> => {
  try {
    const cacheKey = getCacheKey(categoryId, userType);
    const lastUpdatedKey = getLastUpdatedKey(categoryId, userType);
    
    const cachedData: CachedData = {
      data,
      cachedAt: new Date().toISOString(),
      lastUpdatedOn,
    };

    await Promise.all([
      AsyncStorage.setItem(cacheKey, JSON.stringify(cachedData)),
      AsyncStorage.setItem(lastUpdatedKey, lastUpdatedOn)
    ]);
    
    console.log(`✅ [saveCachedSubcategories] Subcategories cached successfully for categoryId: ${categoryId}, userType: ${userType}`);
  } catch (error) {
    console.error('Error saving subcategories cache:', error);
  }
};

/**
 * Get last updated timestamp
 */
export const getLastUpdatedOn = async (
  categoryId: number | undefined,
  userType: string = 'all'
): Promise<string | null> => {
  try {
    const lastUpdatedKey = getLastUpdatedKey(categoryId, userType);
    return await AsyncStorage.getItem(lastUpdatedKey);
  } catch (error) {
    console.error('Error reading last updated timestamp:', error);
    return null;
  }
};

/**
 * Check if cache is valid
 */
export const isCacheValid = async (
  categoryId: number | undefined,
  userType: string = 'all'
): Promise<boolean> => {
  try {
    const cacheKey = getCacheKey(categoryId, userType);
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
 * Merge incremental updates with cached subcategories
 * Updates subcategory names, images, rates, etc. when admin makes changes
 */
export const mergeIncrementalSubcategoriesUpdates = (
  cachedData: Subcategory[],
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
  },
  categoryId?: number
): Subcategory[] => {
  console.log('🔄 [mergeIncrementalSubcategoriesUpdates] Starting merge...');
  console.log(`   Cached subcategories: ${cachedData.length}`);
  console.log(`   Updated subcategories: ${updates.subcategories?.length || 0}`);
  
  // Process ALL updates - don't filter by categoryId when merging
  // The cache might contain subcategories from multiple categories, and we want to update all of them
  let relevantUpdates = updates.subcategories || [];
  console.log(`   Total updates received: ${relevantUpdates.length}`);
  
  if (categoryId) {
    console.log(`   CategoryId filter provided: ${categoryId}, but processing ALL updates to ensure cache consistency`);
  }
  
  // Log updates by category for debugging
  if (relevantUpdates.length > 0) {
    const updatesByCategory = relevantUpdates.reduce((acc, sub) => {
      acc[sub.main_category_id] = (acc[sub.main_category_id] || 0) + 1;
      return acc;
    }, {} as Record<number, number>);
    console.log(`   Updates by category:`, updatesByCategory);
  }
  
  // Create a map of cached subcategories by ID
  const subcategoryMap = new Map<number, Subcategory>();
  cachedData.forEach(sub => {
    subcategoryMap.set(sub.id, { ...sub });
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
  if (relevantUpdates.length > 0) {
    console.log(`   🔍 Processing ${relevantUpdates.length} subcategory updates...`);
    relevantUpdates.forEach(updatedSub => {
      console.log(`   🔍 Looking for subcategory ID ${updatedSub.id} (${updatedSub.name}) in cache...`);
      const existingSub = subcategoryMap.get(updatedSub.id);
      
      console.log(`   ${existingSub ? '✅ Found' : '❌ Not found'} subcategory ID ${updatedSub.id} in cache`);
      
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
        if (imageUrl && imageUrl.trim().length > 0) {
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
              if (imageChanged) {
                console.log(`   🔄 [Cache Bust] Added timestamp to subcategory image URL (image changed)`);
              } else {
                console.log(`   🔄 [Cache Bust] Added timestamp to subcategory image URL (force reload)`);
              }
            }
          } catch (urlError) {
            console.warn(`   ⚠️  [Cache Bust] Could not add cache-busting parameter:`, urlError);
          }
        }
        
        // Update subcategory - IMPORTANT: spread updatedSub last to ensure new values override old ones
        // This ensures name, image, price changes are applied correctly
        const updatedSubcategory: Subcategory = {
          ...existingSub,
          // Override with updated values from API
          name: updatedSub.name, // Update name
          image: imageUrl, // Update image with cache-busting
          default_price: updatedSub.default_price, // Update price
          price_unit: updatedSub.price_unit, // Update price unit
          // Preserve ID and main_category_id from existing
          id: existingSub.id,
          main_category_id: existingSub.main_category_id,
          // Preserve other fields from existing
          available_in: existingSub.available_in || { b2b: true, b2c: true },
          main_category: existingSub.main_category,
          created_at: existingSub.created_at,
          // Update timestamp to reflect the change
          updated_at: (updatedSub as any).updated_at || new Date().toISOString(),
        };
        
        subcategoryMap.set(updatedSub.id, updatedSubcategory);
        
        // Verify the update immediately after setting
        const updated = subcategoryMap.get(updatedSub.id);
        console.log(`   ✅ Updated subcategory ID ${updatedSub.id} in map`);
        console.log(`      Map contains: ${subcategoryMap.has(updatedSub.id) ? 'YES' : 'NO'}`);
        console.log(`      Name: "${updated?.name}" (was: "${oldName}", target: "${newName}")`);
        console.log(`      Image: ${updated?.image ? 'present' : 'missing'} (changed: ${imageChanged})`);
        console.log(`      Default Price: "${updated?.default_price}" (was: "${existingSub.default_price}", target: "${updatedSub.default_price}", changed: ${priceChanged})`);
        
        // Verify the update actually worked
        if (updated?.name !== newName) {
          console.error(`   ❌ ERROR: Subcategory name not updated correctly! Expected "${newName}", got "${updated?.name}"`);
          console.error(`      Debug: updatedSub.name = "${updatedSub.name}", updatedSub keys = ${Object.keys(updatedSub).join(', ')}`);
        } else {
          console.log(`   ✅ Name update verified: "${updated.name}"`);
        }
        if (imageChanged) {
          // Compare base URLs (without cache-busting parameter)
          const baseUpdatedImage = updated?.image?.replace(/[?&]_t=\d+/g, '') || '';
          const baseNewImage = newImage.replace(/[?&]_t=\d+/g, '');
          if (baseUpdatedImage !== baseNewImage) {
            console.error(`   ❌ ERROR: Subcategory image not updated correctly!`);
            console.error(`      Expected base: "${baseNewImage.substring(0, 100)}..."`);
            console.error(`      Got base: "${baseUpdatedImage.substring(0, 100)}..."`);
          } else {
            console.log(`   ✅ Image update verified (with cache-busting)`);
          }
        }
        if (priceChanged && updated?.default_price !== updatedSub.default_price) {
          console.error(`   ❌ ERROR: Subcategory price not updated correctly!`);
          console.error(`      Expected: "${updatedSub.default_price}", got: "${updated?.default_price}"`);
        } else if (priceChanged) {
          console.log(`   ✅ Price update verified: "${updated?.default_price}"`);
        }
      } else {
        // Subcategory not in cache - add it if it matches the category filter OR if no filter is set
        // This handles new subcategories or subcategories that weren't in the initial cache
        const shouldAdd = !categoryId || updatedSub.main_category_id === categoryId;
        
        if (shouldAdd) {
          console.log(`   ➕ Adding new/updated subcategory ID ${updatedSub.id}: "${updatedSub.name}" (not found in cache, category: ${updatedSub.main_category_id})`);
          
          // Apply cache-busting to image URL
          let imageUrl = updatedSub.image || '';
          if (imageUrl && imageUrl.trim().length > 0) {
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
                console.log(`   🔄 [Cache Bust] Added timestamp to new subcategory image URL`);
              }
            } catch (urlError) {
              console.warn(`   ⚠️  [Cache Bust] Could not add cache-busting parameter:`, urlError);
            }
          }
          
          subcategoryMap.set(updatedSub.id, {
            id: updatedSub.id,
            name: updatedSub.name,
            image: imageUrl,
            main_category_id: updatedSub.main_category_id,
            default_price: updatedSub.default_price,
            price_unit: updatedSub.price_unit,
            available_in: (updatedSub as any).available_in || {
              b2b: true,
              b2c: true,
            },
            created_at: (updatedSub as any).created_at,
            updated_at: (updatedSub as any).updated_at || new Date().toISOString(),
          });
          
          console.log(`   ✅ Added subcategory ID ${updatedSub.id} to cache`);
        } else {
          console.log(`   ⚠️  Subcategory ID ${updatedSub.id} (category ${updatedSub.main_category_id}) doesn't match filter (categoryId: ${categoryId}) - skipping`);
        }
      }
    });
  }
  
  // Convert map back to array
  let updatedSubcategories = Array.from(subcategoryMap.values());
  
  // If categoryId filter is provided, filter the final result to only include subcategories for that category
  // This ensures the hook returns only the subcategories it requested
  if (categoryId !== undefined) {
    const beforeFilter = updatedSubcategories.length;
    updatedSubcategories = updatedSubcategories.filter(sub => sub.main_category_id === categoryId);
    const afterFilter = updatedSubcategories.length;
    if (beforeFilter !== afterFilter) {
      console.log(`   🔍 [Filter] Filtered by categoryId ${categoryId}: ${beforeFilter} → ${afterFilter} subcategories`);
    }
  }
  
  console.log(`   ✅ [mergeIncrementalSubcategoriesUpdates] Merge complete. Final subcategories: ${updatedSubcategories.length}`);
  
  // Log a sample of updated subcategories to verify they have the new values
  if (relevantUpdates.length > 0 && updatedSubcategories.length > 0) {
    const sampleUpdate = relevantUpdates[0];
    const mergedSub = updatedSubcategories.find(s => s.id === sampleUpdate.id);
    if (mergedSub) {
      console.log(`   🔍 [Verification] Sample merged subcategory ID ${sampleUpdate.id}:`);
      console.log(`      Name: "${mergedSub.name}" (API: "${sampleUpdate.name}")`);
      console.log(`      Image: ${mergedSub.image ? 'present' : 'missing'} (API: ${sampleUpdate.image ? 'present' : 'missing'})`);
      console.log(`      Price: "${mergedSub.default_price}" (API: "${sampleUpdate.default_price}")`);
      if (mergedSub.name !== sampleUpdate.name) {
        console.error(`   ❌ ERROR: Name mismatch in final array! Expected "${sampleUpdate.name}", got "${mergedSub.name}"`);
      } else {
        console.log(`   ✅ Name matches API`);
      }
      if (mergedSub.default_price !== sampleUpdate.default_price) {
        console.error(`   ❌ ERROR: Price mismatch in final array! Expected "${sampleUpdate.default_price}", got "${mergedSub.default_price}"`);
      } else {
        console.log(`   ✅ Price matches API`);
      }
    } else {
      console.warn(`   ⚠️  Sample subcategory ID ${sampleUpdate.id} not found in final array!`);
      console.warn(`      This might mean it was filtered out by categoryId (${categoryId}) or not in cache`);
      console.warn(`      Sample update category: ${sampleUpdate.main_category_id}, Filter: ${categoryId}`);
    }
  }
  
  return updatedSubcategories;
};

/**
 * Clear subcategories cache
 */
export const clearSubcategoriesCache = async (
  categoryId: number | undefined,
  userType: string = 'all'
): Promise<void> => {
  try {
    const cacheKey = getCacheKey(categoryId, userType);
    const lastUpdatedKey = getLastUpdatedKey(categoryId, userType);
    
    await Promise.all([
      AsyncStorage.removeItem(cacheKey),
      AsyncStorage.removeItem(lastUpdatedKey)
    ]);
    
    console.log(`🗑️ [clearSubcategoriesCache] Cache cleared for categoryId: ${categoryId}, userType: ${userType}`);
  } catch (error) {
    console.error('Error clearing subcategories cache:', error);
  }
};
