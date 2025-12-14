/**
 * V2 Profile API Service
 * Handles profile-related API calls
 */

import { buildApiUrl, getApiHeaders, fetchWithLogging, API_ROUTES } from '../apiConfig';

export interface ProfileData {
  id: string | number;
  name: string;
  email: string;
  phone: string;
  user_type: string;
  app_type?: string;
  profile_image?: string | null;
  completion_percentage: number;
  shop?: {
    id: string | number;
    shopname: string;
    ownername: string;
    address: string;
    contact: string;
    shop_type?: string;
    aadhar_card?: string | null;
    driving_license?: string | null;
  };
  delivery?: {
    id: string | number;
    name: string;
    address: string;
    contact: string;
    delivery_mode?: 'deliver' | 'deliverPicking' | 'picker';
    is_online?: boolean;
    aadhar_card?: string | null;
    driving_license?: string | null;
    vehicle_type?: string;
    vehicle_model?: string;
    vehicle_registration_number?: string;
    approval_status?: string;
    rejection_reason?: string | null;
  };
  delivery_boy?: {
    id: string | number;
    name: string;
    address: string;
    contact: string;
    delivery_mode?: 'deliver' | 'deliverPicking' | 'picker';
    is_online?: boolean;
    aadhar_card?: string | null;
    driving_license?: string | null;
    vehicle_type?: string;
    vehicle_model?: string;
    vehicle_registration_number?: string;
    approval_status?: string;
    rejection_reason?: string | null;
  };
  created_at?: string;
  updated_at?: string;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  shop?: {
    shopname?: string;
    ownername?: string;
    address?: string;
    contact?: string;
    vehicle_type?: string;
    vehicle_model?: string;
    vehicle_registration_number?: string;
    aadhar_card?: string;
    driving_license?: string;
  };
  delivery?: {
    name?: string;
    address?: string;
    contact?: string;
    delivery_mode?: 'deliver' | 'deliverPicking' | 'picker';
    vehicle_type?: string;
    vehicle_model?: string;
    vehicle_registration_number?: string;
    aadhar_card?: string;
    driving_license?: string;
  };
}

export interface ProfileResponse {
  status: 'success' | 'error';
  msg: string;
  data: ProfileData | null;
}

/**
 * Get user profile
 */
export const getProfile = async (userId: string | number): Promise<ProfileData> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.get(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to fetch profile');
  }

  const result: ProfileResponse = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to fetch profile');
  }

  return result.data;
};

/**
 * Update user profile
 */
export const updateProfile = async (
  userId: string | number,
  data: UpdateProfileData
): Promise<ProfileData> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.update(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to update profile');
  }

  const result: ProfileResponse = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to update profile');
  }

  return result.data;
};

/**
 * Update delivery mode for delivery boy
 */
export const updateDeliveryMode = async (
  userId: string | number,
  deliveryMode: 'deliver' | 'deliverPicking' | 'picker'
): Promise<ProfileData> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.updateDeliveryMode(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ delivery_mode: deliveryMode }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to update delivery mode');
  }

  const result: ProfileResponse = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to update delivery mode');
  }

  return result.data;
};

/**
 * Update online/offline status for delivery boy
 */
export const updateOnlineStatus = async (
  userId: string | number,
  isOnline: boolean
): Promise<ProfileData> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.updateOnlineStatus(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ is_online: isOnline }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to update online status');
  }

  const result: ProfileResponse = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to update online status');
  }

  return result.data;
};

/**
 * Upload profile image
 */
export const uploadProfileImage = async (
  userId: string | number,
  imageUri: string
): Promise<{ image_url: string; profile: ProfileData }> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.uploadImage(userId));
  const headers = getApiHeaders();

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'profile.jpg',
  } as any);

  // Remove Content-Type header to let fetch set it with boundary
  const { 'Content-Type': _, ...headersWithoutContentType } = headers;

  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers: headersWithoutContentType,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to upload profile image');
  }

  const result = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to upload profile image');
  }

  return result.data;
};

/**
 * Upload Aadhar card
 */
