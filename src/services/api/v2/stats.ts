/**
 * V2 Stats API Service
 * Handles dashboard statistics API calls with 365-day cache support
 * 
 * Backend API Endpoints Required:
 * 
 * 1. GET /v2/stats/dashboard
 *    Query Parameters:
 *      - userType: 'customer' | 'b2c' | 'b2b' | 'delivery'
 *      - userId: number (optional, for user-specific stats)
 *      - lastUpdatedOn: string (optional, ISO timestamp for incremental updates)
 *    Returns:
 *      {
 *        status: 'success',
 *        msg: string,
 *        data: {
 *          totalRecycled: number,        // Total weight recycled in kg
 *          carbonOffset: number,         // Carbon offset in kg CO2
 *          totalOrderValue: number,      // Total order value for last 6 months in rupees
 *          operatingCategories: number,  // Number of scrap categories operating
 *          lastUpdatedOn: string        // ISO timestamp
 *        },
 *        meta: {
 *          lastUpdatedOn: string,
 *          hasUpdates?: boolean
 *        }
 *      }
 * 
 * 2. GET /v2/stats/incremental-updates
 *    Query Parameters:
 *      - userType: 'customer' | 'b2c' | 'b2b' | 'delivery'
 *      - lastUpdatedOn: string (required, ISO timestamp)
 *      - userId: number (optional, for user-specific stats)
 *    Returns:
 *      {
 *        status: 'success',
 *        msg: string,
 *        data: {
 *          totalRecycled?: number,        // Only if changed
 *          carbonOffset?: number,          // Only if changed
 *          totalOrderValue?: number,       // Only if changed
 *          operatingCategories?: number,   // Only if changed
 *          lastUpdatedOn: string          // Current timestamp
 *        },
 *        meta: {
 *          hasUpdates: boolean,            // true if any stats changed
 *          lastUpdatedOn: string          // Current timestamp
 *        }
 *      }
 * 
 * Implementation Notes:
 * - Stats should be calculated for the last 6 months
 * - Incremental updates should only return fields that have changed since lastUpdatedOn
 * - Operating categories should count unique categories the user has operated in
 * - Carbon offset can be calculated based on recycled weight (e.g., 1kg recycled = X kg CO2 offset)
 */

import { buildApiUrl, getApiHeaders } from '../apiConfig';

export interface DashboardStats {
  totalRecycled: number; // Total weight recycled in kg
  carbonOffset: number; // Carbon offset in kg CO2
  totalOrderValue: number; // Total order value for last 6 months in rupees
  operatingCategories: number; // Number of scrap categories operating
  lastUpdatedOn: string; // Timestamp of last update
}

export interface DashboardStatsResponse {
  status: string;
  msg: string;
  data: DashboardStats;
  meta?: {
    lastUpdatedOn: string;
    hasUpdates?: boolean;
  };
}

export interface IncrementalStatsUpdate {
  totalRecycled?: number;
  carbonOffset?: number;
  totalOrderValue?: number;
  operatingCategories?: number;
  lastUpdatedOn: string;
}

/**
 * Get dashboard statistics
 * @param userType - User type: 'customer', 'b2c', 'b2b', or 'delivery'
 * @param userId - Optional user ID for user-specific stats
 * @param lastUpdatedOn - Optional timestamp for incremental updates
 */
export const getDashboardStats = async (
  userType: 'customer' | 'b2c' | 'b2b' | 'delivery' = 'customer',
  userId?: number,
  lastUpdatedOn?: string
): Promise<DashboardStatsResponse> => {
  const url = buildApiUrl('/v2/stats/dashboard');
  const queryParams = new URLSearchParams();
  
  queryParams.append('userType', userType);
  if (userId) {
    queryParams.append('userId', userId.toString());
  }
  if (lastUpdatedOn) {
    queryParams.append('lastUpdatedOn', lastUpdatedOn);
  }
  
  const fullUrl = `${url}?${queryParams.toString()}`;

  console.log('🌐 [getDashboardStats] Making API call:', {
    url: fullUrl,
    userType,
    userId,
    lastUpdatedOn,
  });

  let response: Response;
  try {
    response = await fetch(fullUrl, {
      method: 'GET',
      headers: getApiHeaders(),
    });
  } catch (fetchError: any) {
    console.error('❌ [getDashboardStats] Fetch error:', fetchError);
    throw new Error(`Network error: ${fetchError?.message || 'Failed to fetch dashboard stats'}`);
  }

  console.log('📥 [getDashboardStats] Response received:', {
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    headers: Object.fromEntries(response.headers.entries()),
  });

  if (!response.ok) {
    // Try to get error message from response body
    let errorMessage = response.statusText || `HTTP ${response.status}`;
    try {
      const errorData = await response.clone().json();
      errorMessage = errorData.msg || errorData.message || errorMessage;
    } catch (e) {
      try {
        const errorText = await response.clone().text();
        if (errorText) {
          errorMessage = errorText.substring(0, 200);
        }
      } catch (e2) {
        // Ignore parsing errors
      }
    }
    console.error('❌ [getDashboardStats] API error response:', {
      status: response.status,
      statusText: response.statusText,
      errorMessage,
    });
    throw new Error(`Failed to fetch dashboard stats: ${errorMessage}`);
  }

  let result: DashboardStatsResponse;
  try {
    result = await response.json();
  } catch (parseError: any) {
    console.error('❌ [getDashboardStats] JSON parse error:', parseError);
    throw new Error(`Invalid response format: ${parseError?.message || 'Failed to parse response'}`);
  }
  
  console.log('✅ [getDashboardStats] Response parsed:', {
    status: result.status,
    hasData: !!result.data,
    hasMeta: !!result.meta,
  });
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to fetch dashboard stats');
  }

  return result;
};

/**
 * Get incremental stats updates
 * Similar to categories incremental updates pattern
 */
export const getIncrementalStatsUpdates = async (
  userType: 'customer' | 'b2c' | 'b2b' | 'delivery' = 'customer',
  lastUpdatedOn: string,
  userId?: number
): Promise<{
  status: string;
  msg: string;
  data: IncrementalStatsUpdate;
  meta: {
    hasUpdates: boolean;
    lastUpdatedOn: string;
  };
}> => {
  const url = buildApiUrl('/v2/stats/incremental-updates');
  const queryParams = new URLSearchParams();
  
  queryParams.append('userType', userType);
  queryParams.append('lastUpdatedOn', lastUpdatedOn);
  if (userId) {
    queryParams.append('userId', userId.toString());
  }
  
  const fullUrl = `${url}?${queryParams.toString()}`;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch incremental stats updates: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to fetch incremental stats updates');
  }

  return result;
};
