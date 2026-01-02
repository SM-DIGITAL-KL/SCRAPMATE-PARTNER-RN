/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from './App';
import { name as appName } from './app.json';

// Register background message handler for Android
// This function must be called outside of any component lifecycle
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📨 Background message received:', remoteMessage);
  console.log('   Notification type:', remoteMessage.data?.type);
  console.log('   Data:', JSON.stringify(remoteMessage.data, null, 2));
  
  // Import DeviceEventEmitter to emit events from background handler
  const { DeviceEventEmitter } = require('react-native');
  
  // Handle notification data in background
  if (remoteMessage.data && remoteMessage.data.type) {
    const data = remoteMessage.data;
    
    // Store notification in AsyncStorage so it can be processed when app comes to foreground
    try {
      const notificationKey = `pending_notification_${Date.now()}`;
      await AsyncStorage.setItem(notificationKey, JSON.stringify({
        type: data.type,
        data: data,
        timestamp: Date.now()
      }));
      console.log('💾 Stored notification in AsyncStorage for processing:', notificationKey);
    } catch (storageError) {
      console.error('❌ Error storing notification in AsyncStorage:', storageError);
    }
    
    switch (data.type) {
      case 'pickup_request_accepted_by_other':
        console.log('⚠️ Background: Pickup request accepted by another vendor');
        // Try to emit event (may not work in background context)
        try {
          DeviceEventEmitter.emit('PICKUP_REQUEST_ACCEPTED_BY_OTHER', {
            order_id: data.order_id,
            order_number: data.order_number,
            accepted_by_user_id: data.accepted_by_user_id
          });
          console.log('✅ Event emitted from background handler');
        } catch (emitError) {
          console.warn('⚠️ Could not emit event from background (will process when app opens):', emitError);
        }
        break;
      case 'order_list_updated':
        console.log('🔄 Background: Order list updated notification');
        try {
          DeviceEventEmitter.emit('ORDER_LIST_UPDATED', {
            order_id: data.order_id,
            order_number: data.order_number,
            action: data.action,
            message: data.message
          });
          console.log('✅ ORDER_LIST_UPDATED event emitted from background handler');
        } catch (emitError) {
          console.warn('⚠️ Could not emit ORDER_LIST_UPDATED event from background:', emitError);
        }
        break;
      case 'new_order':
      case 'pickup_request':
        console.log('📦 Background: New order/pickup request notification');
        try {
          DeviceEventEmitter.emit('NEW_ORDER_RECEIVED', {
            order_id: data.order_id,
            order_number: data.order_number,
            shop_id: data.shop_id,
            customer_id: data.customer_id,
            status: data.status
          });
        } catch (emitError) {
          console.warn('⚠️ Could not emit event from background:', emitError);
        }
        break;
      case 'order_update':
        console.log('📦 Background: Order update notification');
        try {
          DeviceEventEmitter.emit('ORDER_UPDATED', data);
        } catch (emitError) {
          console.warn('⚠️ Could not emit event from background:', emitError);
        }
        break;
      default:
        console.log('ℹ️ Background: Unknown notification type:', data.type);
    }
  }
});

AppRegistry.registerComponent(appName, () => App);
