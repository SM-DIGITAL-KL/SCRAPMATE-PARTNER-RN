/**
 * Location Tracking Service
 * Tracks vendor location when pickup is initiated (status 3)
 * - Updates Upstash Redis every 5 minutes
 * - Saves to backend every 30 minutes
 */

import { Platform, NativeModules, AppState, AppStateStatus } from 'react-native';
import { API_BASE_URL, API_KEY } from '../api/apiConfig';
import { REDIS_CONFIG } from '../../config/redisConfig';
import { getActivePickup } from '../api/v2/orders';

const { LocationModule } = NativeModules;


interface LocationData {
  user_id: number;
  user_type: 'R' | 'S' | 'SR' | 'D';
  latitude: number;
  longitude: number;
  timestamp: string;
  order_id: number;
}

interface TrackingState {
  orderId: number | null;
  userId: number | null;
  userType: 'R' | 'S' | 'SR' | 'D' | null;
  isTracking: boolean;
  redisUpdateInterval: NodeJS.Timeout | null;
  backendSaveInterval: NodeJS.Timeout | null;
  lastBackendSave: number;
  orderStatusCheckInterval: NodeJS.Timeout | null;
  appStateSubscription: any | null;
  isAppInBackground: boolean;
  lastSavedLocation: { latitude: number; longitude: number } | null;
}

class LocationTrackingService {
  private state: TrackingState = {
    orderId: null,
    userId: null,
    userType: null,
    isTracking: false,
    redisUpdateInterval: null,
    backendSaveInterval: null,
    lastBackendSave: 0,
    orderStatusCheckInterval: null,
    appStateSubscription: null,
    isAppInBackground: false,
    lastSavedLocation: null,
  };

  private redisUrl: string = REDIS_CONFIG.REDIS_URL;
  private redisToken: string = REDIS_CONFIG.REDIS_TOKEN;

  /**
   * Set Redis credentials (optional - uses default from config if not called)
   */
  setRedisCredentials(url: string, token: string) {
    this.redisUrl = url;
    this.redisToken = token;
    console.log('✅ Redis credentials updated');
  }

  /**
   * Update location in Upstash Redis directly (REST API)
   * Upstash Redis REST API format: POST https://{endpoint}/
   * Body: ["SET", "key", "value", "EX", seconds]
   */
  private async updateRedisLocation(locationData: LocationData): Promise<boolean> {
    try {
      if (!this.redisUrl || !this.redisToken) {
        console.warn('⚠️ Upstash Redis credentials not configured. Skipping Redis update.');
        return false;
      }

      const orderLocationKey = `location:order:${locationData.order_id}`;
      const userLocationKey = `location:user:${locationData.user_id}:type:${locationData.user_type}`;

      const redisUrl = this.redisUrl.replace(/\/$/, ''); // Remove trailing slash
      const locationValue = JSON.stringify(locationData);
      const ttl = 7200; // 2 hours TTL - longer to prevent premature deletion

      // Upstash Redis REST API format
      // POST https://{endpoint}/
      // Body: ["SET", "key", "value", "EX", seconds]
      
      // Update order location
      const orderLocationResponse = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', orderLocationKey, locationValue, 'EX', ttl.toString()]),
      });

      if (!orderLocationResponse.ok) {
        const errorText = await orderLocationResponse.text().catch(() => 'Unknown error');
        console.error('❌ Failed to update order location in Redis:', orderLocationResponse.status, errorText);
      }

