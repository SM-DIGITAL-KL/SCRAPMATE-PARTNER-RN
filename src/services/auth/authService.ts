/**
 * Authentication Service
 * Handles authentication state and token management
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_DATA_KEY = 'user_data';

export interface UserData {
  id: string | number;
  name: string;
  email: string;
  phone_number: string;
  user_type?: string;
  [key: string]: any;
}

/**
 * Check if user is logged in
 */
export const isLoggedIn = async (): Promise<boolean> => {
  try {
    const token = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    return !!token;
  } catch (error) {
    console.error('Error checking login status:', error);
    return false;
  }
};

/**
 * Get auth token
 */
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error getting auth token:', error);
    return null;
  }
};

/**
 * Set auth token
 */
export const setAuthToken = async (token: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, token);
  } catch (error) {
    console.error('Error setting auth token:', error);
    throw error;
  }
};

/**
 * Get user data
 */
export const getUserData = async (): Promise<UserData | null> => {
  try {
    const userDataString = await AsyncStorage.getItem(USER_DATA_KEY);
    if (userDataString) {
      return JSON.parse(userDataString);
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    return null;
  }
};

/**
 * Set user data
 */
export const setUserData = async (userData: UserData): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_DATA_KEY, JSON.stringify(userData));
  } catch (error) {
    console.error('Error setting user data:', error);
    throw error;
  }
};

/**
 * Logout - Clear all auth data and user-specific AsyncStorage fields
 */
export const logout = async (): Promise<void> => {
  try {
    // Clear auth tokens and user data
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    await AsyncStorage.removeItem(USER_DATA_KEY);
    
    // Clear all user-specific AsyncStorage fields
    const keysToRemove = [
      '@allowed_dashboards',
      '@b2b_status',
      '@selected_join_type',
      '@join_as_shown',
      '@b2c_signup_needed',
      '@delivery_vehicle_info_needed',
      '@b2c_approval_status',
      '@delivery_approval_status',
      'current_dashboard',
      'user_dashboard_info',
    ];
    
    // Remove all keys in parallel
    await Promise.all(
      keysToRemove.map(key => AsyncStorage.removeItem(key).catch(err => {
        console.warn(`Failed to remove ${key} during logout:`, err);
        // Continue even if one key fails
      }))
    );
    
    console.log('✅ Logout: All AsyncStorage fields cleared');
  } catch (error) {
    console.error('Error during logout:', error);
    throw error;
  }
};

/**
 * Clear auth token only (keep user data)
 */
export const clearAuthToken = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
  } catch (error) {
    console.error('Error clearing auth token:', error);
    throw error;
  }
};

