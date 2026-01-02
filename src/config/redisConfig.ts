/**
 * Redis Configuration
 * Upstash Redis credentials for location tracking
 * These values should match the backend aws.txt file
 */

// Upstash Redis REST API URL and Token
// These are loaded from environment or can be fetched from backend
export const REDIS_CONFIG = {
  // Default values - can be overridden
  REDIS_URL: 'https://open-honeybee-9527.upstash.io',
  REDIS_TOKEN: 'ASU3AAImcDJmYTQ1MjQwNGIzNTA0ZWNlYmRkMDU2OGM3OGRmZWY4NXAyOTUyNw',
};

/**
 * Initialize Redis config (can be called from app initialization)
 * This allows fetching credentials from backend if needed
 */
export const initializeRedisConfig = async (url?: string, token?: string) => {
  if (url && token) {
    REDIS_CONFIG.REDIS_URL = url;
    REDIS_CONFIG.REDIS_TOKEN = token;
    console.log('✅ Redis config initialized');
  }
};


