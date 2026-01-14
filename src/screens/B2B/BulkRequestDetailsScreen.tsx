import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Alert, Linking, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { BulkScrapRequest, startPickupForBulkRequest, removeVendorFromBulkRequest, getBulkScrapRequestsByBuyer, updateBulkRequestBuyerStatus } from '../../services/api/v2/bulkScrap';
import { SectionCard } from '../../components/SectionCard';
import { BulkRequestMapView } from '../../components/BulkRequestMapView';
import { getProfile } from '../../services/api/v2/profile';
import { getLocationByOrder } from '../../services/api/v2/location';
import { getUserData } from '../../services/auth/authService';
import { locationTrackingService } from '../../services/location/locationTrackingService';
import { arrivedLocation, completePickup } from '../../services/api/v2/orders';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

interface VendorWithLocation {
  user_id: number;
  user_type: string;
  shop_id?: number | null;
  committed_quantity?: number;
  bidding_price?: number;
  accepted_at?: string;
  status?: string;
  shopname?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  liveLocation?: { latitude: number; longitude: number } | null;
  order_id?: number;
  order_number?: number;
  order_status?: number; // Order status (2=Accepted, 3=Pickup Initiated, 4=Arrived, 5=Completed)
  phone?: string;
  contact?: string;
  images?: string[]; // Array of image URLs uploaded by vendor
}

const BulkRequestDetailsScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const queryClient = useQueryClient();
  
  const { request: initialRequest } = route.params || {};
  const [request, setRequest] = useState<BulkScrapRequest | null>(initialRequest || null);
  const [vendorsWithLocations, setVendorsWithLocations] = useState<VendorWithLocation[]>([]);
  const [loadingVendors, setLoadingVendors] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [startingPickup, setStartingPickup] = useState(false);
  const [markingArrived, setMarkingArrived] = useState(false);
  const [completingPickup, setCompletingPickup] = useState(false);
  const [removingVendor, setRemovingVendor] = useState<number | null>(null);
  const [markingVendorArrived, setMarkingVendorArrived] = useState<number | null>(null);
  const [completingVendorPickup, setCompletingVendorPickup] = useState<number | null>(null);
  
  // Check if current user is the buyer/creator of this request
  const isBuyer = userData?.id && request?.buyer_id && userData.id === request.buyer_id;
  
  // Get buyer's current status from request (check both buyer_status and status fields)
  const buyerStatus = (request as any)?.buyer_status || (request as any)?.status || 'pending';
  
  // Function to refetch request data after status changes
  const refetchRequest = async () => {
    if (!request?.id || !userData?.id) return;
    
    try {
      console.log('🔄 Refetching bulk request data after status change...');
      const updatedRequests = await getBulkScrapRequestsByBuyer(userData.id);
      const updatedRequest = updatedRequests.find((r: any) => r.id === request.id);
      
      if (updatedRequest) {
        console.log('✅ Updated request data received:', {
          id: updatedRequest.id,
          status: updatedRequest.status,
          buyer_status: (updatedRequest as any)?.buyer_status
        });
        setRequest(updatedRequest);
        // Update route params so navigation back also has updated data
        navigation.setParams({ request: updatedRequest });
      } else {
        console.warn('⚠️ Updated request not found in refetch results');
      }
    } catch (error) {
      console.error('❌ Error refetching request:', error);
    }
  };
  
  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);
  
  // Update request when route params change (e.g., after navigation back with updated data)
  useEffect(() => {
    if (route.params?.request) {
      setRequest(route.params.request);
    }
  }, [route.params?.request]);

  // Fetch request by ID if only requestId is provided (not the full request object)
  useEffect(() => {
    const fetchRequestById = async () => {
      // If we already have a request, don't fetch
      if (request) return;
      
      // If requestId is provided but no request object, fetch it
      const requestId = route.params?.requestId;
      if (requestId && userData?.id) {
        try {
          console.log('🔄 Fetching bulk request by ID:', requestId, 'for user:', userData.id);
          setRefreshing(true);
          
          // Fetch all requests by buyer (includes completed requests)
          const requests = await getBulkScrapRequestsByBuyer(userData.id);
          console.log(`📋 Fetched ${requests.length} bulk requests, searching for ID: ${requestId}`);
          
          // Try to find the request by ID (handle both string and number comparison)
          const foundRequest = requests.find((r: any) => {
            const rId = String(r.id || r.request_id || '');
            const searchId = String(requestId);
            const match = rId === searchId || rId === String(Number(searchId)) || String(Number(rId)) === searchId;
            if (match) {
              console.log('✅ Found matching request:', { requestId: r.id, searchId: requestId, match });
            }
            return match;
          });
          
          if (foundRequest) {
            console.log('✅ Found bulk request:', {
              id: foundRequest.id,
              status: foundRequest.status,
              buyer_id: foundRequest.buyer_id
            });
            setRequest(foundRequest);
            // Update route params so navigation back also has the request
            navigation.setParams({ request: foundRequest });
          } else {
            console.warn('⚠️ Bulk request not found for ID:', requestId);
            console.warn('   Available request IDs:', requests.map((r: any) => r.id));
          }
        } catch (error) {
          console.error('❌ Error fetching bulk request by ID:', error);
        } finally {
          setRefreshing(false);
        }
      }
    };

    // Only fetch if we have userData and requestId, and no request yet
    if (userData?.id && route.params?.requestId && !request) {
      fetchRequestById();
    }
  }, [route.params?.requestId, userData?.id, request, navigation]);

  // Parse vendor locations from shop data
  useEffect(() => {
    const fetchVendorLocations = async () => {
      if (!request?.accepted_vendors || request.accepted_vendors.length === 0) {
        return;
      }

      setLoadingVendors(true);
      try {
        const vendors: VendorWithLocation[] = await Promise.all(
          request.accepted_vendors.map(async (vendor: any) => {
            try {
              // Fetch profile to get shop location
              const profile = await getProfile(vendor.user_id);
              
              let latitude: number | undefined;
              let longitude: number | undefined;
              let shopname: string | undefined;
              let address: string | undefined;
              let location: string | undefined;

              // Try to get location from shop data (check shop, b2cShop, and b2bShop)
              const shopData = profile?.shop || profile?.b2cShop || profile?.b2bShop;
              
              if (shopData?.lat_log) {
                const [lat, lng] = shopData.lat_log.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                  latitude = lat;
                  longitude = lng;
                }
              }
              
              if (shopData?.shopname) {
                shopname = shopData.shopname;
              }
              
              if (shopData?.address) {
                address = shopData.address;
              }
              
              if (shopData?.location) {
                location = shopData.location;
              }

              // Get phone numbers from shop data and user profile
              let phone: string | undefined;
              let contact: string | undefined;
              
              // Try shop contact first
              if (shopData?.contact) {
                contact = String(shopData.contact);
              }
              
              // Try user profile for phone number
              if ((profile as any)?.mob_num) {
                phone = String((profile as any).mob_num);
              } else if ((profile as any)?.phone_number) {
                phone = String((profile as any).phone_number);
              }
              
              // Use contact as fallback if phone not available
              if (!phone && contact) {
                phone = contact;
              }

              // Check if vendor has started pickup and get live tracking location
              let liveLocation: { latitude: number; longitude: number } | null = null;
              let orderStatus: number | undefined = undefined;
              const vendorStatus = vendor.status || 'participated';
              
              // Always try to get order status if vendor has an order_id (not just for specific statuses)
              if (vendor.order_id || vendor.order_number) {
                const orderId = vendor.order_id || vendor.order_number;
                
                // Get live location if pickup has started
                if (vendorStatus === 'pickup_started' || vendorStatus === 'arrived' || vendorStatus === 'completed') {
                  try {
                    const locationData = await getLocationByOrder(orderId);
                    if (locationData?.vendor) {
                      liveLocation = {
                        latitude: locationData.vendor.latitude,
                        longitude: locationData.vendor.longitude
                      };
                    }
                  } catch (error) {
                    console.error(`Error fetching live location for vendor ${vendor.user_id}:`, error);
                  }
                }
                
                // Always try to get order status from active pickups (for status 4 detection) and completed pickups (for status 5)
                try {
                  const { getAllActivePickups, getCompletedPickups } = require('../../services/api/v2/orders');
                  const userData = await getUserData();
                  if (userData?.id && userData?.user_type) {
                    // First check active pickups
                    const activePickups = await getAllActivePickups(userData.id, userData.user_type as 'R' | 'S' | 'SR' | 'D');
                    let order = activePickups.find((p: any) => 
                      p.order_id === orderId || p.order_number === orderId
                    );
                    
                    // If not found in active pickups, check completed pickups
                    if (!order) {
                      const completedPickups = await getCompletedPickups(userData.id, userData.user_type as 'R' | 'S' | 'SR' | 'D');
                      order = completedPickups.find((p: any) => 
                        p.order_id === orderId || p.order_number === orderId
                      );
                    }
                    
                    if (order) {
                      orderStatus = order.status;
                      console.log(`✅ Found order status ${orderStatus} for vendor ${vendor.user_id}, order ${orderId}`);
                    }
                  }
                } catch (error) {
                  console.error(`Error fetching order status for vendor ${vendor.user_id}:`, error);
                }
              }

              return {
                user_id: vendor.user_id,
                user_type: vendor.user_type,
                shop_id: vendor.shop_id,
                committed_quantity: vendor.committed_quantity,
                bidding_price: vendor.bidding_price,
                accepted_at: vendor.accepted_at,
                status: vendorStatus,
                shopname,
                address,
                latitude,
                longitude,
                location,
                liveLocation, // Live tracking location if pickup started
                order_id: vendor.order_id,
                order_number: vendor.order_number,
                order_status: orderStatus, // Order status from API
                phone, // Vendor phone number
                contact, // Shop contact number
                images: vendor.images || [] // Vendor uploaded images
              };
            } catch (error) {
              console.error(`Error fetching location for vendor ${vendor.user_id}:`, error);
              return {
                user_id: vendor.user_id,
                user_type: vendor.user_type,
                shop_id: vendor.shop_id,
                committed_quantity: vendor.committed_quantity,
                bidding_price: vendor.bidding_price,
                accepted_at: vendor.accepted_at,
                status: vendor.status || 'participated',
                order_id: vendor.order_id,
                order_number: vendor.order_number,
                images: vendor.images || [] // Vendor uploaded images
              };
            }
          })
        );

        setVendorsWithLocations(vendors);
      } catch (error) {
        console.error('Error fetching vendor locations:', error);
      } finally {
        setLoadingVendors(false);
      }
    };

    fetchVendorLocations();

    // Refresh vendor locations every 30 seconds to update live tracking
    const interval = setInterval(() => {
      if (request?.accepted_vendors && request.accepted_vendors.length > 0) {
        fetchVendorLocations();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [request]);

  const onRefresh = async () => {
    setRefreshing(true);
    
    // Refetch request data first to get latest status
    if (request?.id && userData?.id) {
      await refetchRequest();
    }
    
    // Re-fetch vendor locations
    const fetchVendorLocations = async () => {
      if (!request?.accepted_vendors || request.accepted_vendors.length === 0) {
        setRefreshing(false);
        return;
      }

      try {
        const vendors: VendorWithLocation[] = await Promise.all(
          request.accepted_vendors.map(async (vendor: any) => {
            try {
              const profile = await getProfile(vendor.user_id);
              
              let latitude: number | undefined;
              let longitude: number | undefined;
              let shopname: string | undefined;
              let address: string | undefined;
              let location: string | undefined;

              const shopData = profile?.shop || profile?.b2cShop || profile?.b2bShop;
              
              if (shopData?.lat_log) {
                const [lat, lng] = shopData.lat_log.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                  latitude = lat;
                  longitude = lng;
                }
              }
              
              if (shopData?.shopname) {
                shopname = shopData.shopname;
              }
              
              if (shopData?.address) {
                address = shopData.address;
              }
              
              if (shopData?.location) {
                location = shopData.location;
              }

              // Get phone numbers from shop data and user profile
              let phone: string | undefined;
              let contact: string | undefined;
              
              // Try shop contact first
              if (shopData?.contact) {
                contact = String(shopData.contact);
              }
              
              // Try user profile for phone number
              if ((profile as any)?.mob_num) {
                phone = String((profile as any).mob_num);
              } else if ((profile as any)?.phone_number) {
                phone = String((profile as any).phone_number);
              }
              
              // Use contact as fallback if phone not available
              if (!phone && contact) {
                phone = contact;
              }

              // Check if vendor has started pickup and get live tracking location
              let liveLocation: { latitude: number; longitude: number } | null = null;
              let orderStatus: number | undefined = undefined;
              const vendorStatus = vendor.status || 'participated';
              
              // Always try to get order status if vendor has an order_id (for all vendors with orders)
              if (vendor.order_id || vendor.order_number) {
                const orderId = vendor.order_id || vendor.order_number;
                
                // Get live location if pickup has started
                if (vendorStatus === 'pickup_started' || vendorStatus === 'arrived' || vendorStatus === 'completed') {
                  try {
                    const locationData = await getLocationByOrder(orderId);
                    if (locationData?.vendor) {
                      liveLocation = {
                        latitude: locationData.vendor.latitude,
                        longitude: locationData.vendor.longitude
                      };
                    }
                  } catch (error) {
                    console.error(`Error fetching live location for vendor ${vendor.user_id}:`, error);
                  }
                }
                
                // Always try to get order status from active pickups and completed pickups (for all vendors with orders)
                try {
                  const { getAllActivePickups, getCompletedPickups } = require('../../services/api/v2/orders');
                  const userData = await getUserData();
                  if (userData?.id && userData?.user_type) {
                    // First check active pickups
                    const activePickups = await getAllActivePickups(userData.id, userData.user_type as 'R' | 'S' | 'SR' | 'D');
                    let order = activePickups.find((p: any) => 
                      p.order_id === orderId || p.order_number === orderId
                    );
                    
                    // If not found in active pickups, check completed pickups
                    if (!order) {
                      const completedPickups = await getCompletedPickups(userData.id, userData.user_type as 'R' | 'S' | 'SR' | 'D');
                      order = completedPickups.find((p: any) => 
                        p.order_id === orderId || p.order_number === orderId
                      );
                    }
                    
                    if (order) {
                      orderStatus = order.status;
                      console.log(`✅ Found order status ${orderStatus} for vendor ${vendor.user_id}, order ${orderId}`);
                    } else {
                      console.log(`⚠️ No order found for vendor ${vendor.user_id}, order ${orderId}`);
                    }
                  }
                } catch (error) {
                  console.error(`Error fetching order status for vendor ${vendor.user_id}:`, error);
                }
              }

              return {
                user_id: vendor.user_id,
                user_type: vendor.user_type,
                shop_id: vendor.shop_id,
                committed_quantity: vendor.committed_quantity,
                bidding_price: vendor.bidding_price,
                accepted_at: vendor.accepted_at,
                status: vendorStatus,
                shopname,
                address,
                latitude,
                longitude,
                location,
                liveLocation, // Live tracking location if pickup started
                order_id: vendor.order_id,
                order_number: vendor.order_number,
                order_status: orderStatus, // Order status from API
                phone, // Vendor phone number
                contact, // Shop contact number
                images: vendor.images || [] // Vendor uploaded images
              };
            } catch (error) {
              console.error(`Error fetching location for vendor ${vendor.user_id}:`, error);
              return {
                user_id: vendor.user_id,
                user_type: vendor.user_type,
                shop_id: vendor.shop_id,
                committed_quantity: vendor.committed_quantity,
                bidding_price: vendor.bidding_price,
                accepted_at: vendor.accepted_at,
                status: vendor.status || 'participated',
                order_id: vendor.order_id,
                order_number: vendor.order_number,
                order_status: undefined,
                images: vendor.images || [] // Vendor uploaded images
              };
            }
          })
        );

        setVendorsWithLocations(vendors);
      } catch (error) {
        console.error('Error fetching vendor locations:', error);
      } finally {
        setRefreshing(false);
      }
    };

    await fetchVendorLocations();
  };

  // Calculate distance helper
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Handle start pickup
  const handleStartPickup = async () => {
    if (!request || !userData) {
      Alert.alert(
        t('common.error') || 'Error',
        t('orders.missingData') || 'Request or user data is missing'
      );
      return;
    }

    const userType = userData.user_type;
    if (!userType || !['R', 'S', 'SR'].includes(userType)) {
      Alert.alert(
        t('common.error') || 'Error',
        t('orders.invalidUserType') || 'Invalid user type'
      );
      return;
    }

    try {
      setStartingPickup(true);

      console.log('🚀 Starting pickup for bulk request:', request.id);

      const result = await startPickupForBulkRequest(
        request.id,
        userData.id,
        userType as 'R' | 'S' | 'SR'
      );

      // Start location tracking when pickup is initiated
      // Use request ID as a pseudo order ID for tracking bulk request buyer location
      // We'll track it with a special key pattern in Redis
      if (request.id) {
        // Note: We'll need to track buyer location separately since they don't have an order ID
        // For now, we'll track using request ID as order ID (locationTrackingService expects orderId)
        locationTrackingService.startTracking(
          request.id, // Use request ID as order ID for tracking
          userData.id,
          userType as 'R' | 'S' | 'SR' | 'D'
        );
        console.log(`📍 Started location tracking for bulk request buyer ${userData.id}`);
      }

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bulkScrap.requests(userData.id, userType)
      });
      
      // Refetch the request data to update UI with new status
      await refetchRequest();

      Alert.alert(
        t('orders.pickupStarted') || 'Pickup Started',
        t('orders.pickupStartedMessage') || 'Pickup has been started successfully',
        [{ text: t('common.ok') || 'OK' }]
      );
    } catch (error: any) {
      console.error('Error starting pickup:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || t('orders.failedToStartPickup') || 'Failed to start pickup'
      );
    } finally {
      setStartingPickup(false);
    }
  };

  // Handle arrived location for a specific vendor's order
  const handleVendorArrived = async (vendor: VendorWithLocation) => {
    if (!request || !userData || !vendor.order_id && !vendor.order_number) {
      Alert.alert(t('common.error') || 'Error', t('orders.missingData') || 'Order data is missing');
      return;
    }

    const orderId = vendor.order_id || vendor.order_number;
    if (!orderId) {
      Alert.alert(t('common.error') || 'Error', 'Order ID not found for this vendor');
      return;
    }

    try {
      setMarkingVendorArrived(vendor.user_id);
      
      // Mark arrived for this specific vendor's order
      await arrivedLocation(
        orderId,
        userData.id,
        userData.user_type as 'R' | 'S' | 'SR' | 'D'
      );
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bulkScrap.requests(userData.id, userData.user_type)
      });
      
      // Refetch the request data to update UI with new status
      await refetchRequest();

      Alert.alert(
        t('orders.arrivedLocation') || 'Arrived at Location',
        t('orders.arrivedLocationMessage') || 'You have arrived at the vendor location',
        [{ text: t('common.ok') || 'OK' }]
      );
    } catch (error: any) {
      console.error('Error marking arrived for vendor:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || t('orders.failedToMarkArrived') || 'Failed to mark arrived location'
      );
    } finally {
      setMarkingVendorArrived(null);
    }
  };

  // Handle complete pickup for a specific vendor's order
  const handleVendorComplete = async (vendor: VendorWithLocation) => {
    if (!request || !userData || !vendor.order_id && !vendor.order_number) {
      Alert.alert(t('common.error') || 'Error', t('orders.missingData') || 'Order data is missing');
      return;
    }

    const orderId = vendor.order_id || vendor.order_number;
    if (!orderId) {
      Alert.alert(t('common.error') || 'Error', 'Order ID not found for this vendor');
      return;
    }

    try {
      setCompletingVendorPickup(vendor.user_id);
      
      // Complete pickup for this specific vendor's order
      await completePickup(
        orderId,
        userData.id,
        userData.user_type as 'R' | 'S' | 'SR' | 'D'
      );
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bulkScrap.requests(userData.id, userData.user_type)
      });
      
      // Refetch the request data to update UI with new status
      await refetchRequest();

      Alert.alert(
        t('orders.pickupCompleted') || 'Pickup Completed',
        t('orders.pickupCompletedMessage') || 'Pickup from this vendor has been completed successfully',
        [{ text: t('common.ok') || 'OK' }]
      );
    } catch (error: any) {
      console.error('Error completing pickup for vendor:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || t('orders.failedToCompletePickup') || 'Failed to complete pickup'
      );
    } finally {
      setCompletingVendorPickup(null);
    }
  };

  // Handle remove vendor (only for buyer)
  const handleRemoveVendor = async (vendorUserId: number) => {
    if (!request || !userData || !isBuyer) {
      Alert.alert(
        t('common.error') || 'Error',
        t('orders.missingData') || 'Request or user data is missing'
      );
      return;
    }

    Alert.alert(
      t('dashboard.removeVendor') || 'Remove Vendor',
      t('dashboard.removeVendorConfirm') || 'Are you sure you want to remove this vendor? The scrap quality was not proper.',
      [
        {
          text: t('common.cancel') || 'Cancel',
          style: 'cancel'
        },
        {
          text: t('dashboard.remove') || 'Remove',
          style: 'destructive',
          onPress: async () => {
            setRemovingVendor(vendorUserId);
            try {
              await removeVendorFromBulkRequest(
                request.id,
                userData.id,
                vendorUserId,
                'Scrap quality not proper'
              );
              
              // Immediately update UI: Remove vendor from local state
              setVendorsWithLocations(prev => 
                prev.filter(v => v.user_id !== vendorUserId)
              );
              
              // Immediately update request's accepted_vendors array
              if (request.accepted_vendors) {
                const updatedVendors = Array.isArray(request.accepted_vendors)
                  ? request.accepted_vendors.filter((v: any) => {
                      const vid = typeof v === 'object' ? v.user_id : v;
                      return vid !== vendorUserId;
                    })
                  : [];
                request.accepted_vendors = updatedVendors;
              }
              
              // Recalculate total committed quantity
              const remainingVendors = vendorsWithLocations.filter(v => v.user_id !== vendorUserId);
              const newTotalCommitted = remainingVendors.reduce((sum, v) => {
                return sum + (v.committed_quantity || 0);
              }, 0);
              
              // Update request status if needed
              const requestedQty = typeof request.quantity === 'number' ? request.quantity : parseFloat(String(request.quantity || 0));
              if (newTotalCommitted < requestedQty && request.status === 'order_full_filled') {
                request.status = 'active';
              }
              
              // Invalidate all bulk scrap queries to refresh data when navigating back
              await queryClient.invalidateQueries({
                predicate: (query) => {
                  const queryKey = query.queryKey;
                  return queryKey[0] === 'bulkScrap';
                },
              });
              
              Alert.alert(
                t('dashboard.vendorRemoved') || 'Vendor Removed',
                t('dashboard.vendorRemovedMessage') || 'Vendor has been removed from the request.',
                [{ text: t('common.ok') || 'OK' }]
              );
            } catch (error: any) {
              console.error('Error removing vendor:', error);
              Alert.alert(
                t('common.error') || 'Error',
                error?.message || t('dashboard.removeVendorError') || 'Failed to remove vendor. Please try again.'
              );
            } finally {
              setRemovingVendor(null);
            }
          }
        }
      ]
    );
  };

  // Handle complete pickup (for bulk request buyer)
  const handleComplete = async () => {
    if (!request || !userData) {
      Alert.alert(t('common.error') || 'Error', t('orders.missingData') || 'Request or user data is missing');
      return;
    }

    try {
      setCompletingPickup(true);
      
      // Update buyer status to 'completed' on backend
      await updateBulkRequestBuyerStatus(request.id, userData.id, 'completed');
      
      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.bulkScrap.requests(userData.id, userData.user_type)
      });
      
      // Refetch the request data to update UI with new status
      await refetchRequest();

      // Stop location tracking
      locationTrackingService.stopTracking();

      Alert.alert(
        t('orders.pickupCompleted') || 'Pickup Completed',
        t('orders.pickupCompletedMessage') || 'Pickup has been completed successfully',
        [{ text: t('common.ok') || 'OK' }]
      );
    } catch (error: any) {
      console.error('Error completing pickup:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || t('orders.failedToCompletePickup') || 'Failed to complete pickup'
      );
    } finally {
      setCompletingPickup(false);
    }
  };

  // Sort vendors by distance from request location (nearest first)
  const sortedVendorsByDistance = useMemo(() => {
    if (!request?.latitude || !request?.longitude) {
      return vendorsWithLocations;
    }

    return [...vendorsWithLocations].sort((a, b) => {
      const distA = (a.latitude && a.longitude) 
        ? calculateDistance(request.latitude, request.longitude, a.latitude, a.longitude)
        : Infinity;
      const distB = (b.latitude && b.longitude)
        ? calculateDistance(request.latitude, request.longitude, b.latitude, b.longitude)
        : Infinity;
      return distA - distB;
    });
  }, [vendorsWithLocations, request]);

  // Prepare map markers and routes for vendors with locations
  const mapMarkers = useMemo(() => {
    const markers: any[] = [];
    
    // Add request location marker
    if (request?.latitude && request?.longitude &&
        typeof request.latitude === 'number' && typeof request.longitude === 'number' &&
        !isNaN(request.latitude) && !isNaN(request.longitude)) {
      markers.push({
        id: 'request',
        latitude: request.latitude,
        longitude: request.longitude,
        title: t('dashboard.requestLocation') || 'Request Location',
        description: request.location || '',
        pinColor: '#FF6B6B',
      });
    }

    // Add vendor location markers (sorted by distance)
    sortedVendorsByDistance.forEach((vendor, index) => {
      // Add shop location marker (if available)
      if (vendor.latitude && vendor.longitude &&
          typeof vendor.latitude === 'number' && typeof vendor.longitude === 'number' &&
          !isNaN(vendor.latitude) && !isNaN(vendor.longitude)) {
        const distance = request?.latitude && request?.longitude &&
          typeof request.latitude === 'number' && typeof request.longitude === 'number' &&
          !isNaN(request.latitude) && !isNaN(request.longitude)
          ? calculateDistance(request.latitude, request.longitude, vendor.latitude, vendor.longitude)
          : null;
        
        markers.push({
          id: `vendor-shop-${vendor.user_id}`,
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          title: vendor.shopname || `${t('dashboard.vendor') || 'Vendor'} #${vendor.user_id}`,
          description: `Shop Location - ${vendor.status || 'participated'}` + (distance !== null ? ` (${distance.toFixed(2)} km)` : ''),
          pinColor: '#4ECDC4', // Teal for shop location
          distance: distance,
        });
      }

      // Add live tracking location marker (if pickup started)
      if (vendor.liveLocation && vendor.liveLocation.latitude && vendor.liveLocation.longitude) {
        const liveDistance = request?.latitude && request?.longitude &&
          typeof request.latitude === 'number' && typeof request.longitude === 'number' &&
          !isNaN(request.latitude) && !isNaN(request.longitude)
          ? calculateDistance(request.latitude, request.longitude, vendor.liveLocation.latitude, vendor.liveLocation.longitude)
          : null;
        
        markers.push({
          id: `vendor-live-${vendor.user_id}`,
          latitude: vendor.liveLocation.latitude,
          longitude: vendor.liveLocation.longitude,
          title: `${vendor.shopname || `${t('dashboard.vendor') || 'Vendor'} #${vendor.user_id}`} - Live`,
          description: `Live Location - ${vendor.status || 'pickup_started'}` + (liveDistance !== null ? ` (${liveDistance.toFixed(2)} km)` : ''),
          pinColor: '#FFD93D', // Yellow for live tracking
          distance: liveDistance,
        });
      }
    });

    return markers;
  }, [request, sortedVendorsByDistance, t, calculateDistance]);

  // Prepare route points: request -> nearest vendor -> next vendor -> ...
  const routePoints = useMemo(() => {
    const points: Array<{ latitude: number; longitude: number; title: string }> = [];
    
    // Start with request location
    if (request?.latitude && request?.longitude && 
        typeof request.latitude === 'number' && typeof request.longitude === 'number' &&
        !isNaN(request.latitude) && !isNaN(request.longitude)) {
      points.push({
        latitude: request.latitude,
        longitude: request.longitude,
        title: t('dashboard.requestLocation') || 'Request Location',
      });
    }

    // Add vendors in order of distance (only those with valid locations)
    sortedVendorsByDistance.forEach((vendor) => {
      if (vendor.latitude && vendor.longitude &&
          typeof vendor.latitude === 'number' && typeof vendor.longitude === 'number' &&
          !isNaN(vendor.latitude) && !isNaN(vendor.longitude)) {
        points.push({
          latitude: vendor.latitude,
          longitude: vendor.longitude,
          title: vendor.shopname || `${t('dashboard.vendor') || 'Vendor'} #${vendor.user_id}`,
        });
      }
    });

    return points;
  }, [request, sortedVendorsByDistance, t]);

  // Open phone dialer for vendor
  const handleCallVendor = React.useCallback((phoneNumber: string | undefined) => {
    if (!phoneNumber) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.phoneNumberNotAvailable') || 'Phone number not available'
      );
      return;
    }
    
    // Remove any non-numeric characters except +
    const cleanPhone = phoneNumber.replace(/[^\d+]/g, '');
    const phoneUrl = `tel:${cleanPhone}`;
    
    Linking.canOpenURL(phoneUrl)
      .then((supported: boolean) => {
        if (supported) {
          return Linking.openURL(phoneUrl);
        } else {
          Alert.alert(
            t('common.error') || 'Error',
            t('dashboard.cannotMakeCall') || 'Cannot make phone call on this device'
          );
        }
      })
      .catch((err: Error) => {
        console.error('Error opening phone dialer:', err);
        Alert.alert(
          t('common.error') || 'Error',
          t('dashboard.cannotMakeCall') || 'Cannot make phone call on this device'
        );
      });
  }, [t]);

  // Open Google Maps with route including all vendor locations as waypoints  
  const handleOpenGoogleMaps = React.useCallback(() => {
    if (!request?.latitude || !request?.longitude) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.locationNotAvailable') || 'Request location not available'
      );
      return;
    }

    // Get all vendors with valid locations (sorted by distance)
    const vendorsWithValidLocations = sortedVendorsByDistance.filter(
      (v) => v.latitude && v.longitude &&
      typeof v.latitude === 'number' && typeof v.longitude === 'number' &&
      !isNaN(v.latitude) && !isNaN(v.longitude)
    );

    if (vendorsWithValidLocations.length === 0) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.noVendorLocations') || 'No vendor locations available'
      );
      return;
    }

    const requestLat = request.latitude;
    const requestLng = request.longitude;
    
    // Build the Google Maps URL based on number of vendors
    let googleMapsUrl: string;
    
    if (vendorsWithValidLocations.length === 1) {
      // Single vendor: Simple route from request location to vendor (no waypoints)
      const vendor = vendorsWithValidLocations[0];
      const vendorLat = vendor.latitude;
      const vendorLng = vendor.longitude;
      
      if (Platform.OS === 'android') {
        // For Android, use Google Maps directions URL
        googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${requestLat},${requestLng}&destination=${vendorLat},${vendorLng}&travelmode=driving`;
      } else {
        // For iOS, use Apple Maps
        googleMapsUrl = `https://maps.apple.com/?daddr=${vendorLat},${vendorLng}&saddr=${requestLat},${requestLng}`;
      }
    } else {
      // Multiple vendors: Route with waypoints (stops)
      // Build waypoints string: lat1,lng1|lat2,lng2|...
      const waypoints = vendorsWithValidLocations
        .map((v) => `${v.latitude},${v.longitude}`)
        .join('|');
      
      if (Platform.OS === 'android') {
        // For Android with multiple waypoints
        // Use the first vendor as destination and rest as waypoints
        const firstVendor = vendorsWithValidLocations[0];
        const remainingWaypoints = vendorsWithValidLocations.slice(1)
          .map((v) => `${v.latitude},${v.longitude}`)
          .join('|');
        
        if (remainingWaypoints) {
          // Multiple waypoints: origin -> waypoint1 -> waypoint2 -> ... -> destination
          googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${requestLat},${requestLng}&destination=${firstVendor.latitude},${firstVendor.longitude}&waypoints=${encodeURIComponent(remainingWaypoints)}&travelmode=driving`;
        } else {
          // Only one waypoint, use simple route
          googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${requestLat},${requestLng}&destination=${firstVendor.latitude},${firstVendor.longitude}&travelmode=driving`;
        }
      } else {
        // For iOS with multiple waypoints, use Google Maps web URL
        const firstVendor = vendorsWithValidLocations[0];
        const remainingWaypoints = vendorsWithValidLocations.slice(1)
          .map((v) => `${v.latitude},${v.longitude}`)
          .join('|');
        
        if (remainingWaypoints) {
          googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${requestLat},${requestLng}&destination=${firstVendor.latitude},${firstVendor.longitude}&waypoints=${encodeURIComponent(remainingWaypoints)}&travelmode=driving`;
        } else {
          googleMapsUrl = `https://www.google.com/maps/dir/?api=1&origin=${requestLat},${requestLng}&destination=${firstVendor.latitude},${firstVendor.longitude}&travelmode=driving`;
        }
      }
    }
    
    // Try to open the URL directly
    Linking.openURL(googleMapsUrl).catch((err: Error) => {
      console.error('Error opening Google Maps URL:', err);
      // Fallback: Try simple geo URL
      if (vendorsWithValidLocations.length === 1) {
        const vendor = vendorsWithValidLocations[0];
        const geoUrl = `geo:${vendor.latitude},${vendor.longitude}?q=${vendor.latitude},${vendor.longitude}`;
        Linking.openURL(geoUrl).catch((fallbackErr: Error) => {
          console.error('Error opening geo URL:', fallbackErr);
          Alert.alert(
            t('common.error') || 'Error',
            t('dashboard.cannotOpenMaps') || 'Cannot open Google Maps on this device. Please make sure Google Maps is installed.'
          );
        });
      } else {
        Alert.alert(
          t('common.error') || 'Error',
          t('dashboard.cannotOpenMaps') || 'Cannot open Google Maps on this device. Please make sure Google Maps is installed.'
        );
      }
    });
  }, [request, sortedVendorsByDistance, t]);

  // Calculate map region to show all markers
  const mapRegion = useMemo(() => {
    if (mapMarkers.length === 0) {
      return {
        latitude: request?.latitude || 0,
        longitude: request?.longitude || 0,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    const lats = mapMarkers.map(m => m.latitude).filter(Boolean);
    const lngs = mapMarkers.map(m => m.longitude).filter(Boolean);

    if (lats.length === 0 || lngs.length === 0) {
      return {
        latitude: request?.latitude || 0,
        longitude: request?.longitude || 0,
        latitudeDelta: 0.1,
        longitudeDelta: 0.1,
      };
    }

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const latDelta = (maxLat - minLat) * 1.5 || 0.1;
    const lngDelta = (maxLng - minLng) * 1.5 || 0.1;

    return {
      latitude: (minLat + maxLat) / 2,
      longitude: (minLng + maxLng) / 2,
      latitudeDelta: Math.max(latDelta, 0.01),
      longitudeDelta: Math.max(lngDelta, 0.01),
    };
  }, [mapMarkers, request]);

  // Show loading state if we're fetching by requestId
  const isFetchingRequest = !request && route.params?.requestId && userData?.id;
  
  if (!request) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <AutoText style={styles.headerTitle}>
            {t('dashboard.bulkRequestDetails') || 'Bulk Request Details'}
          </AutoText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          {isFetchingRequest ? (
            <>
              <ActivityIndicator size="large" color={theme.primary} />
              <AutoText style={styles.emptyText}>
                {t('common.loading') || 'Loading...'}
              </AutoText>
            </>
          ) : (
            <AutoText style={styles.emptyText}>
              {t('dashboard.requestNotFound') || 'Request not found'}
            </AutoText>
          )}
        </View>
      </View>
    );
  }

  const quantityInTons = (request.quantity / 1000).toFixed(2);
  const subcategoriesText = request.subcategories && request.subcategories.length > 0
    ? request.subcategories.map((s: any) => s.subcategory_name).join(', ')
    : request.scrap_type || 'Scrap';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('dashboard.bulkRequestDetails') || 'Bulk Request Details'} #{request.id}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {/* Map Section */}
        {mapMarkers.length > 0 && (
          <SectionCard style={styles.mapCard}>
            <AutoText style={styles.sectionTitle}>
              {t('dashboard.vendorLocations') || 'Vendor Locations'}
            </AutoText>
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => {
                // Navigate to fullscreen map with all markers and routes
                if (request?.latitude && request?.longitude) {
                  navigation.navigate('FullscreenMap', {
                    destination: {
                      latitude: request.latitude,
                      longitude: request.longitude
                    },
                    requestId: request?.id?.toString(),
                  });
                }
              }}
            >
              <View style={styles.mapContainer}>
                <BulkRequestMapView
                  markers={mapMarkers}
                  routePoints={routePoints}
                  initialRegion={mapRegion}
                  style={styles.map}
                />
              </View>
            </TouchableOpacity>
            <View style={styles.mapLegend}>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#FF6B6B' }]} />
                <AutoText style={styles.legendText}>
                  {t('dashboard.requestLocation') || 'Request Location'}
                </AutoText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: '#4ECDC4' }]} />
                <AutoText style={styles.legendText}>
                  {t('dashboard.vendorLocation') || 'Vendor Shop'}
                </AutoText>
              </View>
            </View>
          </SectionCard>
        )}

        {/* Request Details */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>
            {t('dashboard.requestDetails') || 'Request Details'}
          </AutoText>
          
          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="package-variant" size={16} color={theme.primary} />
            <AutoText style={styles.detailText} numberOfLines={3}>
              {subcategoriesText}
            </AutoText>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="weight-kilogram" size={16} color={theme.primary} />
            <AutoText style={styles.detailText} numberOfLines={1}>
              {t('dashboard.requestedQuantity') || 'Requested'}: {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
            </AutoText>
          </View>

          {request.total_committed_quantity !== undefined && request.total_committed_quantity > 0 && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="progress-check" size={16} color={theme.primary} />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.committedQuantity') || 'Committed'}: {request.total_committed_quantity.toLocaleString('en-IN')} kg
              </AutoText>
            </View>
          )}

          {request.preferred_price && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="currency-inr" size={16} color={theme.primary} />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{request.preferred_price.toLocaleString('en-IN')} / kg
              </AutoText>
            </View>
          )}

          {request.location && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color={theme.primary} />
              <AutoText style={styles.detailText} numberOfLines={2}>
                {request.location}
              </AutoText>
            </View>
          )}

          {request.when_needed && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="clock-outline" size={16} color={theme.primary} />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.whenNeeded') || 'When needed'}: {request.when_needed}
              </AutoText>
            </View>
          )}

          {request.additional_notes && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="note-text" size={16} color={theme.primary} />
              <AutoText style={styles.detailText} numberOfLines={3}>
                {request.additional_notes}
              </AutoText>
            </View>
          )}
        </SectionCard>

        {/* Participating Vendors */}
        <SectionCard>
          <View style={styles.vendorsHeader}>
            <AutoText style={styles.sectionTitle}>
              {t('dashboard.participatingVendors') || 'Participating Vendors'} ({vendorsWithLocations.length})
            </AutoText>
            {loadingVendors && (
              <ActivityIndicator size="small" color={theme.primary} />
            )}
          </View>

          {vendorsWithLocations.length === 0 ? (
            <View style={styles.emptyVendorsContainer}>
              <MaterialCommunityIcons
                name="account-off"
                size={32}
                color={theme.textSecondary}
              />
              <AutoText style={styles.emptyVendorsText}>
                {t('dashboard.noVendorsParticipated') || 'No vendors have participated yet'}
              </AutoText>
            </View>
          ) : (
            vendorsWithLocations.map((vendor, index) => {
              // Calculate distance from request location if available
              const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
                const R = 6371; // Radius of the Earth in km
                const dLat = (lat2 - lat1) * Math.PI / 180;
                const dLon = (lon2 - lon1) * Math.PI / 180;
                const a = 
                  Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
                const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                return R * c;
              };

              let distance: number | null = null;
              if (request?.latitude && request?.longitude && vendor.latitude && vendor.longitude) {
                distance = calculateDistance(
                  request.latitude,
                  request.longitude,
                  vendor.latitude,
                  vendor.longitude
                );
              }

              // Get vendor status - use order_status if available, otherwise use vendor.status
              // Map order_status to vendor status: 2=Accepted, 3=Pickup Initiated, 4=Arrived, 5=Completed
              let vendorStatus = vendor.status || 'participated';
              if (vendor.order_status !== undefined && vendor.order_status !== null) {
                if (vendor.order_status === 5) {
                  vendorStatus = 'completed';
                } else if (vendor.order_status === 4) {
                  vendorStatus = 'arrived';
                } else if (vendor.order_status === 3) {
                  vendorStatus = 'pickup_started';
                }
                // If order_status is 2 or other, keep the vendor.status
              }
              
              // Get status label and color
              const getStatusInfo = (status: string) => {
                switch (status) {
                  case 'participated':
                    return {
                      label: t('dashboard.statusParticipated') || 'Participated',
                      color: theme.primary,
                      icon: 'account-check',
                      bgColor: theme.primary + '15'
                    };
                  case 'order_full_filled':
                    return {
                      label: t('dashboard.statusOrderFullFilled') || 'Order Full Filled',
                      color: theme.info || '#2196F3',
                      icon: 'package-variant',
                      bgColor: (theme.info || '#2196F3') + '15'
                    };
                  case 'pickup_started':
                    return {
                      label: t('dashboard.statusPickupStarted') || 'Pickup Started',
                      color: theme.warning || '#FFA500',
                      icon: 'truck-delivery',
                      bgColor: (theme.warning || '#FFA500') + '15'
                    };
                  case 'arrived':
                    return {
                      label: t('dashboard.statusArrived') || 'Arrived',
                      color: theme.success || '#4CAF50',
                      icon: 'map-marker-check',
                      bgColor: (theme.success || '#4CAF50') + '15'
                    };
                  case 'completed':
                    return {
                      label: t('dashboard.statusCompleted') || 'Completed',
                      color: theme.success || '#4CAF50',
                      icon: 'check-circle',
                      bgColor: (theme.success || '#4CAF50') + '15'
                    };
                  default:
                    return {
                      label: t('dashboard.statusParticipated') || 'Participated',
                      color: theme.textSecondary,
                      icon: 'account',
                      bgColor: theme.textSecondary + '15'
                    };
                }
              };

              const statusInfo = getStatusInfo(vendorStatus);

              return (
              <View key={`vendor-${vendor.user_id}-${index}`} style={styles.vendorCard}>
                {/* Header */}
                <View style={styles.vendorHeader}>
                  <View style={styles.vendorHeaderLeft}>
                    <MaterialCommunityIcons
                      name="store"
                      size={20}
                      color={theme.primary}
                      style={{ marginRight: 10 }}
                    />
                    <View style={styles.vendorHeaderInfo}>
                      <AutoText style={styles.vendorName} numberOfLines={1}>
                        {vendor.shopname || `${t('dashboard.vendor') || 'Vendor'} #${vendor.user_id}`}
                      </AutoText>
                      {vendor.user_type && (
                        <AutoText style={styles.vendorType}>
                          {vendor.user_type}
                        </AutoText>
                      )}
                    </View>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusInfo.bgColor }]}>
                    <MaterialCommunityIcons
                      name={statusInfo.icon as any}
                      size={14}
                      color={statusInfo.color}
                    />
                    <AutoText style={[styles.statusBadgeText, { color: statusInfo.color }]}>
                      {statusInfo.label}
                    </AutoText>
                  </View>
                </View>

                {/* Details */}
                <View style={styles.vendorDetails}>
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="weight-kilogram"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <AutoText style={styles.detailLabel}>
                      {t('dashboard.committedQuantity') || 'Committed'}:
                    </AutoText>
                    <AutoText style={styles.detailValue}>
                      {vendor.committed_quantity && typeof vendor.committed_quantity === 'number'
                        ? vendor.committed_quantity.toLocaleString('en-IN')
                        : '0'} kg
                    </AutoText>
                  </View>

                  {vendor.bidding_price && typeof vendor.bidding_price === 'number' && !isNaN(vendor.bidding_price) && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons
                        name="currency-inr"
                        size={16}
                        color={theme.textSecondary}
                      />
                      <AutoText style={styles.detailLabel}>
                        {t('dashboard.biddingPrice') || 'Bidding Price'}:
                      </AutoText>
                      <AutoText style={styles.detailValue}>
                        ₹{vendor.bidding_price.toLocaleString('en-IN')}/kg
                      </AutoText>
                    </View>
                  )}

                  {distance !== null && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons
                        name="map-marker-distance"
                        size={16}
                        color={theme.textSecondary}
                      />
                      <AutoText style={styles.detailLabel}>
                        {t('dashboard.distance') || 'Distance'}:
                      </AutoText>
                      <AutoText style={styles.detailValue}>
                        {distance.toFixed(1)} km
                      </AutoText>
                    </View>
                  )}

                  {vendor.address && (
                    <View style={styles.vendorDetailRow}>
                      <MaterialCommunityIcons
                        name="map-marker"
                        size={16}
                        color={theme.textSecondary}
                      />
                      <AutoText style={styles.detailAddress} numberOfLines={2}>
                        {vendor.address}
                      </AutoText>
                    </View>
                  )}

                  {vendor.accepted_at && (
                    <View style={styles.vendorDetailRow}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={16}
                        color={theme.textSecondary}
                      />
                      <AutoText style={styles.detailLabel}>
                        {t('dashboard.participatedAt') || 'Participated'}:
                      </AutoText>
                      <AutoText style={styles.detailValue}>
                        {new Date(vendor.accepted_at).toLocaleDateString('en-IN', { 
                          day: 'numeric', 
                          month: 'short', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </AutoText>
                    </View>
                  )}

                  {/* Vendor Images */}
                  {vendor.images && Array.isArray(vendor.images) && vendor.images.length > 0 && (
                    <View style={styles.vendorImagesContainer}>
                      <View style={styles.vendorImagesHeader}>
                        <MaterialCommunityIcons
                          name="image-multiple"
                          size={16}
                          color={theme.primary}
                        />
                        <AutoText style={styles.vendorImagesTitle}>
                          {t('dashboard.scrapImages') || 'Scrap Images'} ({vendor.images.length})
                        </AutoText>
                      </View>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.vendorImagesScroll}>
                        {vendor.images.map((imageUrl: string, imgIndex: number) => (
                          <TouchableOpacity
                            key={imgIndex}
                            style={styles.vendorImageWrapper}
                            onPress={() => {
                              // TODO: Open image in fullscreen viewer
                              Alert.alert(
                                t('dashboard.scrapImages') || 'Scrap Image',
                                imageUrl
                              );
                            }}
                          >
                            <Image source={{ uri: imageUrl }} style={styles.vendorImage} />
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>

                {/* Action Buttons */}
                <View style={styles.vendorActions}>
                  {vendor.phone && (
                    <TouchableOpacity
                      style={[styles.vendorActionButton, { backgroundColor: theme.success || '#4CAF50' }]}
                      onPress={() => handleCallVendor(vendor.phone)}
                    >
                      <MaterialCommunityIcons
                        name="phone"
                        size={18}
                        color="#FFFFFF"
                      />
                      <AutoText style={styles.vendorActionButtonText}>
                        {t('dashboard.call') || 'Call'}
                      </AutoText>
                    </TouchableOpacity>
                  )}
                  {index === 0 && (
                    <TouchableOpacity
                      style={[styles.vendorActionButton, { backgroundColor: theme.primary }]}
                      onPress={handleOpenGoogleMaps}
                    >
                      <MaterialCommunityIcons
                        name="map"
                        size={18}
                        color="#FFFFFF"
                      />
                      <AutoText style={styles.vendorActionButtonText}>
                        {t('dashboard.openInMaps') || 'Open in Maps'}
                      </AutoText>
                    </TouchableOpacity>
                  )}
                </View>
                
                {/* Buyer-specific order status buttons - Below Call/Open Maps */}
                {isBuyer && vendor.order_id && (
                  <View style={styles.vendorActions}>
                    {/* Show "Arrived Location" button only if order is not already arrived (4) or completed (5) */}
                    {vendor.status === 'pickup_started' && vendor.order_status !== 4 && vendor.order_status !== 5 && (
                      <TouchableOpacity
                        style={[styles.vendorActionButton, { backgroundColor: theme.primary }]}
                        onPress={() => handleVendorArrived(vendor)}
                        disabled={markingVendorArrived === vendor.user_id}
                      >
                        {markingVendorArrived === vendor.user_id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons
                              name="map-marker-check"
                              size={18}
                              color="#FFFFFF"
                            />
                            <AutoText style={styles.vendorActionButtonText}>
                              {t('deliveryTracking.arrivedLocation') || 'Arrived Location'}
                            </AutoText>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    {/* Show "Complete Pickup" button only if order is arrived (4) but not completed (5) */}
                    {(vendor.status === 'arrived' || vendor.order_status === 4) && vendor.order_status !== 5 && (
                      <TouchableOpacity
                        style={[styles.vendorActionButton, { backgroundColor: theme.success || '#4CAF50' }]}
                        onPress={() => handleVendorComplete(vendor)}
                        disabled={completingVendorPickup === vendor.user_id}
                      >
                        {completingVendorPickup === vendor.user_id ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={18}
                              color="#FFFFFF"
                            />
                            <AutoText style={styles.vendorActionButtonText}>
                              {t('deliveryTracking.completePickup') || 'Complete Pickup'}
                            </AutoText>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                    {/* Show "Completed" status if order is completed (5) */}
                    {(vendor.status === 'completed' || vendor.order_status === 5) && (
                      <View style={[styles.vendorActionButton, { backgroundColor: theme.success + '40', opacity: 0.7 }]}>
                        <MaterialCommunityIcons
                          name="check-circle"
                          size={18}
                          color={theme.success || '#4CAF50'}
                        />
                        <AutoText style={[styles.vendorActionButtonText, { color: theme.success || '#4CAF50' }]}>
                          {t('orders.status.completed') || 'Completed'}
                        </AutoText>
                      </View>
                    )}
                  </View>
                )}

                {/* Committed Subcategories Section */}
                {request?.subcategories && Array.isArray(request.subcategories) && request.subcategories.length > 0 && (
                  <View style={styles.committedSubcategoriesContainer}>
                    <View style={styles.committedSubcategoriesHeader}>
                      <MaterialCommunityIcons
                        name="package-variant-closed"
                        size={16}
                        color={theme.primary}
                        style={{ marginRight: 8 }}
                      />
                      <AutoText style={styles.committedSubcategoriesTitle}>
                        {t('dashboard.committedSubcategories') || 'Committed Subcategories'}
                      </AutoText>
                    </View>
                    {request.subcategories.map((subcat: any, subcatIndex: number) => {
                      // Calculate proportional quantity for this subcategory
                      const subcatQuantity = subcat.quantity || 0;
                      const totalRequestQuantity = request.quantity || 1;
                      const vendorCommittedQty = vendor.committed_quantity || 0;
                      const proportionalQty = (subcatQuantity / totalRequestQuantity) * vendorCommittedQty;
                      
                      return (
                        <View key={subcatIndex} style={styles.committedSubcategoryCard}>
                          <View style={styles.committedSubcategoryHeader}>
                            <View style={[styles.subcategoryIconContainer, { backgroundColor: theme.primary + '15' }]}>
                              <MaterialCommunityIcons
                                name="package-variant"
                                size={16}
                                color={theme.primary}
                              />
                            </View>
                            <AutoText style={styles.committedSubcategoryName} numberOfLines={2}>
                              {subcat.subcategory_name || `Subcategory ${subcatIndex + 1}`}
                            </AutoText>
                          </View>
                          <View style={styles.committedSubcategoryDetails}>
                            <View style={styles.committedSubcategoryDetailRow}>
                              <View style={styles.committedSubcategoryDetailItem}>
                                <AutoText style={styles.committedSubcategoryDetailLabel}>
                                  {t('dashboard.requestedQuantity') || 'Requested'}
                                </AutoText>
                                <AutoText style={styles.committedSubcategoryDetailValue}>
                                  {subcatQuantity.toLocaleString('en-IN')} kg
                                </AutoText>
                              </View>
                              {proportionalQty > 0 && (
                                <View style={styles.committedSubcategoryDetailItem}>
                                  <AutoText style={styles.committedSubcategoryDetailLabel}>
                                    {t('dashboard.committedQuantity') || 'Committed'}
                                  </AutoText>
                                  <AutoText style={[styles.committedSubcategoryDetailValue, { color: theme.primary }]}>
                                    {proportionalQty.toFixed(2)} kg
                                  </AutoText>
                                </View>
                              )}
                            </View>
                            <View style={styles.committedSubcategoryPriceRow}>
                              {subcat.preferred_price && (
                                <View style={styles.priceBadge}>
                                  <MaterialCommunityIcons
                                    name="tag-outline"
                                    size={12}
                                    color={theme.textSecondary}
                                    style={{ marginRight: 4 }}
                                  />
                                  <AutoText style={styles.priceBadgeText}>
                                    {t('dashboard.preferredPrice') || 'Preferred'}: ₹{subcat.preferred_price.toLocaleString('en-IN')}/kg
                                  </AutoText>
                                </View>
                              )}
                              {/* {vendor.bidding_price && typeof vendor.bidding_price === 'number' && !isNaN(vendor.bidding_price) && (
                                <View style={[styles.priceBadge, { backgroundColor: theme.success + '15' }]}>
                                  <MaterialCommunityIcons
                                    name="tag"
                                    size={12}
                                    color={theme.success}
                                    style={{ marginRight: 4 }}
                                  />
                                  <AutoText style={[styles.priceBadgeText, { color: theme.success }]}>
                                    {t('dashboard.biddingPrice') || 'Bid'}: ₹{vendor.bidding_price.toLocaleString('en-IN')}/kg
                                  </AutoText>
                                </View>
                              )} */}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}

                {/* Remove Vendor Button (only for buyer, at bottom of card) */}
                {isBuyer && (
                  <TouchableOpacity
                    style={styles.removeVendorButton}
                    onPress={() => handleRemoveVendor(vendor.user_id)}
                    disabled={removingVendor === vendor.user_id}
                  >
                    {removingVendor === vendor.user_id ? (
                      <ActivityIndicator size="small" color={theme.primary} />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name="account-remove"
                          size={18}
                          color={theme.primary}
                        />
                        <AutoText style={styles.removeVendorButtonText}>
                          {t('dashboard.removeVendor') || 'Remove Vendor'}
                        </AutoText>
                      </>
                    )}
                  </TouchableOpacity>
                )}
              </View>
              );
            })
          )}
        </SectionCard>

      </ScrollView>

      {/* Action Buttons - Only show Start Pickup button at bottom */}
      {isBuyer && (
        <View style={styles.bottomRow}>
          {(() => {
            // Get vendors with orders
            const vendorsWithOrders = vendorsWithLocations.filter(v => v.order_id || v.order_number);
            
            // Check if all vendors with orders have completed (order_status === 5)
            const allVendorsCompleted = vendorsWithOrders.length > 0 && vendorsWithOrders.every(v => 
              v.order_status === 5 || v.status === 'completed'
            );
            
            // Check if buyer has started pickup (check if any vendor has pickup_started status or if request has orders created)
            const hasPickupStarted = vendorsWithLocations.some(v => 
              v.status === 'pickup_started' || v.status === 'arrived' || v.status === 'completed'
            ) || buyerStatus === 'pickup_started' || buyerStatus === 'arrived' || buyerStatus === 'completed';

            if (allVendorsCompleted) {
              // Show "Completed Order" message when all vendors have completed
              return (
                <View style={[styles.infoContainer, { backgroundColor: (theme.success || '#4CAF50') + '15' }]}>
                  <MaterialCommunityIcons name="check-circle" size={20} color={theme.success || '#4CAF50'} />
                  <AutoText 
                    style={[styles.infoText, { color: theme.success || '#4CAF50' }]}
                    numberOfLines={0}
                  >
                    {t('dashboard.orderCompleted') || 'Order Completed - All vendors have completed pickup from their locations'}
                  </AutoText>
                </View>
              );
            } else if (!hasPickupStarted && (buyerStatus === 'pending' || buyerStatus === 'order_full_filled' || buyerStatus === 'active')) {
              // Show Start Pickup button (only when request is pending, active, or fully filled)
              return (
                <TouchableOpacity
                  style={[styles.actionButton, startingPickup && styles.actionButtonDisabled]}
                  onPress={handleStartPickup}
                  disabled={startingPickup || !userData}
                >
                  {startingPickup ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <AutoText style={styles.actionButtonText} numberOfLines={1}>
                      {t('deliveryTracking.myselfPickup') || 'Start Pickup'}
                    </AutoText>
                  )}
                </TouchableOpacity>
              );
            } else if (hasPickupStarted) {
              // Show info message that buyer should use per-vendor buttons
              const pendingVendors = vendorsWithLocations.filter(v => 
                v.status === 'pickup_started' || v.status === 'arrived' || 
                (v.order_status !== undefined && v.order_status !== null && v.order_status !== 5)
              );
              if (pendingVendors.length > 0) {
                return (
                  <View style={styles.infoContainer}>
                    <MaterialCommunityIcons name="information" size={20} color={theme.primary} />
                    <AutoText 
                      style={styles.infoText}
                      numberOfLines={0}
                    >
                      {t('dashboard.useVendorButton') || 'Use the buttons on each vendor card to mark arrived/complete'}
                    </AutoText>
                  </View>
                );
              }
            }
            return null;
          })()}
        </View>
      )}
    </View>
  );
};

const getStyles = (theme: any, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      padding: '18@s',
      paddingBottom: '24@vs',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20@s',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '10@vs',
      textAlign: 'center',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: '10@vs',
      gap: '8@s',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      flex: 1,
    },
    mapCard: {
      marginBottom: '18@vs',
    },
    mapContainer: {
      height: '250@vs',
      borderRadius: '12@ms',
      overflow: 'hidden',
      marginBottom: '12@vs',
    },
    map: {
      flex: 1,
    },
    mapLegend: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingTop: '8@vs',
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
    },
    legendDot: {
      width: '12@s',
      height: '12@s',
      borderRadius: '6@s',
    },
    legendText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    vendorsHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12@vs',
    },
    vendorCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '16@s',
      marginBottom: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    vendorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12@vs',
      paddingBottom: '12@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    vendorHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    vendorHeaderInfo: {
      flex: 1,
    },
    vendorName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    vendorType: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '10@s',
      paddingVertical: '6@vs',
      borderRadius: '8@ms',
      gap: '5@s',
    },
    statusBadgeText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
    },
    vendorDetails: {
      gap: '10@vs',
    },
    vendorDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
    },
    detailLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
    },
    detailValue: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
      marginLeft: 'auto',
    },
    detailAddress: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
      flex: 1,
      marginLeft: 'auto',
    },
    vendorActions: {
      flexDirection: 'row',
      marginTop: '12@vs',
      paddingTop: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: '8@ms',
    },
    vendorActionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '10@vs',
      paddingHorizontal: '12@s',
      borderRadius: '8@ms',
      gap: '6@ms',
    },
    vendorActionButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@ms',
      fontWeight: '600',
      color: '#FFFFFF',
    },
    removeVendorButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '12@vs',
      paddingHorizontal: '16@s',
      borderRadius: '8@ms',
      backgroundColor: theme.primary + '10',
      borderWidth: 1,
      borderColor: theme.primary + '30',
      marginTop: '12@vs',
      gap: '8@ms',
    },
    removeVendorButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@ms',
      fontWeight: '600',
      color: theme.primary,
    },
    vendorImagesContainer: {
      marginTop: '12@vs',
      paddingTop: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    vendorImagesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '10@vs',
      gap: '6@ms',
    },
    vendorImagesTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    vendorImagesScroll: {
      marginHorizontal: '-4@ms',
    },
    vendorImageWrapper: {
      marginRight: '8@ms',
      borderRadius: '8@ms',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    vendorImage: {
      width: '80@ms',
      height: '80@ms',
      backgroundColor: theme.card,
    },
    orderCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '16@ms',
      marginBottom: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12@ms',
    },
    orderHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    orderHeaderInfo: {
      flex: 1,
      marginLeft: '10@ms',
    },
    orderNumber: {
      fontSize: '15@ms',
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: '4@ms',
    },
    orderDetails: {
      marginTop: '8@ms',
      marginBottom: '12@ms',
    },
    viewOrderButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: '10@vs',
      paddingHorizontal: '12@s',
      borderRadius: '8@ms',
      backgroundColor: theme.primary + '10',
      borderWidth: 1,
      borderColor: theme.primary + '30',
      marginTop: '8@vs',
    },
    viewOrderButtonText: {
      fontSize: '14@ms',
      fontWeight: '600',
      color: theme.primary,
      flex: 1,
      marginLeft: '8@ms',
    },
    emptyVendorsContainer: {
      paddingVertical: '30@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyVendorsText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    committedSubcategoriesContainer: {
      marginTop: '16@vs',
      paddingTop: '16@vs',
      borderTopWidth: 2,
      borderTopColor: theme.border,
    },
    committedSubcategoriesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '14@vs',
    },
    committedSubcategoriesTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    committedSubcategoryCard: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '14@s',
      marginBottom: '10@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    committedSubcategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '12@vs',
    },
    subcategoryIconContainer: {
      width: '32@s',
      height: '32@s',
      borderRadius: '16@s',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: '10@s',
    },
    committedSubcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      flex: 1,
    },
    committedSubcategoryDetails: {
      marginLeft: '42@s',
    },
    committedSubcategoryDetailRow: {
      flexDirection: 'row',
      gap: '16@s',
      marginBottom: '10@vs',
    },
    committedSubcategoryDetailItem: {
      flex: 1,
    },
    committedSubcategoryDetailLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    committedSubcategoryDetailValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    committedSubcategoryPriceRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '8@s',
      marginTop: '4@vs',
    },
    priceBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      paddingHorizontal: '10@s',
      paddingVertical: '6@vs',
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    priceBadgeText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.textPrimary,
    },
    bottomRow: {
      flexDirection: 'row',
      gap: '8@s',
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    actionButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '12@vs',
      borderRadius: '10@ms',
      borderColor: theme.primary,
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    actionButtonDisabled: {
      opacity: 0.5,
    },
    actionButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
      textAlign: 'center',
    },
    infoContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'flex-start',
      paddingVertical: '12@vs',
      paddingHorizontal: '16@s',
      backgroundColor: theme.primary + '10',
      borderRadius: '8@ms',
      gap: '8@ms',
    },
    infoText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@ms',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'left',
    },
    completedContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '12@vs',
      gap: '8@s',
    },
    completedText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: '#4CAF50',
      textAlign: 'center',
    },
  });

export default BulkRequestDetailsScreen;

