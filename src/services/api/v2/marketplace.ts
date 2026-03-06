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

interface SavedTendersApiResponse {
  status: 'success' | 'error';
  msg: string;
  data?: {
    total?: number;
    tenders?: SavedTender[];
    [key: string]: any;
  } | null;
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
