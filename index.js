/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import App from './App';
import { name as appName } from './app.json';

// Register background message handler for Android
// This function must be called outside of any component lifecycle
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📨 Background message received:', remoteMessage);
  // Background messages are handled automatically by the system
  // You can add custom logic here if needed
});

AppRegistry.registerComponent(appName, () => App);
