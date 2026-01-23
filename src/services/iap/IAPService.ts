/**
 * iOS In-App Purchase Service
 * Handles Apple IAP for subscription purchases
 */

import { Platform, Alert } from 'react-native';
import {
  initConnection,
  endConnection,
  getProducts,
  purchaseUpdatedListener,
  purchaseErrorListener,
  finishTransaction,
  requestPurchase,
  Product,
  Purchase,
  PurchaseError,
  SubscriptionPurchase,
} from 'react-native-iap';

export interface IAPProduct extends Product {
  packageId?: string; // Map to backend package ID
}

class IAPService {
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized = false;
  private products: IAPProduct[] = [];

  /**
   * Initialize IAP connection
   */
  async initialize(): Promise<boolean> {
    if (Platform.OS !== 'ios') {
      console.warn('⚠️ IAP only available on iOS');
      return false;
    }

    if (this.isInitialized) {
      console.log('✅ IAP already initialized');
      return true;
    }

    try {
      console.log('🔧 Initializing IAP connection...');
      const result = await initConnection();
      this.isInitialized = result;
      
      if (result) {
        console.log('✅ IAP connection initialized');
        this.setupListeners();
      } else {
        console.error('❌ Failed to initialize IAP connection');
      }
      
      return result;
    } catch (error: any) {
      console.error('❌ Error initializing IAP:', error);
      return false;
    }
  }

  /**
   * Setup purchase listeners
   */
  private setupListeners() {
    // Listen for successful purchases
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: Purchase | SubscriptionPurchase) => {
        console.log('✅ Purchase successful:', purchase);
        // Transaction will be finished in handlePurchase
      }
    );

    // Listen for purchase errors
    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('❌ Purchase error:', error);
      }
    );
  }

  /**
   * Get available products from App Store
   * @param productIds - Array of Apple product IDs
   */
  async getProducts(productIds: string[]): Promise<IAPProduct[]> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('IAP not initialized');
      }
    }

    try {
      console.log('📦 Fetching IAP products:', productIds);
      const products = await getProducts({ skus: productIds });
      console.log('✅ IAP products fetched:', products.length);
      this.products = products as IAPProduct[];
      return this.products;
    } catch (error: any) {
      console.error('❌ Error fetching IAP products:', error);
      throw error;
    }
  }

  /**
   * Purchase a product
   * @param productId - Apple product ID
   * @param packageId - Backend package ID (optional, for mapping)
   */
  async purchaseProduct(
    productId: string,
    packageId?: string
  ): Promise<Purchase | SubscriptionPurchase> {
    if (!this.isInitialized) {
      const initialized = await this.initialize();
      if (!initialized) {
        throw new Error('IAP not initialized');
      }
    }

    try {
      console.log('💳 Initiating purchase:', { productId, packageId });
      
      // Request purchase - this will trigger the purchaseUpdatedListener
      await requestPurchase({ sku: productId });
      
      // The purchase result will be handled by the existing listeners
      // Return a promise that resolves when purchase is complete
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Purchase timeout - no response received'));
        }, 120000); // 2 minute timeout

        // Create temporary listeners for this specific purchase
        let tempUpdateSub: any = null;
        let tempErrorSub: any = null;

        const cleanup = () => {
          clearTimeout(timeout);
          if (tempUpdateSub) {
            tempUpdateSub.remove();
            tempUpdateSub = null;
          }
          if (tempErrorSub) {
            tempErrorSub.remove();
            tempErrorSub = null;
          }
        };

        const successHandler = async (purchase: Purchase | SubscriptionPurchase) => {
          if (purchase.productId === productId) {
            cleanup();
            
            // Finish transaction
            try {
              await finishTransaction({ purchase });
              console.log('✅ Transaction finished');
            } catch (finishError) {
              console.error('❌ Error finishing transaction:', finishError);
            }
            
            resolve(purchase);
          }
        };

        const errorHandler = (error: PurchaseError) => {
          cleanup();
          
          if (error.code === 'E_USER_CANCELLED') {
            reject(new Error('Purchase cancelled by user'));
          } else {
            reject(new Error(error.message || 'Purchase failed'));
          }
        };

        // Add temporary listeners
        tempUpdateSub = purchaseUpdatedListener(successHandler);
        tempErrorSub = purchaseErrorListener(errorHandler);
      });
    } catch (error: any) {
      console.error('❌ Error purchasing product:', error);
      throw error;
    }
  }

  /**
   * Finish a transaction (acknowledge purchase)
   * @param purchase - Purchase object
   */
  async finishTransaction(purchase: Purchase | SubscriptionPurchase): Promise<void> {
    try {
      await finishTransaction({ purchase });
      console.log('✅ Transaction finished:', purchase.transactionId);
    } catch (error: any) {
      console.error('❌ Error finishing transaction:', error);
      throw error;
    }
  }

  /**
   * Cleanup and end IAP connection
   */
  async cleanup() {
    try {
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
        this.purchaseUpdateSubscription = null;
      }
      
      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
        this.purchaseErrorSubscription = null;
      }
      
      await endConnection();
      this.isInitialized = false;
      console.log('✅ IAP connection ended');
    } catch (error: any) {
      console.error('❌ Error cleaning up IAP:', error);
    }
  }

  /**
   * Get product by package ID
   */
  getProductByPackageId(packageId: string): IAPProduct | undefined {
    return this.products.find(p => p.packageId === packageId);
  }

  /**
   * Get product by Apple product ID
   */
  getProductByProductId(productId: string): IAPProduct | undefined {
    return this.products.find(p => p.productId === productId);
  }
}

// Export singleton instance
export const iapService = new IAPService();
