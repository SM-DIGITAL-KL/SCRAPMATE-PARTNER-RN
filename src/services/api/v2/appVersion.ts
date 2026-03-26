import { buildApiUrl, getApiHeaders, fetchWithLogging } from '../apiConfig';
import { APP_VERSION } from '../../../constants/version';

export interface AppVersionResponse {
  status: string;
  msg: string;
  data: {
    appVersion: string;
  };
}

const extractNumericVersion = (version: string): string => {
  if (!version || typeof version !== 'string') return '0.0.0';
  const match = version.trim().match(/\d+(?:\.\d+)*/);
  return match ? match[0] : '0.0.0';
};

/**
 * Get the latest app version from the backend
 */
export const getLatestAppVersion = async (): Promise<string> => {
  try {
    const url = buildApiUrl('/v2/app-version');
    console.log('🌐 Fetching app version from:', url);
    const response = await fetchWithLogging(url, {
      method: 'GET',
      headers: getApiHeaders(true),
    });

    if (!response.ok) {
      console.warn('⚠️ App version check failed:', response.status, response.statusText);
      return APP_VERSION;
    }

    const data: AppVersionResponse = await response.json();
    console.log('📦 App version API response:', JSON.stringify(data, null, 2));

    if (data.status === 'success' && data.data?.appVersion) {
      console.log(`✅ Retrieved latest version from API: ${data.data.appVersion}`);
      return data.data.appVersion;
    }
    console.warn('⚠️ Invalid API response format, using current version');
    // Fallback to current version if API fails
    return APP_VERSION;
  } catch (error) {
    console.error('❌ Error fetching latest app version:', error);
    // Return current version on error to avoid blocking the app
    return APP_VERSION;
  }
};

/**
 * Compare version strings (e.g., "1.0.8" vs "1.0.9")
 * Returns: 1 if version1 > version2, -1 if version1 < version2, 0 if equal
 */
export const compareVersions = (version1: string, version2: string): number => {
  const cleanVersion1 = extractNumericVersion(version1);
  const cleanVersion2 = extractNumericVersion(version2);

  const v1Parts = cleanVersion1.split('.').map((part) => Number.parseInt(part, 10) || 0);
  const v2Parts = cleanVersion2.split('.').map((part) => Number.parseInt(part, 10) || 0);
  
  const maxLength = Math.max(v1Parts.length, v2Parts.length);
  
  for (let i = 0; i < maxLength; i++) {
    const v1Part = v1Parts[i] || 0;
    const v2Part = v2Parts[i] || 0;
    
    if (v1Part > v2Part) return 1;
    if (v1Part < v2Part) return -1;
  }
  
  return 0;
};

/**
 * Check if an update is required
 */
export const checkForUpdate = async (): Promise<{ updateAvailable: boolean; latestVersion: string; currentVersion: string }> => {
  const currentVersion = APP_VERSION;
  const latestVersion = await getLatestAppVersion();
  const compareResult = compareVersions(latestVersion, currentVersion);
  const updateAvailable = compareResult > 0;

  console.log('📊 Version comparison:', {
    currentVersion,
    latestVersion,
    updateAvailable,
    compareResult,
  });
  
  return {
    updateAvailable,
    latestVersion,
    currentVersion,
  };
};
