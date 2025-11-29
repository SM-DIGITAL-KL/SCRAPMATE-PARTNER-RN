/**
 * React Query hooks for profile management
 */

import { useApiQuery, useApiMutation } from './index';
import { getProfile, updateProfile, updateDeliveryMode, updateOnlineStatus, uploadProfileImage, uploadAadharCard, uploadDrivingLicense, ProfileData, UpdateProfileData } from '../services/api/v2/profile';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Query keys for profile
 */
export const profileQueryKeys = {
  all: ['profile'] as const,
  detail: (userId: string | number) => ['profile', 'detail', userId] as const,
  current: () => ['profile', 'current'] as const,
};

/**
 * Hook to get user profile
 */
export const useProfile = (userId: string | number | null | undefined, enabled = true) => {
  return useApiQuery({
    queryKey: profileQueryKeys.detail(userId!),
    queryFn: () => getProfile(userId!),
    enabled: enabled && !!userId,
  });
};

/**
 * Hook to update user profile
 */
export const useUpdateProfile = (userId: string | number) => {
  const queryClient = useQueryClient();

  return useApiMutation({
    mutationFn: (data: UpdateProfileData) => updateProfile(userId, data),
    invalidateQueries: [
      profileQueryKeys.detail(userId),
      profileQueryKeys.current(),
      profileQueryKeys.all,
    ],
    onSuccess: async (data) => {
      // Remove all profile-related cache entries to force fresh fetch
      console.log('🗑️  Invalidating React Query cache for profile');
      
      // Remove all profile queries to force refetch
      await queryClient.removeQueries({ queryKey: profileQueryKeys.all });
      await queryClient.removeQueries({ queryKey: profileQueryKeys.detail(userId) });
      await queryClient.removeQueries({ queryKey: profileQueryKeys.current() });
      
      // Invalidate queries to mark them as stale
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });
      
      // Set the new data in cache
      queryClient.setQueryData(profileQueryKeys.detail(userId), data);
      
      console.log('✅ React Query cache invalidated and updated with fresh data');
      console.log('✅ Updated profile data:', JSON.stringify(data, null, 2));
    },
  });
};

/**
 * Hook to update delivery mode for delivery boy
 */
export const useUpdateDeliveryMode = (userId: string | number) => {
  const queryClient = useQueryClient();

  return useApiMutation({
    mutationFn: (deliveryMode: 'deliver' | 'deliverPicking' | 'picker') => 
      updateDeliveryMode(userId, deliveryMode),
    invalidateQueries: [
      profileQueryKeys.detail(userId),
      profileQueryKeys.current(),
      profileQueryKeys.all,
    ],
    onSuccess: async (data) => {
      // Invalidate and update cache
      console.log('🗑️  Invalidating React Query cache for delivery mode update');
      
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      
      // Set the new data in cache
      queryClient.setQueryData(profileQueryKeys.detail(userId), data);
      
      console.log('✅ Delivery mode updated successfully');
    },
  });
};

/**
 * Hook to update online/offline status for delivery boy
 */
export const useUpdateOnlineStatus = (userId: string | number) => {
  const queryClient = useQueryClient();

  return useApiMutation({
    mutationFn: (isOnline: boolean) => 
      updateOnlineStatus(userId, isOnline),
    invalidateQueries: [
      profileQueryKeys.detail(userId),
      profileQueryKeys.current(),
      profileQueryKeys.all,
    ],
    onSuccess: async (data) => {
      // Invalidate and update cache
      console.log('🗑️  Invalidating React Query cache for online status update');
      
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      
      // Set the new data in cache
      queryClient.setQueryData(profileQueryKeys.detail(userId), data);
      
      console.log('✅ Online status updated successfully');
    },
  });
};

/**
 * Hook to upload profile image
 */
export const useUploadProfileImage = (userId: string | number) => {
  const queryClient = useQueryClient();

  return useApiMutation({
    mutationFn: (imageUri: string) => uploadProfileImage(userId, imageUri),
    invalidateQueries: [
      profileQueryKeys.detail(userId),
      profileQueryKeys.current(),
      profileQueryKeys.all,
    ],
    onSuccess: async (data) => {
      // Invalidate and update cache with the profile data from response
      console.log('🗑️  Invalidating React Query cache for profile image upload');
      
      // Remove all profile queries to force refetch
      await queryClient.removeQueries({ queryKey: profileQueryKeys.all });
      await queryClient.removeQueries({ queryKey: profileQueryKeys.detail(userId) });
      await queryClient.removeQueries({ queryKey: profileQueryKeys.current() });
      
      // Invalidate queries to mark them as stale
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });
      
      // Set the new profile data in cache
      if (data.profile) {
        queryClient.setQueryData(profileQueryKeys.detail(userId), data.profile);
      }
      
      console.log('✅ Profile image uploaded and cache updated');
    },
  });
};

/**
 * Hook to upload Aadhar card
 */
export const useUploadAadharCard = (userId: string | number) => {
  const queryClient = useQueryClient();

  return useApiMutation({
    mutationFn: (fileUri: string) => uploadAadharCard(userId, fileUri),
    invalidateQueries: [
      profileQueryKeys.detail(userId),
      profileQueryKeys.current(),
      profileQueryKeys.all,
    ],
    onSuccess: async (data) => {
      // Invalidate and update cache
      console.log('🗑️  Invalidating React Query cache for Aadhar card upload');
      
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      
      // Set the new profile data in cache if available
      if (data.profile) {
        queryClient.setQueryData(profileQueryKeys.detail(userId), data.profile);
      }
      
      console.log('✅ Aadhar card uploaded and cache updated');
    },
  });
};

/**
 * Hook to upload driving license
 */
export const useUploadDrivingLicense = (userId: string | number) => {
  const queryClient = useQueryClient();

  return useApiMutation({
    mutationFn: (fileUri: string) => uploadDrivingLicense(userId, fileUri),
    invalidateQueries: [
      profileQueryKeys.detail(userId),
      profileQueryKeys.current(),
      profileQueryKeys.all,
    ],
    onSuccess: async (data) => {
      // Invalidate and update cache
      console.log('🗑️  Invalidating React Query cache for driving license upload');
      
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userId) });
      
      // Set the new profile data in cache if available
      if (data.profile) {
        queryClient.setQueryData(profileQueryKeys.detail(userId), data.profile);
      }
      
      console.log('✅ Driving license uploaded and cache updated');
    },
  });
};

