/**
 * V2 Address API Service
 * Handles address-related API calls
 */

import { buildApiUrl, getApiHeaders, fetchWithLogging } from '../apiConfig';

export interface SaveAddressData {
  customer_id: string | number;
  address: string;
  addres_type: 'Work' | 'Home' | 'Other';
  district?: string;
  state?: string;
  pincode?: string;
  zone?: string;
  country?: string;
  building_no?: string;
  landmark?: string;
  lat_log?: string; // Format: "latitude,longitude" (optional if latitude/longitude provided)
  latitude?: number;
  longitude?: number;
}

export interface AddressResponse {
  status: 'success' | 'error';
  msg?: string;
  data?: {
    id: number;
    customer_id: number;
    address: string;
    addres_type: string;
    state?: string;
    building_no?: string;
    landmark?: string;
    lat_log: string;
    latitude?: number;
    longitude?: number;
    created_at: string;
    updated_at: string;
  };
}

export interface Address {
  id: number;
  customer_id: number;
  address: string;
  addres_type: 'Work' | 'Home' | 'Other';
  district?: string;
  state?: string;
  pincode?: string;
  zone?: string;
  country?: string;
  building_no?: string;
  landmark?: string;
  lat_log: string;
  latitude?: number;
  longitude?: number;
  created_at: string;
  updated_at: string;
}

/**
 * Save customer address
 */
export const saveAddress = async (data: SaveAddressData): Promise<AddressResponse> => {
  const url = buildApiUrl('/v2/addresses');
  
  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to save address: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to save address');
  }

  return result;
};

/**
 * Get all addresses for a customer
 */
export const getCustomerAddresses = async (customerId: string | number): Promise<Address[]> => {
  const url = buildApiUrl(`/v2/addresses/customer/${customerId}`);
  
  const response = await fetchWithLogging(url, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get addresses: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to get addresses');
  }

  return result.data || [];
};

/**
 * Update an address
 */
export const updateAddress = async (addressId: number, data: Partial<SaveAddressData>): Promise<AddressResponse> => {
  const url = buildApiUrl(`/v2/addresses/${addressId}`);
  
  const response = await fetchWithLogging(url, {
    method: 'PUT',
    headers: getApiHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to update address: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to update address');
  }

  return result;
};

/**
 * Delete an address
 */
export const deleteAddress = async (addressId: number): Promise<void> => {
  const url = buildApiUrl(`/v2/addresses/${addressId}`);
  
  const response = await fetchWithLogging(url, {
    method: 'DELETE',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to delete address: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to delete address');
  }
};

/**
 * Get latest marketplace address for a customer
 */
export const getMarketplaceAddress = async (customerId: string | number): Promise<Address | null> => {
  const url = buildApiUrl(`/v2/addresses/marketplace/customer/${customerId}`);

  const response = await fetchWithLogging(url, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to get marketplace address: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to get marketplace address');
  }

  return result.data || null;
};

/**
 * Upsert marketplace address for a customer.
 * This endpoint also marks user marketplace role as M (additive, does not replace core user_type).
 */
export const upsertMarketplaceAddress = async (
  data: Omit<SaveAddressData, 'addres_type' | 'address'> & { address?: string }
): Promise<AddressResponse> => {
  const url = buildApiUrl('/v2/addresses/marketplace/upsert');

  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error(`Failed to save marketplace address: ${response.statusText}`);
  }

  const result = await response.json();

  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to save marketplace address');
  }

  return result;
};

export interface ResolvedGeoResponse {
  status: 'success' | 'error';
  msg?: string;
  data?: {
    district?: string;
    state?: string;
    pincode?: string;
    zone?: string;
  };
}

/**
 * Resolve district/state/pincode/zone from latitude+longitude using backend zone flow.
 */
export const resolveAddressGeo = async (
  latitude: number,
  longitude: number,
  address?: string
): Promise<{ district: string; state: string; pincode: string; zone: string }> => {
  let query = `latitude=${encodeURIComponent(String(latitude))}&longitude=${encodeURIComponent(String(longitude))}`;
  if (address && address.trim()) {
    query += `&address=${encodeURIComponent(address.trim())}`;
  }
  const url = buildApiUrl(`/v2/addresses/geo/resolve?${query}`);

  const response = await fetchWithLogging(url, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to resolve geo fields: ${response.statusText}`);
  }

  const result: ResolvedGeoResponse = await response.json();
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to resolve geo fields');
  }

  return {
    district: String(result?.data?.district || ''),
    state: String(result?.data?.state || ''),
    pincode: String(result?.data?.pincode || ''),
    zone: String(result?.data?.zone || ''),
  };
};
