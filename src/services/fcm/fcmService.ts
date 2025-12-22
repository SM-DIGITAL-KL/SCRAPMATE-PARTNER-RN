/**
 * Firebase Cloud Messaging (FCM) Service
 * Handles FCM token management, notification permissions, and message handling
 */

import messaging from '@react-native-firebase/messaging';
import { Platform, Alert, AppState, DeviceEventEmitter } from 'react-native';
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

      // Request notification permissions
      await this.requestPermission();

      // Get initial FCM token
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
      const token = await messaging().getToken();
      if (token) {
        console.log('🔑 FCMService: FCM Token obtained:', token.substring(0, 20) + '...');
        this.fcmToken = token;

        // Store token on server if user is logged in
        await this.storeTokenOnServer(token);

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
   * Store FCM token on the server
   */
  private async storeTokenOnServer(token: string): Promise<void> {
    try {
      const userData = await getUserData();
      if (userData?.id) {
        console.log('💾 FCMService: Storing FCM token on server for user:', userData.id);
        await storeFcmToken(userData.id, token);
        console.log('✅ FCMService: FCM token stored on server');
      } else {
        console.log('ℹ️ FCMService: User not logged in, skipping token storage');
      }
    } catch (error) {
      console.error('❌ FCMService: Error storing FCM token on server:', error);
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
      console.log('📨 FCMService: Foreground message received:', remoteMessage);
      
      // Show local notification for foreground messages
      if (remoteMessage.notification) {
        this.showLocalNotification(
          remoteMessage.notification.title || 'Notification',
          remoteMessage.notification.body || '',
          remoteMessage.data
        );
      }

      // Handle notification data
      if (remoteMessage.data) {
        this.handleNotificationData(remoteMessage.data);
      }
    });

    // Handle background messages (when app is in background)
    messaging().setBackgroundMessageHandler(async (remoteMessage) => {
      console.log('📨 FCMService: Background message received:', remoteMessage);
      // Background messages are handled automatically by the system
    });

    // Handle notification opened (when user taps notification)
    this.notificationOpenedUnsubscribe = messaging().onNotificationOpenedApp(
      (remoteMessage) => {
        console.log('🔔 FCMService: Notification opened app:', remoteMessage);
        this.handleNotificationOpened(remoteMessage);
      }
    );

    // Monitor app state to refresh token when app comes to foreground
    this.appStateSubscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active') {
        // Refresh token when app comes to foreground
        await this.getFCMToken();
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
   */
  private showLocalNotification(
    title: string,
    body: string,
    data?: Record<string, any>
  ): void {
    // For now, we'll use Alert. In production, you might want to use
    // react-native-push-notification or a similar library for better UX
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
      // Android shows notifications automatically, but we can still show an alert
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

