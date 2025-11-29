/**
 * API Client Configuration
 * Base configuration for all API requests
 * 
 * @deprecated Use apiConfig.ts for new code
 * This file is kept for backward compatibility
 */

import { API_CONFIG as NEW_API_CONFIG } from './apiConfig';

export const API_CONFIG = {
  // Base URL - Using centralized config
  baseURL: NEW_API_CONFIG.baseURL,
  timeout: NEW_API_CONFIG.timeout,
  headers: NEW_API_CONFIG.headers(false),
};

export interface ApiError {
  message: string;
  status?: number;
  data?: any;
}

/**
 * Custom error class for API errors
 */
export class ApiException extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiException';
    this.status = status;
    this.data = data;
  }
}

/**
 * Parse error response
 */
export const parseError = (error: any): ApiError => {
  if (error instanceof ApiException) {
    return {
      message: error.message,
      status: error.status,
      data: error.data,
    };
  }

  if (error?.response) {
    // Axios-like error response
    return {
      message: error.response.data?.message || error.response.statusText || 'An error occurred',
      status: error.response.status,
      data: error.response.data,
    };
  }

  if (error?.message) {
    return {
      message: error.message,
    };
  }

  return {
    message: 'An unexpected error occurred',
  };
};

