import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, Platform, PermissionsAndroid, Alert, NativeModules } from 'react-native';

const { LocationModule } = NativeModules;

// Export function to get address from coordinates (FREE - uses OpenStreetMap Nominatim API)
export const getAddressFromCoordinates = async (
  latitude: number,
  longitude: number
): Promise<{
  formattedAddress?: string;
  address?: string;
  houseNumber?: string;
  road?: string;
  neighborhood?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
  country?: string;
  countryCode?: string;
}> => {
  if (Platform.OS === 'android' && LocationModule) {
    try {
      const address = await LocationModule.getAddressFromCoordinates(latitude, longitude);
      return address;
    } catch (error) {
      // Network errors are expected and handled by callers - don't log as error
      // Only log if it's not a network timeout/connection error
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.includes('failed to connect') && !errorMessage.includes('timeout')) {
        console.warn('Address lookup error:', error);
      }
      throw error;
    }
  } else {
    throw new Error('Address lookup not available on this platform');
  }
};

// Convenience function to get current location with address
export const getCurrentLocationWithAddress = async (): Promise<{
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
  address?: {
    formattedAddress?: string;
    address?: string;
    houseNumber?: string;
    road?: string;
    neighborhood?: string;
    suburb?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
    countryCode?: string;
  };
}> => {
  if (Platform.OS === 'android' && LocationModule) {
    try {
      // First, ensure location permission is granted and location updates are started
      try {
        await LocationModule.requestLocationPermission();
      } catch (permError) {
        console.warn('Location permission request error:', permError);
        // Continue anyway - permission might already be granted
      }

      // Wait a bit for location to become available, then try to get it
      // Retry logic: try up to 5 times with delays
      let location = null;
      let lastError = null;
      const maxRetries = 5;
      const retryDelay = 1000; // 1 second

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          location = await LocationModule.getCurrentLocation();
          if (location) {
            break; // Success, exit retry loop
          }
        } catch (error: any) {
          lastError = error;
          // If it's "NO_LOCATION" error, wait and retry
          if (error?.message?.includes('Location not available') || error?.code === 'NO_LOCATION') {
            if (attempt < maxRetries - 1) {
              // Wait before retrying (except on last attempt)
              await new Promise(resolve => setTimeout(resolve, retryDelay));
              continue;
            }
          } else {
            // For other errors, throw immediately
            throw error;
          }
        }
      }

      if (!location) {
        throw lastError || new Error('Location not available after multiple attempts. Please ensure location services are enabled and try again.');
      }
      
      // Get address from coordinates
      try {
        const address = await LocationModule.getAddressFromCoordinates(
          location.latitude,
          location.longitude
        );
        return {
          ...location,
          address,
        };
      } catch (addressError) {
        // If address lookup fails, still return location
        console.warn('Address lookup failed:', addressError);
        return location;
      }
    } catch (error) {
      console.error('Error getting location with address:', error);
      throw error;
    }
  } else {
    throw new Error('Location lookup not available on this platform');
  }
};

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

// Hook to request location permission and get current location
export const useLocationService = () => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION,
        ]);

        if (
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED ||
          granted[PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION] ===
            PermissionsAndroid.RESULTS.GRANTED
        ) {
          setHasPermission(true);
          if (LocationModule) {
            await LocationModule.requestLocationPermission();
          }
          return true;
        } else {
          Alert.alert(
            'Location Permission',
            'Location permission is required to get your current location.'
          );
          return false;
        }
      } catch (err) {
        console.warn('Error requesting location permission:', err);
        return false;
      }
    } else {
      // iOS - permission is requested in native code
      setHasPermission(true);
      return true;
    }
  }, []);

  const getCurrentLocation = useCallback(async (): Promise<LocationData | null> => {
    if (!hasPermission) {
      const permissionGranted = await requestLocationPermission();
      if (!permissionGranted) {
        return null;
      }
    }

    if (Platform.OS === 'android' && LocationModule) {
      setIsLoading(true);
      try {
        // Ensure location updates are started
        try {
          await LocationModule.requestLocationPermission();
        } catch (permError) {
          console.warn('Location permission request error:', permError);
          // Continue anyway - permission might already be granted
        }

        // Retry logic: try up to 5 times with delays
        let location = null;
        let lastError = null;
        const maxRetries = 5;
        const retryDelay = 1000; // 1 second

        for (let attempt = 0; attempt < maxRetries; attempt++) {
          try {
            location = await LocationModule.getCurrentLocation();
            if (location) {
              break; // Success, exit retry loop
            }
          } catch (error: any) {
            lastError = error;
            // If it's "NO_LOCATION" error, wait and retry
            if (error?.message?.includes('Location not available') || error?.code === 'NO_LOCATION') {
              if (attempt < maxRetries - 1) {
                // Wait before retrying (except on last attempt)
                await new Promise(resolve => setTimeout(resolve, retryDelay));
                continue;
              }
            } else {
              // For other errors, throw immediately
              throw error;
            }
          }
        }

        setIsLoading(false);
        
        if (!location) {
          throw lastError || new Error('Location not available after multiple attempts. Please ensure location services are enabled and try again.');
        }

        return location;
      } catch (error) {
        setIsLoading(false);
        console.error('Error getting location:', error);
        throw error;
      }
    } else {
      throw new Error('Location service not available on this platform');
    }
  }, [hasPermission, requestLocationPermission]);

  return {
    hasPermission,
    isLoading,
    requestLocationPermission,
    getCurrentLocation,
    getCurrentLocationWithAddress,
  };
};

