/**
 * React Hook for In-App Purchases
 */

import { useState, useEffect, useCallback } from 'react';
import { Platform, Alert } from 'react-native';
import { iapService, IAPProduct } from '../services/iap/IAPService';
import { Purchase, SubscriptionPurchase, PurchaseError } from 'react-native-iap';

export interface UseIAPResult {
  products: IAPProduct[];
  loading: boolean;
  error: string | null;
  initialized: boolean;
  purchaseProduct: (productId: string, packageId?: string) => Promise<Purchase | SubscriptionPurchase>;
  refreshProducts: (productIds: string[]) => Promise<void>;
}

/**
 * Hook for managing In-App Purchases
 * @param productIds - Array of Apple product IDs to fetch
 */
export const useIAP = (productIds: string[] = []): UseIAPResult => {
  const [products, setProducts] = useState<IAPProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);

  /**
   * Initialize IAP and fetch products
   */
  const refreshProducts = useCallback(async (ids: string[] = productIds) => {
    if (Platform.OS !== 'ios' || ids.length === 0) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const initialized = await iapService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize IAP');
      }
      setInitialized(true);

      const fetchedProducts = await iapService.getProducts(ids);
      setProducts(fetchedProducts);
    } catch (err: any) {
      console.error('Error fetching IAP products:', err);
      setError(err.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, [productIds]);

  /**
   * Purchase a product
   */
  const purchaseProduct = useCallback(
    async (productId: string, packageId?: string): Promise<Purchase | SubscriptionPurchase> => {
      if (Platform.OS !== 'ios') {
        throw new Error('IAP only available on iOS');
      }

      if (!initialized) {
        await refreshProducts();
      }

      try {
        const purchase = await iapService.purchaseProduct(productId, packageId);
        return purchase;
      } catch (err: any) {
        console.error('Error purchasing product:', err);
        throw err;
      }
    },
    [initialized, refreshProducts]
  );

  // Initialize on mount
  useEffect(() => {
    if (Platform.OS === 'ios' && productIds.length > 0) {
      refreshProducts();
    }

    // Cleanup on unmount
    return () => {
      iapService.cleanup();
    };
  }, []);

  return {
    products,
    loading,
    error,
    initialized,
    purchaseProduct,
    refreshProducts,
  };
};
