/**
 * V2 Bulk Scrap API
 * Handles bulk scrap purchase requests
 */

import { buildApiUrl, getApiHeaders } from '../apiConfig';
import { API_ROUTES } from '../apiConfig';

export interface SubcategoryDetail {
  subcategory_id: number;
  subcategory_name: string;
  quantity: number; // in kgs
  preferred_price?: number; // per kg
}

export interface BulkScrapPurchaseRequest {
  buyer_id: number;
  latitude: number;
  longitude: number;
  scrap_type?: string;
  subcategories?: SubcategoryDetail[]; // Array of subcategories with quantities and prices
  subcategory_id?: number; // Deprecated: kept for backward compatibility
  quantity: number; // in kgs (total quantity)
  preferred_price?: number; // average preferred price (deprecated, use subcategories array)
  when_needed?: string;
  preferred_distance?: number; // Preferred search distance in km (0-3000, step 50)
  location?: string;
  additional_notes?: string;
  documents?: Array<{ uri: string; name: string; type: string }>; // Array of document URIs
  pending_order_id?: string | number; // ID of the pending order being submitted
}

export interface BulkScrapPurchaseResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    buyer_id: number;
    buyer_name: string;
    quantity: number;
    scrap_type: string | null;
    location: {
      latitude: number;
      longitude: number;
      address: string | null;
    };
    notified_users: {
      total: number;
      b2b_count: number;
      b2c_count: number;
      with_fcm_tokens: number;
    };
    notifications: {
      success_count: number;
      failure_count: number;
    } | null;
  } | null;
}

/**
 * Create a bulk scrap purchase request
 * This will notify nearby B2B and B2C users about the purchase request
 */
export const createBulkPurchaseRequest = async (
  request: BulkScrapPurchaseRequest
): Promise<BulkScrapPurchaseResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkScrap.purchase);
  const headers = getApiHeaders();

  console.log('📤 Creating bulk scrap purchase request:', {
    buyer_id: request.buyer_id,
    quantity: request.quantity,
    latitude: request.latitude,
    longitude: request.longitude,
    subcategories_count: request.subcategories?.length || 0,
    documents_count: request.documents?.length || 0
  });

  // If documents are present, use FormData; otherwise use JSON
  let body: any;
  let finalHeaders: any = headers;

  if (request.documents && request.documents.length > 0) {
    // Use FormData for document uploads
    const formData = new FormData();
    
    // Add all non-document fields
    formData.append('buyer_id', request.buyer_id.toString());
    formData.append('latitude', request.latitude.toString());
    formData.append('longitude', request.longitude.toString());
    formData.append('quantity', request.quantity.toString());
    
    if (request.scrap_type) {
      formData.append('scrap_type', request.scrap_type);
    }
    if (request.subcategories && request.subcategories.length > 0) {
      formData.append('subcategories', JSON.stringify(request.subcategories));
    }
    if (request.subcategory_id) {
      formData.append('subcategory_id', request.subcategory_id.toString());
    }
    if (request.pending_order_id) {
      formData.append('pending_order_id', request.pending_order_id.toString());
    }
    if (request.preferred_price) {
      formData.append('preferred_price', request.preferred_price.toString());
    }
    if (request.when_needed) {
      formData.append('when_needed', request.when_needed);
    }
    if (request.preferred_distance !== undefined) {
      formData.append('preferred_distance', request.preferred_distance.toString());
    }
    if (request.location) {
      formData.append('location', request.location);
    }
    if (request.additional_notes) {
      formData.append('additional_notes', request.additional_notes);
    }

    // Add documents
    request.documents.forEach((doc, index) => {
      formData.append(`document${index + 1}`, {
        uri: doc.uri,
        type: doc.type || 'application/pdf',
        name: doc.name || `document${index + 1}.pdf`,
      } as any);
    });

    body = formData;
    // Remove Content-Type header to let fetch set it with boundary
    const { 'Content-Type': _, ...headersWithoutContentType } = headers;
    finalHeaders = headersWithoutContentType;
  } else {
    // Use JSON for requests without documents
    body = JSON.stringify(request);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: finalHeaders,
    body: body as any,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Bulk scrap purchase request failed:', data);
    throw new Error(data.msg || 'Failed to create bulk scrap purchase request');
  }

  console.log('✅ Bulk scrap purchase request created:', data);
  return data;
};

