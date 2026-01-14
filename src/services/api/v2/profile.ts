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
    approval_status?: string;
    rejection_reason?: string | null;
    company_name?: string;
    gst_number?: string;
    pan_number?: string;
    business_license_url?: string;
    gst_certificate_url?: string;
    address_proof_url?: string;
    kyc_owner_url?: string;
    lat_log?: string;
    location?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  b2bShop?: {
    id: string | number;
    shopname: string;
    ownername: string;
    address: string;
    contact: string;
    company_name: string;
    gst_number: string;
    pan_number?: string;
    business_license_url?: string;
    gst_certificate_url?: string;
    address_proof_url?: string;
    kyc_owner_url?: string;
    approval_status: string | null;
    rejection_reason?: string | null;
    shop_type: number;
    lat_log?: string;
    location?: string;
    latitude?: number | null;
    longitude?: number | null;
  };
  b2cShop?: {
    id: string | number;
    shopname: string;
    address: string;
    contact: string;
    aadhar_card?: string | null;
    driving_license?: string | null;
    approval_status: string | null;
    rejection_reason?: string | null;
    shop_type: number;
    lat_log?: string;
    location?: string;
    latitude?: number | null;
    longitude?: number | null;
    is_subscribed?: boolean;
    subscribed_duration?: number; // Duration in days
    subscription_ends_at?: string; // ISO date string
    is_subscription_ends?: boolean;
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
  invoices?: Array<{
    id: string | number;
    user_id: string | number;
    name?: string;
    displayname?: string;
    type?: string;
    price?: string;
    duration?: string | number;
    from_date?: string;
    to_date?: string;
    approval_status?: 'pending' | 'approved' | 'rejected';
    approval_notes?: string | null;
    approved_at?: string;
    payment_moj_id?: string | null;
    payment_req_id?: string | null;
    created_at?: string;
    updated_at?: string;
  }>;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  shop?: {
    shopname?: string;
    ownername?: string;
    address?: string;
    contact?: string;
    latitude?: number;
    longitude?: number;
    lat_log?: string;
    pincode?: string;
    place_id?: string;
    state?: string;
    language?: string;
    place?: string;
    location?: string;
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
    latitude?: number;
    longitude?: number;
    lat_log?: string;
    pincode?: string;
    place_id?: string;
    state?: string;
    language?: string;
    place?: string;
    location?: string;
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

  // Debug: Log invoices if present
  if ((result.data as any).invoices) {
    console.log('📋 [getProfile] Invoices in response:', {
      count: ((result.data as any).invoices || []).length,
      invoices: ((result.data as any).invoices || []).map((inv: any) => ({
        id: inv.id,
        approval_status: inv.approval_status,
        approval_notes: inv.approval_notes,
        type: inv.type
      }))
    });
  } else {
    console.log('⚠️ [getProfile] No invoices in profile response');
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
// Helper function to get MIME type from file URI or provided type
const getMimeTypeFromUri = (uri: string, providedType?: string): string => {
  // If fileType is provided and valid, use it
  if (providedType && providedType !== 'application/octet-stream') {
    return providedType;
  }
  
  // Otherwise, determine from file extension
  const uriLower = uri.toLowerCase();
  // Remove query parameters if present
  const uriWithoutQuery = uriLower.split('?')[0];
  
  if (uriWithoutQuery.endsWith('.pdf')) {
    return 'application/pdf';
  } else if (uriWithoutQuery.endsWith('.jpg') || uriWithoutQuery.endsWith('.jpeg')) {
    return 'image/jpeg';
  } else if (uriWithoutQuery.endsWith('.png')) {
    return 'image/png';
  } else if (uriWithoutQuery.endsWith('.gif')) {
    return 'image/gif';
  } else if (uriWithoutQuery.endsWith('.webp')) {
    return 'image/webp';
  } else if (uriWithoutQuery.endsWith('.bmp')) {
    return 'image/bmp';
  } else if (uriWithoutQuery.endsWith('.tiff') || uriWithoutQuery.endsWith('.tif')) {
    return 'image/tiff';
  }
  // Default to PDF for backward compatibility
  return 'application/pdf';
};

// Helper function to get file extension from URI
const getFileExtension = (uri: string, providedType?: string): string => {
  // If we have a provided type, extract extension from it
  if (providedType) {
    if (providedType === 'application/pdf') return 'pdf';
    if (providedType.startsWith('image/')) {
      const typeMap: { [key: string]: string } = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/bmp': 'bmp',
        'image/tiff': 'tiff',
        'image/tif': 'tif',
      };
      return typeMap[providedType] || 'jpg';
    }
  }
  
  // Otherwise, try to get from URI
  const uriLower = uri.toLowerCase();
  // Remove query parameters if present
  const uriWithoutQuery = uriLower.split('?')[0];
  const lastDot = uriWithoutQuery.lastIndexOf('.');
  if (lastDot === -1) return 'pdf';
  return uriWithoutQuery.substring(lastDot + 1);
};

export const uploadAadharCard = async (
  userId: string | number,
  imageUri: string,
  fileType?: string
): Promise<{ image_url: string; profile: ProfileData }> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.uploadAadhar(userId));
  const headers = getApiHeaders();

  // Detect MIME type and file extension from URI or provided type
  const mimeType = getMimeTypeFromUri(imageUri, fileType);
  const fileExtension = getFileExtension(imageUri, fileType);
  const fileName = `aadhar.${fileExtension}`;

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: mimeType,
    name: fileName,
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
  imageUri: string,
  fileType?: string
): Promise<{ image_url: string; profile: ProfileData }> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.uploadDrivingLicense(userId));
  const headers = getApiHeaders();

  // Detect MIME type and file extension from URI or provided type
  const mimeType = getMimeTypeFromUri(imageUri, fileType);
  const fileExtension = getFileExtension(imageUri, fileType);
  const fileName = `driving-license.${fileExtension}`;

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append('file', {
    uri: imageUri,
    type: mimeType,
    name: fileName,
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

/**
 * Upgrade user_type from 'S' to 'SR' and create R shop when switching to B2C mode
 * Only works if user is approved by admin panel
 */
export const upgradeToSR = async (
  userId: string | number
): Promise<{ status: string; msg: string; data: { user_type: string; b2b_shop_id: string | number; r_shop_id: string | number } }> => {
  const url = buildApiUrl(API_ROUTES.v2.profile.upgradeToSR(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || errorData.message || `Failed to upgrade to SR: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status === 'error') {
    throw new Error(result.msg || result.message || 'Failed to upgrade to SR');
  }

  return result;
};

