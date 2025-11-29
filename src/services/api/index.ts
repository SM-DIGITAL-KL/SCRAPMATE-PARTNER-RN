/**
 * Centralized API Exports
 * Export all API services and configuration from a single entry point
 */

// ==================== CONFIGURATION ====================
export {
  API_BASE_URL,
  API_KEY,
  API_TIMEOUT,
  API_ROUTES,
  API_CONFIG,
  getApiHeaders,
  buildApiUrl,
  getV2BaseUrl,
  fetchWithLogging,
  logApiCall,
} from './apiConfig';

// ==================== CLIENT UTILITIES ====================
export { ApiException, parseError } from './client';
export type { ApiError } from './client';

// ==================== V2 API SERVICES ====================
export {
  sendOtp,
  verifyOtp,
} from './v2/auth';
export type {
  LoginResponse,
  VerifyOtpResponse,
} from './v2/auth';

// Re-export shop types if needed
export * from './v2/shopTypes';

// ==================== QUERY CLIENT ====================
export { queryClient, resetQueryCache } from './queryClient';

// ==================== QUERY KEYS ====================
export { queryKeys } from './queryKeys';

