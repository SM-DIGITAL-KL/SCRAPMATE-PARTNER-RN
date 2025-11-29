/**
 * Shop Types API v2
 * API endpoints for shop types and dashboard management
 */

import { API_CONFIG } from '../client';

const BASE_URL = `${API_CONFIG.baseURL}/v2`;

export interface ShopType {
  id: number;
  name: string;
  description: string;
  dashboard_type: 'b2b' | 'b2c' | 'delivery';
}

export interface UserDashboardInfo {
  userId: number;
  shopType: number | null;
  shopTypeName: string | null;
  allowedDashboards: ('b2b' | 'b2c' | 'delivery')[];
  canSwitch: boolean;
}

export interface DashboardValidation {
  canAccess: boolean;
  reason: string | null;
}

export interface DashboardSwitchResult {
  userId: number;
  currentDashboard: 'b2b' | 'b2c' | 'delivery';
  shopType: number | null;
  shopTypeName: string | null;
}

/**
 * Get all shop types
 */
export const getShopTypes = async (): Promise<ShopType[]> => {
  const response = await fetch(`${BASE_URL}/shop-types`, {
    method: 'GET',
    headers: {
      ...API_CONFIG.headers,
      'api-key': process.env.API_KEY || '', // TODO: Get from secure storage or config
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch shop types: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.success) {
    return data.data;
  }
  throw new Error(data.message || 'Failed to fetch shop types');
};

/**
 * Get user's allowed dashboards
 */
export const getUserDashboards = async (userId: number | string): Promise<UserDashboardInfo> => {
  const response = await fetch(`${BASE_URL}/user/dashboards/${userId}`, {
    method: 'GET',
    headers: {
      ...API_CONFIG.headers,
      'api-key': process.env.API_KEY || '', // TODO: Get from secure storage or config
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user dashboards: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.success) {
    return data.data;
  }
  throw new Error(data.message || 'Failed to fetch user dashboards');
};

/**
 * Validate if user can access a specific dashboard
 */
export const validateDashboard = async (
  userId: number | string,
  dashboardType: 'b2b' | 'b2c' | 'delivery'
): Promise<DashboardValidation> => {
  const response = await fetch(`${BASE_URL}/user/validate-dashboard`, {
    method: 'POST',
    headers: {
      ...API_CONFIG.headers,
      'api-key': process.env.API_KEY || '', // TODO: Get from secure storage or config
    },
    body: JSON.stringify({
      userId,
      dashboardType,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to validate dashboard: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.success) {
    return data.data;
  }
  throw new Error(data.message || 'Failed to validate dashboard');
};

/**
 * Switch user's dashboard
 */
export const switchDashboard = async (
  userId: number | string,
  targetDashboard: 'b2b' | 'b2c' | 'delivery'
): Promise<DashboardSwitchResult> => {
  const response = await fetch(`${BASE_URL}/user/switch-dashboard`, {
    method: 'POST',
    headers: {
      ...API_CONFIG.headers,
      'api-key': process.env.API_KEY || '', // TODO: Get from secure storage or config
    },
    body: JSON.stringify({
      userId,
      targetDashboard,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || errorData.reason || `Failed to switch dashboard: ${response.statusText}`);
  }

  const data = await response.json();
  if (data.success) {
    return data.data;
  }
  throw new Error(data.message || 'Failed to switch dashboard');
};

