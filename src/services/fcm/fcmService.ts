/**
 * Firebase Cloud Messaging (FCM) Service
 * Handles FCM token management, notification permissions, and message handling
 */

import messaging from '@react-native-firebase/messaging';
import { Platform, Alert, AppState, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserData } from '../auth/authService';
import { storeFcmToken, clearFcmToken } from '../api/v2/fcm';

export interface NotificationPayload {
  title?: string;
  body?: string;
  data?: Record<string, any>;
  [key: string]: any;
}

class FCMService {
  private fcmToken: string | null = null;
  private tokenRefreshUnsubscribe: (() => void) | null = null;
  private messageUnsubscribe: (() => void) | null = null;
  private notificationOpenedUnsubscribe: (() => void) | null = null;
  private appStateSubscription: any = null;

  /**
   * Initialize FCM service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🔔 FCMService: Initializing...');

      // Create notification channel for Android (required for Android 8.0+)
      if (Platform.OS === 'android') {
        await this.createNotificationChannel();
      }

      // Request notification permissions
      await this.requestPermission();

      // Register device for remote messages (required for iOS)
      // Note: React Native Firebase should auto-register, but we ensure it's done
      if (Platform.OS === 'ios') {
        try {
          // Always try to register - it's idempotent and safe to call multiple times
          // Even if auto-registration is enabled, calling this ensures registration is complete
          console.log('📱 FCMService: Ensuring device is registered for remote messages...');
          await messaging().registerDeviceForRemoteMessages();
          // Wait longer for APNS token registration to complete
          // The AppDelegate's didRegisterForRemoteNotificationsWithDeviceToken needs time
          // APNS token must be registered before FCM token can be obtained
          console.log('⏳ FCMService: Waiting for APNS token registration...');
          await new Promise(resolve => setTimeout(resolve, 2000)); // Increased wait time for APNS
          console.log('✅ FCMService: Device registration ensured (iOS)');
        } catch (registerError: any) {
          // If auto-registration is enabled, this might show a warning but continue
          const errorMsg = registerError.message || '';
          if (errorMsg.includes('not required') || errorMsg.includes('auto-registration')) {
            console.log('ℹ️ FCMService: Auto-registration is enabled, waiting for APNS token...');
            // Even with auto-registration, wait for APNS token to be registered
            await new Promise(resolve => setTimeout(resolve, 2000));
          } else {
            console.warn('⚠️ FCMService: Registration warning:', errorMsg);
            // Wait anyway to allow APNS token registration
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
      }

      // Get initial FCM token (with retry mechanism built-in)
      await this.getFCMToken();

      // Set up token refresh listener
      this.setupTokenRefreshListener();

      // Set up message handlers
      this.setupMessageHandlers();

      // Check for initial notification (app opened from notification)
      await this.checkInitialNotification();

      console.log('✅ FCMService: Initialization complete');
    } catch (error) {
      console.error('❌ FCMService: Initialization error:', error);
      throw error;
    }
  }

  /**
   * Create notification channel for Android (required for Android 8.0+)
   */
  private async createNotificationChannel(): Promise<void> {
    try {
      if (Platform.OS === 'android') {
        // Try to create notification channel using native module
        try {
          const { NativeModules } = require('react-native');
          const { NotificationChannelModule } = NativeModules;
          
          if (NotificationChannelModule && NotificationChannelModule.createNotificationChannel) {
            await NotificationChannelModule.createNotificationChannel();
            console.log('✅ FCMService: Notification channel created via native module');
          } else {
            console.warn('⚠️ FCMService: NotificationChannelModule not available, channel should be created from manifest');
          }
        } catch (nativeError: any) {
          console.warn('⚠️ FCMService: Could not create channel via native module:', nativeError.message);
          console.log('   Channel should be created from AndroidManifest.xml');
          console.log('   Channel ID: scrapmate_partner_notifications');
        }
      }
    } catch (error: any) {
      console.error('❌ FCMService: Error creating notification channel:', error);
      // Don't throw - channel creation failure shouldn't break the app
    }
  }

