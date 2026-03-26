/**
 * V2 Bulk Sell API
 * Handles bulk scrap sell requests
 * Both 'S' and 'R' type users can see and accept these requests
 */

import { buildApiUrl, getApiHeaders } from '../apiConfig';
import { API_ROUTES } from '../apiConfig';

export interface SubcategoryDetail {
  subcategory_id: number;
  subcategory_name: string;
  quantity: number; // in kgs
  asking_price?: number; // per kg
}

export interface BulkSellRequest {
  request_id?: number | string;
  seller_id: number;
  latitude: number;
  longitude: number;
  scrap_type?: string;
  subcategories?: SubcategoryDetail[];
  subcategory_id?: number;
  quantity: number; // in kgs
  asking_price?: number; // per kg
  preferred_distance?: number; // in km
  when_available?: string;
  location?: string;
  additional_notes?: string;
  documents?: Array<{ uri?: string; name: string; type: string; size?: number; s3Url?: string }>;
  // Payment fields
  payment_status?: string;
  payment_amount?: number;
  payment_moj_id?: string;
  payment_req_id?: string;
  invoice_id?: string;
  order_value?: number;
  post_star?: number;
}

export interface BulkSellResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: number;
    notified_users: {
      total: number;
      notified: number;
    };
  } | null;
}

/**
 * Create a bulk sell request
 * This will notify nearby 'S' and 'R' type users about the sell request
 */
export const createBulkSellRequest = async (
  request: BulkSellRequest
): Promise<BulkSellResponse> => {
  // AWS Lambda synchronous invoke payload hard-limit is 6MB.
  // Keep a safety margin for multipart boundaries and JSON fields.
  const MAX_LAMBDA_UPLOAD_BYTES = 5.5 * 1024 * 1024;
  const url = buildApiUrl(API_ROUTES.v2.bulkSell.create);
  const headers = getApiHeaders();

  console.log('📤 Creating bulk sell request:', {
    seller_id: request.seller_id,
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
    const preUploadedUrls = request.documents
      .map((doc) => String(doc.s3Url || '').trim())
      .filter((url) => url.startsWith('http://') || url.startsWith('https://'));

    // If all documents are pre-uploaded to S3, send lightweight JSON payload.
    if (preUploadedUrls.length === request.documents.length) {
      const jsonPayload: Record<string, any> = {
        ...request,
        documents: undefined,
        document_urls: preUploadedUrls,
      };
      body = JSON.stringify(jsonPayload);
    } else {
    const totalFileBytes = request.documents.reduce((sum, doc) => sum + (doc.size || 0), 0);
    if (totalFileBytes > MAX_LAMBDA_UPLOAD_BYTES) {
      throw new Error(
        'Selected files are too large for upload. Keep total media under ~5.5MB or reduce video size.'
      );
    }

    const formData = new FormData();
    
    formData.append('seller_id', request.seller_id.toString());
    if (request.request_id !== undefined && request.request_id !== null && request.request_id !== '') {
      formData.append('request_id', request.request_id.toString());
    }
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
    if (request.asking_price) {
      formData.append('asking_price', request.asking_price.toString());
    }
    if (request.preferred_distance !== undefined) {
      formData.append('preferred_distance', request.preferred_distance.toString());
    }
    if (request.when_available) {
      formData.append('when_available', request.when_available);
    }
    if (request.location) {
      formData.append('location', request.location);
    }
    if (request.additional_notes) {
      formData.append('additional_notes', request.additional_notes);
    }

    // Add documents
    request.documents.forEach((doc, index) => {
      if (!doc.uri) return;
      formData.append(`document${index + 1}`, {
        uri: doc.uri,
        type: doc.type || 'application/pdf',
        name: doc.name || `document${index + 1}.pdf`,
      } as any);
    });

    if (preUploadedUrls.length > 0) {
      formData.append('document_urls', JSON.stringify(preUploadedUrls));
    }

    body = formData;
    const { 'Content-Type': _, ...headersWithoutContentType } = headers;
    finalHeaders = headersWithoutContentType;
    }
  } else {
    body = JSON.stringify(request);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: finalHeaders,
    body: body as any,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Bulk sell request failed:', data);
    const rawMessage = data?.msg || data?.message || '';
    if (
      typeof rawMessage === 'string' &&
      rawMessage.includes('Request must be smaller than 6291456 bytes')
    ) {
      throw new Error(
        'Upload is too large for server limit (6MB). Reduce images/video size and try again.'
      );
    }
    throw new Error(data.msg || 'Failed to create bulk sell request');
  }

  console.log('✅ Bulk sell request created:', data);
  return data;
};

export interface BulkSellRequestItem {
  id: number;
  seller_id: number;
  seller_name: string | null;
  latitude: number;
  longitude: number;
  scrap_type: string | null;
  subcategories?: SubcategoryDetail[] | null;
  subcategory_id?: number | null;
  quantity: number; // in kgs
  asking_price?: number | null;
  preferred_distance: number; // in km
  when_available?: string | null;
  location?: string | null;
  additional_notes?: string | null;
  documents?: string[] | null;
  post_star?: number;
  status: string;
  created_at: string;
  updated_at: string;
  distance?: number; // Distance from user's location in km
  distance_km?: number;
  total_committed_quantity?: number; // Total quantity committed by all buyers
  accepted_buyers?: Array<{
    user_id: number;
    user_type: string;
    shop_id?: number | null;
    committed_quantity?: number;
    bidding_price?: number;
    status?: string;
    accepted_at: string;
    images?: string[] | null;
  }>;
}

export interface BulkSellRequestsResponse {
  status: 'success' | 'error';
  msg: string;
  data: BulkSellRequestItem[];
  pagination?: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
  };
}

