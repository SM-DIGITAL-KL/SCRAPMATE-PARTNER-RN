import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getActivePickup, 
  getAvailablePickupRequests, 
  acceptPickupRequest,
  PlacePickupRequestData,
  ActivePickup,
  PickupRequest
} from '../services/api/v2/orders';
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
    staleTime: 30 * 1000, // 30 seconds (active pickup changes frequently)
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

/**
 * Hook to fetch available pickup requests
 * @param userId - User ID
 * @param user_type - Type of user: 'R', 'S', 'SR', or 'D'
 * @param latitude - Optional latitude for distance filtering
 * @param longitude - Optional longitude for distance filtering
 * @param radius - Radius in km (default: 10)
 * @param enabled - Whether the query should run
 */
export const useAvailablePickupRequests = (
  userId: number | undefined,
  user_type: 'R' | 'S' | 'SR' | 'D',
  latitude?: number,
  longitude?: number,
  radius: number = 10,
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

/**
 * Hook to accept a pickup request
 */
export const useAcceptPickupRequest = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({
      orderId,
      userId,
      userType
    }: {
      orderId: number | string;
      userId: number;
      userType: 'R' | 'S' | 'SR' | 'D';
    }) => acceptPickupRequest(orderId, userId, userType),
    onSuccess: (data, variables) => {
      // Invalidate active pickup and available requests queries
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.orders.activePickup(variables.userId, variables.userType) 
      });
      queryClient.invalidateQueries({ 
        queryKey: queryKeys.orders.availablePickupRequests(variables.userId, variables.userType) 
      });
    },
  });
};