export const uploadAadharCard = async (
  userId: string | number,
  imageUri: string
): Promise<{ image_url: string; profile: ProfileData }> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.uploadAadhar(userId));
  const headers = getApiHeaders();

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'application/pdf',
    name: 'aadhar.pdf',
  } as any);

  // Remove Content-Type header to let fetch set it with boundary
  const { 'Content-Type': _, ...headersWithoutContentType } = headers;

  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers: headersWithoutContentType,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to upload Aadhar card');
  }

  const result = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to upload Aadhar card');
  }

  return result.data;
};

/**
 * Upload driving license
 */
export const uploadDrivingLicense = async (
  userId: string | number,
  imageUri: string
): Promise<{ image_url: string; profile: ProfileData }> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.uploadDrivingLicense(userId));
  const headers = getApiHeaders();

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: 'application/pdf',
    name: 'driving-license.pdf',
  } as any);

  // Remove Content-Type header to let fetch set it with boundary
  const { 'Content-Type': _, ...headersWithoutContentType } = headers;

  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers: headersWithoutContentType,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to upload driving license');
  }

  const result = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to upload driving license');
  }

  return result.data;
};

/**
 * Complete delivery signup manually (fallback endpoint)
 * This is used if the regular updateProfile doesn't update user_type to 'D'
 */
export const completeDeliverySignup = async (
  userId: string | number
): Promise<ProfileData> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.completeDeliverySignup(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'PUT',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to complete delivery signup');
  }

  const result: ProfileResponse = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to complete delivery signup');
  }

  return result.data;
};

/**
 * Delete user account
 */
export const deleteAccount = async (
  userId: string | number
): Promise<{ status: string; msg: string; data: any }> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.deleteAccount(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to delete account: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to delete account');
  }

  return result;
};

/**
 * Update user's operating categories
 */
export const updateUserCategories = async (
  userId: string | number,
  categoryIds: number[]
): Promise<{ status: string; msg: string; data: any }> => {
  const url = buildApiUrl(`/v2/profile/${userId}/categories`);
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ categoryIds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to update categories: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to update categories');
  }

  return result;
};

/**
 * Get user's operating categories
 */
export const getUserCategories = async (
  userId: string | number
): Promise<{ status: string; msg: string; data: { user_id: string | number; category_ids: number[]; categories: any[]; categories_count: number } }> => {
  const url = buildApiUrl(`/v2/profile/${userId}/categories`);
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to get categories: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to get categories');
  }

  return result;
};

/**
 * Remove a category and all its subcategories from user's operating categories/subcategories
 */
export const removeUserCategory = async (
  userId: string | number,
  categoryId: string | number
): Promise<{ status: string; msg: string; data: any }> => {
  const url = buildApiUrl(`/v2/profile/${userId}/categories/${categoryId}`);
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'DELETE',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to remove category: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to remove category');
  }

  return result;
};

/**
 * Update user's operating subcategories with custom prices
 */
export const updateUserSubcategories = async (
  userId: string | number,
  subcategories: Array<{ subcategoryId: number; customPrice: string; priceUnit: string }>
): Promise<{ status: string; msg: string; data: any }> => {
  const url = buildApiUrl(`/v2/profile/${userId}/subcategories`);
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ subcategories }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to update subcategories: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to update subcategories');
  }

  return result;
};

/**
 * Remove specific subcategories from user's operating subcategories
 */
export const removeUserSubcategories = async (
  userId: string | number,
  subcategoryIds: number[]
): Promise<{ status: string; msg: string; data: any }> => {
  const url = buildApiUrl(`/v2/profile/${userId}/subcategories`);
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ subcategoryIds }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to remove subcategories: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to remove subcategories');
  }

  return result;
};

/**
 * Get user's operating subcategories with custom prices
 */
export const getUserSubcategories = async (
  userId: string | number
): Promise<{ status: string; msg: string; data: { user_id: string | number; subcategories: any[]; subcategories_count: number } }> => {
  const url = buildApiUrl(`/v2/profile/${userId}/subcategories`);
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to get subcategories: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to get subcategories');
  }

  return result;
};