  /**
   * Request notification permissions
   */
  async requestPermission(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;

        if (enabled) {
          console.log('✅ FCMService: Notification permission granted');
        } else {
          console.warn('⚠️ FCMService: Notification permission denied');
        }
        return enabled;
      } else {
        // Android permissions are granted by default
        console.log('✅ FCMService: Android notification permission granted');
        return true;
      }
    } catch (error) {
      console.error('❌ FCMService: Error requesting permission:', error);
      return false;
    }
  }

  /**
   * Get FCM token (without storing on server)
   * Use this when you just need the token (e.g., during login)
   */
  async getFCMTokenOnly(): Promise<string | null> {
    try {
      // Ensure device is registered for remote messages (iOS)
      if (Platform.OS === 'ios') {
        try {
          // Check if device is already registered
          const isRegistered = messaging().isDeviceRegisteredForRemoteMessages;
          if (!isRegistered) {
            console.log('📱 FCMService: Registering device for remote messages...');
            await messaging().registerDeviceForRemoteMessages();
            // Small delay to ensure registration completes
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error: any) {
          // If registration fails, try to continue anyway
          console.warn('⚠️ FCMService: Registration check failed, continuing:', error.message);
        }
      }
      
      const token = await messaging().getToken();
      if (token) {
        console.log('🔑 FCMService: FCM Token obtained:', token.substring(0, 20) + '...');
        this.fcmToken = token;
        return token;
      } else {
        console.warn('⚠️ FCMService: No FCM token available');
        return null;
      }
    } catch (error) {
      console.error('❌ FCMService: Error getting FCM token:', error);
      return null;
    }
  }

  /**
   * Get FCM token and store it on the server
   */
  async getFCMToken(): Promise<string | null> {
    try {
      // Ensure device is registered for remote messages (iOS)
      if (Platform.OS === 'ios') {
        try {
          // Always try to register - it's idempotent
          await messaging().registerDeviceForRemoteMessages();
          // Wait a bit longer to ensure registration completes
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error: any) {
          // If auto-registration is enabled, this might show a warning but continue
          const errorMsg = error.message || '';
          if (!errorMsg.includes('not required') && !errorMsg.includes('auto-registration')) {
            console.warn('⚠️ FCMService: Registration warning:', errorMsg);
          }
        }
      }
      
      // Retry mechanism for getting token (iOS sometimes needs a retry)
      let token: string | null = null;
      let retries = 8; // Increased retries for APNS token wait
      let delay = 500; // Start with longer delay
      
      while (retries > 0 && !token) {
        try {
          token = await messaging().getToken();
          if (token) break;
        } catch (error: any) {
          retries--;
          const errorCode = error.code || '';
          const errorMessage = error.message || '';
          
          // Check for APNS token error specifically
          const isAPNSError = errorCode === 'messaging/unknown' && 
                             (errorMessage.includes('APNS token') || 
                              errorMessage.includes('No APNS token'));
          
          const isUnregisteredError = errorCode === 'messaging/unregistered' || 
                                     errorMessage.includes('unregistered');
          
          if ((isAPNSError || isUnregisteredError) && retries > 0) {
            if (isAPNSError) {
              console.log(`⏳ FCMService: Waiting for APNS token, retrying (${retries} attempts left)...`);
            } else {
              console.log(`🔄 FCMService: Device not registered yet, retrying (${retries} attempts left)...`);
            }
            
            // Re-register if needed (iOS)
            if (Platform.OS === 'ios') {
              try {
                await messaging().registerDeviceForRemoteMessages();
                console.log('📱 FCMService: Re-registered device for remote messages');
              } catch (regError: any) {
                // Ignore "not required" warnings
                const regMsg = regError.message || '';
                if (!regMsg.includes('not required') && !regMsg.includes('auto-registration')) {
                  console.warn('⚠️ FCMService: Re-registration warning:', regMsg);
                }
              }
            }
            
            // Wait longer for APNS token (it takes time to register)
            await new Promise(resolve => setTimeout(resolve, delay));
            delay = Math.min(delay * 1.2, 3000); // Cap at 3 seconds, slower backoff for APNS
          } else {
            // If not a registration/APNS error or out of retries, throw
            throw error;
          }
        }
      }
      
      if (!token) {
        throw new Error('Failed to get FCM token after retries');
      }
      if (token) {
        console.log('🔑 FCMService: FCM Token obtained:', token.substring(0, 20) + '...');
        console.log('   Full token length:', token.length);
        this.fcmToken = token;

        // Store token on server if user is logged in
        try {
          await this.storeTokenOnServer(token);
        } catch (storeError: any) {
          console.error('❌ FCMService: Failed to store token on server:', storeError);
          console.error('   Error message:', storeError.message);
          // Don't throw - continue even if storage fails
        }

        return token;
      } else {
        console.warn('⚠️ FCMService: No FCM token available');
        return null;
      }
    } catch (error: any) {
      console.error('❌ FCMService: Error getting FCM token:', error);
      console.error('   Error details:', error.message);
      if (error.code) {
        console.error('   Error code:', error.code);
      }
      return null;
    }
  }

  /**
   * Store FCM token on the server
   */
  private async storeTokenOnServer(token: string): Promise<void> {
    try {
      const userData = await getUserData();
      if (userData?.id) {
        console.log('💾 FCMService: Storing FCM token on server for user:', userData.id);
        console.log('   Token preview:', token.substring(0, 30) + '...');
        try {
          await storeFcmToken(userData.id, token);
          console.log('✅ FCMService: FCM token stored on server successfully');
        } catch (apiError: any) {
          console.error('❌ FCMService: API error storing token:', apiError.message);
          if (apiError.response) {
            console.error('   Response status:', apiError.response.status);
            console.error('   Response data:', apiError.response.data);
          }
          throw apiError;
        }
      } else {
        console.log('ℹ️ FCMService: User not logged in, skipping token storage');
      }
    } catch (error: any) {
      console.error('❌ FCMService: Error storing FCM token on server:', error);
      console.error('   Error message:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
      // Don't throw - token storage failure shouldn't break the app
    }
  }

  /**
   * Clear FCM token from server (on logout)
   */
  async clearTokenFromServer(userId: string | number): Promise<void> {
    try {
      console.log('🗑️ FCMService: Clearing FCM token from server for user:', userId);
      await clearFcmToken(userId);
      console.log('✅ FCMService: FCM token cleared from server');
    } catch (error) {
      console.error('❌ FCMService: Error clearing FCM token from server:', error);
      // Don't throw - token clearing failure shouldn't break logout
    }
  }

  /**
   * Set up token refresh listener
   */
  private setupTokenRefreshListener(): void {
    this.tokenRefreshUnsubscribe = messaging().onTokenRefresh(async (token) => {
      console.log('🔄 FCMService: FCM token refreshed:', token.substring(0, 20) + '...');
      this.fcmToken = token;
      await this.storeTokenOnServer(token);
    });
  }

  /**
   * Set up message handlers for foreground, background, and quit state
   */
  private setupMessageHandlers(): void {
    // Handle foreground messages (when app is open)
    this.messageUnsubscribe = messaging().onMessage(async (remoteMessage) => {
      console.log('📨 FCMService: Foreground message received');
      console.log('   Full message:', JSON.stringify(remoteMessage, null, 2));
      console.log('   Notification type:', remoteMessage.data?.type);
      console.log('   Has notification:', !!remoteMessage.notification);
      console.log('   Has data:', !!remoteMessage.data);
      
      if (remoteMessage.notification) {
        console.log('   Title:', remoteMessage.notification.title);
        console.log('   Body:', remoteMessage.notification.body);
      }
      
      // Handle notification data FIRST (before showing alert)
      // This ensures events are emitted even if user dismisses alert
      if (remoteMessage.data) {
        console.log('   Processing notification data...');
        this.handleNotificationData(remoteMessage.data);
      } else {
        console.warn('⚠️ FCMService: Foreground message has no data field');
      }
      
      // Show local notification for foreground messages
      if (remoteMessage.notification) {
        this.showLocalNotification(
          remoteMessage.notification.title || 'Notification',
          remoteMessage.notification.body || '',
          remoteMessage.data
        );
      } else {
        console.warn('⚠️ FCMService: Foreground message has no notification field');
        console.warn('   This might be a data-only message');
        
        // Even if there's no notification field, try to show alert if we have data
        if (remoteMessage.data && remoteMessage.data.type) {
          const title = remoteMessage.data.title || 'New Notification';
          const body = remoteMessage.data.body || remoteMessage.data.message || 'You have a new notification';
          this.showLocalNotification(title, body, remoteMessage.data);
        }
      }
    });

    // Note: Background message handler must be registered in index.js at the top level
    // Do not call setBackgroundMessageHandler here - it won't work inside a method

    // Handle notification opened (when user taps notification)
    this.notificationOpenedUnsubscribe = messaging().onNotificationOpenedApp(
      (remoteMessage) => {
        console.log('🔔 FCMService: Notification opened app:', remoteMessage);
        console.log('   Notification type:', remoteMessage.data?.type);
        console.log('   Data:', JSON.stringify(remoteMessage.data, null, 2));
        this.handleNotificationOpened(remoteMessage);
      }
    );

    // Monitor app state to refresh token when app comes to foreground
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        console.log('🔄 FCMService: App came to foreground');
        // Refresh token when app comes to foreground
        await this.getFCMToken();
        
        // Check for any pending notifications stored in AsyncStorage from background handler
        try {
          const allKeys = await AsyncStorage.getAllKeys();
          const notificationKeys = allKeys.filter(key => key.startsWith('pending_notification_'));
          
          if (notificationKeys.length > 0) {
            console.log(`📨 FCMService: Found ${notificationKeys.length} pending notification(s) from background`);
            
            // Process all pending notifications
            for (const key of notificationKeys) {
              try {
                const notificationData = await AsyncStorage.getItem(key);
                if (notificationData) {
                  const notification = JSON.parse(notificationData);
                  console.log('📨 Processing stored notification:', notification.type);
                  
                  // Process the notification
                  if (notification.data) {
                    this.handleNotificationData(notification.data);
                  }
                  
                  // Remove processed notification
                  await AsyncStorage.removeItem(key);
                  console.log('✅ Processed and removed stored notification:', key);
                }
              } catch (parseError) {
                console.error('❌ Error processing stored notification:', parseError);
                // Remove invalid notification
                await AsyncStorage.removeItem(key);
              }
            }
          }
        } catch (storageError) {
          console.error('❌ FCMService: Error checking stored notifications:', storageError);
        }
        
        // Also check for initial notification (app opened from notification)
        try {
          const initialNotification = await messaging().getInitialNotification();
          if (initialNotification && initialNotification.data) {
            console.log('📨 FCMService: Found initial notification:', initialNotification.data?.type);
            // Small delay to ensure app is fully initialized
            setTimeout(() => {
              this.handleNotificationData(initialNotification.data);
            }, 500);
          }
        } catch (error) {
          console.error('❌ FCMService: Error checking initial notification:', error);
        }
      }
    });
  }

  /**
   * Check for initial notification (app opened from notification)
   */
  private async checkInitialNotification(): Promise<void> {
    try {
      const remoteMessage = await messaging().getInitialNotification();
      if (remoteMessage) {
        console.log('🔔 FCMService: App opened from notification:', remoteMessage);
        // Wait a bit for app to fully initialize before handling
        setTimeout(() => {
          this.handleNotificationOpened(remoteMessage);
        }, 1000);
      }
    } catch (error) {
      console.error('❌ FCMService: Error checking initial notification:', error);
    }
  }

  /**
   * Show local notification (for foreground messages)
   * Note: React Native Firebase should automatically show notifications,
   * but we can use Alert as a fallback for foreground messages
   */
  private showLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): void {
    console.log('📢 FCMService: Showing local notification:', { title, body, hasData: !!data });
    
    // React Native Firebase should automatically display notifications
    // But for foreground messages, we can show an Alert as well
    // On Android, notifications should appear in the notification tray automatically
    // On iOS, we need to show an Alert for foreground messages
    
    if (Platform.OS === 'ios') {
      Alert.alert(title, body, [
        {
          text: 'OK',
          onPress: () => {
            if (data) {
              this.handleNotificationData(data);
            }
          },
        },
      ]);
    } else {
      // Android: React Native Firebase should show notification automatically
      // But we can also show an Alert for immediate visibility
      console.log('📱 FCMService: Android - notification should appear in notification tray');
      
      // Show Alert for immediate feedback (optional)
      Alert.alert(title, body, [
        {
          text: 'OK',
          onPress: () => {
            if (data) {
              this.handleNotificationData(data);
            }
          },
        },
      ]);
    }
  }

  /**
   * Handle notification data
   */
  private handleNotificationData(data: Record<string, any>): void {
    console.log('📊 FCMService: Handling notification data:', data);
    
    // You can add custom logic here based on notification data
    // For example, navigate to a specific screen based on notification type
    if (data.type) {
      switch (data.type) {
        case 'new_order':
          // New order notification - emit event to refresh orders in dashboards
          console.log('📦 FCMService: New order notification received');
          console.log('   Order ID:', data.order_id);
          console.log('   Order Number:', data.order_number);
          console.log('   Shop ID:', data.shop_id);
          // Emit event to trigger order list refresh in dashboards
          DeviceEventEmitter.emit('NEW_ORDER_RECEIVED', {
            order_id: data.order_id,
            order_number: data.order_number,
            shop_id: data.shop_id,
            customer_id: data.customer_id,
            status: data.status
          });
          break;
        case 'order_update':
          // Navigate to order details
          console.log('📦 FCMService: Order update notification');
          DeviceEventEmitter.emit('ORDER_UPDATED', data);
          break;
        case 'pickup_request':
          // Navigate to pickup request
          console.log('🚚 FCMService: Pickup request notification');
          DeviceEventEmitter.emit('PICKUP_REQUEST_RECEIVED', data);
          break;
        case 'pickup_request_accepted_by_other':
          // Another vendor accepted the pickup request
          console.log('⚠️ FCMService: Pickup request accepted by another vendor');
          console.log('   Order ID:', data.order_id);
          console.log('   Order Number:', data.order_number);
          console.log('   Accepted by User ID:', data.accepted_by_user_id);
          console.log('   Full data:', JSON.stringify(data, null, 2));
          
          // Prepare event data
          const eventData = {
            order_id: data.order_id,
            order_number: data.order_number,
            accepted_by_user_id: data.accepted_by_user_id
          };
          
          console.log('📤 FCMService: Emitting PICKUP_REQUEST_ACCEPTED_BY_OTHER event');
          console.log('   Event data:', JSON.stringify(eventData, null, 2));
          
          // Emit event to trigger dashboard refresh and show alert
          try {
            DeviceEventEmitter.emit('PICKUP_REQUEST_ACCEPTED_BY_OTHER', eventData);
            console.log('✅ FCMService: Event emitted successfully');
          } catch (emitError) {
            console.error('❌ FCMService: Error emitting event:', emitError);
          }
          break;
        case 'order_list_updated':
          // Order list has been updated (e.g., order was accepted by another vendor)
          // Refresh the available orders list
          console.log('🔄 FCMService: Order list updated notification');
          console.log('   Order ID:', data.order_id);
          console.log('   Order Number:', data.order_number);
          console.log('   Action:', data.action);
          
          // Emit event to trigger dashboard refresh
          DeviceEventEmitter.emit('ORDER_LIST_UPDATED', {
            order_id: data.order_id,
            order_number: data.order_number,
            action: data.action || 'refresh_orders'
          });
          break;
        default:
          console.log('ℹ️ FCMService: Unknown notification type:', data.type);
      }
    }
  }

  /**
   * Handle notification opened (when user taps notification)
   */
  private handleNotificationOpened(remoteMessage: any): void {
    console.log('🔔 FCMService: Handling notification opened:', remoteMessage);
    console.log('   Notification type:', remoteMessage.data?.type);
    console.log('   Data:', JSON.stringify(remoteMessage.data, null, 2));
    
    // Process notification data when notification is tapped
    if (remoteMessage.data) {
      this.handleNotificationData(remoteMessage.data);
    }

    if (remoteMessage.notification) {
      console.log(
        '📨 FCMService: Notification:',
        remoteMessage.notification.title,
        remoteMessage.notification.body
      );
    }
  }

  /**
   * Get current FCM token
   */
  getToken(): string | null {
    return this.fcmToken;
  }

  /**
   * Subscribe to a topic
   */
  async subscribeToTopic(topic: string): Promise<void> {
    try {
      await messaging().subscribeToTopic(topic);
      console.log('✅ FCMService: Subscribed to topic:', topic);
    } catch (error) {
      console.error('❌ FCMService: Error subscribing to topic:', error);
      throw error;
    }
  }

  /**
   * Unsubscribe from a topic
   */
  async unsubscribeFromTopic(topic: string): Promise<void> {
    try {
      await messaging().unsubscribeFromTopic(topic);
      console.log('✅ FCMService: Unsubscribed from topic:', topic);
    } catch (error) {
      console.error('❌ FCMService: Error unsubscribing from topic:', error);
      throw error;
    }
  }

  /**
   * Cleanup - remove all listeners
   */
  cleanup(): void {
    console.log('🧹 FCMService: Cleaning up...');
    
    if (this.tokenRefreshUnsubscribe) {
      this.tokenRefreshUnsubscribe();
      this.tokenRefreshUnsubscribe = null;
    }

    if (this.messageUnsubscribe) {
      this.messageUnsubscribe();
      this.messageUnsubscribe = null;
    }

    if (this.notificationOpenedUnsubscribe) {
      this.notificationOpenedUnsubscribe();
      this.notificationOpenedUnsubscribe = null;
    }

    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    this.fcmToken = null;
    console.log('✅ FCMService: Cleanup complete');
  }
}

// Export singleton instance
export const fcmService = new FCMService();

