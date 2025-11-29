/**
 * Dashboard Service
 * Manages dashboard switching and access control
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getUserDashboards, switchDashboard } from '../api/v2/shopTypes';

const CURRENT_DASHBOARD_KEY = 'current_dashboard';
const USER_DASHBOARD_INFO_KEY = 'user_dashboard_info';

export type DashboardType = 'b2b' | 'b2c' | 'delivery';

export interface UserDashboardInfo {
  userId: number;
  shopType: number | null;
  shopTypeName: string | null;
  allowedDashboards: DashboardType[];
  canSwitch: boolean;
}

/**
 * Get current dashboard preference
 */
export const getCurrentDashboard = async (): Promise<DashboardType | null> => {
  try {
    const dashboard = await AsyncStorage.getItem(CURRENT_DASHBOARD_KEY);
    return dashboard as DashboardType | null;
  } catch (error) {
    console.error('Error getting current dashboard:', error);
    return null;
  }
};

/**
 * Set current dashboard preference
 */
export const setCurrentDashboard = async (dashboard: DashboardType): Promise<void> => {
  try {
    await AsyncStorage.setItem(CURRENT_DASHBOARD_KEY, dashboard);
  } catch (error) {
    console.error('Error setting current dashboard:', error);
    throw error;
  }
};

/**
 * Get cached user dashboard info
 */
export const getCachedUserDashboardInfo = async (): Promise<UserDashboardInfo | null> => {
  try {
    const info = await AsyncStorage.getItem(USER_DASHBOARD_INFO_KEY);
    if (info) {
      return JSON.parse(info);
    }
    return null;
  } catch (error) {
    console.error('Error getting cached user dashboard info:', error);
    return null;
  }
};

/**
 * Cache user dashboard info
 */
export const cacheUserDashboardInfo = async (info: UserDashboardInfo): Promise<void> => {
  try {
    await AsyncStorage.setItem(USER_DASHBOARD_INFO_KEY, JSON.stringify(info));
  } catch (error) {
    console.error('Error caching user dashboard info:', error);
    throw error;
  }
};

/**
 * Clear dashboard preferences
 */
export const clearDashboardPreferences = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CURRENT_DASHBOARD_KEY);
    await AsyncStorage.removeItem(USER_DASHBOARD_INFO_KEY);
  } catch (error) {
    console.error('Error clearing dashboard preferences:', error);
    throw error;
  }
};

/**
 * Get user's allowed dashboards and cache them
 */
export const fetchAndCacheUserDashboards = async (userId: number | string): Promise<UserDashboardInfo> => {
  const info = await getUserDashboards(userId);
  await cacheUserDashboardInfo(info);
  return info;
};

/**
 * Switch dashboard and update preference
 */
export const switchUserDashboard = async (
  userId: number | string,
  targetDashboard: DashboardType
): Promise<void> => {
  await switchDashboard(userId, targetDashboard);
  await setCurrentDashboard(targetDashboard);
  // Refresh cached info
  await fetchAndCacheUserDashboards(userId);
};

