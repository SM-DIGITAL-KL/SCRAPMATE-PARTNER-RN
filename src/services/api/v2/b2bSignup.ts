/**
 * V2 B2B Signup API Service
 * Handles B2B business signup API calls
 */

import { buildApiUrl, getApiHeaders, fetchWithLogging, API_ROUTES } from '../apiConfig';

export interface DocumentUploadResponse {
  status: 'success' | 'error';
  msg: string;
  data: {
    document_url: string;
    document_type: string;
  } | null;
}

export interface B2BSignupData {
  companyName: string;
  gstNumber: string;
  panNumber: string;
  businessAddress: string;
  contactPersonName: string;
  contactNumber: string;
  contactEmail: string;
  businessLicenseUrl?: string;
  gstCertificateUrl?: string;
  addressProofUrl?: string;
  kycOwnerUrl?: string;
}

export interface B2BSignupResponse {
  status: 'success' | 'error';
  msg: string;
  data: any | null;
}

/**
 * Submit B2B signup data
 */
export const submitB2BSignup = async (
  userId: string | number,
  data: B2BSignupData
): Promise<any> => {
  const url = buildApiUrl(API_ROUTES.v2.b2bSignup.submit(userId));
  const headers = getApiHeaders();

  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to submit B2B signup');
  }

  const result: B2BSignupResponse = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to submit B2B signup');
  }

  return result.data;
};

/**
 * Upload B2B signup document
 */
export const uploadB2BDocument = async (
  userId: string | number,
  fileUri: string,
  documentType: 'business-license' | 'gst-certificate' | 'address-proof' | 'kyc-owner'
): Promise<{ document_url: string }> => {
  const url = buildApiUrl(API_ROUTES.v2.b2bSignup.uploadDocument(userId));
  const headers = getApiHeaders();

  // Create FormData for multipart/form-data upload
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    type: 'application/pdf',
    name: `${documentType}.pdf`,
  } as any);
  formData.append('documentType', documentType);

  // Remove Content-Type header to let fetch set it with boundary
  const { 'Content-Type': _, ...headersWithoutContentType } = headers;

  const response = await fetchWithLogging(url, {
    method: 'POST',
    headers: headersWithoutContentType,
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.msg || 'Failed to upload document');
  }

  const result: DocumentUploadResponse = await response.json();
  
  if (result.status === 'error' || !result.data) {
    throw new Error(result.msg || 'Failed to upload document');
  }

  return {
    document_url: result.data.document_url,
  };
};