      // Update user location
      const userLocationResponse = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['SET', userLocationKey, locationValue, 'EX', ttl.toString()]),
      });

      if (!userLocationResponse.ok) {
        const errorText = await userLocationResponse.text().catch(() => 'Unknown error');
        console.error('❌ Failed to update user location in Redis:', userLocationResponse.status, errorText);
      }

      // Return true if at least order location was updated successfully
      // User location update failure is less critical
      if (orderLocationResponse.ok) {
        if (userLocationResponse.ok) {
          console.log(`✅ Location updated in Redis for order ${locationData.order_id} at ${locationData.latitude}, ${locationData.longitude}`);
        } else {
          console.log(`✅ Order location updated in Redis (user location update failed) for order ${locationData.order_id} at ${locationData.latitude}, ${locationData.longitude}`);
        }
        return true;
      }

      // If order location update failed, log error but don't fail completely
      console.error('❌ Failed to update order location in Redis - location may expire');
      return false;
    } catch (error) {
      console.error('❌ Error updating Redis location:', error);
      return false;
    }
  }

  /**
   * Save location to backend (Lambda API)
   */
  private async saveLocationToBackend(locationData: LocationData): Promise<boolean> {
    try {
      // Validate all required fields before sending
      if (!locationData.user_id || !locationData.user_type || 
          locationData.latitude === undefined || locationData.latitude === null ||
          locationData.longitude === undefined || locationData.longitude === null) {
        console.error('❌ Cannot save location to backend: Missing required fields', {
          user_id: locationData.user_id,
          user_type: locationData.user_type,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
        return false;
      }

      // Validate coordinate ranges
      if (isNaN(locationData.latitude) || isNaN(locationData.longitude) ||
          locationData.latitude < -90 || locationData.latitude > 90 ||
          locationData.longitude < -180 || locationData.longitude > 180) {
        console.error('❌ Cannot save location to backend: Invalid coordinates', {
          latitude: locationData.latitude,
          longitude: locationData.longitude,
        });
        return false;
      }

      const response = await fetch(`${API_BASE_URL}/v2/location/update`, {
        method: 'POST',
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: locationData.user_id,
          user_type: locationData.user_type,
          latitude: locationData.latitude,
          longitude: locationData.longitude,
          order_id: locationData.order_id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Failed to save location to backend:', errorData.msg || response.statusText);
        return false;
      }

      console.log(`✅ Location saved to backend for order ${locationData.order_id}`);
      return true;
    } catch (error) {
      console.error('❌ Error saving location to backend:', error);
      return false;
    }
  }

  /**
   * Get current location from device
   */
  private async getCurrentLocation(): Promise<{ latitude: number; longitude: number } | null> {
    try {
      if (Platform.OS === 'android' && LocationModule) {
        const location = await LocationModule.getCurrentLocation();
        if (location && location.latitude && location.longitude) {
          return {
            latitude: location.latitude,
            longitude: location.longitude,
          };
        }
      }
      return null;
    } catch (error) {
      console.error('❌ Error getting current location:', error);
      return null;
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   * Returns distance in meters
   */
  private calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371e3; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  /**
   * Check if location has moved significantly (more than threshold meters)
   */
  private hasLocationChanged(
    currentLat: number,
    currentLon: number,
    thresholdMeters: number = 200
  ): boolean {
    if (!this.state.lastSavedLocation) {
      // No previous location, always save
      return true;
    }

    const distance = this.calculateDistance(
      currentLat,
      currentLon,
      this.state.lastSavedLocation.latitude,
      this.state.lastSavedLocation.longitude
    );

    return distance > thresholdMeters;
  }

  /**
   * Check order status and stop tracking only if order is completed (status 5)
   */
  private async checkOrderStatus(): Promise<boolean> {
    try {
      if (!this.state.orderId || !this.state.userId || !this.state.userType) {
        console.warn('⚠️ [checkOrderStatus] Missing state, but continuing tracking');
        return true; // Continue tracking even if state check fails
      }

      // Fetch order status from backend
      const activePickup = await getActivePickup(
        this.state.userId,
        this.state.userType
      );

      // Only stop tracking if order status is 5 (completed)
      // Don't stop if order is not active - keep tracking until status 5
      if (activePickup && activePickup.order_id === this.state.orderId) {
        const orderStatus = parseInt(String(activePickup.status || 0));
        if (orderStatus === 5) {
          console.log(`📍 Order ${this.state.orderId} is completed (status 5), stopping tracking`);
          this.stopTracking();
          return false;
        }
        // Order is active and not completed, continue tracking
        return true;
      }

      // If order is not found in active pickups, continue tracking anyway
      // (user wants to track until status 5, not until order becomes inactive)
      console.log(`📍 Order ${this.state.orderId} not found in active pickups, but continuing tracking until status 5`);
      return true;
    } catch (error) {
      console.error('❌ Error checking order status:', error);
      // Don't stop tracking on error, just log it
      return true;
    }
  }

  /**
   * Start tracking location for an order
   */
  async startTracking(orderId: number, userId: number, userType: 'R' | 'S' | 'SR' | 'D'): Promise<void> {
    // Stop any existing tracking
    this.stopTracking();

    this.state.orderId = orderId;
    this.state.userId = userId;
    this.state.userType = userType;
    this.state.isTracking = true;
    this.state.lastBackendSave = Date.now();
    this.state.isAppInBackground = AppState.currentState !== 'active';

    console.log(`📍 Starting location tracking for order ${orderId}, user ${userId} (${userType})`);
    console.log(`📍 App state: ${AppState.currentState}`);

    // Listen to app state changes to continue tracking in background
    this.state.appStateSubscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      this.handleAppStateChange(nextAppState);
    });

    // Check order status every 1 minute to stop tracking if order is completed
    this.state.orderStatusCheckInterval = setInterval(async () => {
      if (!this.state.isTracking) {
        return;
      }
      await this.checkOrderStatus();
    }, 60 * 1000); // 1 minute

    // Update Redis every 5 minutes (300000 ms)
    // This continues even when app is in background
    this.state.redisUpdateInterval = setInterval(async () => {
      // Double-check state before proceeding
      if (!this.state.isTracking || !this.state.orderId || !this.state.userId || !this.state.userType) {
        return;
      }

      // Check order status before sending location update
      const isOrderActive = await this.checkOrderStatus();
      if (!isOrderActive) {
        return; // Tracking stopped by checkOrderStatus
      }

      // Re-check state after status check (might have been cleared)
      if (!this.state.isTracking || !this.state.orderId || !this.state.userId || !this.state.userType) {
        return;
      }

      const appState = AppState.currentState;
      const isBackground = appState !== 'active';
      if (isBackground) {
        console.log(`📍 [Background] Updating location - App state: ${appState}`);
      }

      const location = await this.getCurrentLocation();
      if (!location || location.latitude === undefined || location.longitude === undefined) {
        console.warn('⚠️ Could not get valid location for tracking');
        // If we have a last saved location, refresh it in Redis to prevent expiration
        if (this.state.lastSavedLocation && this.state.orderId && this.state.userId && this.state.userType) {
          console.log('📍 [Redis Update] Using last saved location to refresh TTL');
          const lastLocationData: LocationData = {
            user_id: this.state.userId,
            user_type: this.state.userType,
            latitude: this.state.lastSavedLocation.latitude,
            longitude: this.state.lastSavedLocation.longitude,
            timestamp: new Date().toISOString(),
            order_id: this.state.orderId,
          };
          await this.updateRedisLocation(lastLocationData);
        }
        return;
      }

      // Ensure all required fields are present before creating locationData
      if (!this.state.userId || !this.state.userType || !location.latitude || !location.longitude || !this.state.orderId) {
        console.error('❌ [Redis Update] Missing required state for location data:', {
          userId: this.state.userId,
          userType: this.state.userType,
          latitude: location.latitude,
          longitude: location.longitude,
          orderId: this.state.orderId,
        });
        return;
      }

      // Always update Redis to refresh TTL, even if location hasn't changed significantly
      // This prevents the location from expiring if vehicle is stationary
      const hasChanged = this.hasLocationChanged(location.latitude, location.longitude, 200);
      if (!hasChanged) {
        const distance = this.state.lastSavedLocation
          ? this.calculateDistance(
              location.latitude,
              location.longitude,
              this.state.lastSavedLocation.latitude,
              this.state.lastSavedLocation.longitude
            )
          : 0;
        console.log(`📍 [Redis Update] Location unchanged (< 200m), but updating Redis to refresh TTL. Distance: ${distance.toFixed(2)}m`);
        // Continue to update Redis anyway to refresh TTL
      }

      const locationData: LocationData = {
        user_id: this.state.userId,
        user_type: this.state.userType,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
        order_id: this.state.orderId,
      };

      // Calculate distance moved (before updating lastSavedLocation)
      const distanceMoved = this.state.lastSavedLocation
        ? this.calculateDistance(
            location.latitude,
            location.longitude,
            this.state.lastSavedLocation.latitude,
            this.state.lastSavedLocation.longitude
          )
        : 0;

      // Update Redis directly (works in background too)
      const redisUpdateSuccess = await this.updateRedisLocation(locationData);
      
      // Only update last saved location if Redis update was successful
      // This ensures we preserve the last known good location
      if (redisUpdateSuccess) {
        this.state.lastSavedLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
        console.log(`✅ [Redis Update] Location saved successfully (moved ${distanceMoved.toFixed(2)}m from last saved location)`);
      } else {
        console.warn('⚠️ [Redis Update] Failed to update Redis, preserving last saved location');
        // If Redis update fails, try to preserve last location by refreshing TTL
        if (this.state.lastSavedLocation && this.state.orderId && this.state.userId && this.state.userType) {
          const lastLocationData: LocationData = {
            user_id: this.state.userId,
            user_type: this.state.userType,
            latitude: this.state.lastSavedLocation.latitude,
            longitude: this.state.lastSavedLocation.longitude,
            timestamp: new Date().toISOString(),
            order_id: this.state.orderId,
          };
          await this.updateRedisLocation(lastLocationData);
          console.log('📍 [Redis Update] Refreshed last saved location TTL as fallback');
        }
      }
    }, 5 * 60 * 1000); // 5 minutes

    // Save to backend every 30 minutes (1800000 ms)
    // This continues even when app is in background
    this.state.backendSaveInterval = setInterval(async () => {
      // Double-check state before proceeding
      if (!this.state.isTracking || !this.state.orderId || !this.state.userId || !this.state.userType) {
        console.warn('⚠️ Skipping backend save: Tracking state invalid', {
          isTracking: this.state.isTracking,
          orderId: this.state.orderId,
          userId: this.state.userId,
          userType: this.state.userType,
        });
        return;
      }

      // Check order status before saving to backend
      const isOrderActive = await this.checkOrderStatus();
      if (!isOrderActive) {
        return; // Tracking stopped by checkOrderStatus
      }

      // Re-check state after status check (might have been cleared)
      if (!this.state.isTracking || !this.state.orderId || !this.state.userId || !this.state.userType) {
        console.warn('⚠️ Skipping backend save: State cleared after status check');
        return;
      }

      const appState = AppState.currentState;
      const isBackground = appState !== 'active';
      if (isBackground) {
        console.log(`📍 [Background] Saving location to backend - App state: ${appState}`);
      }

      const location = await this.getCurrentLocation();
      if (!location || location.latitude === undefined || location.longitude === undefined) {
        console.warn('⚠️ Could not get valid location for backend save');
        // If we have a last saved location, refresh it in Redis to prevent expiration
        if (this.state.lastSavedLocation && this.state.orderId && this.state.userId && this.state.userType) {
          console.log('📍 [Backend Save] Using last saved location to refresh Redis TTL');
          const lastLocationData: LocationData = {
            user_id: this.state.userId,
            user_type: this.state.userType,
            latitude: this.state.lastSavedLocation.latitude,
            longitude: this.state.lastSavedLocation.longitude,
            timestamp: new Date().toISOString(),
            order_id: this.state.orderId,
          };
          await this.updateRedisLocation(lastLocationData);
        }
        return;
      }

      // Ensure all required fields are present before creating locationData
      if (!this.state.userId || !this.state.userType || !location.latitude || !location.longitude || !this.state.orderId) {
        console.error('❌ [Backend Save] Missing required state for location data:', {
          userId: this.state.userId,
          userType: this.state.userType,
          latitude: location.latitude,
          longitude: location.longitude,
          orderId: this.state.orderId,
        });
        return;
      }

      // Always update Redis to refresh TTL, even if location hasn't changed significantly
      // This prevents the location from expiring if vehicle is stationary
      const hasChanged = this.hasLocationChanged(location.latitude, location.longitude, 200);
      if (!hasChanged) {
        const distance = this.state.lastSavedLocation
          ? this.calculateDistance(
              location.latitude,
              location.longitude,
              this.state.lastSavedLocation.latitude,
              this.state.lastSavedLocation.longitude
            )
          : 0;
        console.log(`📍 [Backend Save] Location unchanged (< 200m), but refreshing Redis TTL. Distance: ${distance.toFixed(2)}m`);
        // Still update Redis to refresh TTL, but skip backend save
        const locationData: LocationData = {
          user_id: this.state.userId,
          user_type: this.state.userType,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
          order_id: this.state.orderId,
        };
        await this.updateRedisLocation(locationData);
        this.state.lastSavedLocation = {
          latitude: location.latitude,
          longitude: location.longitude,
        };
        return; // Skip backend save but Redis is updated
      }

      const locationData: LocationData = {
        user_id: this.state.userId,
        user_type: this.state.userType,
        latitude: location.latitude,
        longitude: location.longitude,
        timestamp: new Date().toISOString(),
        order_id: this.state.orderId,
      };

      console.log('📍 [Backend Save] Sending location data:', {
        user_id: locationData.user_id,
        user_type: locationData.user_type,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        order_id: locationData.order_id,
        app_state: appState,
      });

      // Calculate distance moved (before updating lastSavedLocation)
      const distanceMoved = this.state.lastSavedLocation
        ? this.calculateDistance(
            location.latitude,
            location.longitude,
            this.state.lastSavedLocation.latitude,
            this.state.lastSavedLocation.longitude
          )
        : 0;
      
      // Save to backend (works in background too)
      await this.saveLocationToBackend(locationData);
      this.state.lastBackendSave = Date.now();
      
      // Update last saved location
      this.state.lastSavedLocation = {
        latitude: location.latitude,
        longitude: location.longitude,
      };
      
      console.log(`📍 [Backend Save] Location saved to database (moved ${distanceMoved.toFixed(2)}m from last saved location)`);
    }, 30 * 60 * 1000); // 30 minutes

    // Do an initial update immediately
    const initialLocation = await this.getCurrentLocation();
    if (initialLocation && this.state.userId && this.state.userType && this.state.orderId) {
      const locationData: LocationData = {
        user_id: this.state.userId,
        user_type: this.state.userType,
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
        timestamp: new Date().toISOString(),
        order_id: this.state.orderId,
      };

      console.log('📍 [Initial Update] Sending initial location data:', {
        user_id: locationData.user_id,
        user_type: locationData.user_type,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        order_id: locationData.order_id,
      });

      await this.updateRedisLocation(locationData);
      await this.saveLocationToBackend(locationData);
      
      // Update last saved location after initial update (always save initial location)
      this.state.lastSavedLocation = {
        latitude: initialLocation.latitude,
        longitude: initialLocation.longitude,
      };
      
      console.log('📍 [Initial Update] Location saved (initial update always saved)');
    } else {
      console.warn('⚠️ [Initial Update] Skipping initial update - missing location or state:', {
        hasLocation: !!initialLocation,
        userId: this.state.userId,
        userType: this.state.userType,
        orderId: this.state.orderId,
      });
    }
  }

  /**
   * Handle app state changes (foreground/background)
   */
  private handleAppStateChange(nextAppState: AppStateStatus): void {
    const wasInBackground = this.state.isAppInBackground;
    const isNowInBackground = nextAppState !== 'active';

    this.state.isAppInBackground = isNowInBackground;

    if (this.state.isTracking) {
      if (isNowInBackground && !wasInBackground) {
        console.log('📍 App moved to background - location tracking will continue');
      } else if (!isNowInBackground && wasInBackground) {
        console.log('📍 App moved to foreground - location tracking active');
        // Optionally do an immediate location update when app comes to foreground
        this.performLocationUpdate();
      }
    }
  }

  /**
   * Perform a location update (used when app comes to foreground)
   */
  private async performLocationUpdate(): Promise<void> {
    if (!this.state.isTracking || !this.state.orderId || !this.state.userId || !this.state.userType) {
      return;
    }

    try {
      const location = await this.getCurrentLocation();
      if (location && location.latitude !== undefined && location.longitude !== undefined) {
        const locationData: LocationData = {
          user_id: this.state.userId,
          user_type: this.state.userType,
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
          order_id: this.state.orderId,
        };

        // Always update Redis to refresh TTL, even if location hasn't changed significantly
        const hasChanged = this.hasLocationChanged(locationData.latitude, locationData.longitude, 200);
        if (hasChanged) {
          // Update Redis immediately
          await this.updateRedisLocation(locationData);
          
          // Update last saved location
          this.state.lastSavedLocation = {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          };
          
          console.log('📍 Immediate location update after app foreground');
        } else {
          // Still update Redis to refresh TTL even if location hasn't changed
          await this.updateRedisLocation(locationData);
          this.state.lastSavedLocation = {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          };
          const distance = this.state.lastSavedLocation
            ? this.calculateDistance(
                locationData.latitude,
                locationData.longitude,
                this.state.lastSavedLocation.latitude,
                this.state.lastSavedLocation.longitude
              )
            : 0;
          console.log(`📍 [Foreground Update] Location unchanged (< 200m), but refreshed Redis TTL. Distance: ${distance.toFixed(2)}m`);
        }
      }
    } catch (error) {
      console.error('❌ Error performing immediate location update:', error);
    }
  }

  /**
   * Stop tracking location
   * Note: Does NOT delete location from Redis - location persists with TTL
   */
  stopTracking(): void {
    // Save last location to Redis one final time before stopping (if available)
    if (this.state.isTracking && this.state.lastSavedLocation && 
        this.state.orderId && this.state.userId && this.state.userType) {
      const finalLocationData: LocationData = {
        user_id: this.state.userId,
        user_type: this.state.userType,
        latitude: this.state.lastSavedLocation.latitude,
        longitude: this.state.lastSavedLocation.longitude,
        timestamp: new Date().toISOString(),
        order_id: this.state.orderId,
      };
      
      // Update Redis one last time to ensure location persists
      this.updateRedisLocation(finalLocationData).then((success) => {
        if (success) {
          console.log(`📍 Final location saved to Redis before stopping tracking for order ${this.state.orderId}`);
        } else {
          console.warn(`⚠️ Failed to save final location to Redis for order ${this.state.orderId}`);
        }
      }).catch((error) => {
        console.error('❌ Error saving final location to Redis:', error);
      });
    }

    if (this.state.redisUpdateInterval) {
      clearInterval(this.state.redisUpdateInterval);
      this.state.redisUpdateInterval = null;
    }

    if (this.state.backendSaveInterval) {
      clearInterval(this.state.backendSaveInterval);
      this.state.backendSaveInterval = null;
    }

    if (this.state.orderStatusCheckInterval) {
      clearInterval(this.state.orderStatusCheckInterval);
      this.state.orderStatusCheckInterval = null;
    }

    if (this.state.appStateSubscription) {
      this.state.appStateSubscription.remove();
      this.state.appStateSubscription = null;
    }

    if (this.state.isTracking) {
      console.log(`📍 Stopped location tracking for order ${this.state.orderId} (location remains in Redis with TTL)`);
    }

    this.state.isTracking = false;
    // Keep orderId, userId, userType, and lastSavedLocation for potential recovery
    // Only clear them if explicitly needed
    const savedOrderId = this.state.orderId;
    this.state.orderId = null;
    this.state.userId = null;
    this.state.userType = null;
    this.state.isAppInBackground = false;
    // Keep lastSavedLocation in memory for potential recovery (not cleared)
    // this.state.lastSavedLocation = null; // Commented out to preserve last location
  }

  /**
   * Check if currently tracking
   */
  isTracking(): boolean {
    return this.state.isTracking;
  }

  /**
   * Get current tracking order ID
   */
  getCurrentOrderId(): number | null {
    return this.state.orderId;
  }
}

// Export singleton instance
export const locationTrackingService = new LocationTrackingService();

