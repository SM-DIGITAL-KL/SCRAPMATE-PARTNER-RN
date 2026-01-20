/**
 * V2 Categories API Service
 * Handles category and subcategory API calls
 */

import { buildApiUrl, getApiHeaders } from '../apiConfig';

export interface Category {
  id: number;
  name: string;
  image: string;
  available_in: {
    b2b: boolean;
    b2c: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

export interface Subcategory {
  id: number;
  name: string;
  image: string;
  default_price: string;
  price_unit: string;
  main_category_id: number;
  main_category?: {
    id: number;
    name: string;
    image: string;
  };
  available_in: {
    b2b: boolean;
    b2c: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

export interface CategoryWithSubcategories extends Category {
  subcategories: Subcategory[];
  subcategory_count: number;
}

export interface CategoriesResponse {
  status: string;
  msg: string;
  data: Category[];
  meta?: {
    total: number;
    b2b_available: number;
    b2c_available: number;
  };
}

export interface SubcategoriesResponse {
  status: string;
  msg: string;
  data: Subcategory[];
  meta?: {
    total: number;
    b2b_available: number;
    b2c_available: number;
    category_id?: number | null;
  };
}

export interface CategoriesWithSubcategoriesResponse {
  status: string;
  msg: string;
  data: CategoryWithSubcategories[];
  meta?: {
    total_categories: number;
    total_subcategories: number;
    b2b_available: number;
    b2c_available: number;
  };
}

/**
 * Get all categories
 * @param userType - Optional filter: 'b2b', 'b2c', or 'all'
 */
export const getCategories = async (
  userType?: 'b2b' | 'b2c' | 'all'
): Promise<CategoriesResponse> => {
  const url = buildApiUrl('/v2/categories');
  const queryParams = userType && userType !== 'all' ? `?userType=${userType}` : '';
  const fullUrl = `${url}${queryParams}`;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch categories: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get all subcategories
 * @param categoryId - Optional filter by main category ID
 * @param userType - Optional filter: 'b2b', 'b2c', or 'all'
 */
export const getSubcategories = async (
  categoryId?: number,
  userType?: 'b2b' | 'b2c' | 'all'
): Promise<SubcategoriesResponse> => {
  const params = new URLSearchParams();
  if (categoryId) {
    params.append('categoryId', categoryId.toString());
  }
  if (userType && userType !== 'all') {
    params.append('userType', userType);
  }

  const url = buildApiUrl('/v2/subcategories');
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch subcategories: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get categories with their subcategories grouped
 * @param userType - Optional filter: 'b2b', 'b2c', or 'all'
 */
export const getCategoriesWithSubcategories = async (
  userType?: 'b2b' | 'b2c' | 'all'
): Promise<CategoriesWithSubcategoriesResponse> => {
  const url = buildApiUrl('/v2/categories/with-subcategories');
  const queryParams = userType && userType !== 'all' ? `?userType=${userType}` : '';
  const fullUrl = `${url}${queryParams}`;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch categories with subcategories: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Request a new subcategory (for B2C users)
 * @param mainCategoryId - Main category ID
 * @param subcategoryName - Name of the subcategory
 * @param userId - User ID making the request
 * @param defaultPrice - Default price (optional)
 * @param priceUnit - Price unit: 'kg' or 'pcs' (optional, default: 'kg')
 */
export const requestSubcategory = async (
  mainCategoryId: number,
  subcategoryName: string,
  userId: number,
  defaultPrice?: string,
  priceUnit?: string
): Promise<{ status: string; msg: string; data: any }> => {
  const url = buildApiUrl('/v2/subcategories/request');
  const headers = getApiHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      main_category_id: mainCategoryId,
      subcategory_name: subcategoryName,
      user_id: userId,
      default_price: defaultPrice || '0',
      price_unit: priceUnit || 'kg',
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to request subcategory: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to request subcategory');
  }

  return result;
};

/**
 * Get pending subcategory requests (for admin)
 */
export const getPendingSubcategoryRequests = async (): Promise<{
  status: string;
  msg: string;
  data: Array<{
    id: number;
    subcategory_name: string;
    subcategory_img?: string;
    default_price: string;
    price_unit: string;
    main_category_id: number;
    main_category?: {
      id: number;
      name: string;
      image: string;
    };
    approval_status: string;
    requested_by_user_id: number;
    requester?: {
      id: number;
      name: string;
      contact: string;
      email: string;
    };
    created_at: string;
    updated_at: string;
  }>;
}> => {
  const url = buildApiUrl('/v2/subcategories/pending');
  const headers = getApiHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch pending requests: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Approve or reject a subcategory request (for admin)
 * @param subcategoryId - Subcategory ID
 * @param action - 'approve' or 'reject'
 * @param approvalNotes - Optional notes from admin
 */
export const approveRejectSubcategory = async (
  subcategoryId: number,
  action: 'approve' | 'reject',
  approvalNotes?: string
): Promise<{ status: string; msg: string; data: any }> => {
  const url = buildApiUrl(`/v2/subcategories/${subcategoryId}/approve`);
  const headers = getApiHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      action,
      approval_notes: approvalNotes || null,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to ${action} subcategory: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || `Failed to ${action} subcategory`);
  }

  return result;
};

/**
 * Get subcategory requests by user ID (for B2C users to see their requests)
 * @param userId - User ID
 */
export interface UserSubcategoryRequest {
  id: number;
  subcategory_name: string;
  subcategory_img?: string;
  default_price: string;
  price_unit: string;
  main_category_id: number;
  main_category?: {
    id: number;
    name: string;
    image: string;
  };
  approval_status: 'pending' | 'approved' | 'rejected';
  requested_by_user_id: number;
  approved_by_user_id?: number | null;
  approval_notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSubcategoryRequestsResponse {
  status: string;
  msg: string;
  data: UserSubcategoryRequest[];
  count: number;
}

export const getUserSubcategoryRequests = async (
  userId: number
): Promise<UserSubcategoryRequestsResponse> => {
  const url = buildApiUrl(`/v2/subcategories/user/${userId}/requests`);
  const headers = getApiHeaders();

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch user subcategory requests: ${response.statusText}`);
  }

  return response.json();
};

/**
 * Get incremental updates for categories and subcategories since lastUpdatedOn
 * This endpoint returns only categories/subcategories that have changed (name, image, rates, etc.)
 * or have been deleted since the lastUpdatedOn timestamp
 * 
 * @param userType - Optional filter: 'b2b', 'b2c', or 'all' (default: 'all')
 * @param lastUpdatedOn - ISO timestamp string, required for incremental updates
 * @param userId - Optional user ID for user-specific stats
 * @param type - Optional type filter (default: 'customer')
 * 
 * Returns:
 * - categories: Array of updated categories (only fields that changed)
 * - subcategories: Array of updated subcategories (only fields that changed)
 * - deleted: { categories: [], subcategories: [] } - IDs of deleted items
 * - meta.hasUpdates: true if any updates found
 * - meta.lastUpdatedOn: Current timestamp
 */
export interface IncrementalUpdatesResponse {
  status: string;
  msg: string;
  data: {
    categories?: Category[];
    subcategories?: Subcategory[];
    deleted?: {
      categories?: Array<{ id: number; deleted: boolean }>;
      subcategories?: Array<{ id: number; deleted: boolean }>;
    };
    stats?: any;
  };
  meta: {
    hasUpdates: boolean;
    lastUpdatedOn: string;
  };
  hitBy?: string;
}

export const getIncrementalUpdates = async (
  userType?: 'b2b' | 'b2c' | 'all',
  lastUpdatedOn?: string,
  userId?: number,
  type?: string
): Promise<IncrementalUpdatesResponse> => {
  const url = buildApiUrl('/v2/categories/incremental-updates');
  const params = new URLSearchParams();
  
  if (userType && userType !== 'all') {
    params.append('userType', userType);
  }
  if (lastUpdatedOn) {
    params.append('lastUpdatedOn', lastUpdatedOn);
  }
  if (userId) {
    params.append('userId', userId.toString());
  }
  if (type) {
    params.append('type', type);
  }
  
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch incremental updates: ${response.statusText}`);
  }

  return response.json();
};

