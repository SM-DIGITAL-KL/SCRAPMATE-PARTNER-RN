import { API_BASE_URL, API_KEY, getApiHeaders } from '../apiConfig';

export interface PickupRequest {
  order_id: number;
  order_number: number;
  customer_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  scrap_description: string;
  estimated_weight_kg: number;
  estimated_price: number;
  status: number;
  preferred_pickup_time?: string;
  preferred_pickup_date?: string | null;
  preferred_pickup_time_slot?: string | null;
  pickup_time_display?: string;
  created_at: string;
  distance_km?: number;
  images: string[];
}

export interface OrderItem {
  subcategory_id?: number;
  subcategoryId?: number;
  category_id?: number;
  categoryId?: number;
  name?: string;
  category_name?: string;
  material_name?: string;
  quantity?: number;
  qty?: number;
  weight?: number;
  price?: number;
  [key: string]: any; // Allow additional properties
}

export interface ActivePickup {
  order_id: number;
  order_number: number;
  order_no: string;
  customer_id: number;
  customer_name?: string | null;
  customer_phone?: string | null;
  address: string;
  latitude: number | null;
  longitude: number | null;
  scrap_description: string;
  estimated_weight_kg: number;
  estimated_price: number;
  status: number;
  status_label?: string;
  accepted_by_other?: boolean; // Flag to indicate if accepted by another vendor
  cancelled_by_vendor?: boolean; // Flag to indicate if cancelled by this vendor
  cancellation_reason?: string | null; // Cancellation reason if cancelled
  cancelled_at?: string | null; // Cancellation timestamp if cancelled
  accepted_at?: string;
  pickup_initiated_at?: string;
  arrived_at?: string;
  preferred_pickup_time?: string;
  pickup_time_display: string;
  preferred_pickup_date?: string | null;
  preferred_pickup_time_slot?: string | null;
  created_at: string;
  pickup_completed_at?: string;
  images: string[];
  orderdetails?: OrderItem[]; // Parsed order items with subcategory info
}

export interface PlacePickupRequestData {
  customer_id: number;
  orderdetails: string | object;
  customerdetails: string;
  latitude: number;
  longitude: number;
  estim_weight: number;
  estim_price: number;
  preferred_pickup_time?: string;
  images?: File[];
}

/**
 * Place a pickup request order (User type 'U' from user app)
 */
export const placePickupRequest = async (
  data: PlacePickupRequestData
): Promise<{ order_number: number; order_id: number; status: number }> => {
  const formData = new FormData();
  
  formData.append('customer_id', data.customer_id.toString());
  formData.append(
    'orderdetails',
    typeof data.orderdetails === 'string' 
      ? data.orderdetails 
      : JSON.stringify(data.orderdetails)
  );
  formData.append('customerdetails', data.customerdetails);
  formData.append('latitude', data.latitude.toString());
  formData.append('longitude', data.longitude.toString());
  formData.append('estim_weight', data.estim_weight.toString());
  formData.append('estim_price', data.estim_price.toString());
  
  if (data.preferred_pickup_time) {
    formData.append('preferred_pickup_time', data.preferred_pickup_time);
  }
  
  // Add images (React Native FormData format)
  if (data.images && data.images.length > 0) {
    data.images.slice(0, 6).forEach((image, index) => {
      const imageFile = image as any;
      formData.append(`image${index + 1}`, {
        uri: imageFile.uri || imageFile.path || imageFile.localUri,
        type: imageFile.type || 'image/jpeg',
        name: imageFile.name || imageFile.fileName || `image${index + 1}.jpg`
      } as any);
    });
  }

  const response = await fetch(
    `${API_BASE_URL}/v2/orders/pickup-request`,
    {
      method: 'POST',
      headers: {
        'api-key': API_KEY,
        // Don't set Content-Type for FormData - React Native will set it with boundary
      },
      body: formData as any,
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to place pickup request: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to place pickup request');
  }

  return result.data;
};

/**
 * Get available pickup requests (for R, S, SR, D users)
 */
export const getAvailablePickupRequests = async (
  user_id: number,
  user_type: 'R' | 'S' | 'SR' | 'D',
  latitude?: number,
  longitude?: number,
  radius: number = 10
): Promise<PickupRequest[]> => {
  try {
    let url = `${API_BASE_URL}/v2/orders/pickup-requests/available?user_id=${user_id}&user_type=${user_type}`;
    
    if (latitude && longitude) {
      url += `&latitude=${latitude}&longitude=${longitude}&radius=${radius}`;
    }

    console.log(`📤 [getAvailablePickupRequests] Fetching from: ${url}`);
    console.log(`📤 [getAvailablePickupRequests] Headers:`, getApiHeaders(true));

    const response = await fetch(url, {
      method: 'GET',
      headers: getApiHeaders(true),
    });

    console.log(`📥 [getAvailablePickupRequests] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ [getAvailablePickupRequests] Error response:`, errorText);
      throw new Error(`Failed to fetch available pickup requests: ${response.statusText}`);
    }

    const result = await response.json();
    console.log(`📥 [getAvailablePickupRequests] Response data:`, result);
    
    if (result.status === 'error') {
      console.error(`❌ [getAvailablePickupRequests] Error in response:`, result.msg);
      throw new Error(result.msg || 'Failed to fetch available pickup requests');
    }

    if (!result.data) {
      console.warn(`⚠️ [getAvailablePickupRequests] No data in response, returning empty array`);
      return [];
    }

    console.log(`✅ [getAvailablePickupRequests] Successfully fetched ${result.data?.length || 0} pickup requests`);
    return result.data || [];
  } catch (error) {
    console.error(`❌ [getAvailablePickupRequests] Exception:`, error);
    throw error;
  }
};

