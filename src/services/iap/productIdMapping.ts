/**
 * Mapping between backend package IDs and Apple IAP product IDs
 */

export const APPLE_PRODUCT_ID_MAP: Record<string, string> = {
  // B2C Monthly subscription
  'b2c_monthly': 'com.scrapmatepartner.b2cmonthly.app',
  'monthly': 'com.scrapmatepartner.b2cmonthly.app',
  'B2C Monthly': 'com.scrapmatepartner.b2cmonthly.app',
  
  // B2C Yearly subscription
  'b2c_yearly': 'com.scrapmatepartner.b2Cyearly.app',
  'yearly': 'com.scrapmatepartner.b2Cyearly.app',
  'B2C Yearly': 'com.scrapmatepartner.b2Cyearly.app',
};

/**
 * Get Apple product ID from package ID or name
 */
export const getAppleProductId = (packageId: string, packageName?: string): string | null => {
  // First check if package has appleProductId directly
  // Then check mapping by ID
  if (APPLE_PRODUCT_ID_MAP[packageId]) {
    return APPLE_PRODUCT_ID_MAP[packageId];
  }
  
  // Check mapping by name
  if (packageName && APPLE_PRODUCT_ID_MAP[packageName]) {
    return APPLE_PRODUCT_ID_MAP[packageName];
  }
  
  // Check case-insensitive match
  const lowerId = packageId.toLowerCase();
  const lowerName = packageName?.toLowerCase();
  
  for (const [key, value] of Object.entries(APPLE_PRODUCT_ID_MAP)) {
    if (key.toLowerCase() === lowerId || key.toLowerCase() === lowerName) {
      return value;
    }
  }
  
  return null;
};

/**
 * Get all Apple product IDs for IAP initialization
 */
export const getAllAppleProductIds = (): string[] => {
  return Object.values(APPLE_PRODUCT_ID_MAP);
};