export interface BulkFeedQueryOptions {
  page?: number;
  limit?: number;
  state?: string;
  sortBy?: 'created_at' | 'price' | 'post_star' | 'distance';
  sortOrder?: 'asc' | 'desc';
  includeAll?: boolean;
  minStar?: number;
  maxStar?: number;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Get bulk sell requests available for the user
 * Both 'S' and 'R' type users can see these requests
 */
export const getBulkSellRequests = async (
  userId: number,
  latitude?: number,
  longitude?: number,
  userType?: string,
  options?: BulkFeedQueryOptions
): Promise<BulkSellRequestItem[]> => {
  let url = `${buildApiUrl(API_ROUTES.v2.bulkSell.requests)}?user_id=${userId}`;
  
  if (userType) {
    url += `&user_type=${userType}`;
  }
  if (latitude !== undefined) {
    url += `&latitude=${latitude}`;
  }
  if (longitude !== undefined) {
    url += `&longitude=${longitude}`;
  }
  if (options?.page !== undefined) {
    url += `&page=${options.page}`;
  }
  if (options?.limit !== undefined) {
    url += `&limit=${options.limit}`;
  }
  if (options?.state) {
    url += `&state=${encodeURIComponent(options.state)}`;
  }
  if (options?.sortBy) {
    url += `&sort_by=${encodeURIComponent(options.sortBy)}`;
  }
  if (options?.sortOrder) {
    url += `&sort_order=${encodeURIComponent(options.sortOrder)}`;
  }
  if (options?.includeAll) {
    url += '&include_all=true';
  }
  if (options?.minStar !== undefined) {
    url += `&min_star=${options.minStar}`;
  }
  if (options?.maxStar !== undefined) {
    url += `&max_star=${options.maxStar}`;
  }
  if (options?.minPrice !== undefined) {
    url += `&min_price=${options.minPrice}`;
  }
  if (options?.maxPrice !== undefined) {
    url += `&max_price=${options.maxPrice}`;
  }

  const headers = getApiHeaders();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    // Check if response is JSON
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response from getBulkSellRequests:', text.substring(0, 200));
      throw new Error('Server returned non-JSON response. Please check server logs.');
    }

    const data: BulkSellRequestsResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Get bulk sell requests failed:', data);
      throw new Error(data.msg || 'Failed to get bulk sell requests');
    }

    return data.data || [];
  } catch (error: any) {
    console.error('❌ Error getting bulk sell requests:', error);
    throw error;
  }
};

/**
 * Get bulk sell requests accepted by the user
 */
export const getAcceptedBulkSellRequests = async (
  userId: number,
  latitude?: number,
  longitude?: number,
  userType?: string
): Promise<BulkSellRequestItem[]> => {
  let url = `${buildApiUrl(API_ROUTES.v2.bulkSell.accepted)}?user_id=${userId}`;
  
  if (userType) {
    url += `&user_type=${userType}`;
  }
  if (latitude !== undefined) {
    url += `&latitude=${latitude}`;
  }
  if (longitude !== undefined) {
    url += `&longitude=${longitude}`;
  }

  const headers = getApiHeaders();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response from getAcceptedBulkSellRequests:', text.substring(0, 200));
      throw new Error('Server returned non-JSON response. Please check server logs.');
    }

    const data: BulkSellRequestsResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Get accepted bulk sell requests failed:', data);
      throw new Error(data.msg || 'Failed to get accepted bulk sell requests');
    }

    return data.data || [];
  } catch (error: any) {
    console.error('❌ Error getting accepted bulk sell requests:', error);
    throw error;
  }
};

/**
 * Get bulk sell requests created by a specific seller
 */