/**
 * Accept a pickup request (R, S, SR, D users)
 */
export const acceptPickupRequest = async (
  orderId: number | string,
  user_id: number,
  user_type: 'R' | 'S' | 'SR' | 'D'
): Promise<{ order_id: number; order_number: number; status: number }> => {
  try {
    console.log(`📤 [acceptPickupRequest] Accepting order ${orderId} for user ${user_id} (type: ${user_type})`);
    
    const response = await fetch(
      `${API_BASE_URL}/v2/orders/pickup-request/${orderId}/accept`,
      {
        method: 'POST',
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id,
          user_type,
        }),
      }
    );

    console.log(`📥 [acceptPickupRequest] Response status: ${response.status} ${response.statusText}`);

    // Try to parse response body first (even for error responses)
    let responseData;
    try {
      const responseText = await response.text();
      console.log(`📥 [acceptPickupRequest] Response body:`, responseText);
      responseData = responseText ? JSON.parse(responseText) : null;
    } catch (parseError) {
      console.error(`❌ [acceptPickupRequest] Failed to parse response:`, parseError);
      responseData = null;
    }

    if (!response.ok) {
      // Extract error message from response
      let errorMessage = 'Failed to accept pickup request';
      
      if (responseData) {
        errorMessage = responseData.msg || responseData.message || responseData.error || errorMessage;
      } else {
        errorMessage = response.statusText || `HTTP ${response.status}: ${errorMessage}`;
      }
      
      console.error(`❌ [acceptPickupRequest] Error: ${errorMessage} (Status: ${response.status})`);
      throw new Error(errorMessage);
    }

    if (!responseData) {
      throw new Error('Invalid response from server');
    }
    
    if (responseData.status === 'error') {
      const errorMsg = responseData.msg || responseData.message || 'Failed to accept pickup request';
      console.error(`❌ [acceptPickupRequest] API returned error: ${errorMsg}`);
      throw new Error(errorMsg);
    }

    console.log(`✅ [acceptPickupRequest] Order accepted successfully:`, responseData.data);
    return responseData.data;
  } catch (error: any) {
    console.error(`❌ [acceptPickupRequest] Exception caught:`, error);
    // Re-throw with better error message if it's not already an Error object
    if (error instanceof Error) {
      throw error;
    }
    throw new Error(error?.message || String(error) || 'Failed to accept pickup request');
  }
};

/**
 * Cancel/decline a pickup request (vendor declines the order)
 */
