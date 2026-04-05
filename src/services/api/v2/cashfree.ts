import { API_ROUTES, buildApiUrl, fetchWithLogging, getApiHeaders } from '../apiConfig';

export interface CashfreeCreateOrderPayload {
  order_amount: string | number;
  order_currency?: string;
  order_id?: string;
  order_note?: string;
  order_meta?: {
    return_url?: string;
    notify_url?: string;
    [key: string]: any;
  };
  customer_details: {
    customer_id: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
  };
  order_tags?: Record<string, string>;
}

export interface CashfreeCreateOrderResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    order_id: string;
    payment_session_id: string;
    order_status: string;
    cf_order_id?: string | null;
    environment?: 'SANDBOX' | 'PRODUCTION';
  } | null;
}

export interface CashfreeOrderStatusResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    order_id: string;
    order_status: string;
    payment_status?: string | null;
    cf_payment_id?: string | null;
    cf_order_id?: string | null;
    environment?: 'SANDBOX' | 'PRODUCTION';
    payments?: Array<Record<string, any>>;
  } | null;
}

const parseErrorMessage = async (response: Response, fallback: string) => {
  const raw = await response.text().catch(() => '');
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed?.msg || parsed?.message || parsed?.error || fallback;
  } catch {
    return raw || fallback;
  }
};

export const createCashfreeOrder = async (
  payload: CashfreeCreateOrderPayload
): Promise<CashfreeCreateOrderResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.cashfree.createOrder);
  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers: getApiHeaders(),
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to create Cashfree order'));
  }

  const data: CashfreeCreateOrderResponse = await response.json();
  if (data.status !== 'success' || !data.data?.payment_session_id || !data.data?.order_id) {
    throw new Error(data.msg || 'Failed to create Cashfree order');
  }
  return data;
};

export const getCashfreeOrderStatus = async (
  orderId: string
): Promise<CashfreeOrderStatusResponse> => {
  const url = buildApiUrl(API_ROUTES.v2.cashfree.getOrderStatus(orderId));
  const response = await fetchWithLogging(url, {
    method: 'GET',
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response, 'Failed to fetch Cashfree order status'));
  }

  const data: CashfreeOrderStatusResponse = await response.json();
  if (data.status !== 'success' || !data.data) {
    throw new Error(data.msg || 'Failed to fetch Cashfree order status');
  }
  return data;
};