export const getBulkSellRequestsBySeller = async (
  sellerId: number
): Promise<BulkSellRequestItem[]> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkSell.bySeller(sellerId));
  const headers = getApiHeaders();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
    });

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('❌ Non-JSON response from getBulkSellRequestsBySeller:', text.substring(0, 200));
      throw new Error('Server returned non-JSON response. Please check server logs.');
    }

    const data: BulkSellRequestsResponse = await response.json();

    if (!response.ok) {
      console.error('❌ Get bulk sell requests by seller failed:', data);
      throw new Error(data.msg || 'Failed to get bulk sell requests by seller');
    }

    return data.data || [];
  } catch (error: any) {
    console.error('❌ Error getting bulk sell requests by seller:', error);
    throw error;
  }
};

export interface AcceptBulkSellRequestParams {
  buyer_id: number;
  user_type: string;
  committed_quantity: number;
  bidding_price?: number;
  images?: Array<{ uri: string; type?: string; fileName?: string }>;
}

export interface AcceptBulkSellResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: number;
    buyer_id: number;
    committed_quantity: number;
    total_committed_quantity: number;
    request_status: string;
  } | null;
}

/**
 * Accept/buy from a bulk sell request
 * S/R/SR/M users can accept
 */
export const acceptBulkSellRequest = async (
  requestId: number,
  params: AcceptBulkSellRequestParams
): Promise<AcceptBulkSellResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkSell.accept(requestId));
  let headers: any = getApiHeaders();

  // If images are present, use FormData; otherwise use JSON
  let body: any;

  if (params.images && params.images.length > 0) {
    const formData = new FormData();
    
    formData.append('buyer_id', params.buyer_id.toString());
    formData.append('user_type', params.user_type);
    formData.append('committed_quantity', params.committed_quantity.toString());
    
    if (params.bidding_price !== undefined) {
      formData.append('bidding_price', params.bidding_price.toString());
    }

    // Add images
    params.images.forEach((image, index) => {
      formData.append(`image${index + 1}`, {
        uri: image.uri,
        type: image.type || 'image/jpeg',
        name: image.fileName || `image${index + 1}.jpg`,
      } as any);
    });

    body = formData;
    // Remove Content-Type header to let fetch set it with boundary
    const { 'Content-Type': _, ...headersWithoutContentType } = headers;
    headers = headersWithoutContentType;
  } else {
    body = JSON.stringify({
      buyer_id: params.buyer_id,
      user_type: params.user_type,
      committed_quantity: params.committed_quantity,
      bidding_price: params.bidding_price,
    });
  }

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: body as any,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Accept bulk sell request failed:', data);
    throw new Error(data.msg || 'Failed to accept bulk sell request');
  }

  return data;
};

export interface RejectBulkSellRequestParams {
  buyer_id: number;
  user_type: string;
  rejection_reason?: string;
}

export interface RejectBulkSellResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: number;
    buyer_id: number;
  } | null;
}

/**
 * Reject a bulk sell request
 */
export const rejectBulkSellRequest = async (
  requestId: number,
  params: RejectBulkSellRequestParams
): Promise<RejectBulkSellResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkSell.reject(requestId));
  const headers = getApiHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(params),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Reject bulk sell request failed:', data);
    throw new Error(data.msg || 'Failed to reject bulk sell request');
  }

  return data;
};

export interface RemoveBuyerFromBulkSellResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    request_id: number;
    buyer_removed: boolean;
    removed_buyer_id: number;
    total_committed_quantity: number;
    request_status: string;
  } | null;
}

/**
 * Remove a buyer from accepted buyers list (seller only)
 */
export const removeBuyerFromBulkSellRequest = async (
  requestId: number,
  sellerId: number,
  buyerUserId: number,
  reason?: string
): Promise<RemoveBuyerFromBulkSellResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkSell.removeBuyer(requestId));
  const headers = getApiHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      seller_id: sellerId,
      buyer_user_id: buyerUserId,
      reason: reason || null,
    }),
  });

  const data: RemoveBuyerFromBulkSellResponse = await response.json();
  if (!response.ok || data.status === 'error') {
    throw new Error(data.msg || 'Failed to remove buyer from bulk sell request');
  }

  return data;
};







/**
 * Cancel a bulk sell request
 */
export const cancelBulkSellRequest = async (
  requestId: number
): Promise<{ status: string; msg: string }> => {
  const url = buildApiUrl(API_ROUTES.v2.bulkSell.cancel(requestId));
  const headers = getApiHeaders();

  const response = await fetch(url, {
    method: 'POST',
    headers,
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Cancel bulk sell request failed:', data);
    throw new Error(data.msg || 'Failed to cancel bulk sell request');
  }

  return data;
};
