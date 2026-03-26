/**
 * Marketplace API Service
 * Handles marketplace-related API calls.
 */

import { buildApiUrl, getApiHeaders } from '../apiConfig';

export interface SavedTenderDocument {
  id?: number;
  tender_id?: number;
  file_url?: string | null;
  file_name?: string | null;
  [key: string]: any;
}

export interface SavedTender {
  id: number;
  title?: string | null;
  location?: string | null;
  state?: string | null;
  state_name?: string | null;
  state_normalized?: string | null;
  closing_date?: string | null;
  submission_end_date?: string | null;
  tender_amount?: string | null;
  tender_value?: string | null;
  bids?: number | null;
  bid_count?: number | null;
  documents?: SavedTenderDocument[];
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

export interface MarketplaceInterestedPost {
  id: string;
  user_id: number;
  post_id: string;
  post_type: 'buy' | 'sell';
  owner_id?: number | null;
  owner_name?: string | null;
  post_title?: string | null;
  post_location?: string | null;
  post_price?: string | null;
  post_star?: number | null;
  post_image?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

export interface MarketplaceTenderRequest {
  id: string;
  user_id: number;
  user_name?: string | null;
  user_phone?: string | null;
  user_type?: string | null;
  requested_state: string;
  requested_state_normalized?: string | null;
  note?: string | null;
  source?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: any;
}

interface SavedTendersApiResponse {
  status: 'success' | 'error';
  msg: string;
  data?: {
    total?: number;
    tenders?: SavedTender[];
    [key: string]: any;
  } | null;
}

interface MarketplaceInterestsApiResponse {
  status: 'success' | 'error';
  msg: string;
  data?: MarketplaceInterestedPost[] | any;
}

interface MarketplaceTenderRequestsApiResponse {
  status: 'success' | 'error';
  msg: string;
  data?: MarketplaceTenderRequest[] | MarketplaceTenderRequest | any;
}

/**
 * Fetch saved tenders from DynamoDB-backed admin API endpoint.
 */
export const getSavedMarketplaceTenders = async (params?: { state?: string }): Promise<SavedTender[]> => {
  const state = String(params?.state || '').trim();
  const query = state ? `?state=${encodeURIComponent(state)}` : '';
  const url = buildApiUrl(`/accounts/tenders-saved${query}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  const result: SavedTendersApiResponse = await response.json();

  if (!response.ok || result.status !== 'success') {
    throw new Error(result?.msg || `Failed to fetch saved tenders (${response.status})`);
  }

  const tenders = result?.data?.tenders;
  return Array.isArray(tenders) ? tenders : [];
};

export const markMarketplacePostInterested = async (payload: {
  user_id: number;
  post_id: string;
  post_type: 'buy' | 'sell';
  owner_id?: number;
  owner_name?: string;
  post_title?: string;
  post_location?: string;
  post_price?: string;
  post_star?: number;
  post_image?: string;
  post_snapshot?: Record<string, any>;
}): Promise<MarketplaceInterestedPost> => {
  const url = buildApiUrl('/v2/marketplace/interests');
  const response = await fetch(url, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(payload),
  });

  const result: MarketplaceInterestsApiResponse = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result?.msg || `Failed to save interested post (${response.status})`);
  }
  return (result.data || {}) as MarketplaceInterestedPost;
};

export const getMarketplaceInterestedPosts = async (userId: number): Promise<MarketplaceInterestedPost[]> => {
  const url = buildApiUrl(`/v2/marketplace/interests?user_id=${encodeURIComponent(String(userId))}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: getApiHeaders(),
  });
  const result: MarketplaceInterestsApiResponse = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result?.msg || `Failed to fetch interested posts (${response.status})`);
  }
  return Array.isArray(result.data) ? result.data : [];
};

export const requestMarketplaceTender = async (payload: {
  user_id: number;
  requested_state: string;
  note?: string;
}): Promise<MarketplaceTenderRequest> => {
  const url = buildApiUrl('/v2/marketplace/tender-requests');
  const response = await fetch(url, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(payload),
  });
  const result: MarketplaceTenderRequestsApiResponse = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result?.msg || `Failed to submit tender request (${response.status})`);
  }
  return (result.data || {}) as MarketplaceTenderRequest;
};

export const getMarketplaceTenderRequestsByUser = async (userId: number): Promise<MarketplaceTenderRequest[]> => {
  const url = buildApiUrl(`/v2/marketplace/tender-requests?user_id=${encodeURIComponent(String(userId))}`);
  const response = await fetch(url, {
    method: 'GET',
    headers: getApiHeaders(),
  });
  const result: MarketplaceTenderRequestsApiResponse = await response.json();
  if (!response.ok || result.status !== 'success') {
    throw new Error(result?.msg || `Failed to fetch tender requests (${response.status})`);
  }
  return Array.isArray(result.data) ? result.data : [];
};
