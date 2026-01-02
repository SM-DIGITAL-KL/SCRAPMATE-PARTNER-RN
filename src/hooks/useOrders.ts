import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getActivePickup, 
  getAllActivePickups,
  getAvailablePickupRequests, 
  acceptPickupRequest,
  ActivePickup,
  PickupRequest
} from '../services/api/v2/orders';
import { 
  getBulkScrapRequests, 
  getAcceptedBulkScrapRequests,
  getBulkScrapRequestsByBuyer,
  acceptBulkScrapRequest,
  rejectBulkScrapRequest,
  BulkScrapRequest 
} from '../services/api/v2/bulkScrap';
import {
  getBulkSellRequests,
  getAcceptedBulkSellRequests,
  getBulkSellRequestsBySeller,
  acceptBulkSellRequest,
  rejectBulkSellRequest,
  BulkSellRequestItem
} from '../services/api/v2/bulkSell';
import { queryKeys } from '../services/api/queryKeys';

/**
 * Hook to fetch active pickup order for a user
 * @param userId - User ID
 * @param user_type - Type of user: 'R', 'S', 'SR', or 'D'
 * @param enabled - Whether the query should run
 */
export const useActivePickup = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D',
  enabled: boolean = true
) => {
  return useQuery<ActivePickup | null>({
    queryKey: queryKeys.orders.activePickup(userId, user_type),
    queryFn: () => getActivePickup(userId!, user_type),
    enabled: enabled && !!userId,
    staleTime: 10 * 1000, // 10 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch all active pickups for a user
 */
export const useAllActivePickups = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D',
  enabled: boolean = true
) => {
  return useQuery<ActivePickup[]>({
    queryKey: [...queryKeys.orders.all, 'allActivePickups', userId, user_type],
    queryFn: () => getAllActivePickups(userId!, user_type),
    enabled: enabled && !!userId,
    staleTime: 10 * 1000,
    gcTime: 5 * 60 * 1000,
  });
};

/**
 * Hook to fetch available pickup requests for a user
 */
export const useAvailablePickupRequests = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D',
  latitude?: number,
  longitude?: number,
  radius?: number,
  enabled: boolean = true
) => {
  return useQuery<PickupRequest[]>({
    queryKey: queryKeys.orders.availablePickupRequests(userId, user_type, latitude, longitude, radius),
    queryFn: () => getAvailablePickupRequests(userId!, user_type, latitude, longitude, radius),
    enabled: enabled && !!userId,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useAcceptPickupRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: { orderId: number | string; userId: number; userType: 'R' | 'S' | 'SR' | 'D' }) => {
      // Destructure the object and pass parameters correctly
      return acceptPickupRequest(data.orderId, data.userId, data.userType);
    },
    onSuccess: () => {
      // Invalidate all order-related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
    },
  });
};

/**
 * Hook to fetch bulk scrap purchase requests for a user
 * Returns requests where the user is within the request's preferred_distance
 */
export const useBulkScrapRequests = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D' | string | undefined,
  latitude?: number,
  longitude?: number,
  enabled: boolean = true
) => {
  // Backend can fetch shop location if not provided, so we don't require lat/lng
  const isEnabled = enabled && !!userId && !!user_type;
  
  console.log('🔍 useBulkScrapRequests: Hook called with:', {
    userId,
    user_type,
    latitude,
    longitude,
    enabled,
    isEnabled,
    latitudeDefined: latitude !== undefined,
    longitudeDefined: longitude !== undefined
  });

  return useQuery<BulkScrapRequest[]>({
    queryKey: queryKeys.bulkScrap.requests(userId, user_type, latitude, longitude),
    queryFn: async () => {
      console.log('📤 useBulkScrapRequests: Making API call with params:', {
        userId,
        user_type,
        latitude,
        longitude
      });
      try {
        const result = await getBulkScrapRequests(userId!, latitude, longitude, user_type);
        console.log('✅ useBulkScrapRequests: API call successful, received:', result?.length || 0, 'requests');
        return result;
      } catch (error: any) {
        console.error('❌ useBulkScrapRequests: API call failed:', error?.message || error);
        throw error;
      }
    },
    enabled: isEnabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });
};

/**
 * Hook to accept a bulk scrap purchase request
 */
export const useAcceptBulkScrapRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      requestId,
      userId,
      userType,
      quantity,
      biddingPrice,
      images,
    }: {
      requestId: number;
      userId: number;
      userType: 'R' | 'S' | 'SR';
      quantity?: number;
      biddingPrice?: number;
      images?: Array<{ uri: string; type?: string; name?: string }>;
    }) => {
      return acceptBulkScrapRequest(
        requestId,
        userId,
        userType,
        quantity,
        biddingPrice,
        images
      );
    },
    onSuccess: () => {
      // Invalidate bulk scrap queries
      queryClient.invalidateQueries({ queryKey: queryKeys.bulkScrap.all });
    },
  });
};

/**
 * Hook to reject a bulk scrap purchase request
 */