export const cancelPickupRequest = async (
  orderId: string | number,
  userId: number,
  userType: 'R' | 'S' | 'SR' | 'D',
  cancellationReason: string
): Promise<{ order_number: number; cancellation_reason: string; cancelled_at: string }> => {
  const response = await fetch(
    `${API_BASE_URL}/v2/orders/pickup-request/${orderId}/cancel`,
    {
      method: 'POST',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        user_type: userType,
        cancellation_reason: cancellationReason,
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to cancel pickup request: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to cancel pickup request');
  }

  return result.data;
};

/**
 * Get active pickup order for a user (R, S, SR, D)
 */
export const getActivePickup = async (
  userId: number,
  user_type: 'R' | 'S' | 'SR' | 'D'
): Promise<ActivePickup | null> => {
  const response = await fetch(
    `${API_BASE_URL}/v2/orders/active-pickup/${userId}?user_type=${user_type}`,
    {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch active pickup: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to fetch active pickup');
  }

  return result.data;
};

/**
 * Get all active pickup orders for a user (R, S, SR, D)
 */
export const getAllActivePickups = async (
  userId: number,
  user_type: 'R' | 'S' | 'SR' | 'D'
): Promise<ActivePickup[]> => {
  const response = await fetch(
    `${API_BASE_URL}/v2/orders/active-pickups/${userId}?user_type=${user_type}`,
    {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch all active pickups: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to fetch all active pickups');
  }

  return result.data || [];
};

/**
 * Get completed pickup orders for a user (R, S, SR, D) - status 5
 */
export const getCompletedPickups = async (
  userId: number,
  user_type: 'R' | 'S' | 'SR' | 'D'
): Promise<ActivePickup[]> => {
  const response = await fetch(
    `${API_BASE_URL}/v2/orders/completed-pickups/${userId}?user_type=${user_type}`,
    {
      method: 'GET',
      headers: {
        'api-key': API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch completed pickups: ${response.statusText}`);
  }

  const result = await response.json();
  
  if (result.status === 'error') {
    throw new Error(result.msg || 'Failed to fetch completed pickups');
  }

  return result.data || [];
};

/**
 * Start pickup (vendor clicks "Myself Pickup")
 */
export const startPickup = async (
  orderId: number | string,
  user_id: number,
  user_type: 'R' | 'S' | 'SR' | 'D'
): Promise<{ order_id: number; order_number: number; status: number }> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v2/orders/pickup-request/${orderId}/start-pickup`,
      {
        method: 'POST',
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id,
          user_type,
        }),
      }
    );

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      // If JSON parsing fails, throw with status text
      throw new Error(`Failed to start pickup: ${response.statusText || response.status}`);
    }
    
    if (!response.ok || result.status === 'error') {
      const errorMessage = result.msg || result.message || `Failed to start pickup (${response.status})`;
      console.error('Start pickup error:', {
        status: response.status,
        statusText: response.statusText,
        result
      });
      throw new Error(errorMessage);
    }

    return result.data;
  } catch (error: any) {
    // Re-throw if it's already an Error with a message
    if (error instanceof Error && error.message) {
      throw error;
    }
    // Otherwise wrap it
    throw new Error(error.message || 'Failed to start pickup');
  }
};

/**
 * Mark order as arrived at location (status 4)
 */
export const arrivedLocation = async (
  orderId: number | string,
  user_id: number,
  user_type: 'R' | 'S' | 'SR' | 'D'
): Promise<{ order_id: number; order_number: number; status: number }> => {
  try {
    const response = await fetch(
      `${API_BASE_URL}/v2/orders/pickup-request/${orderId}/arrived-location`,
      {
        method: 'POST',
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id,
          user_type,
        }),
      }
    );

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to mark arrived location: ${response.statusText || response.status}`);
    }
    
    if (!response.ok || result.status === 'error') {
      const errorMessage = result.msg || result.message || `Failed to mark arrived location (${response.status})`;
      console.error('Arrived location error:', {
        status: response.status,
        statusText: response.statusText,
        result
      });
      throw new Error(errorMessage);
    }

    return result.data;
  } catch (error: any) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(error.message || 'Failed to mark arrived location');
  }
};

/**
 * Mark order as pickup completed (status 5)
 */
export const completePickup = async (
  orderId: number | string,
  user_id: number,
  user_type: 'R' | 'S' | 'SR' | 'D',
  paymentDetails?: Array<{
    category_id?: number | string;
    subcategory_id?: number | string;
    weight: number | string;
    amount: number | string;
  }>
): Promise<{ order_id: number; order_number: number; status: number }> => {
  try {
    const requestBody: any = {
      user_id,
      user_type,
    };

    // Add payment details if provided
    if (paymentDetails && paymentDetails.length > 0) {
      requestBody.payment_details = paymentDetails.map(detail => ({
        category_id: detail.category_id || null,
        subcategory_id: detail.subcategory_id || null,
        weight: parseFloat(String(detail.weight || 0)) || 0,
        amount: parseFloat(String(detail.amount || 0)) || 0,
      }));
    }

    const response = await fetch(
      `${API_BASE_URL}/v2/orders/pickup-request/${orderId}/complete-pickup`,
      {
        method: 'POST',
        headers: {
          'api-key': API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    let result;
    try {
      result = await response.json();
    } catch (parseError) {
      throw new Error(`Failed to complete pickup: ${response.statusText || response.status}`);
    }
    
    if (!response.ok || result.status === 'error') {
      const errorMessage = result.msg || result.message || `Failed to complete pickup (${response.status})`;
      console.error('Complete pickup error:', {
        status: response.status,
        statusText: response.statusText,
        result
      });
      throw new Error(errorMessage);
    }

    return result.data;
  } catch (error: any) {
    if (error instanceof Error && error.message) {
      throw error;
    }
    throw new Error(error.message || 'Failed to complete pickup');
  }
};