export interface BulkScrapRequest {
  id: number;
  buyer_id: number;
  buyer_name: string | null;
  latitude: number;
  longitude: number;
  scrap_type: string | null;
  subcategories?: SubcategoryDetail[] | null;
  subcategory_id?: number | null;
  quantity: number; // in kgs (requested quantity)
  preferred_price?: number | null;
  preferred_distance: number; // in km
  when_needed?: string | null;
  location?: string | null;
  additional_notes?: string | null;
  documents?: string[] | null;
  status: string;
  created_at: string;
  updated_at: string;
  distance?: number; // Distance from user's location in km
  distance_km?: number;
  total_committed_quantity?: number; // Total quantity committed by all vendors
  accepted_vendors?: Array<{
    user_id: number;
    user_type: string;
    shop_id?: number | null;
    committed_quantity?: number;
    bidding_price?: number; // Bidding price per kg submitted by the vendor
    status?: 'participated' | 'order_full_filled' | 'pickup_started' | 'arrived' | 'completed'; // Vendor-specific status
    accepted_at: string;
    updated_at?: string;
  }>; // Array of vendors who have accepted
}

export interface BulkScrapRequestsResponse {
  status: 'success' | 'error';
  msg: string;
  data: BulkScrapRequest[];
}

/**
 * Get bulk scrap purchase requests for a user
 * Returns requests where the user is within the request's preferred_distance
 */
export const getBulkScrapRequests = async (
  userId: number,
  latitude?: number,
  longitude?: number,
  userType?: string
): Promise<BulkScrapRequest[]> => {
  let url = `${buildApiUrl(API_ROUTES.v2.bulkScrap.requests)}?user_id=${userId}`;
  
  // Only add latitude/longitude if both are defined and valid numbers
  if (latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)) {
    url += `&latitude=${latitude}&longitude=${longitude}`;
  }
  
  if (userType) {
    url += `&user_type=${userType}`;
  }

  const headers = getApiHeaders();

  console.log('📤 Fetching bulk scrap requests:', { userId, latitude, longitude, userType });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    // Check if response is OK and content type is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response received:', text.substring(0, 200));
      throw new Error(`Server returned non-JSON response (Status: ${response.status}). The server may be experiencing issues.`);
    }

    const data: BulkScrapRequestsResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to fetch bulk scrap requests:', data);
      throw new Error(data.msg || 'Failed to fetch bulk scrap requests');
    }

    if (data.status === 'error') {
      throw new Error(data.msg || 'Failed to fetch bulk scrap requests');
    }

    console.log(`✅ Fetched ${data.data?.length || 0} bulk scrap requests`);
    return data.data || [];
  } catch (error: any) {
    console.error('❌ Error fetching bulk scrap requests:', error);
    throw error;
  }
};

export interface AcceptBulkScrapRequestResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: string;
    accepted: boolean;
    accepted_vendors_count?: number;
  } | null;
}

export interface RejectBulkScrapRequestResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: string;
    rejected: boolean;
  } | null;
}

/**
 * Accept a bulk scrap purchase request
 */
export const acceptBulkScrapRequest = async (
  requestId: string | number,
  userId: number,
  userType: 'R' | 'S' | 'SR',
  quantity?: number, // Optional: quantity to commit (in kgs)
  biddingPrice?: number, // Optional: bidding price per kg
  images?: Array<{ uri: string; type?: string; name?: string }> // Optional: images of scrap (up to 6)
): Promise<AcceptBulkScrapRequestResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkScrap.accept(requestId));
  
  console.log('📤 Accepting bulk scrap request:', { requestId, userId, userType, quantity, biddingPrice, imagesCount: images?.length || 0 });

  // If images are provided, use FormData; otherwise use JSON
  let body: any;
  let headers: any = getApiHeaders();

  if (images && images.length > 0) {
    // Use FormData for image uploads
    const formData = new FormData();
    formData.append('user_id', userId.toString());
    formData.append('user_type', userType);
    
    if (quantity !== undefined) {
      formData.append('quantity', quantity.toString());
    }
    if (biddingPrice !== undefined) {
      formData.append('bidding_price', biddingPrice.toString());
    }

    // Add images (limit to 6)
    images.slice(0, 6).forEach((image, index) => {
      formData.append(`image${index + 1}`, {
        uri: image.uri,
        type: image.type || 'image/jpeg',
        name: image.name || `image${index + 1}.jpg`,
      } as any);
    });

    body = formData;
    // Remove Content-Type header to let fetch set it with boundary
    const { 'Content-Type': _, ...headersWithoutContentType } = headers;
    headers = headersWithoutContentType;
  } else {
    // Use JSON for requests without images
    body = JSON.stringify({
      user_id: userId,
      user_type: userType,
      quantity: quantity,
      bidding_price: biddingPrice,
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body as any,
  });

  const data: AcceptBulkScrapRequestResponse = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to accept bulk scrap request');
  }

  console.log('✅ Bulk scrap request accepted:', data);
  return data;
};

