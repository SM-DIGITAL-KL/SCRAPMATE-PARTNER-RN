/**
 * Location Permission Utility
 * Handles location permission requests with prominent disclosure for background location
 * Required by Google Play Store policy
 */

import { Platform, PermissionsAndroid, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCLOSURE_SHOWN_KEY = '@location_disclosure_shown';
const BACKGROUND_LOCATION_PERMISSION_KEY = '@background_location_permission_granted';

/**
 * Check if background location disclosure has been shown
 */
export const hasShownDisclosure = async (): Promise<boolean> => {
  try {
    const shown = await AsyncStorage.getItem(DISCLOSURE_SHOWN_KEY);
    return shown === 'true';
  } catch {
    return false;
  }
};

/**
 * Mark disclosure as shown
 */
export const markDisclosureShown = async (): Promise<void> => {
  try {
    await AsyncStorage.setItem(DISCLOSURE_SHOWN_KEY, 'true');
  } catch (error) {
    console.warn('Error marking disclosure as shown:', error);
  }
};

/**
 * Check if background location permission is granted
 */
export const hasBackgroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS handles this differently
  }

  try {
    const granted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION
    );
    
    // Also check in AsyncStorage for consistency
    const stored = await AsyncStorage.getItem(BACKGROUND_LOCATION_PERMISSION_KEY);
    return granted || stored === 'true';
  } catch {
    return false;
  }
};

/**
 * Request background location permission (Android only)
 * Must be called AFTER showing the prominent disclosure
 */
export const requestBackgroundLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS !== 'android') {
    return true; // iOS doesn't need this
  }

  try {
    // First ensure foreground location permissions are granted
    const foregroundGranted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const hasForegroundPermission =
      foregroundGranted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED ||
      foregroundGranted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED;

    if (!hasForegroundPermission) {
      Alert.alert(
        'Location Permission Required',
        'Foreground location permission is required before requesting background location access.'
      );
      return false;
    }

    // Request background location permission
    // Note: This should only be called after showing the prominent disclosure
    const backgroundGranted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
      {
        title: 'Background Location Permission',
        message:
          'This app needs background location access to track your location during order pickups and deliveries. ' +
          'This allows real-time tracking even when the app is minimized.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'Allow',
      }
    );

    const granted =
      backgroundGranted === PermissionsAndroid.RESULTS.GRANTED;

    if (granted) {
      await AsyncStorage.setItem(BACKGROUND_LOCATION_PERMISSION_KEY, 'true');
    }

    return granted;
  } catch (error) {
    console.error('Error requesting background location permission:', error);
    return false;
  }
};

/**
 * Request location permissions with disclosure flow
 * This is the main function to use when requesting location permissions
 */
export const requestLocationPermissionsWithDisclosure = async (
  showDisclosure: () => Promise<boolean>
): Promise<{
  foregroundGranted: boolean;
  backgroundGranted: boolean;
}> => {
  if (Platform.OS !== 'android') {
    // iOS handles permissions differently
    return { foregroundGranted: true, backgroundGranted: true };
  }

  try {
    // Step 1: Request foreground location permissions
    const foregroundGranted = await PermissionsAndroid.requestMultiple([
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
    ]);

    const hasForegroundPermission =
      foregroundGranted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED ||
      foregroundGranted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
        PermissionsAndroid.RESULTS.GRANTED;

    if (!hasForegroundPermission) {
      return { foregroundGranted: false, backgroundGranted: false };
    }

    // Step 2: Check if disclosure has been shown
    const disclosureShown = await hasShownDisclosure();
    
    // Step 3: Show disclosure if not shown before
    if (!disclosureShown) {
      const userAccepted = await showDisclosure();
      if (!userAccepted) {
        // User declined disclosure, don't request background permission
        return { foregroundGranted: true, backgroundGranted: false };
      }
      await markDisclosureShown();
    }

    // Step 4: Request background location permission
    const backgroundGranted = await requestBackgroundLocationPermission();

    return {
      foregroundGranted: true,
      backgroundGranted,
    };
  } catch (error) {
    console.error('Error in location permission flow:', error);
    return { foregroundGranted: false, backgroundGranted: false };
  }
};

