/**
 * Centralized API Configuration
 * Single source of truth for API base URL, routes, and configuration
 */

// ==================== BASE CONFIGURATION ====================

/**
 * API Base URL Configuration
 * Update this value to change the API base URL
 * For production, use environment variables or build-time configuration
 * Note: Base URL should include /api at the end since routes are mounted at /api/v2
 */

// For ngrok tunnel (uncomment to use)
  //  export const API_BASE_URL = 'https://5be164ada1bb.ngrok-free.app/api';
// For AWS Lambda (uncomment to use)
  export const API_BASE_URL = 'https://tvwi76fg9d.execute-api.ap-south-1.amazonaws.com/api';

/**
 * API Key for authentication
 * Update this value or set via environment variable
 * For production, use secure storage or environment variables
 */
export const API_KEY: string = 'zyubkfzeumeoviaqzcsrvfwdzbiwnlnn';

/**
 * API Timeout in milliseconds
 */
export const API_TIMEOUT = 30000; // 30 seconds

/**
 * Common API Headers
 */
export const getApiHeaders = (includeApiKey: boolean = true) => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  // Add ngrok skip browser warning header
  if (API_BASE_URL.includes('ngrok-free.app')) {
    headers['ngrok-skip-browser-warning'] = 'true';
  }

  if (includeApiKey && API_KEY) {
    headers['api-key'] = API_KEY;
  }

  return headers;
};

// ==================== API ROUTES ====================

/**
 * API Route Definitions
 * Centralized route paths for all API endpoints
 */
export const API_ROUTES = {
  // V2 API Routes
  V2: '/v2',
  v2: {
    // Auth Routes
    auth: {
      login: '/v2/auth/login',
      verifyOtp: '/v2/auth/verify-otp',
    },
    // Shop Type Routes
    shopTypes: {
      list: '/v2/shop-types',
      userDashboards: (userId: string | number) => `/v2/user/dashboards/${userId}`,
      validateDashboard: '/v2/user/validate-dashboard',
      switchDashboard: '/v2/user/switch-dashboard',
    },
    // Profile Routes
    profile: {
      get: (userId: string | number) => `/v2/profile/${userId}`,
      update: (userId: string | number) => `/v2/profile/${userId}`,
      updateDeliveryMode: (userId: string | number) => `/v2/profile/${userId}/delivery-mode`,
      updateOnlineStatus: (userId: string | number) => `/v2/profile/${userId}/online-status`,
      uploadImage: (userId: string | number) => `/v2/profile/${userId}/image`,
      uploadAadhar: (userId: string | number) => `/v2/profile/${userId}/aadhar`,
      uploadDrivingLicense: (userId: string | number) => `/v2/profile/${userId}/driving-license`,
      completeDeliverySignup: (userId: string | number) => `/v2/profile/${userId}/complete-delivery-signup`,
      deleteAccount: (userId: string | number) => `/v2/profile/${userId}`,
    },
    // B2B Signup Routes
    b2bSignup: {
      uploadDocument: (userId: string | number) => `/v2/b2b-signup/${userId}/document`,
      submit: (userId: string | number) => `/v2/b2b-signup/${userId}`,
    },
    // Subscription Packages Routes
    subscriptionPackages: '/v2/subscription-packages',
    // Category Routes
    categories: {
      list: '/v2/categories',
      subcategories: '/v2/subcategories',
      withSubcategories: '/v2/categories/with-subcategories',
    },
  },
  // Legacy API Routes (if needed)
  legacy: {
    auth: {
      login: '/auth/login',
      register: '/auth/register',
    },
  },
} as const;

// ==================== HELPER FUNCTIONS ====================

/**
 * Build full API URL from route
 */
export const buildApiUrl = (route: string): string => {
  // If route already includes the base, return as is
  if (route.startsWith('http')) {
    return route;
  }

  // Remove leading slash if present
  const cleanRoute = route.startsWith('/') ? route : `/${route}`;

  // Build full URL
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${baseUrl}${cleanRoute}`;
};

/**
 * Get V2 API base URL
 */
export const getV2BaseUrl = (): string => {
  // Base URL already includes /api, so just append /v2
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL.slice(0, -1) : API_BASE_URL;
  return `${baseUrl}/v2`;
};

// ==================== API LOGGING ====================

/**
 * Log API request and response
 */
export const logApiCall = (
  url: string,
  method: string,
  requestBody?: any,
  response?: any,
  status?: number,
  error?: any
) => {
  if (!__DEV__) return; // Only log in development

  const timestamp = new Date().toISOString();

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`📡 API Call - ${timestamp}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`🌐 URL: ${url}`);
  console.log(`📤 Method: ${method}`);

  if (requestBody) {
    console.log(`📦 Request Body:`, JSON.stringify(requestBody, null, 2));
  }

  if (status) {
    console.log(`📊 Status: ${status} ${status >= 200 && status < 300 ? '✅' : '❌'}`);
  }

  if (response) {
    console.log(`📥 Response:`, JSON.stringify(response, null, 2));
  }

  if (error) {
    console.log(`❌ Error:`, error);
  }

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
};

/**
 * Enhanced fetch with automatic logging
 */
export const fetchWithLogging = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const method = options.method || 'GET';
  let requestBody: any = undefined;

  // Parse request body if present
  if (options.body) {
    try {
      requestBody = typeof options.body === 'string'
        ? JSON.parse(options.body)
        : options.body;
    } catch (e) {
      requestBody = options.body;
    }
  }

  // Log request
  logApiCall(url, method, requestBody);

  try {
    const response = await fetch(url, options);
    const responseClone = response.clone(); // Clone to read body without consuming it

    // Try to parse response as JSON
    let responseData: any = null;
    try {
      responseData = await responseClone.json();
    } catch (e) {
      // If not JSON, try text
      try {
        const textClone = response.clone();
        responseData = await textClone.text();
      } catch (e2) {
        responseData = 'Unable to parse response';
      }
    }

    // Log response
    logApiCall(url, method, requestBody, responseData, response.status);

    // Return the original response (body not consumed)
    return response;
  } catch (error: any) {
    // Log error
    logApiCall(url, method, requestBody, null, undefined, error);
    throw error;
  }
};

// ==================== CONFIGURATION EXPORT ====================

/**
 * Complete API Configuration Object
 */
export const API_CONFIG = {
  baseURL: API_BASE_URL,
  v2BaseURL: getV2BaseUrl(),
  apiKey: API_KEY,
  timeout: API_TIMEOUT,
  routes: API_ROUTES,
  headers: getApiHeaders,
  buildUrl: buildApiUrl,
} as const;

// ==================== DEBUG LOGGING ====================

if (__DEV__) {
  console.log('📡 API Configuration:', {
    baseURL: API_BASE_URL,
    v2BaseURL: getV2BaseUrl(),
    apiKey: API_KEY && API_KEY.length > 0 ? `${API_KEY.substring(0, 4)}...` : 'Not Set',
    routes: {
      login: buildApiUrl(API_ROUTES.v2.auth.login),
      verifyOtp: buildApiUrl(API_ROUTES.v2.auth.verifyOtp),
    },
  });
}