/**
 * Reject a bulk scrap purchase request
 */
export const rejectBulkScrapRequest = async (
  requestId: string | number,
  userId: number,
  userType: 'R' | 'S' | 'SR',
  rejectionReason?: string
): Promise<RejectBulkScrapRequestResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkScrap.reject(requestId));
  const headers = getApiHeaders();

  console.log('📤 Rejecting bulk scrap request:', { requestId, userId, userType, rejectionReason });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      user_id: userId,
      user_type: userType,
      rejection_reason: rejectionReason || null,
    }),
  });

  const data: RejectBulkScrapRequestResponse = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to reject bulk scrap request');
  }

  console.log('✅ Bulk scrap request rejected:', data);
  return data;
};

/**
 * Remove a vendor from accepted vendors list (only buyer can do this)
 */
export const removeVendorFromBulkRequest = async (
  requestId: string | number,
  buyerId: number,
  vendorUserId: number,
  reason?: string
): Promise<{
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: number;
    vendor_removed: boolean;
  } | null;
}> => {
  const url = buildApiUrl(`${API_ROUTES.v2.bulkScrap.accept(requestId)}/remove-vendor`);
  const headers = getApiHeaders();

  console.log('📤 Removing vendor from bulk request:', { requestId, buyerId, vendorUserId, reason });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      buyer_id: buyerId,
      vendor_user_id: vendorUserId,
      reason: reason || 'Scrap quality not proper'
    }),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to remove vendor from bulk request');
  }

  console.log('✅ Vendor removed from bulk request:', data);
  return data;
};

/**
 * Get accepted bulk scrap purchase requests for a user
 * Returns requests where the user has accepted
 */
export const getAcceptedBulkScrapRequests = async (
  userId: number,
  latitude?: number,
  longitude?: number,
  userType?: string
): Promise<BulkScrapRequest[]> => {
  let url = `${buildApiUrl(API_ROUTES.v2.bulkScrap.accepted)}?user_id=${userId}`;
  
  // Only add latitude/longitude if both are defined and valid numbers
  if (latitude !== undefined && longitude !== undefined && !isNaN(latitude) && !isNaN(longitude)) {
    url += `&latitude=${latitude}&longitude=${longitude}`;
  }
  
  if (userType) {
    url += `&user_type=${userType}`;
  }

  const headers = getApiHeaders();

  console.log('📤 Fetching accepted bulk scrap requests:', { userId, latitude, longitude, userType });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    // Check if response is OK and content type is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response received:', text.substring(0, 200));
      throw new Error(`Server returned non-JSON response (Status: ${response.status}). The server may be experiencing issues.`);
    }

    const data: BulkScrapRequestsResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to fetch accepted bulk scrap requests:', data);
      throw new Error(data.msg || 'Failed to fetch accepted bulk scrap requests');
    }

    if (data.status === 'error') {
      throw new Error(data.msg || 'Failed to fetch accepted bulk scrap requests');
    }

    console.log(`✅ Fetched ${data.data?.length || 0} accepted bulk scrap requests`);
    return data.data || [];
  } catch (error: any) {
    console.error('❌ Error fetching accepted bulk scrap requests:', error);
    throw error;
  }
};

/**
 * Get bulk scrap purchase requests created by a specific buyer
 * Returns requests created by the buyer
 */
