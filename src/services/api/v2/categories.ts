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



