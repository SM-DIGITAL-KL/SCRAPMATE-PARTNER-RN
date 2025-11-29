/**
 * Login hook using React Query
 */

import { useApiMutation, useApiQuery } from './index';
import { queryKeys } from '../services/api/queryKeys';

// API functions (replace with your actual API endpoints)
const sendOtpApi = async (phoneNumber: string) => {
  const response = await fetch(
    `${process.env.API_BASE_URL || 'https://api.scrapmate.co.in/api'}/auth/send-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone_number: phoneNumber }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Failed to send OTP');
  }

  return response.json();
};

const verifyOtpApi = async (phoneNumber: string, otp: string) => {
  const response = await fetch(
    `${process.env.API_BASE_URL || 'https://api.scrapmate.co.in/api'}/auth/verify-otp`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone_number: phoneNumber,
        otp: otp,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || 'Invalid OTP');
  }

  return response.json();
};

/**
 * Hook for sending OTP
 */
export const useSendOtp = () => {
  return useApiMutation({
    mutationFn: sendOtpApi,
    onSuccess: (data) => {
      console.log('OTP sent successfully:', data);
    },
    onError: (error) => {
      console.error('Failed to send OTP:', error);
    },
  });
};

/**
 * Hook for verifying OTP
 */
export const useVerifyOtp = () => {
  return useApiMutation({
    mutationFn: ({ phoneNumber, otp }: { phoneNumber: string; otp: string }) =>
      verifyOtpApi(phoneNumber, otp),
    invalidateQueries: [
      queryKeys.users.current(),
    ],
    onSuccess: async (data) => {
      console.log('OTP verified successfully:', data);
      // Store auth token and user data using auth service
      const { setAuthToken, setUserData } = require('../services/auth/authService');
      if (data?.token) {
        await setAuthToken(data.token);
      }
      if (data?.user) {
        await setUserData(data.user);
      }
    },
    onError: (error) => {
      console.error('Failed to verify OTP:', error);
    },
  });
};