export const getBulkScrapRequestsByBuyer = async (
  buyerId: number
): Promise<BulkScrapRequest[]> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkScrap.byBuyer(buyerId));
  const headers = getApiHeaders();

  console.log('📤 Fetching bulk scrap requests by buyer:', { buyerId });

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    // Check if response is OK and content type is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response received:', text.substring(0, 200));
      throw new Error(`Server returned non-JSON response (Status: ${response.status}). The server may be experiencing issues.`);
    }

    const data: BulkScrapRequestsResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Failed to fetch bulk scrap requests by buyer:', data);
      throw new Error(data.msg || 'Failed to fetch bulk scrap requests by buyer');
    }

    if (data.status === 'error') {
      throw new Error(data.msg || 'Failed to fetch bulk scrap requests by buyer');
    }

    console.log(`✅ Fetched ${data.data?.length || 0} bulk scrap requests by buyer ${buyerId}`);
    return data.data || [];
  } catch (error: any) {
    console.error('❌ Error fetching bulk scrap requests by buyer:', error);
    throw error;
  }
};

/**
 * Start pickup for a bulk scrap request
 * Creates orders for each participating vendor
 */
export const startPickupForBulkRequest = async (
  requestId: string | number,
  buyerId: number,
  userType: 'R' | 'S' | 'SR'
): Promise<{
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: number;
    orders_created: number;
    orders: Array<{
      order_id: number;
      order_number: number;
      vendor_id: number;
      committed_quantity: number;
      bidding_price: number | null;
    }>;
  } | null;
}> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkScrap.startPickup(requestId));
  const headers = getApiHeaders();

  console.log('📤 Starting pickup for bulk request:', { requestId, buyerId, userType });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      buyer_id: buyerId,
      user_type: userType,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to start pickup for bulk request');
  }

  console.log('✅ Pickup started for bulk request:', data);
  return data;
};

/**
 * Update buyer status for a bulk scrap request (arrived, completed)
 */
export const updateBulkRequestBuyerStatus = async (
  requestId: string | number,
  buyerId: number,
  buyerStatus: 'arrived' | 'completed'
): Promise<{
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: number;
    buyer_status: string;
  } | null;
}> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkScrap.updateBuyerStatus(requestId));
  const headers = getApiHeaders();

  console.log('📤 Updating buyer status for bulk request:', { requestId, buyerId, buyerStatus });

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      buyer_id: buyerId,
      buyer_status: buyerStatus,
    }),
  });

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to update buyer status');
  }

  console.log('✅ Buyer status updated for bulk request:', data);
  return data;
};

export interface BulkRequestOrder {
  order_id: string | number;
  order_number: number;
  vendor_id: number;
  vendor_name: string | null;
  vendor_phone: string | null;
  shop_id: number | null;
  shop_name: string | null;
  shop_address: string | null;
  committed_quantity: number;
  bidding_price: number | null;
  estimated_weight_kg: number;
  estimated_price: number;
  total_amount: number;
  status: number;
  status_label: string;
  address: string;
  lat_log: string;
  orderdetails: any[];
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  pickup_initiated_at?: string;
  arrived_at?: string;
  pickup_completed_at?: string;
}

export interface BulkRequestOrdersResponse {
  status: 'success' | 'error';
  msg: string;
  data: BulkRequestOrder[];
}

/**
 * Get all orders created from a bulk scrap request (for the buyer)
 */
export const getBulkRequestOrders = async (
  requestId: string | number,
  buyerId: number
): Promise<BulkRequestOrder[]> => {
  const url = `${buildApiUrl(API_ROUTES.v2.bulkScrap.orders(requestId))}?buyer_id=${buyerId}`;
  const headers = getApiHeaders();

  console.log('📤 Fetching orders for bulk request:', { requestId, buyerId });

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  // Check if response is OK and content type is JSON
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('❌ Non-JSON response received:', text.substring(0, 200));
    throw new Error(`Server returned non-JSON response (Status: ${response.status}). The server may be experiencing issues.`);
  }

  const data: BulkRequestOrdersResponse = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to fetch bulk request orders');
  }

  console.log(`✅ Fetched ${data.data?.length || 0} orders for bulk request ${requestId}`);
  return data.data || [];
};

/**
 * Save pending bulk buy order with payment transaction ID
 * This creates a pending order that will be submitted after payment approval
 */