export const useRejectBulkScrapRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      requestId,
      vendor_id,
      user_type,
      rejection_reason,
    }: {
      requestId: number;
      vendor_id: number;
      user_type: string;
      rejection_reason?: string;
    }) => {
      return rejectBulkScrapRequest(requestId, {
        vendor_id,
        user_type,
        rejection_reason,
      });
    },
    onSuccess: () => {
      // Invalidate bulk scrap queries
      queryClient.invalidateQueries({ queryKey: queryKeys.bulkScrap.all });
    },
  });
};

/**
 * Hook to fetch bulk scrap purchase requests accepted by the user
 */
export const useAcceptedBulkScrapRequests = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D' | string | undefined,
  latitude?: number,
  longitude?: number,
  enabled: boolean = true
) => {
  const isEnabled = enabled && !!userId && !!user_type;

  return useQuery<BulkScrapRequest[]>({
    queryKey: [...queryKeys.bulkScrap.all, 'accepted', userId, user_type, latitude, longitude],
    queryFn: async () => {
      console.log('📤 useAcceptedBulkScrapRequests: Making API call with params:', {
        userId,
        user_type,
        latitude,
        longitude
      });
      try {
        const result = await getAcceptedBulkScrapRequests(userId!, latitude, longitude, user_type);
        console.log('✅ useAcceptedBulkScrapRequests: API call successful, received:', result?.length || 0, 'requests');
        return result;
      } catch (error: any) {
        console.error('❌ useAcceptedBulkScrapRequests: API call failed:', error?.message || error);
        throw error;
      }
    },
    enabled: isEnabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });
};

/**
 * Hook to fetch bulk scrap purchase requests created by a buyer
 */
export const useBulkScrapRequestsByBuyer = (
  buyerId: number | undefined,
  enabled: boolean = true
) => {
  const isEnabled = enabled && !!buyerId;

  return useQuery<BulkScrapRequest[]>({
    queryKey: [...queryKeys.bulkScrap.all, 'byBuyer', buyerId],
    queryFn: async () => {
      console.log('📤 useBulkScrapRequestsByBuyer: Making API call with params:', {
        buyerId
      });
      try {
        const result = await getBulkScrapRequestsByBuyer(buyerId!);
        console.log('✅ useBulkScrapRequestsByBuyer: API call successful, received:', result?.length || 0, 'requests');
        return result;
      } catch (error: any) {
        console.error('❌ useBulkScrapRequestsByBuyer: API call failed:', error?.message || error);
        throw error;
      }
    },
    enabled: isEnabled,
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
    retryDelay: 1000,
  });
};

/**
 * Hook to fetch bulk sell requests for a user
 * Only 'S' type users can see these requests
 */
export const useBulkSellRequests = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D' | string | undefined,
  latitude?: number,
  longitude?: number,
  enabled: boolean = true
) => {
  const isEnabled = enabled && !!userId && !!user_type;

  return useQuery<BulkSellRequestItem[]>({
    queryKey: queryKeys.bulkSell.requests(userId, user_type, latitude, longitude),
    queryFn: async () => {
      const result = await getBulkSellRequests(userId!, latitude, longitude, user_type);
      return result;
    },
    enabled: isEnabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });
};

/**
 * Hook to fetch accepted bulk sell requests for a user
 */
export const useAcceptedBulkSellRequests = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D' | string | undefined,
  latitude?: number,
  longitude?: number,
  enabled: boolean = true
) => {
  const isEnabled = enabled && !!userId && !!user_type;

  return useQuery<BulkSellRequestItem[]>({
    queryKey: queryKeys.bulkSell.accepted(userId, user_type, latitude, longitude),
    queryFn: async () => {
      const result = await getAcceptedBulkSellRequests(userId!, latitude, longitude, user_type);
      return result;
    },
    enabled: isEnabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });
};

/**
 * Hook to fetch bulk sell requests created by a seller
 */
export const useBulkSellRequestsBySeller = (
  sellerId: number | undefined,
  enabled: boolean = true
) => {
  const isEnabled = enabled && !!sellerId;

  return useQuery<BulkSellRequestItem[]>({
    queryKey: queryKeys.bulkSell.bySeller(sellerId!),
    queryFn: async () => {
      const result = await getBulkSellRequestsBySeller(sellerId!);
      return result;
    },
    enabled: isEnabled,
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
    retry: 2,
    retryDelay: 1000,
  });
};

/**
 * Hook to accept a bulk sell request
 */
export const useAcceptBulkSellRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      requestId,
      buyer_id,
      user_type,
      committed_quantity,
      bidding_price,
      images,
    }: {
      requestId: number;
      buyer_id: number;
      user_type: string;
      committed_quantity: number;
      bidding_price?: number;
      images?: Array<{ uri: string; type?: string; fileName?: string }>;
    }) => {
      return acceptBulkSellRequest(requestId, {
        buyer_id,
        user_type,
        committed_quantity,
        bidding_price,
        images,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bulkSell.all });
    },
  });
};

/**
 * Hook to reject a bulk sell request
 */
export const useRejectBulkSellRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      requestId,
      buyer_id,
      user_type,
      rejection_reason,
    }: {
      requestId: number;
      buyer_id: number;
      user_type: string;
      rejection_reason?: string;
    }) => {
      return rejectBulkSellRequest(requestId, {
        buyer_id,
        user_type,
        rejection_reason,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bulkSell.all });
    },
  });
};
