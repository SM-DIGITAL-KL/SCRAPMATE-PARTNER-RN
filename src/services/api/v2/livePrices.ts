/**
 * V2 Live Prices API Service
 * Handles live scrap prices API calls
 */

import { buildApiUrl, getApiHeaders } from '../apiConfig';

export interface LivePrice {
  id?: number;
  location: string;
  item: string;
  category: string | null;
  city: string | null;
  buy_price: string | null;
  sell_price: string | null;
  lme_price: string | null;
  mcx_price: string | null;
  injection_moulding: string | null;
  battery_price: string | null;
  pe_63: string | null;
  drum_scrap: string | null;
  blow: string | null;
  pe_100: string | null;
  crate: string | null;
  black_cable: string | null;
  white_pipe: string | null;
  grey_pvc: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface LivePricesResponse {
  status: string;
  msg: string;
  data: LivePrice[];
  cached?: boolean;
}

/**
 * Get all live prices
 * @param location - Optional filter by location
 * @param category - Optional filter by category
 */
export const getLivePrices = async (
  location?: string,
  category?: string
): Promise<LivePricesResponse> => {
  const params = new URLSearchParams();
  if (location) {
    params.append('location', location);
  }
  if (category) {
    params.append('category', category);
  }

  const url = buildApiUrl('/v2/live-prices');
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;

  const response = await fetch(fullUrl, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch live prices: ${response.statusText}`);
  }

  return response.json();
};