export const savePendingBulkBuyOrder = async (
  userId: number,
  request: BulkScrapPurchaseRequest,
  transactionId: string,
  paymentAmount: number,
  subscriptionPlanId: string
): Promise<{
  status: 'success' | 'error';
  msg: string;
  data?: {
    pending_order_id: string;
    transaction_id: string;
  };
}> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkScrap.pendingOrders);
  const headers = getApiHeaders();

  console.log('📤 Saving pending bulk buy order:', {
    userId,
    transactionId,
    paymentAmount,
    subcategories_count: request.subcategories?.length || 0,
  });

  // If documents are present, use FormData; otherwise use JSON
  let body: any;
  let finalHeaders: any = headers;

  if (request.documents && request.documents.length > 0) {
    const formData = new FormData();
    
    formData.append('user_id', userId.toString());
    formData.append('transaction_id', transactionId);
    formData.append('payment_amount', paymentAmount.toString());
    formData.append('subscription_plan_id', subscriptionPlanId);
    formData.append('buyer_id', request.buyer_id.toString());
    formData.append('latitude', request.latitude.toString());
    formData.append('longitude', request.longitude.toString());
    formData.append('quantity', request.quantity.toString());
    
    if (request.scrap_type) {
      formData.append('scrap_type', request.scrap_type);
    }
    if (request.subcategories && request.subcategories.length > 0) {
      formData.append('subcategories', JSON.stringify(request.subcategories));
    }
    if (request.subcategory_id) {
      formData.append('subcategory_id', request.subcategory_id.toString());
    }
    if (request.preferred_price) {
      formData.append('preferred_price', request.preferred_price.toString());
    }
    if (request.when_needed) {
      formData.append('when_needed', request.when_needed);
    }
    if (request.preferred_distance !== undefined) {
      formData.append('preferred_distance', request.preferred_distance.toString());
    }
    if (request.location) {
      formData.append('location', request.location);
    }
    if (request.additional_notes) {
      formData.append('additional_notes', request.additional_notes);
    }

    request.documents.forEach((doc, index) => {
      formData.append(`document${index + 1}`, {
        uri: doc.uri,
        type: doc.type || 'application/pdf',
        name: doc.name || `document${index + 1}.pdf`,
      } as any);
    });

    body = formData;
    const { 'Content-Type': _, ...headersWithoutContentType } = headers;
    finalHeaders = headersWithoutContentType;
  } else {
    body = JSON.stringify({
      user_id: userId,
      transaction_id: transactionId,
      payment_amount: paymentAmount,
      subscription_plan_id: subscriptionPlanId,
      ...request,
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: finalHeaders,
    body: body as any,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Failed to save pending bulk buy order:', data);
    throw new Error(data.msg || 'Failed to save pending bulk buy order');
  }

  console.log('✅ Pending bulk buy order saved:', data);
  return data;
};

/**
 * Get pending bulk buy orders for a user
 * @param userId - User ID
 * @param isSubmitted - Optional: false = exclude submitted orders (default), true = only submitted orders
 */
export const getPendingBulkBuyOrders = async (
  userId: number,
  isSubmitted?: boolean
): Promise<Array<{
  id: string;
  user_id: number;
  transaction_id: string;
  payment_amount: number;
  subscription_plan_id: string;
  buyer_id: number;
  latitude: number;
  longitude: number;
  scrap_type: string | null;
  subcategories: SubcategoryDetail[] | null;
  quantity: number;
  preferred_price: number | null;
  when_needed: string | null;
  preferred_distance: number;
  location: string | null;
  additional_notes: string | null;
  documents: string[] | null;
  status: 'pending_payment' | 'payment_approved' | 'submitted' | 'cancelled';
  created_at: string;
  updated_at: string;
}>> => {
  let url = `${buildApiUrl(API_ROUTES.v2.bulkScrap.pendingOrders)}?user_id=${userId}`;
  if (isSubmitted !== undefined) {
    url += `&isSubmitted=${isSubmitted}`;
  }
  const headers = getApiHeaders();

  console.log('📤 Fetching pending bulk buy orders:', { userId, isSubmitted });

  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    const text = await response.text();
    console.error('❌ Non-JSON response received:', text.substring(0, 200));
    throw new Error(`Server returned non-JSON response (Status: ${response.status})`);
  }

  const data = await response.json();

  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to fetch pending bulk buy orders');
  }

  console.log(`✅ Fetched ${data.data?.length || 0} pending bulk buy orders`);
  return data.data || [];
};

