import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Vibration, Platform, Animated, Image, ActivityIndicator, Modal, Alert, DeviceEventEmitter, AppState, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { CategoryBadge } from '../../components/CategoryBadge';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useTabBar } from '../../context/TabBarContext';
import { useUserMode } from '../../context/UserModeContext';
import LinearGradient from 'react-native-linear-gradient';
import { getUserData } from '../../services/auth/authService';
import { useProfile } from '../../hooks/useProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '../../services/api/v2/categories';
import { useCategories, useUserCategories, useUserSubcategories } from '../../hooks/useCategories';
import { useRecyclingStats, useVendorRecyclingStats } from '../../hooks/useRecycling';
import { useMonthlyBreakdown } from '../../hooks/useEarnings';
import { useActivePickup, useAllActivePickups, useAvailablePickupRequests, useAcceptPickupRequest, useBulkScrapRequests, useAcceptedBulkScrapRequests, useAcceptBulkScrapRequest, useRejectBulkScrapRequest } from '../../hooks/useOrders';
import { startPickup, cancelPickupRequest } from '../../services/api/v2/orders';
import { PickupRequest } from '../../services/api/v2/orders';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

const DashboardScreen = () => {
  const { theme, isDark, themeName } = useTheme();
  const { setTabBarVisible } = useTabBar();
  const { mode, setMode } = useUserMode();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [acceptingOrderId, setAcceptingOrderId] = useState<number | string | null>(null);
  const [cancellingOrderId, setCancellingOrderId] = useState<number | string | null>(null);
  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<PickupRequest | null>(null);
  const [selectedCancelReason, setSelectedCancelReason] = useState<string>('');
  const [customCancelReason, setCustomCancelReason] = useState<string>('');
  const [cancelBulkScrapModalVisible, setCancelBulkScrapModalVisible] = useState(false);
  const [selectedBulkScrapRequestForCancel, setSelectedBulkScrapRequestForCancel] = useState<any | null>(null);
  const [selectedBulkScrapCancelReason, setSelectedBulkScrapCancelReason] = useState<string>('');
  const [customBulkScrapCancelReason, setCustomBulkScrapCancelReason] = useState<string>('');
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

  // Helper function to format scheduled date and time - same format as customer app
  const formatScheduledDateTime = (pickup: any): string => {
    try {
      const preferredDate = pickup?.preferred_pickup_date;
      const preferredTimeSlot = pickup?.preferred_pickup_time_slot;

      // Console log to verify data
      console.log('🕐 [Dashboard] Formatting scheduled date/time for order:', pickup.order_number);
      console.log('   preferred_pickup_date:', preferredDate);
      console.log('   preferred_pickup_time_slot:', preferredTimeSlot);
      console.log('   preferred_pickup_time:', pickup?.preferred_pickup_time);
      console.log('   pickup_time_display:', pickup?.pickup_time_display);

      // Use backend formatted fields if available (from updated backend)
      if (preferredDate && preferredTimeSlot) {
        return `${preferredDate}, ${preferredTimeSlot}`;
      }

      // If we have time slot but no date, try to get date from preferred_pickup_time or use pickup_time_display
      if (preferredTimeSlot) {
        if (preferredDate) {
          return `${preferredDate}, ${preferredTimeSlot}`;
        }
        // Try to extract date from preferred_pickup_time
        const preferredTime = pickup?.preferred_pickup_time;
        if (preferredTime) {
          const dateTimeMatch = preferredTime.match(/(\d{4}-\d{2}-\d{2})\s+(.+)/);
          if (dateTimeMatch) {
            const dateStr = dateTimeMatch[1];
            try {
              const pickupDate = new Date(dateStr);
              const today = new Date();
              today.setHours(0, 0, 0, 0);
              const tomorrow = new Date(today);
              tomorrow.setDate(tomorrow.getDate() + 1);
              const dateOnly = new Date(pickupDate);
              dateOnly.setHours(0, 0, 0, 0);

              const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
              const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

              let formattedDate = '';
              if (dateOnly.getTime() === today.getTime()) {
                formattedDate = t('dashboard.today') || 'Today';
              } else if (dateOnly.getTime() === tomorrow.getTime()) {
                formattedDate = t('dashboard.tomorrow') || 'Tomorrow';
              } else {
                const dayName = days[pickupDate.getDay()];
                const day = pickupDate.getDate();
                const month = months[pickupDate.getMonth()];
                const year = pickupDate.getFullYear();
                formattedDate = `${dayName}, ${day} ${month} ${year}`;
              }

              return `${formattedDate}, ${preferredTimeSlot}`;
            } catch (e) {
              console.error('Error parsing date from preferred_pickup_time:', e);
            }
          }
        }
        // If we have time slot but can't get date, just show time slot
        return preferredTimeSlot;
      }

      // Fallback: parse from preferred_pickup_time if backend hasn't been updated yet
      const preferredTime = pickup?.preferred_pickup_time;

      if (preferredTime) {
        // Parse format: "YYYY-MM-DD 9:00 AM - 12:00 PM" (customer app format)
        const dateTimeMatch = preferredTime.match(/(\d{4}-\d{2}-\d{2})\s+(.+)/);

        if (dateTimeMatch) {
          const dateStr = dateTimeMatch[1]; // "YYYY-MM-DD"
          const timeSlot = dateTimeMatch[2]; // "9:00 AM - 12:00 PM"

          try {
            const pickupDate = new Date(dateStr);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);
            const dateOnly = new Date(pickupDate);
            dateOnly.setHours(0, 0, 0, 0);

            // Format date same as customer app: "Monday, 15 January 2024"
            const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

            let formattedDate = '';
            if (dateOnly.getTime() === today.getTime()) {
              formattedDate = t('dashboard.today') || 'Today';
            } else if (dateOnly.getTime() === tomorrow.getTime()) {
              formattedDate = t('dashboard.tomorrow') || 'Tomorrow';
            } else {
              const dayName = days[pickupDate.getDay()];
              const day = pickupDate.getDate();
              const month = months[pickupDate.getMonth()];
              const year = pickupDate.getFullYear();
              formattedDate = `${dayName}, ${day} ${month} ${year}`;
            }

            return `${formattedDate}, ${timeSlot}`;
          } catch (e) {
            console.error('Error parsing preferred_pickup_time date:', e);
          }
        }
      }

      // Final fallback
      return pickup?.pickup_time_display || t('dashboard.today') || 'Today';
    } catch (error) {
      console.error('Error formatting scheduled date/time:', error);
      return pickup?.pickup_time_display || t('dashboard.today') || 'Today';
    }
  };

  // Helper function to format address (handles string, object, or JSON string)
  const formatAddress = (address: any): string => {
    if (!address) return '';

    try {
      // If address is already a string
      if (typeof address === 'string') {
        // Check if it's a JSON string that needs parsing
        const trimmed = address.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(address);
            if (typeof parsed === 'object' && parsed !== null) {
              // Extract address from object
              return parsed.address ||
                parsed.formattedAddress ||
                parsed.fullAddress ||
                parsed.customerdetails ||
                (parsed.name && parsed.location ? `${parsed.name}, ${parsed.location}` : '') ||
                JSON.stringify(parsed);
            }
          } catch {
            // If JSON parsing fails, return the string as is
            return address;
          }
        }
        return address;
      }

      // If address is an object
      if (typeof address === 'object' && address !== null) {
        return address.address ||
          address.formattedAddress ||
          address.fullAddress ||
          address.customerdetails ||
          (address.name && address.location ? `${address.name}, ${address.location}` : '') ||
          JSON.stringify(address);
      }

      return String(address);
    } catch (error) {
      console.error('Error formatting address:', error);
      return String(address);
    }
  };

  // React Query hooks for categories
  const { data: userCategoriesData, isLoading: loadingCategories, refetch: refetchUserCategories } = useUserCategories(
    userData?.id,
    !!userData?.id
  );
  const { data: userSubcategoriesData, isLoading: loadingSubcategories, refetch: refetchUserSubcategories } = useUserSubcategories(
    userData?.id,
    !!userData?.id
  );

  // Get all categories to match with user's category IDs
  const { data: allCategoriesData, refetch: refetchAllCategories } = useCategories('b2c', true);

  // Get vendor recycling statistics from new v2 API (uses status 5 orders with actual_weight)
  const {
    data: recyclingStats,
    isLoading: loadingRecyclingStats,
    error: recyclingStatsError,
    isError: isRecyclingStatsError,
    refetch: refetchRecyclingStats
  } = useVendorRecyclingStats(
    userData?.id,
    !!userData?.id
  );

  // Get monthly breakdown (for B2C vendors, use 'shop' type to get orders completed by their shop)
  const {
    data: monthlyBreakdownData,
    isLoading: loadingMonthlyBreakdown,
    error: monthlyBreakdownError,
    isError: isMonthlyBreakdownError,
    refetch: refetchMonthlyBreakdown
  } = useMonthlyBreakdown(
    userData?.id,
    'shop', // Changed from 'customer' to 'shop' for B2C vendors
    6,
    !!userData?.id
  );

  // Log errors for debugging
  useEffect(() => {
    if (isRecyclingStatsError && recyclingStatsError) {
      console.error('❌ Error fetching recycling stats:', recyclingStatsError);
      console.error('   User ID:', userData?.id);
      console.error('   Error details:', {
        message: recyclingStatsError?.message,
        stack: recyclingStatsError?.stack,
        name: recyclingStatsError?.name
      });
    }
  }, [isRecyclingStatsError, recyclingStatsError, userData?.id]);

  useEffect(() => {
    if (isMonthlyBreakdownError && monthlyBreakdownError) {
      console.error('❌ Error fetching monthly breakdown:', monthlyBreakdownError);
      console.error('   User ID:', userData?.id);
      console.error('   Error details:', {
        message: monthlyBreakdownError?.message,
        stack: monthlyBreakdownError?.stack,
        name: monthlyBreakdownError?.name
      });
    }
  }, [isMonthlyBreakdownError, monthlyBreakdownError, userData?.id]);

  // Log successful data fetches
  useEffect(() => {
    if (recyclingStats && !loadingRecyclingStats) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('♻️  RECYCLING STATS API DATA (B2C Dashboard)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📊 Full Recycling Stats Data:', JSON.stringify(recyclingStats, null, 2));
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('📈 Summary:');
      console.log('   Total Recycled Weight:', recyclingStats.total_recycled_weight_kg, 'kg');
      console.log('   Total Carbon Offset:', recyclingStats.total_carbon_offset_kg, 'kg CO2');
      console.log('   Total Orders Completed:', recyclingStats.total_orders_completed);
      console.log('   Trees Equivalent:', recyclingStats.trees_equivalent);
      console.log('   Cars Off Road Days:', recyclingStats.cars_off_road_days);
      if (recyclingStats.category_breakdown && recyclingStats.category_breakdown.length > 0) {
        console.log('   Category Breakdown Count:', recyclingStats.category_breakdown.length);
      }
      if (recyclingStats.monthly_breakdown && recyclingStats.monthly_breakdown.length > 0) {
        console.log('   Monthly Breakdown Count:', recyclingStats.monthly_breakdown.length);
        console.log('   Monthly Breakdown:', JSON.stringify(recyclingStats.monthly_breakdown, null, 2));
      }
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }
  }, [recyclingStats, loadingRecyclingStats]);

  useEffect(() => {
    if (monthlyBreakdownData && !loadingMonthlyBreakdown) {
      console.log('✅ Monthly breakdown loaded:', {
        totalEarnings: monthlyBreakdownData.totalEarnings,
        totalOrders: monthlyBreakdownData.totalOrders,
        monthlyBreakdownCount: monthlyBreakdownData.monthlyBreakdown?.length || 0
      });
    }
  }, [monthlyBreakdownData, loadingMonthlyBreakdown]);

  // Determine user_type for B2C dashboard (R or SR)
  // B2C users can be either 'R' (Retailer) or 'SR' (B2B+B2C)
  const b2cUserType = React.useMemo(() => {
    const userType = userData?.user_type;
    // B2C dashboard supports R and SR user types
    if (userType === 'R' || userType === 'SR') {
      return userType;
    }
    // Default to 'R' if user_type is not set or is something else
    return 'R';
  }, [userData?.user_type]);

  // Get active pickup order (for R or SR type users in B2C dashboard)
  const { data: activePickup, isLoading: loadingActivePickup, refetch: refetchActivePickup, isRefetching: isRefetchingActivePickup } = useActivePickup(
    userData?.id,
    b2cUserType as 'R' | 'SR',
    !!userData?.id && !!b2cUserType
  );

  // Get all active pickups to show count and navigate to list
  const { data: allActivePickups } = useAllActivePickups(
    userData?.id,
    b2cUserType as 'R' | 'SR',
    !!userData?.id && !!b2cUserType
  );

  // Filter out bulk request orders from active pickups (only show customer orders)
  // Bulk request orders have a bulk_request_id field
  const filteredActivePickup = React.useMemo(() => {
    if (!activePickup) return null;
    // Check if this order is from a bulk request (has bulk_request_id)
    const orderAny = activePickup as any;
    if (orderAny?.bulk_request_id !== null && orderAny?.bulk_request_id !== undefined) {
      return null; // Hide bulk request orders
    }
    return activePickup;
  }, [activePickup]);

  // Filter out bulk request orders from all active pickups (only show customer orders)
  const filteredAllActivePickups = React.useMemo(() => {
    if (!allActivePickups || allActivePickups.length === 0) return [];
    // Filter out orders that have bulk_request_id field
    return allActivePickups.filter((pickup: any) => {
      // If bulk_request_id exists and is not null/undefined, exclude it
      return pickup?.bulk_request_id === null || pickup?.bulk_request_id === undefined;
    });
  }, [allActivePickups]);

  // Get available pickup requests (for accepting new orders)
  const { data: availablePickupRequests, isLoading: loadingAvailableRequests, refetch: refetchAvailableRequests, isRefetching: isRefetchingAvailableRequests } = useAvailablePickupRequests(
    userData?.id,
    b2cUserType as 'R' | 'SR', // B2C dashboard is for R (Retailer) or SR (B2B+B2C) type users
    undefined, // No location filtering for now
    undefined,
    10,
    !!userData?.id && !!b2cUserType
  );

  // Accept pickup request mutation
  const acceptPickupMutation = useAcceptPickupRequest();
  
  // Accept/reject bulk scrap request mutations
  const acceptBulkScrapMutation = useAcceptBulkScrapRequest();
  const rejectBulkScrapMutation = useRejectBulkScrapRequest();
  
  const [acceptingBulkScrapId, setAcceptingBulkScrapId] = useState<string | number | null>(null);
  const [rejectingBulkScrapId, setRejectingBulkScrapId] = useState<string | number | null>(null);
  const [participateQuantityModalVisible, setParticipateQuantityModalVisible] = useState(false);
  const [selectedBulkScrapRequestForParticipate, setSelectedBulkScrapRequestForParticipate] = useState<any | null>(null);
  const [participateQuantity, setParticipateQuantity] = useState<string>('');

  // Get user location from profile/shop for bulk scrap requests
  const userLocation = React.useMemo(() => {
    if (profileData?.shop?.lat_log) {
      const [lat, lng] = profileData.shop.lat_log.split(',').map(Number);
      if (!isNaN(lat) && !isNaN(lng)) {
        return { latitude: lat, longitude: lng };
      }
    }
    return null;
  }, [profileData]);

  // Get bulk scrap purchase requests
  // Note: Backend can fetch shop location if not provided, so we allow query to run even without userLocation
  const { data: bulkScrapRequests, isLoading: loadingBulkScrapRequests, refetch: refetchBulkScrapRequests, error: bulkScrapRequestsError } = useBulkScrapRequests(
    userData?.id,
    userData?.user_type || 'R',
    userLocation?.latitude,
    userLocation?.longitude,
    !!userData?.id && !!userData?.user_type
  );

  // Get accepted bulk scrap purchase requests
  const { data: acceptedBulkScrapRequests, isLoading: loadingAcceptedBulkScrapRequests, refetch: refetchAcceptedBulkScrapRequests } = useAcceptedBulkScrapRequests(
    userData?.id,
    userData?.user_type || 'R',
    userLocation?.latitude,
    userLocation?.longitude,
    !!userData?.id && !!userData?.user_type
  );

  // Filter out accepted and rejected requests from the main list
  // Only show active requests that are not fulfilled
  const nonAcceptedBulkScrapRequests = useMemo(() => {
    if (!bulkScrapRequests || !userData?.id) return bulkScrapRequests || [];
    
    // Get list of accepted request IDs
    const acceptedRequestIds = new Set(
      (acceptedBulkScrapRequests || []).map((req: any) => req.id)
    );
    
    const userId = parseInt(String(userData.id));
    
    // Filter out accepted and rejected requests
    // Only show active requests that are not fulfilled
    return bulkScrapRequests.filter((req: any) => {
      // Only show active requests
      if (req.status !== 'active') {
        return false;
      }
      
      // Only show requests that are not fulfilled (total_committed_quantity < quantity)
      const totalCommitted = req.total_committed_quantity || 0;
      const requestedQuantity = req.quantity || 0;
      if (totalCommitted >= requestedQuantity) {
        return false; // Request is fulfilled
      }
      
      // Skip if already accepted
      if (acceptedRequestIds.has(req.id)) {
        return false;
      }
      
      // Check if user has rejected this request
      const rejectedVendors = req.rejected_vendors || [];
      const isRejected = rejectedVendors.some((vendor: any) => {
        const vendorUserId = typeof vendor.user_id === 'string' ? parseInt(vendor.user_id) : (typeof vendor.user_id === 'number' ? vendor.user_id : parseInt(String(vendor.user_id)));
        return vendorUserId === userId;
      });
      
      // Skip if rejected
      if (isRejected) {
        return false;
      }
      
      return true;
    });
  }, [bulkScrapRequests, acceptedBulkScrapRequests, userData?.id]);

  // Get first accepted request for "Active Buy Requests" section
  const activeBuyRequest = acceptedBulkScrapRequests && acceptedBulkScrapRequests.length > 0
    ? acceptedBulkScrapRequests[0]
    : null;

  // Debug: Log bulk scrap requests data
  React.useEffect(() => {
    console.log('🔍 [B2C Dashboard] Bulk Scrap Requests Debug:', {
      userData_id: userData?.id,
      user_type: userData?.user_type,
      userLocation: userLocation,
      enabled: !!userData?.id && !!userLocation && !!userData?.user_type,
      loading: loadingBulkScrapRequests,
      error: bulkScrapRequestsError,
      requestsCount: bulkScrapRequests?.length || 0,
      requests: bulkScrapRequests
    });
  }, [userData?.id, userData?.user_type, userLocation, loadingBulkScrapRequests, bulkScrapRequestsError, bulkScrapRequests]);

  // Get all available requests to show in "Accept Waste Collection" section
  // Show all status 1 (Scheduled) orders - these are orders waiting for acceptance
  // Note: Status 1 orders should always be visible, even if there's an active pickup
  const availableRequests = availablePickupRequests && availablePickupRequests.length > 0
    ? availablePickupRequests
    : [];

  // Console log to verify backend response
  React.useEffect(() => {
    if (availableRequests && availableRequests.length > 0) {
      console.log('📦 [Dashboard] Received available pickup requests from backend:', availableRequests.length);
      availableRequests.forEach((order: PickupRequest, index: number) => {
        console.log(`\n📦 Available Request ${index + 1} (Order #${order.order_number}):`);
        console.log('   preferred_pickup_date:', (order as any)?.preferred_pickup_date);
        console.log('   preferred_pickup_time_slot:', (order as any)?.preferred_pickup_time_slot);
        console.log('   preferred_pickup_time:', order?.preferred_pickup_time);
        console.log('   pickup_time_display:', (order as any)?.pickup_time_display);
      });
    } else if (availableRequests && availableRequests.length === 0) {
      console.log('📦 [Dashboard] No available pickup requests received from backend');
    }
  }, [availableRequests]);

  // Handle accept order for a specific order
  const handleAcceptOrder = async (order: PickupRequest) => {
    if (!order || !userData?.id) {
      console.error('❌ [handleAcceptOrder] Missing order or userData:', { order, userData });
      return;
    }

    const orderNumber = order.order_number || order.order_id || order.id;
    if (!orderNumber) {
      console.error('❌ [handleAcceptOrder] Order number not found in order:', order);
      Alert.alert(
        t('common.error') || 'Error',
        'Order number not found. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    console.log('✅ [handleAcceptOrder] Accepting order:', {
      order_number: orderNumber,
      order_id: order.order_id || order.id,
      full_order: order
    });

    // Set the accepting order ID to show loading state only for this specific order
    setAcceptingOrderId(orderNumber);

    try {
      await acceptPickupMutation.mutateAsync({
        orderId: orderNumber,
        userId: userData.id,
        userType: b2cUserType as 'R' | 'SR'
      });

      // Clear accepting state
      setAcceptingOrderId(null);

      // Show success message
      Alert.alert(
        t('dashboard.orderAccepted') || 'Order Accepted',
        t('dashboard.orderAcceptedMessage') || `Order #${order.order_number} has been accepted successfully!`,
        [{ text: t('common.ok') || 'OK' }]
      );

      // Invalidate and refetch queries to ensure dashboard shows the newest order
      // This ensures the "Accept Waste Collection" section refreshes with the next available order
      // Invalidate ALL available pickup requests queries for this user (regardless of location params)
      queryClient.invalidateQueries({
        predicate: (query) => {
          const queryKey = query.queryKey;
          return (
            queryKey[0] === 'orders' &&
            queryKey[1] === 'availablePickupRequests' &&
            queryKey[2] === userData.id &&
            queryKey[3] === 'R'
          );
        },
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.activePickup(userData.id, 'R')
      });

      // Manually refetch for immediate update
      await Promise.all([
        refetchAvailableRequests(),
        refetchActivePickup()
      ]);

      console.log('✅ Dashboard: Orders refreshed after accepting order');
    } catch (error: any) {
      // Clear accepting state on error
      setAcceptingOrderId(null);
      console.error('Error accepting order:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error?.message || t('dashboard.orderAcceptError') || 'Failed to accept order. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  // Handle accept bulk scrap request
  // Handle participate in bulk scrap request - navigate to participate screen
  const handleAcceptBulkScrapRequest = (request: any) => {
    if (!request || !userData?.id) {
      console.error('❌ [handleAcceptBulkScrapRequest] Missing request or userData:', { request, userData });
      return;
    }

    // Navigate to participate screen
    navigation.navigate('ParticipateBulkRequest', { request });
  };

  // Handle confirm participate with quantity
  const handleConfirmParticipateBulkScrapRequest = async () => {
    if (!selectedBulkScrapRequestForParticipate || !userData?.id) return;

    const request = selectedBulkScrapRequestForParticipate;
    const requestId = request.id;
    
    // Calculate remaining quantity
    const requestedQuantity = request.quantity || 0;
    const totalCommitted = request.total_committed_quantity || 0;
    const remainingQuantity = requestedQuantity - totalCommitted;

    // Parse quantity
    let quantityValue: number | undefined = undefined;
    if (participateQuantity.trim()) {
      quantityValue = parseFloat(participateQuantity.trim());
      if (isNaN(quantityValue) || quantityValue <= 0) {
        Alert.alert(
          t('common.error') || 'Error',
          t('dashboard.invalidQuantity') || 'Please enter a valid quantity (greater than 0)',
          [{ text: t('common.ok') || 'OK' }]
        );
        return;
      }
      if (quantityValue > remainingQuantity) {
        Alert.alert(
          t('common.error') || 'Error',
          (t('dashboard.quantityExceedsRemaining') || 'Cannot commit this quantity. Only {remaining} kg remaining.').replace('{remaining}', remainingQuantity.toFixed(2)),
          [{ text: t('common.ok') || 'OK' }]
        );
        return;
      }
    } else {
      // If no quantity provided, use remaining quantity
      if (remainingQuantity <= 0) {
        Alert.alert(
          t('common.error') || 'Error',
          t('dashboard.noRemainingQuantity') || 'No remaining quantity available. This request is fully committed.',
          [{ text: t('common.ok') || 'OK' }]
        );
        return;
      }
      quantityValue = remainingQuantity;
    }

    setAcceptingBulkScrapId(requestId);

    try {
      await acceptBulkScrapMutation.mutateAsync({
        requestId: requestId,
        userId: userData.id,
        userType: b2cUserType as 'R' | 'SR',
        quantity: quantityValue
      });

      setAcceptingBulkScrapId(null);
      
      // Close modal and clear state
      setParticipateQuantityModalVisible(false);
      setSelectedBulkScrapRequestForParticipate(null);
      setParticipateQuantity('');

      Alert.alert(
        t('dashboard.requestAccepted') || 'Request Accepted',
        t('dashboard.bulkScrapRequestAcceptedMessage') || 'Bulk scrap purchase request accepted successfully!',
        [{ text: t('common.ok') || 'OK' }]
      );

      // Refetch bulk scrap requests
      refetchBulkScrapRequests();
      refetchAcceptedBulkScrapRequests();
    } catch (error: any) {
      setAcceptingBulkScrapId(null);
      console.error('Error accepting bulk scrap request:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error?.message || t('dashboard.requestAcceptError') || 'Failed to accept request. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  // Handle reject bulk scrap request - opens modal
  const handleRejectBulkScrapRequest = (request: any) => {
    if (!request || !userData?.id) {
      console.error('❌ [handleRejectBulkScrapRequest] Missing request or userData:', { request, userData });
      return;
    }

    // Open cancel modal
    setSelectedBulkScrapRequestForCancel(request);
    setCancelBulkScrapModalVisible(true);
    setSelectedBulkScrapCancelReason('');
    setCustomBulkScrapCancelReason('');
  };

  // Handle confirm reject bulk scrap request
  const handleConfirmRejectBulkScrapRequest = async () => {
    if (!selectedBulkScrapRequestForCancel || !userData?.id) return;

    const reason = selectedBulkScrapCancelReason === 'other'
      ? customBulkScrapCancelReason.trim()
      : selectedBulkScrapCancelReason;

    if (!reason) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.cancelReasonRequired') || 'Please select or enter a cancellation reason',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    const requestId = selectedBulkScrapRequestForCancel.id;
    setRejectingBulkScrapId(requestId);

    try {
      await rejectBulkScrapMutation.mutateAsync({
        requestId: requestId,
        userId: userData.id,
        userType: 'R',
        rejectionReason: reason
      });

      // Close modal and clear state
      setCancelBulkScrapModalVisible(false);
      setSelectedBulkScrapRequestForCancel(null);
      setSelectedBulkScrapCancelReason('');
      setCustomBulkScrapCancelReason('');
      setRejectingBulkScrapId(null);

      Alert.alert(
        t('dashboard.requestRejected') || 'Request Rejected',
        t('dashboard.bulkScrapRequestRejectedMessage') || 'Bulk scrap purchase request rejected.',
        [{ text: t('common.ok') || 'OK' }]
      );

      // Refetch bulk scrap requests
      refetchBulkScrapRequests();
      refetchAcceptedBulkScrapRequests();
    } catch (error: any) {
      setRejectingBulkScrapId(null);
      console.error('Error rejecting bulk scrap request:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error?.message || t('dashboard.requestRejectError') || 'Failed to reject request. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  // Handle cancel order
  const handleCancelOrder = (order: PickupRequest) => {
    console.log('🔴 handleCancelOrder called:', order?.order_number);
    console.log('   Order:', order);
    console.log('   User ID:', userData?.id);

    if (!order || !userData?.id) {
      console.warn('⚠️ Cannot cancel: missing order or userData');
      return;
    }

    // Open cancel modal
    console.log('📝 Setting cancel modal state...');
    try {
      setSelectedOrderForCancel(order);
      setCancelModalVisible(true);
      setSelectedCancelReason('');
      setCustomCancelReason('');
      console.log('✅ Cancel modal state set - cancelModalVisible should be true');
    } catch (error) {
      console.error('❌ Error setting cancel modal state:', error);
    }
  };

  // Handle cancel order confirmation
  const handleConfirmCancel = async () => {
    if (!selectedOrderForCancel || !userData?.id) return;

    const reason = selectedCancelReason === 'other'
      ? customCancelReason.trim()
      : selectedCancelReason;

    if (!reason) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.cancelReasonRequired') || 'Please select or enter a cancellation reason',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    setCancellingOrderId(selectedOrderForCancel.order_number);

    try {
      await cancelPickupRequest(
        selectedOrderForCancel.order_number,
        userData.id,
        'R',
        reason
      );

      // Close modal and clear state
      setCancelModalVisible(false);
      setSelectedOrderForCancel(null);
      setSelectedCancelReason('');
      setCustomCancelReason('');
      setCancellingOrderId(null);

      // Show success message
      Alert.alert(
        t('dashboard.orderCancelled') || 'Order Cancelled',
        t('dashboard.orderCancelledMessage') || `Order #${selectedOrderForCancel.order_number} has been cancelled.`,
        [{ text: t('common.ok') || 'OK' }]
      );

      // Invalidate and refetch queries
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.availablePickupRequests(userData.id, 'R')
      });

      // Also invalidate completed pickups (My Orders) so cancelled orders appear there
      queryClient.invalidateQueries({
        queryKey: queryKeys.orders.completedPickups(userData.id, 'R')
      });

      // Manually refetch for immediate update
      await refetchAvailableRequests();

      console.log('✅ Dashboard: Orders refreshed after cancelling order');
    } catch (error: any) {
      setCancellingOrderId(null);
      console.error('Error cancelling order:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error?.message || t('dashboard.orderCancelError') || 'Failed to cancel order. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  // Cancellation reasons
  const cancellationReasons = useMemo(() => [
    { value: 'too_far', label: t('dashboard.cancelReasonTooFar') || 'Too far from my location' },
    { value: 'low_price', label: t('dashboard.cancelReasonLowPrice') || 'Price is too low' },
    { value: 'wrong_category', label: t('dashboard.cancelReasonWrongCategory') || 'Not my category' },
    { value: 'unavailable', label: t('dashboard.cancelReasonUnavailable') || 'I am unavailable' },
    { value: 'other', label: t('dashboard.cancelReasonOther') || 'Other reason' },
  ], [t]);

  // Debug: Log modal state changes
  useEffect(() => {
    console.log('🔍 Cancel modal state changed:', {
      cancelModalVisible,
      hasSelectedOrder: !!selectedOrderForCancel,
      orderNumber: selectedOrderForCancel?.order_number
    });
  }, [cancelModalVisible, selectedOrderForCancel]);

  // Refetch all category data and available pickup requests when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          console.log('🔄 Dashboard focused - refetching category data and available pickup requests...');
          // Just refetch, no need to invalidate on focus
          refetchUserCategories();
          refetchUserSubcategories();
          refetchAllCategories();
          // Refetch available pickup requests when screen comes into focus
          refetchAvailableRequests();
          refetchActivePickup();
          // Refetch bulk scrap requests and accepted requests
          if (userLocation && userData?.user_type) {
            refetchBulkScrapRequests();
            refetchAcceptedBulkScrapRequests();
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, userData?.user_type, userLocation, refetchUserCategories, refetchUserSubcategories, refetchAllCategories, refetchAvailableRequests, refetchActivePickup, refetchBulkScrapRequests, queryClient])
  );

  // Refetch available pickup requests when app comes to foreground
  const appState = useRef(AppState.currentState);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: string) => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('🔄 App has come to the foreground - refetching available pickup requests...');
        if (userData?.id) {
          // Refetch available pickup requests when app comes to foreground
          refetchAvailableRequests();
          // Also refetch active pickup
          refetchActivePickup();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [userData?.id, refetchAvailableRequests, refetchActivePickup]);

  // Listen for new order notifications and refresh orders list
  React.useEffect(() => {
    const handleNewOrder = async (data: any) => {
      console.log('📦 B2C Dashboard: New order/pickup request notification received:', data);

      if (userData?.id && b2cUserType) {
        // Check if this order was accepted (status 2) - if so, it should show in active pickup
        const isAcceptedOrder = data?.status === 2 || data?.status === '2';
        
        console.log(`   Order status: ${data?.status}, Is accepted: ${isAcceptedOrder}`);

        // Always refetch active pickup if order is accepted (status 2) or if we don't have active pickup
        if (isAcceptedOrder || !activePickup) {
          console.log('🔄 B2C Dashboard: Refetching active pickup (order accepted or no active pickup)...');
          
          // Invalidate and remove active pickup cache
          queryClient.removeQueries({
            queryKey: queryKeys.orders.activePickup(userData.id, b2cUserType)
          });
          
          // Also invalidate all active pickups query
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return queryKey.length >= 3 &&
                queryKey[0] === 'orders' &&
                queryKey[1] === 'all' &&
                queryKey[2] === 'allActivePickups' &&
                queryKey[3] === userData.id &&
                queryKey[4] === b2cUserType;
            }
          });
          
          // Refetch immediately
          refetchActivePickup();
          console.log('✅ B2C Dashboard: Active pickup refetched');
        }

        // Check if we already have available requests data - if so, skip refetch for available requests
        const currentAvailableRequests = availablePickupRequests || [];
        const hasExistingData = currentAvailableRequests.length > 0;

        if (hasExistingData && !isAcceptedOrder) {
          console.log(`ℹ️ B2C Dashboard: Already have ${currentAvailableRequests.length} available order(s), skipping refetch`);
          return;
        }

        console.log('🔄 B2C Dashboard: Refetching available requests...');

        // First, remove all cached queries to force fresh fetch
        queryClient.removeQueries({
          predicate: (query) => {
            const queryKey = query.queryKey;
            return queryKey.length >= 3 &&
              queryKey[0] === 'orders' &&
              queryKey[1] === 'availablePickupRequests';
          }
        });

        // Small delay to ensure backend cache invalidation has completed
        await new Promise<void>(resolve => setTimeout(() => resolve(), 300));

        // Keep refetching until data is loaded or timeout
        let retryCount = 0;
        const maxRetries = 2; // Limit to 2 attempts maximum
        const retryDelay = 400; // 400ms for faster refresh

        const refetchWithRetry = async (): Promise<void> => {
          try {
            console.log(`🔄 B2C Dashboard: Refetching orders (attempt ${retryCount + 1}/${maxRetries})...`);

            // Manually refetch for immediate update
            // Using refetch with { cancelRefetch: false } to ensure we get fresh data
            const [availableResult, activeResult] = await Promise.all([
              refetchAvailableRequests(),
              refetchActivePickup()
            ]);

            // Check if we got new orders back (not just empty array)
            const availableOrders = availableResult.data || [];
            const hasNewOrders = availableOrders.length > 0;
            const hasActiveData = activeResult.data !== null;

            console.log(`📊 B2C Dashboard: Refetch results - Available orders: ${availableOrders.length}, Has active: ${hasActiveData}`);

            // If we have new orders or reached max retries, stop
            if (hasNewOrders || retryCount >= maxRetries - 1) {
              console.log(`✅ B2C Dashboard: Orders list refreshed after new order notification. Found ${availableOrders.length} available order(s)`);
              return;
            }

            // Continue refetching if no new orders yet
            retryCount++;
            console.log(`⏳ B2C Dashboard: No new orders yet, retrying in ${retryDelay}ms... (${retryCount}/${maxRetries})`);
            setTimeout(() => {
              refetchWithRetry();
            }, retryDelay);
          } catch (error) {
            console.error('❌ B2C Dashboard: Error refetching orders:', error);

            // Retry if we haven't exceeded max retries
            if (retryCount < maxRetries - 1) {
              retryCount++;
              console.log(`⏳ B2C Dashboard: Error occurred, retrying in ${retryDelay}ms... (${retryCount}/${maxRetries})`);
              setTimeout(() => {
                refetchWithRetry();
              }, retryDelay);
            } else {
              console.error('❌ B2C Dashboard: Max retries reached, giving up');
            }
          }
        };

        // Start refetching (don't await - let it run in background)
        refetchWithRetry();
      }
    };

    // Listen for both NEW_ORDER_RECEIVED and PICKUP_REQUEST_RECEIVED events
    const subscription1 = DeviceEventEmitter.addListener('NEW_ORDER_RECEIVED', handleNewOrder);
    const subscription2 = DeviceEventEmitter.addListener('PICKUP_REQUEST_RECEIVED', handleNewOrder);

    return () => {
      subscription1.remove();
      subscription2.remove();
    };
  }, [userData?.id, b2cUserType, queryClient, refetchAvailableRequests, refetchActivePickup, availablePickupRequests]);

  // Listen for order list updated notification (when order is accepted by another vendor)
  React.useEffect(() => {
    console.log('🎧 B2C Dashboard: Setting up ORDER_LIST_UPDATED listener');

    const subscription = DeviceEventEmitter.addListener('ORDER_LIST_UPDATED', async (data: any) => {
      console.log('🔄 B2C Dashboard: ORDER_LIST_UPDATED event received!');
      console.log('   Event data:', JSON.stringify(data, null, 2));
      console.log('   User ID:', userData?.id);

      if (userData?.id) {
        try {
          // Remove all cached queries to force fresh fetch
          queryClient.removeQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return queryKey.length >= 3 &&
                queryKey[0] === 'orders' &&
                queryKey[1] === 'availablePickupRequests';
            }
          });

          // Also remove active pickup query cache - use b2cUserType instead of hardcoded 'R'
          queryClient.removeQueries({
            queryKey: queryKeys.orders.activePickup(userData.id, b2cUserType)
          });
          
          // Also invalidate all active pickups query
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return queryKey.length >= 3 &&
                queryKey[0] === 'orders' &&
                queryKey[1] === 'all' &&
                queryKey[2] === 'allActivePickups' &&
                queryKey[3] === userData.id &&
                queryKey[4] === b2cUserType;
            }
          });

          console.log('🔄 Removed queries from cache, now refetching immediately...');

          // Small delay to ensure backend has processed the status change (order status 1 -> 2)
          // This ensures DynamoDB has updated the order before we refetch
          await new Promise<void>(resolve => setTimeout(() => resolve(), 200));

          // Refetch with force to bypass any stale cache
          const [availableResult, activeResult] = await Promise.all([
            refetchAvailableRequests(),
            refetchActivePickup()
          ]);

          console.log('✅ B2C Dashboard: Available requests refreshed after order list update');
          console.log(`   Available orders count: ${availableResult.data?.length || 0}`);

          // Log order numbers to verify accepted order is not in the list
          if (data.order_number) {
            const orderNumbers = availableResult.data?.map((o: any) => o.order_number || o.order_id || o.id) || [];
            const isOrderStillVisible = orderNumbers.includes(data.order_number);
            if (isOrderStillVisible) {
              console.warn(`⚠️  WARNING: Order #${data.order_number} is still visible in available orders after refresh!`);
            } else {
              console.log(`✅ Confirmed: Order #${data.order_number} has been removed from available orders`);
            }
          }
        } catch (error) {
          console.error('❌ B2C Dashboard: Error refreshing orders after ORDER_LIST_UPDATED:', error);
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userData?.id, b2cUserType, queryClient, refetchAvailableRequests, refetchActivePickup]);

  // Listen for pickup request accepted by another vendor notification (legacy - keeping for backward compatibility)
  React.useEffect(() => {
    console.log('🎧 B2C Dashboard: Setting up PICKUP_REQUEST_ACCEPTED_BY_OTHER listener (legacy)');

    const subscription = DeviceEventEmitter.addListener('PICKUP_REQUEST_ACCEPTED_BY_OTHER', async (data: any) => {
      console.log('⚠️ B2C Dashboard: PICKUP_REQUEST_ACCEPTED_BY_OTHER event received!');
      console.log('   Event data:', JSON.stringify(data, null, 2));
      console.log('   User ID:', userData?.id);

      if (userData?.id) {
        try {
          // First, invalidate ALL available pickup requests queries to remove the accepted order
          queryClient.invalidateQueries({
            predicate: (query) => {
              const queryKey = query.queryKey;
              return queryKey.length >= 3 &&
                queryKey[0] === 'orders' &&
                queryKey[1] === 'availablePickupRequests';
            }
          });

          // Also invalidate active pickup query
          queryClient.invalidateQueries({
            queryKey: queryKeys.orders.activePickup(userData.id, 'R')
          });

          console.log('🔄 Invalidated queries, now refetching...');

          // Manually refetch for immediate update (this bypasses cache)
          await Promise.all([
            refetchAvailableRequests(),
            refetchActivePickup()
          ]);

          console.log('✅ B2C Dashboard: Available requests refreshed after order accepted by another vendor');

          // Show alert to user after refreshing (so they see the order is gone)
          const orderNumber = data.order_number || data.order_id;
          Alert.alert(
            t('dashboard.orderAcceptedByOther') || 'Order Accepted',
            (t('dashboard.orderAcceptedByOtherMessage') || 'Order #{{orderNumber}} has been accepted by another vendor.').replace('{{orderNumber}}', String(orderNumber)),
            [
              {
                text: t('common.ok') || 'OK',
                onPress: () => {
                  console.log('User acknowledged order accepted by another vendor');
                }
              }
            ],
            { cancelable: true }
          );
        } catch (error) {
          console.error('❌ Error handling order accepted by another vendor:', error);
          console.error('   Error stack:', error instanceof Error ? error.stack : 'No stack trace');

          // Still show alert even if refetch fails
          const orderNumber = data.order_number || data.order_id;
          Alert.alert(
            t('dashboard.orderAcceptedByOther') || 'Order Accepted',
            (t('dashboard.orderAcceptedByOtherMessage') || 'Order #{{orderNumber}} has been accepted by another vendor.').replace('{{orderNumber}}', String(orderNumber)),
            [
              {
                text: t('common.ok') || 'OK',
                onPress: () => {
                  // Try to refetch again
                  refetchAvailableRequests();
                }
              }
            ],
            { cancelable: true }
          );
        }
      } else {
        console.warn('⚠️ B2C Dashboard: Received event but userData.id is not available');
      }
    });

    console.log('✅ B2C Dashboard: PICKUP_REQUEST_ACCEPTED_BY_OTHER listener registered');

    return () => {
      console.log('🧹 B2C Dashboard: Removing PICKUP_REQUEST_ACCEPTED_BY_OTHER listener');
      subscription.remove();
    };
  }, [userData?.id, queryClient, refetchAvailableRequests, refetchActivePickup]);

  // Listen for navigation events to refetch when returning from AddCategoryScreen
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userData?.id) {
        console.log('🔄 Navigation focus - refetching category data and orders...');
        // Refetch all category-related data
        refetchUserCategories();
        refetchUserSubcategories();
        refetchAllCategories();

        // Also refetch available requests to catch any orders that were accepted while away
        // This ensures the dashboard is up-to-date even if notifications were missed
        refetchAvailableRequests();
        refetchActivePickup();

        // Force refetch recycling stats even if cache exists (to show latest completed orders data)
        refetchRecyclingStats();
      }
    });

    return unsubscribe;
  }, [navigation, userData?.id, refetchUserCategories, refetchUserSubcategories, refetchAllCategories, refetchAvailableRequests, refetchActivePickup, refetchRecyclingStats, queryClient]);

  // Refetch when modal opens to ensure we have latest subcategories
  React.useEffect(() => {
    if (modalVisible && userData?.id && selectedCategory?.id) {
      // Force refetch to get latest data
      refetchUserSubcategories();
      refetchUserCategories();
    }
  }, [modalVisible, userData?.id, selectedCategory?.id, refetchUserSubcategories, refetchUserCategories]);

  // Process categories - show user's selected categories in dashboard
  // If user has no categories selected, show all categories (for new users)
  const userCategories = React.useMemo(() => {
    if (!allCategoriesData?.data) {
      return [];
    }

    // If user has selected categories, filter to show only those
    if (userCategoriesData?.data?.category_ids && userCategoriesData.data.category_ids.length > 0) {
      const userCategoryIds = userCategoriesData.data.category_ids.map(id => Number(id));
      const filtered = allCategoriesData.data.filter(cat => {
        const catId = Number(cat.id);
        return userCategoryIds.includes(catId);
      });
      console.log(`📦 Showing ${filtered.length} user-selected categories in dashboard (out of ${allCategoriesData.data.length} total)`);
      return filtered;
    }

    // If user has no categories selected, show all categories (for new users)
    console.log(`📦 User has no categories selected - showing all ${allCategoriesData.data.length} categories in dashboard`);
    return allCategoriesData.data;
  }, [allCategoriesData, userCategoriesData]);

  // Process category subcategories - only show user's selected subcategories for the selected category
  const categorySubcategories = React.useMemo(() => {
    console.log(`🔄 [categorySubcategories] Recomputing...`, {
      hasSelectedCategory: !!selectedCategory,
      selectedCategoryId: selectedCategory?.id,
      selectedCategoryName: selectedCategory?.name,
      hasUserSubcategoriesData: !!userSubcategoriesData,
      hasSubcategoriesArray: !!userSubcategoriesData?.data?.subcategories,
      subcategoriesCount: userSubcategoriesData?.data?.subcategories?.length || 0
    });

    if (!selectedCategory?.id) {
      console.log(`⚠️ [categorySubcategories] No selected category`);
      return [];
    }

    if (!userSubcategoriesData?.data?.subcategories) {
      console.log(`⚠️ [categorySubcategories] No user subcategories data`);
      return [];
    }

    // Convert category ID to number for comparison
    const categoryId = Number(selectedCategory.id);

    // Filter user's subcategories by the selected category
    // Use Number() conversion to handle type mismatches (string vs number)
    console.log(`🔍 [categorySubcategories] Filtering subcategories for category "${selectedCategory.name}" (ID: ${categoryId}, type: ${typeof selectedCategory.id})`);
    console.log(`📊 [categorySubcategories] Total user subcategories: ${userSubcategoriesData.data.subcategories.length}`);

    const userSubcatsForCategory = userSubcategoriesData.data.subcategories.filter(
      (us: any) => {
        const subcatCategoryId = Number(us.main_category_id);
        const matches = subcatCategoryId === categoryId;

        if (!matches) {
          console.log(`  ❌ Mismatch: subcategory "${us.name}" has main_category_id ${us.main_category_id} (${typeof us.main_category_id}) = ${subcatCategoryId}, category ID is ${categoryId}`);
        }

        return matches;
      }
    );

    console.log(`✅ [categorySubcategories] Found ${userSubcatsForCategory.length} subcategories for category "${selectedCategory.name}"`);

    if (userSubcatsForCategory.length === 0) {
      // Debug logging when no subcategories found
      console.log(`⚠️ [categorySubcategories] No subcategories found for category "${selectedCategory.name}" (ID: ${categoryId})`);
      console.log(`📋 [categorySubcategories] Sample subcategories:`, userSubcategoriesData.data.subcategories.slice(0, 3).map((us: any) => ({
        name: us.name,
        subcategory_id: us.subcategory_id,
        main_category_id: us.main_category_id,
        main_category_id_type: typeof us.main_category_id,
        main_category_id_number: Number(us.main_category_id)
      })));
      return [];
    }

    // Get full subcategory details from API if needed, or use what we have
    // Since we already have the data from userSubcategories, we can use it directly
    const mapped = userSubcatsForCategory.map((userSubcat: any) => ({
      id: userSubcat.subcategory_id,
      name: userSubcat.name,
      main_category_id: userSubcat.main_category_id,
      default_price: userSubcat.default_price || '',
      price_unit: userSubcat.price_unit || 'kg',
      custom_price: userSubcat.custom_price || '',
      display_price: userSubcat.display_price || userSubcat.custom_price || userSubcat.default_price || '0',
      display_price_unit: userSubcat.display_price_unit || userSubcat.price_unit || 'kg',
      image: userSubcat.image || ''
    }));

    console.log(`✅ [categorySubcategories] Mapped ${mapped.length} subcategories:`, mapped.map(s => s.name));

    return mapped;
  }, [selectedCategory?.id, selectedCategory?.name, userSubcategoriesData]);

  // Load user data and fetch profile
  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
      };
      loadUserData();
    }, [])
  );

  // Fetch profile data
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);

  // Check subscription status for R and SR type users
  const isSubscribed = React.useMemo(() => {
    // Get user type from multiple sources (userData, profileData.user_type, or profileData.user.user_type)
    const userType = userData?.user_type || profileData?.user_type || profileData?.user?.user_type;
    
    // Non-R and non-SR users are always considered subscribed
    if (userType !== 'R' && userType !== 'SR') {
      console.log('🔍 [Subscription Check] Non-R/SR user - treating as subscribed:', {
        userData_user_type: userData?.user_type,
        profileData_user_type: profileData?.user_type,
        profileData_user_user_type: profileData?.user?.user_type,
        userType: userType
      });
      return true;
    }
    
    // For R and SR users, we need profileData to check subscription
    // If profileData is not loaded yet, treat as NOT subscribed (will show blur)
    if (!profileData) {
      console.log('🔍 [Subscription Check] R/SR user but profileData not loaded yet - treating as NOT subscribed', {
        userType: userType,
        hasProfileData: false
      });
      return false;
    }
    
    // For SR users, we need to find the B2C shop (shop_type = 3)
    // For R users, use the shop directly
    let b2cShop: any = null;
    
    if (userType === 'SR') {
      // SR users may have both B2B and B2C shops
      // Try to get B2C shop from profileData.b2cShop first
      if (profileData.b2cShop) {
        b2cShop = profileData.b2cShop;
        console.log('🔍 [Subscription Check] SR user - using profileData.b2cShop');
      } else if (profileData.shop) {
        // Check if the shop is a B2C shop (shop_type = 3)
        const shop = profileData.shop as any;
        if (shop.shop_type === 3) {
          b2cShop = shop;
          console.log('🔍 [Subscription Check] SR user - using profileData.shop (B2C shop_type = 3)');
        } else {
          // If shop is not B2C, check if profileData has shops array
          if ((profileData as any).shops && Array.isArray((profileData as any).shops)) {
            const shops = (profileData as any).shops;
            const b2cShopFromArray = shops.find((s: any) => s.shop_type === 3);
            if (b2cShopFromArray) {
              b2cShop = b2cShopFromArray;
              console.log('🔍 [Subscription Check] SR user - found B2C shop from shops array');
            }
          }
        }
      }
    } else {
      // For R users, use shop directly
      b2cShop = (profileData.b2cShop || profileData.shop) as any;
    }
    
    if (!b2cShop) {
      console.log('🔍 [Subscription Check] No B2C shop data found - treating as NOT subscribed', {
        user_type: userType,
        hasB2CShop: !!profileData.b2cShop,
        hasShop: !!profileData.shop,
        shopType: (profileData.shop as any)?.shop_type,
        hasShopsArray: !!((profileData as any).shops && Array.isArray((profileData as any).shops))
      });
      // Fresh users without shop data are NOT subscribed
      return false;
    }
    
    // For fresh users, if is_subscribed is undefined/null, treat as NOT subscribed
    // Only explicitly subscribed users (is_subscribed === true) should see unblurred content
    if (b2cShop.is_subscribed === undefined || b2cShop.is_subscribed === null) {
      console.log('🔍 [Subscription Check] Fresh user - is_subscribed is undefined/null - treating as NOT subscribed', {
        user_type: userType,
        shopId: b2cShop.id,
        is_subscribed: b2cShop.is_subscribed
      });
      return false;
    }
    
    // Log subscription details for debugging
    // Calculate subscription status
    const subscriptionStatus = (() => {
      if (b2cShop.is_subscribed === false) return '❌ NOT SUBSCRIBED';
      if (b2cShop.is_subscription_ends === true) return '❌ SUBSCRIPTION ENDED';
      if (b2cShop.subscription_ends_at) {
        const endsAt = new Date(b2cShop.subscription_ends_at);
        const now = new Date();
        if (endsAt < now) return '❌ EXPIRED';
      }
      if (b2cShop.is_subscribed === true) return '✅ ACTIVE';
      return '⚠️ PENDING/UNKNOWN';
    })();
    
    // Format subscribed duration - can be 'month', 'year', 'order', or number of days
    const subscribedDuration = (() => {
      if (!b2cShop.subscribed_duration) return 'N/A';
      const duration = b2cShop.subscribed_duration;
      if (typeof duration === 'string') {
        // Handle string values like 'month', 'year', 'order'
        return duration;
      } else if (typeof duration === 'number') {
        // Handle numeric values (days)
        return `${duration} ${duration === 1 ? 'day' : 'days'}`;
      }
      return String(duration);
    })();
    
    // Format subscription ends status
    const isSubscriptionEnds = b2cShop.is_subscription_ends === true ? 'YES' : b2cShop.is_subscription_ends === false ? 'NO' : 'UNDEFINED';
    
    // Format is subscribed status
    const isSubscribedStatus = b2cShop.is_subscribed === true ? '✅ YES' : b2cShop.is_subscribed === false ? '❌ NO' : '⚠️ UNDEFINED';
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔍 [Subscription Check] Checking subscription for user:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('   Shop ID:', b2cShop.id);
    console.log('   Shop Name:', b2cShop.shopname || 'N/A');
    console.log('   Shop Type:', b2cShop.shop_type, `(${b2cShop.shop_type === 3 ? 'B2C' : b2cShop.shop_type === 1 ? 'B2B' : 'Unknown'})`);
      console.log('   User Type:', userType || 'N/A');
    console.log('   Is Subscribed:', isSubscribedStatus);
    console.log('   Subscription Ends At:', b2cShop.subscription_ends_at || 'N/A');
    console.log('   Is Subscription Ends:', isSubscriptionEnds);
    console.log('   Subscribed Duration:', subscribedDuration);
    console.log('   Status:', subscriptionStatus);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Also log full object for detailed debugging (matching the format user requested)
    console.log('🔍 [Subscription Check] Checking subscription for user:', {
      userId: userData?.id,
      userType: userType || 'N/A',
      shopId: b2cShop.id,
      shopName: b2cShop.shopname || 'N/A',
      shopType: b2cShop.shop_type,
      is_subscribed: b2cShop.is_subscribed,
      is_subscription_ends: b2cShop.is_subscription_ends,
      subscription_ends_at: b2cShop.subscription_ends_at,
      subscribed_duration: b2cShop.subscribed_duration,
      subscribed_duration_text: b2cShop.subscribed_duration_text,
      approval_status: b2cShop.approval_status,
      b2cShopKeys: Object.keys(b2cShop)
    });
    
    // Check if explicitly not subscribed
    if (b2cShop.is_subscribed === false) {
      console.log('❌ [Subscription Check] User is NOT subscribed (is_subscribed === false)');
      return false;
    }
    
    // Check if subscription has ended flag
    if (b2cShop.is_subscription_ends === true) {
      console.log('❌ [Subscription Check] User subscription has ended (is_subscription_ends === true)');
      return false;
    }
    
    // Check if subscription has ended by date
    if (b2cShop.subscription_ends_at) {
      const endsAt = new Date(b2cShop.subscription_ends_at);
      const now = new Date();
      if (endsAt < now) {
        console.log('❌ [Subscription Check] User subscription has expired (subscription_ends_at < now)', {
          endsAt: endsAt.toISOString(),
          now: now.toISOString()
        });
        return false;
      }
    }
    
    // For R and SR type users, require explicit subscription confirmation
    // Only return true if is_subscribed is explicitly true (not undefined, null, or false)
    const subscribed = b2cShop.is_subscribed === true;
    
    if (!subscribed) {
      console.log('❌ [Subscription Check] User is NOT subscribed - is_subscribed is not explicitly true', {
        userId: userData?.id,
        userType: userType,
        shopId: b2cShop.id,
        is_subscribed: b2cShop.is_subscribed,
        type: typeof b2cShop.is_subscribed,
        is_subscription_ends: b2cShop.is_subscription_ends,
        subscription_ends_at: b2cShop.subscription_ends_at
      });
    } else {
      console.log('✅ [Subscription Check] User IS subscribed', {
        userId: userData?.id,
        userType: userType,
        shopId: b2cShop.id,
        shopType: b2cShop.shop_type
      });
    }
    
    return subscribed;
  }, [profileData, userData?.user_type, userData?.id, profileData?.user_type]);

    // Refetch profile if subscription fields are missing (e.g., after admin approval)
  useEffect(() => {
    const userType = userData?.user_type || profileData?.user_type;
    if (!profileData || !userData?.id || (userType !== 'R' && userType !== 'SR')) {
      return;
    }

    // Find B2C shop
    let b2cShop: any = null;
    if (userType === 'SR') {
      b2cShop = profileData.b2cShop || (profileData.shop?.shop_type === 3 ? profileData.shop : null);
    } else {
      b2cShop = profileData.b2cShop || profileData.shop;
    }

    if (!b2cShop) {
      return;
    }

    // Check if subscription fields are missing
    const hasSubscriptionFields = b2cShop.is_subscribed !== undefined || 
                                  b2cShop.subscription_ends_at !== undefined || 
                                  b2cShop.subscribed_duration !== undefined;

    if (!hasSubscriptionFields && refetchProfile) {
      console.log('⚠️ [Subscription Check] Subscription fields missing - scheduling profile refetch');
      // Refetch after 2 seconds to allow admin approval to propagate
      const timeoutId = setTimeout(() => {
        console.log('🔄 [Subscription Check] Refetching profile to get updated subscription fields');
        refetchProfile();
      }, 2000);

      return () => clearTimeout(timeoutId);
    }
  }, [profileData, userData?.id, userData?.user_type, refetchProfile]);

  // Check if user has approval status to show approval status card
  const hasApprovalStatus = React.useMemo(() => {
    if (!profileData) return false;
    const shop = profileData.shop;
    if (!shop || !shop.id) return false;
    // Show approval status card if approval_status exists (pending, approved, or rejected)
    return shop.approval_status !== undefined && shop.approval_status !== null;
  }, [profileData]);

  // Get approval status for display
  const approvalStatus = profileData?.shop?.approval_status || null;

  // Check if B2B button should be shown - only for 'SR' or 'S' users with approved status
  const shouldShowB2BButton = React.useMemo(() => {
    // Only show for 'SR' or 'S' user types
    if (userData?.user_type !== 'SR' && userData?.user_type !== 'S') {
      return false;
    }

    const shop = profileData?.shop as any;
    if (!shop || !shop.id) {
      // No shop data - don't show B2B button
      return false;
    }

    // Check if approval status is approved
    const approvalStatus = shop?.approval_status;
    return approvalStatus === 'approved';
  }, [userData?.user_type, profileData?.shop]);

  // Handle category press - open modal only if subcategories exist
  const handleCategoryPress = (category: Category) => {
    console.log(`🎯 [handleCategoryPress] Category clicked:`, {
      name: category.name,
      id: category.id,
      idType: typeof category.id,
      idNumber: Number(category.id)
    });

    // Check if there are subcategories for this category
    if (!userSubcategoriesData?.data?.subcategories) {
      Alert.alert(
        t('common.warning') || 'Warning',
        t('dashboard.noSubcategories') || 'No subcategories available for this category'
      );
      return;
    }

    const categoryId = Number(category.id);
    const subcatsForCategory = userSubcategoriesData.data.subcategories.filter(
      (us: any) => Number(us.main_category_id) === categoryId
    );

    if (subcatsForCategory.length === 0) {
      Alert.alert(
        t('common.warning') || 'Warning',
        t('dashboard.noSubcategories') || 'No subcategories available for this category'
      );
      return;
    }

    setSelectedCategory(category);
    setModalVisible(true);
  };

  // Sync AsyncStorage with latest approval status when profile is fetched
  React.useEffect(() => {
    const syncB2CStatus = async () => {
      if (profileData?.shop?.approval_status && userData?.id) {
        try {
          const approvalStatus = profileData.shop.approval_status;
          await AsyncStorage.setItem('@b2c_approval_status', approvalStatus);
          console.log('✅ DashboardScreen: Synced @b2c_approval_status to AsyncStorage:', approvalStatus);

          // If rejected, navigate to signup screen
          if (approvalStatus === 'rejected') {
            console.log('✅ B2C approval status is rejected - navigating to B2CSignup');
            // Small delay to ensure navigation is ready
            setTimeout(() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'B2CSignup' }],
              });
            }, 500);
          }
        } catch (error) {
          console.error('❌ Error syncing B2C status:', error);
        }
      }
    };

    syncB2CStatus();
  }, [profileData?.shop?.approval_status, userData?.id, navigation]);

  const handleSwitchMode = async () => {
    if (isSwitchingMode) return;
    setIsSwitchingMode(true);
    try {
      // Load userData if not available
      let currentUserData = userData;
      if (!currentUserData) {
        currentUserData = await getUserData();
        setUserData(currentUserData);
      }

      // Check if user_type is 'SR' - SR users can switch between B2B and B2C dashboards
      // Only switch if B2B is approved - if not approved, stay on B2C (don't navigate to ApprovalWorkflow)
      if (currentUserData?.user_type === 'SR') {
        // For SR users, check if profile has separate b2bShop and b2cShop objects
        const b2bShop = (profileData as any)?.b2bShop;
        const shop = profileData?.shop as any;
        
        // Check B2B approval status
        let b2bApprovalStatus = null;
        
        if (b2bShop && b2bShop.id) {
          // We have separate B2B shop object - use its approval_status directly
          b2bApprovalStatus = b2bShop.approval_status;
          console.log('✅ Dashboard: SR user - using b2bShop.approval_status:', b2bApprovalStatus);
        } else if (shop && shop.id) {
          // Fallback: Use merged shop data
          const hasB2BFields = shop?.company_name || shop?.gst_number || shop?.business_license_url;
          const shopType = shop?.shop_type;
          const isB2BShop = shopType === 1 || shopType === 4; // B2B shop types
          const approvalStatus = shop?.approval_status;
          
          if (isB2BShop) {
            b2bApprovalStatus = approvalStatus;
            console.log('✅ Dashboard: SR user - shop is B2B shop (type ' + shopType + '), approval_status: ' + b2bApprovalStatus);
          } else if (hasB2BFields) {
            // Shop has B2B fields - since merged shop prioritizes B2B approval_status,
            // if it has B2B fields, the approval_status is from B2B shop
            b2bApprovalStatus = approvalStatus;
            console.log('✅ Dashboard: SR user - shop has B2B fields, approval_status (from B2B): ' + b2bApprovalStatus);
          }
        }
        
        // Only switch to B2B if B2B shop is approved
        // If not approved, stay on B2C dashboard (don't navigate to ApprovalWorkflow)
        if (b2bApprovalStatus === 'approved') {
          console.log('✅ Dashboard: SR user - B2B shop is approved, switching to B2B mode');
          await setMode('b2b');
          setIsSwitchingMode(false);
          return;
        } else {
          // B2B is not approved - stay on B2C dashboard, don't navigate anywhere
          console.log('✅ Dashboard: SR user - B2B shop status is ' + (b2bApprovalStatus || 'not approved') + ', staying on B2C dashboard');
          setIsSwitchingMode(false);
          return;
        }
      }

      // Check if user_type is 'R' - check for SR approval status if they've completed business signup
      if (currentUserData?.user_type === 'R') {
        const shop = profileData?.shop as any;
        if (!shop || !shop.id) {
          // No shop data - navigate to business signup
          console.log('✅ Dashboard: User type R with no shop data - navigating to Business signup screen');
          (navigation as any).navigate('DealerSignup', { source: 'b2c_dashboard' });
          setIsSwitchingMode(false);
          return;
        }

        // Check if user has completed business signup for SR conversion
        const hasCompanyName = shop.company_name && shop.company_name.trim() !== '';
        const hasGstNumber = shop.gst_number && shop.gst_number.trim() !== '';
        const hasPanNumber = shop.pan_number && shop.pan_number.trim() !== '';
        const hasCompletedBusinessSignup = hasCompanyName || hasGstNumber || hasPanNumber;

        if (hasCompletedBusinessSignup) {
          // User has submitted SR conversion request - check SR approval status
          const approvalStatus = shop?.approval_status;
          
          if (approvalStatus === 'pending') {
            // SR approval status is pending - navigate to ApprovalWorkflow
            console.log('✅ Dashboard: User type R with SR approval status pending - navigating to ApprovalWorkflow');
            (navigation as any).navigate('ApprovalWorkflow');
            setIsSwitchingMode(false);
            return;
          } else if (approvalStatus === 'approved') {
            // SR approval status is approved - switch to B2B mode
            console.log('✅ Dashboard: User type R with SR approval status approved - switching to B2B mode');
            await setMode('b2b');
            setIsSwitchingMode(false);
            return;
          } else if (approvalStatus === 'rejected') {
            // SR approval status is rejected - navigate to ApprovalWorkflow
            console.log('✅ Dashboard: User type R with SR approval status rejected - navigating to ApprovalWorkflow');
            (navigation as any).navigate('ApprovalWorkflow');
            setIsSwitchingMode(false);
            return;
          } else {
            // No approval status yet - navigate to ApprovalWorkflow
            console.log('✅ Dashboard: User type R with completed business signup but no approval status - navigating to ApprovalWorkflow');
            (navigation as any).navigate('ApprovalWorkflow');
            setIsSwitchingMode(false);
            return;
          }
        } else {
          // User hasn't completed business signup - navigate to business signup screen
          console.log('✅ Dashboard: User type R without completed business signup - navigating to Business signup screen');
          (navigation as any).navigate('DealerSignup', { source: 'b2c_dashboard' });
          setIsSwitchingMode(false);
          return;
        }
      }

      // For non-R users (S, SR, etc.), navigate to Business signup screen when B2B is clicked
      console.log('✅ Dashboard: Navigating to Business signup screen');
      (navigation as any).navigate('DealerSignup');
      setIsSwitchingMode(false);
      return;
    } catch (error) {
      console.error('Error switching mode:', error);
    } finally {
      setIsSwitchingMode(false);
    }
  };

  // Show tab bar when Dashboard is focused
  useFocusEffect(
    React.useCallback(() => {
      setTabBarVisible(true);
    }, [setTabBarVisible])
  );

  // Use API data for monthly breakdown - show total order values instead of earnings
  // For B2C vendors, we want to show total order values (estim_price) not earnings
  const monthlyOrderValues = monthlyBreakdownData?.monthlyBreakdown?.map(month => {
    // Calculate total order value for the month (sum of all order values)
    // The backend returns earnings which is the sum of estim_price, so we can use that
    // But we'll rename it to orderValue for clarity
    return month.earnings || 0; // This is actually total order value (sum of estim_price)
  }) || [];
  const monthLabels = monthlyBreakdownData?.monthlyBreakdown?.map(month => month.monthName) || [];
  const totalOrderValue = monthlyBreakdownData?.totalEarnings || 0; // This is actually total order value

  // Calculate Y-axis values dynamically based on max order value
  const maxOrderValue = monthlyOrderValues.length > 0 ? Math.max(...monthlyOrderValues) : 0;
  const getYAxisValues = () => {
    if (maxOrderValue === 0) return [100, 75, 50, 25, 0];

    // Calculate a nice rounded max value
    let roundedMax;
    if (maxOrderValue < 1000) {
      roundedMax = Math.ceil(maxOrderValue / 100) * 100;
    } else if (maxOrderValue < 10000) {
      roundedMax = Math.ceil(maxOrderValue / 1000) * 1000;
    } else if (maxOrderValue < 100000) {
      roundedMax = Math.ceil(maxOrderValue / 10000) * 10000;
    } else {
      roundedMax = Math.ceil(maxOrderValue / 100000) * 100000;
    }

    // Return values in descending order (max to 0) for display
    // With justifyContent: 'space-between', this will show max at top, 0 at bottom
    return [
      roundedMax,
      Math.round(roundedMax * 0.75),
      Math.round(roundedMax * 0.5),
      Math.round(roundedMax * 0.25),
      0,
    ];
  };

  const yAxisValues = getYAxisValues();

  // Format Y-axis labels to be shorter (e.g., 50K instead of 50,000)
  const formatYAxisLabel = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(0)}K`;
    }
    return `₹${value}`;
  };

  // Get icon name for category (fallback if no image)
  const getCategoryIcon = (categoryName: string): string => {
    const name = categoryName.toLowerCase();
    if (name.includes('metal') || name.includes('aluminum')) return 'aluminum';
    if (name.includes('plastic')) return 'bottle-soda';
    if (name.includes('paper')) return 'file-document';
    if (name.includes('electronic') || name.includes('e-waste')) return 'lightbulb';
    if (name.includes('glass')) return 'glass-wine';
    if (name.includes('wood')) return 'tree';
    if (name.includes('rubber')) return 'circle';
    if (name.includes('organic')) return 'sprout';
    return 'package-variant';
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('../../assets/images/logoDark.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <AutoText style={styles.headerTitle} numberOfLines={1}>
            B2C
          </AutoText>
        </View>
        <View style={styles.iconRow}>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          {shouldShowB2BButton && (
            <TouchableOpacity
              style={styles.switchButton}
              activeOpacity={0.8}
              onPress={handleSwitchMode}
              disabled={isSwitchingMode}
            >
              <LinearGradient
                colors={themeName === 'dark' ? ['#4A90E2', '#357ABD'] : [theme.primary, theme.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.switchButtonGradient}
              >
                <MaterialCommunityIcons name="office-building" size={16} color="#FFFFFF" />
                <Text style={styles.switchButtonText}>
                  {isSwitchingMode ? '...' : 'B2B'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('UserProfile', { profileData })}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Approval Status Card */}
       
        {loadingAvailableRequests ? (
          <SectionCard>
            <View style={styles.activePickupLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.activePickupLoadingText}>
                {t('common.loading') || 'Loading orders...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : (
          <>
            <SectionCard>
              <View style={styles.sectionTitleContainer}>
                <AutoText style={styles.sectionTitle} numberOfLines={3}>
                  {t('dashboard.acceptWasteCollection')} ({availableRequests.length})
                </AutoText>
                {isRefetchingAvailableRequests && (
                  <View style={styles.refreshingIndicator}>
                    <ActivityIndicator size="small" color={theme.primary} />
                    <AutoText style={styles.refreshingText}>
                      {t('common.refreshing') || 'Refreshing...'}
                    </AutoText>
                  </View>
                )}
              </View>
            </SectionCard>
            {availableRequests.length > 0 ? (
              availableRequests.map((order, index) => {
                // Use a unique key that combines order_number and index to ensure uniqueness
                const uniqueKey = order.order_number ? `order-${order.order_number}` : `order-${(order as any).order_id || (order as any).id || index}`;
                // Capture order number at map time to avoid closure issues
                const currentOrderNumber = order.order_number || (order as any).order_id || (order as any).id;

                return (
                  <View key={uniqueKey} style={{ position: 'relative' }}>
                    <TouchableOpacity
                      activeOpacity={isSubscribed ? 0.7 : 1}
                      onPress={() => {
                        if (isSubscribed) {
                          navigation.navigate('OrderDetails', { order });
                        } else {
                          Alert.alert(
                            t('dashboard.subscriptionRequired') || 'Subscription Required',
                            t('dashboard.subscriptionRequiredMessage') || 'Please subscribe to view and accept customer requests.',
                            [{ text: t('common.ok') || 'OK' }]
                          );
                        }
                      }}
                      disabled={!isSubscribed}
                    >
                      <SectionCard style={[index > 0 ? { marginTop: 12 } : undefined, !isSubscribed && styles.blurredCard]}>
                      <AutoText style={styles.detailText} numberOfLines={1}>
                        {t('dashboard.orderNumber') || 'Order'}: #{currentOrderNumber}
                      </AutoText>
                      {order.customer_name && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons
                            name="account"
                            size={14}
                            color={theme.primary}
                            style={!isSubscribed ? { opacity: 0 } : undefined}
                          />
                          <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                            {order.customer_name}
                          </AutoText>
                        </View>
                      )}
                      {order.customer_phone && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons
                            name="phone"
                            size={14}
                            color={theme.primary}
                            style={!isSubscribed ? { opacity: 0 } : undefined}
                          />
                          <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                            {order.customer_phone}
                          </AutoText>
                        </View>
                      )}
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={3}>
                          {order.address ? formatAddress(order.address) : (t('dashboard.addressNotProvided') || 'Address not provided')}
                        </AutoText>
                      </View>
                      {order.scrap_description && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons
                            name="package-variant"
                            size={14}
                            color={theme.primary}
                          />
                          <AutoText style={styles.detailText} numberOfLines={2}>
                            {order.scrap_description}
                            {order.estimated_weight_kg > 0 && ` (${order.estimated_weight_kg} kg)`}
                          </AutoText>
                        </View>
                      )}
                      {((order as any).preferred_pickup_time_slot || order.preferred_pickup_time || (order as any).preferred_pickup_date) && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons
                            name="clock-outline"
                            size={14}
                            color={theme.primary}
                          />
                          <AutoText style={styles.detailText} numberOfLines={1}>
                            {formatScheduledDateTime(order)}
                          </AutoText>
                        </View>
                      )}
                      {order.distance_km !== undefined && order.distance_km !== null && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons
                            name="map-marker-distance"
                            size={14}
                            color={theme.primary}
                          />
                          <AutoText style={styles.detailText} numberOfLines={1}>
                            {order.distance_km.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                          </AutoText>
                        </View>
                      )}
                      <View style={styles.priceRow}>
                        <AutoText style={styles.price} numberOfLines={1}>
                          ₹{order.estimated_price?.toLocaleString('en-IN') || '0'}
                        </AutoText>
                        <View style={styles.actionButtonsRow}>
                          <TouchableOpacity
                            style={[styles.cancelButton, (cancellingOrderId === (order.order_number || order.order_id || order.id) || acceptingOrderId === (order.order_number || order.order_id || order.id)) && styles.cancelButtonDisabled]}
                            onPress={(e) => {
                              console.log('🔴 Cancel button pressed for order:', {
                                order_number: order.order_number,
                                order_id: order.order_id || order.id,
                                index: index
                              });
                              e.stopPropagation();
                              if (Platform.OS === 'ios') {
                                Vibration.vibrate(10);
                              } else {
                                Vibration.vibrate(50);
                              }
                              handleCancelOrder(order);
                            }}
                            disabled={cancellingOrderId === (order.order_number || order.order_id || order.id) || acceptingOrderId === (order.order_number || order.order_id || order.id)}
                            activeOpacity={0.7}
                          >
                            {cancellingOrderId === (order.order_number || order.order_id || order.id) ? (
                              <ActivityIndicator size="small" color={theme.textPrimary} />
                            ) : (
                              <AutoText style={styles.cancelButtonText} numberOfLines={1}>
                                {t('dashboard.cancel') || 'Cancel'}
                              </AutoText>
                            )}
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.acceptButton, (acceptingOrderId === (order.order_number || order.order_id || (order as any).id) || cancellingOrderId === (order.order_number || order.order_id || (order as any).id) || !isSubscribed) && styles.acceptButtonDisabled]}
                            onPress={(e) => {
                              e.stopPropagation(); // Prevent navigation when clicking accept button
                              if (!isSubscribed) {
                                Alert.alert(
                                  t('dashboard.subscriptionRequired') || 'Subscription Required',
                                  t('dashboard.subscriptionRequiredMessage') || 'Please subscribe to view and accept customer requests.',
                                  [{ text: t('common.ok') || 'OK' }]
                                );
                                return;
                              }
                              // Haptic feedback
                              if (Platform.OS === 'ios') {
                                Vibration.vibrate(10);
                              } else {
                                Vibration.vibrate(50);
                              }
                              // Use the order number captured at map time to avoid closure issues
                              const orderNumberToAccept = currentOrderNumber;
                              console.log('🔵 [Dashboard] Accept button clicked for order:', {
                                order_number: orderNumberToAccept,
                                index: index,
                                current_order_in_map: currentOrderNumber,
                                order_from_props: order.order_number,
                                full_order: order
                              });
                              // Create order object with the correct order number
                              const orderToAccept: PickupRequest = {
                                ...order,
                                order_number: orderNumberToAccept as any
                              };
                              handleAcceptOrder(orderToAccept);
                            }}
                            disabled={acceptingOrderId === (order.order_number || order.order_id || (order as any).id) || cancellingOrderId === (order.order_number || order.order_id || (order as any).id) || !isSubscribed}
                            activeOpacity={0.7}
                          >
                            {acceptingOrderId === (order.order_number || order.order_id || (order as any).id) ? (
                              <ActivityIndicator size="small" color={theme.textPrimary} />
                            ) : (
                              <>
                                <AutoText style={styles.acceptButtonText} numberOfLines={1}>
                                  {t('dashboard.acceptOrder')}
                                </AutoText>
                                <MaterialCommunityIcons
                                  name="arrow-right"
                                  size={14}
                                  color={theme.textPrimary}
                                />
                              </>
                            )}
                          </TouchableOpacity>
                      </View>
                    </View>
                  </SectionCard>
                  </TouchableOpacity>
                  </View>
                );
              })
            ) : (
              <SectionCard>
                <AutoText style={styles.detailText} numberOfLines={2}>
                  {t('dashboard.noOrdersAvailable') || 'No orders available at the moment'}
                </AutoText>
              </SectionCard>
            )}
          </>
        )}

        {/* Bulk Scrap Purchase Requests Section */}
        {bulkScrapRequestsError && (
          <SectionCard>
            <AutoText style={[styles.detailText, { color: theme.error || '#FF4444' }]} numberOfLines={3}>
              {t('common.error') || 'Error'}: {bulkScrapRequestsError?.message || 'Failed to load bulk scrap requests'}
            </AutoText>
          </SectionCard>
        )}
        {loadingBulkScrapRequests ? (
          <SectionCard>
            <View style={styles.activePickupLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.activePickupLoadingText}>
                {t('common.loading') || 'Loading bulk scrap requests...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : (
          <>
            {nonAcceptedBulkScrapRequests && nonAcceptedBulkScrapRequests.length > 0 && (
              <SectionCard>
                <View style={styles.sectionTitleContainer}>
                  <AutoText style={styles.sectionTitle} numberOfLines={3}>
                    {t('dashboard.bulkScrapRequests') || 'Bulk Scrap Purchase Requests'} ({nonAcceptedBulkScrapRequests.length})
                  </AutoText>
                </View>
              </SectionCard>
            )}
            {nonAcceptedBulkScrapRequests && nonAcceptedBulkScrapRequests.length > 0 ? (
              nonAcceptedBulkScrapRequests.map((request, index) => {
                const quantityInTons = (request.quantity / 1000).toFixed(2);
                const subcategoriesText = request.subcategories && request.subcategories.length > 0
                  ? request.subcategories.map((s: any) => s.subcategory_name).join(', ')
                  : request.scrap_type || 'Scrap';
                
                const isAccepting = acceptingBulkScrapId === request.id;
                const isRejecting = rejectingBulkScrapId === request.id;
                const isProcessing = isAccepting || isRejecting;

                return (
                  <View key={`bulk-scrap-${request.id}-${index}`} style={{ position: 'relative' }}>
                    <SectionCard style={[index > 0 ? { marginTop: 12 } : undefined, !isSubscribed && styles.blurredCard]}>
                    <AutoText style={styles.detailText} numberOfLines={1}>
                      {t('dashboard.requestFrom') || 'Request from'}: {request.buyer_name || `User #${request.buyer_id}`}
                    </AutoText>
                    {request.subcategories && request.subcategories.length > 0 ? (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="package-variant"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={3}>
                          {subcategoriesText}
                        </AutoText>
                      </View>
                    ) : request.scrap_type && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="package-variant"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={1}>
                          {request.scrap_type}
                        </AutoText>
                      </View>
                    )}
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons
                        name="weight-kilogram"
                        size={14}
                        color={theme.primary}
                      />
                      <AutoText style={styles.detailText} numberOfLines={1}>
                        {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
                      </AutoText>
                    </View>
                    {/* Show progress if vendors have committed */}
                    {request.total_committed_quantity !== undefined && request.total_committed_quantity > 0 && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="progress-check"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={1}>
                          {t('dashboard.committed') || 'Committed'}: {request.total_committed_quantity.toLocaleString('en-IN')} kg / {request.quantity.toLocaleString('en-IN')} kg
                          {' '}({((request.total_committed_quantity / request.quantity) * 100).toFixed(0)}%)
                        </AutoText>
                      </View>
                    )}
                    {request.preferred_price && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="currency-inr"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={1}>
                          {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{request.preferred_price.toLocaleString('en-IN')} / kg
                        </AutoText>
                      </View>
                    )}
                    {request.location && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={2}>
                          {request.location}
                        </AutoText>
                      </View>
                    )}
                    {request.distance_km !== undefined && request.distance_km !== null && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="map-marker-distance"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={1}>
                          {request.distance_km.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                        </AutoText>
                      </View>
                    )}
                    {request.additional_notes && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="note-text"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={3}>
                          {request.additional_notes}
                        </AutoText>
                      </View>
                    )}
                    {request.documents && request.documents.length > 0 && (
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons
                          name="file-document"
                          size={14}
                          color={theme.primary}
                        />
                        <AutoText style={styles.detailText} numberOfLines={1}>
                          {request.documents.length} {t('dashboard.documents') || 'document(s)'}
                        </AutoText>
                      </View>
                    )}
                    <View style={styles.priceRow}>
                      <View style={styles.actionButtonsRow}>
                        <TouchableOpacity
                          style={[styles.cancelButton, isProcessing && styles.cancelButtonDisabled]}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (Platform.OS === 'ios') {
                              Vibration.vibrate(10);
                            } else {
                              Vibration.vibrate(50);
                            }
                            handleRejectBulkScrapRequest(request);
                          }}
                          disabled={isProcessing}
                          activeOpacity={0.7}
                        >
                          {isRejecting ? (
                            <ActivityIndicator size="small" color={theme.textPrimary} />
                          ) : (
                            <AutoText style={styles.cancelButtonText} numberOfLines={1}>
                              {t('dashboard.cancel') || 'Cancel'}
                            </AutoText>
                          )}
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.acceptButton, (isProcessing || !isSubscribed) && styles.acceptButtonDisabled]}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (!isSubscribed) {
                              Alert.alert(
                                t('dashboard.subscriptionRequired') || 'Subscription Required',
                                t('dashboard.subscriptionRequiredMessage') || 'Please subscribe to view and accept bulk buy requests.',
                                [{ text: t('common.ok') || 'OK' }]
                              );
                              return;
                            }
                            if (Platform.OS === 'ios') {
                              Vibration.vibrate(10);
                            } else {
                              Vibration.vibrate(50);
                            }
                            handleAcceptBulkScrapRequest(request);
                          }}
                          disabled={isProcessing || !isSubscribed}
                          activeOpacity={0.7}
                        >
                          {isAccepting ? (
                            <ActivityIndicator size="small" color={theme.textPrimary} />
                          ) : (
                            <>
                              <AutoText style={styles.acceptButtonText} numberOfLines={1}>
                                {t('dashboard.participate') || 'Participate'}
                              </AutoText>
                              <MaterialCommunityIcons
                                name="arrow-right"
                                size={14}
                                color={theme.textPrimary}
                              />
                            </>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  </SectionCard>
                </View>
                );
              })
            ) : (
              nonAcceptedBulkScrapRequests && nonAcceptedBulkScrapRequests.length === 0 && (
                <SectionCard>
                  <AutoText style={styles.detailText} numberOfLines={2}>
                    {t('dashboard.noBulkScrapRequests') || 'No bulk scrap purchase requests available'}
                  </AutoText>
                </SectionCard>
              )
            )}
          </>
        )}

        {/* Active Buy Requests Section */}
        {loadingAcceptedBulkScrapRequests ? (
          <SectionCard>
            <View style={styles.activePickupLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.activePickupLoadingText}>
                {t('common.loading') || 'Loading active buy requests...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : activeBuyRequest ? (
          <SectionCard>
            <View style={styles.activeHeader}>
              <View style={styles.activeHeaderLeft}>
                <AutoText style={styles.sectionTitle} numberOfLines={2}>
                  {t('dashboard.activeBuyRequests') || 'Active Buy Requests'}
                </AutoText>
                {acceptedBulkScrapRequests && acceptedBulkScrapRequests.length > 1 && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('ActiveBuyRequestsList')}
                    style={styles.viewAllButton}
                    activeOpacity={0.7}
                  >
                    <View style={styles.viewAllButtonContent}>
                      <MaterialCommunityIcons
                        name="view-list"
                        size={14}
                        color={theme.primary}
                        style={styles.viewAllIcon}
                      />
                      <AutoText style={styles.viewAllText}>
                        {t('dashboard.viewAll') || 'View All'} ({acceptedBulkScrapRequests.length})
                      </AutoText>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={16}
                        color={theme.primary}
                      />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.statusTag}>
                <AutoText style={styles.statusText} numberOfLines={1}>
                  {t('dashboard.statusAccepted') || 'Accepted'}
                </AutoText>
              </View>
            </View>
            {activeBuyRequest.buyer_name && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="account"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={1}>
                  {t('dashboard.requestFrom') || 'Request from'}: {activeBuyRequest.buyer_name}
                </AutoText>
              </View>
            )}
            {activeBuyRequest.subcategories && activeBuyRequest.subcategories.length > 0 ? (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={3}>
                  {activeBuyRequest.subcategories.map((s: any) => s.subcategory_name).join(', ')}
                </AutoText>
              </View>
            ) : activeBuyRequest.scrap_type && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={1}>
                  {activeBuyRequest.scrap_type}
                </AutoText>
              </View>
            )}
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="weight-kilogram"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {activeBuyRequest.quantity.toLocaleString('en-IN')} kg ({(activeBuyRequest.quantity / 1000).toFixed(2)} tons)
              </AutoText>
            </View>
            {activeBuyRequest.preferred_price && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={1}>
                  {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{activeBuyRequest.preferred_price.toLocaleString('en-IN')} / kg
                </AutoText>
              </View>
            )}
            {activeBuyRequest.location && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={2}>
                  {activeBuyRequest.location}
                </AutoText>
              </View>
            )}
            {activeBuyRequest.distance_km !== undefined && activeBuyRequest.distance_km !== null && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="map-marker-distance"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={1}>
                  {activeBuyRequest.distance_km.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                </AutoText>
              </View>
            )}
            {activeBuyRequest.latitude && activeBuyRequest.longitude && (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => navigation.navigate('FullscreenMap', {
                  destination: {
                    latitude: activeBuyRequest.latitude!,
                    longitude: activeBuyRequest.longitude!
                  },
                  requestId: activeBuyRequest.id?.toString()
                })}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="map"
                  size={16}
                  color={theme.primary}
                />
                <AutoText style={styles.mapButtonText}>
                  {t('dashboard.viewOnMap') || 'View on Map'}
                </AutoText>
              </TouchableOpacity>
            )}
          </SectionCard>
        ) : null}

        {loadingActivePickup ? (
          <SectionCard>
            <View style={styles.activePickupLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.activePickupLoadingText}>
                {t('common.loading') || 'Loading active pickup...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : filteredActivePickup ? (
          <SectionCard style={!isSubscribed && styles.blurredCard}>
            <View style={styles.activeHeader}>
              <View style={styles.activeHeaderLeft}>
                <AutoText style={styles.sectionTitle} numberOfLines={2}>
                  {t('dashboard.activePickup')}
                </AutoText>
                {filteredAllActivePickups && filteredAllActivePickups.length > 1 && (
                  <TouchableOpacity
                    onPress={() => {
                      if (!isSubscribed) {
                        Alert.alert(
                          t('dashboard.subscriptionRequired') || 'Subscription Required',
                          t('dashboard.subscriptionRequiredMessage') || 'Please subscribe to view and accept customer requests.',
                          [{ text: t('common.ok') || 'OK' }]
                        );
                        return;
                      }
                      navigation.navigate('ActivePickupsList');
                    }}
                    style={styles.viewAllButton}
                    activeOpacity={isSubscribed ? 0.7 : 1}
                    disabled={!isSubscribed}
                  >
                    <View style={styles.viewAllButtonContent}>
                      <MaterialCommunityIcons
                        name="view-list"
                        size={14}
                        color={theme.primary}
                        style={styles.viewAllIcon}
                      />
                      <AutoText style={styles.viewAllText}>
                        {t('dashboard.viewAll') || 'View All'} ({filteredAllActivePickups.length})
                      </AutoText>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={16}
                        color={theme.primary}
                      />
                    </View>
                  </TouchableOpacity>
                )}
              </View>
              <View style={styles.statusTag}>
                <AutoText style={styles.statusText} numberOfLines={1}>
                  {filteredActivePickup.status_label ||
                    (parseInt(String(filteredActivePickup.status)) === 2 ? (t('dashboard.statusAccepted') || 'Accepted') :
                      parseInt(String(filteredActivePickup.status)) === 3 ? (t('dashboard.statusPickupInitiated') || 'Pickup Initiated') :
                        parseInt(String(filteredActivePickup.status)) === 4 ? (t('dashboard.statusArrived') || 'Arrived Location') :
                          t('common.scheduled'))}
                </AutoText>
              </View>
            </View>
            {filteredActivePickup.customer_name && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="account"
                  size={14}
                  color={theme.primary}
                  style={!isSubscribed ? { opacity: 0 } : undefined}
                />
                <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                  {filteredActivePickup.customer_name}
                </AutoText>
              </View>
            )}
            {filteredActivePickup.customer_phone && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="phone"
                  size={14}
                  color={theme.primary}
                  style={!isSubscribed ? { opacity: 0 } : undefined}
                />
                <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                  {filteredActivePickup.customer_phone}
                </AutoText>
              </View>
            )}
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="package-variant"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={2}>
                {filteredActivePickup.scrap_description} ({t('dashboard.approx') || 'Approx.'} {filteredActivePickup.estimated_weight_kg}{t('dashboard.kg') || 'kg'})
              </AutoText>
            </View>
            {(filteredActivePickup.preferred_pickup_time || filteredActivePickup.created_at) && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={[styles.detailText, { flex: 1 }]} numberOfLines={1}>
                  {formatScheduledDateTime(filteredActivePickup)}
                </AutoText>
              </View>
            )}
            {filteredActivePickup.address && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color={theme.primary}
                  style={!isSubscribed ? { opacity: 0 } : undefined}
                />
                <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={2}>
                  {filteredActivePickup.address}
                </AutoText>
              </View>
            )}
            {filteredActivePickup.latitude && filteredActivePickup.longitude && (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => {
                  if (!isSubscribed) {
                    Alert.alert(
                      t('dashboard.subscriptionRequired') || 'Subscription Required',
                      t('dashboard.subscriptionRequiredMessage') || 'Please subscribe to view and accept customer requests.',
                      [{ text: t('common.ok') || 'OK' }]
                    );
                    return;
                  }
                  navigation.navigate('FullscreenMap', {
                    destination: {
                      latitude: filteredActivePickup.latitude!,
                      longitude: filteredActivePickup.longitude!
                    },
                    orderId: filteredActivePickup.order_number?.toString(),
                    customer_phone: filteredActivePickup.customer_phone || undefined
                  });
                }}
                activeOpacity={isSubscribed ? 0.7 : 1}
                disabled={!isSubscribed}
              >
                <MaterialCommunityIcons
                  name="map"
                  size={16}
                  color={theme.primary}
                />
                <AutoText style={styles.mapButtonText}>
                  {t('dashboard.viewOnMap') || 'View on Map'}
                </AutoText>
              </TouchableOpacity>
            )}
            <OutlineGreenButton
              title={t('dashboard.viewDetails')}
              onPress={() => {
                if (!isSubscribed) {
                  Alert.alert(
                    t('dashboard.subscriptionRequired') || 'Subscription Required',
                    t('dashboard.subscriptionRequiredMessage') || 'Please subscribe to view and accept customer requests.',
                    [{ text: t('common.ok') || 'OK' }]
                  );
                  return;
                }
                navigation.navigate('DeliveryTracking', {
                  orderId: filteredActivePickup.order_number?.toString(),
                  order: filteredActivePickup
                });
              }}
              style={styles.viewButton}
              disabled={!isSubscribed}
            />
          </SectionCard>
        ) : null}

        <View style={styles.impactSection}>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('dashboard.yourImpact')}
          </AutoText>
          <View style={styles.impactRow}>
            <View style={styles.impactCard}>
              <MaterialCommunityIcons
                name="recycle"
                size={16}
                color={theme.primary}
                style={styles.impactIcon}
              />
              <AutoText style={styles.impactValue} numberOfLines={1}>
                {loadingRecyclingStats
                  ? '...'
                  : isRecyclingStatsError
                    ? 'Error'
                    : `${recyclingStats?.total_recycled_weight_kg?.toFixed(1) || 0} kg`
                }
              </AutoText>
              <AutoText style={styles.impactLabel} numberOfLines={2}>
                {t('dashboard.totalRecycled')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {recyclingStats?.total_orders_completed || 0} {t('dashboard.ordersCompleted') || 'orders'}
              </AutoText>
            </View>
            <View style={styles.impactCard}>
              <MaterialCommunityIcons
                name="leaf"
                size={16}
                color={theme.primary}
                style={styles.impactIcon}
              />
              <AutoText style={styles.impactValue} numberOfLines={1}>
                {loadingRecyclingStats
                  ? '...'
                  : isRecyclingStatsError
                    ? 'Error'
                    : `${recyclingStats?.total_carbon_offset_kg?.toFixed(1) || 0} kg`
                }
              </AutoText>
              <AutoText style={styles.impactLabel} numberOfLines={2}>
                {t('dashboard.carbonOffset')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {recyclingStats?.trees_equivalent
                  ? `≈${recyclingStats.trees_equivalent.toFixed(0)} ${t('dashboard.trees') || 'trees'}`
                  : t('dashboard.equivalentCO2')
                }
              </AutoText>
            </View>
          </View>
        </View>

        <SectionCard>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('dashboard.yourEarnings')}
          </AutoText>
          <AutoText style={styles.subtitle} numberOfLines={1}>
            {t('dashboard.monthlyBreakdown')}
          </AutoText>
          {loadingMonthlyBreakdown ? (
            <View style={styles.chartLoadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.chartLoadingText}>
                {t('common.loading') || 'Loading earnings...'}
              </AutoText>
            </View>
          ) : isMonthlyBreakdownError ? (
            <View style={styles.chartEmptyContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={32}
                color={theme.error || '#FF4C4C'}
              />
              <AutoText style={styles.chartEmptyText}>
                {t('common.errorLoadingData') || 'Error loading data'}
              </AutoText>
              <TouchableOpacity
                onPress={() => refetchMonthlyBreakdown()}
                style={styles.retryButton}
              >
                <AutoText style={styles.retryButtonText}>
                  {t('common.retry') || 'Retry'}
                </AutoText>
              </TouchableOpacity>
            </View>
          ) : monthlyOrderValues.length === 0 ? (
            <View style={styles.chartEmptyContainer}>
              <MaterialCommunityIcons
                name="chart-line"
                size={32}
                color={theme.textSecondary}
              />
              <AutoText style={styles.chartEmptyText}>
                {t('dashboard.noEarningsData') || 'No earnings data available'}
              </AutoText>
            </View>
          ) : (
            <>
              <View style={styles.earningsChart}>
                <View style={styles.chartContainer}>
                  <View style={styles.yAxis}>
                    {yAxisValues.map(value => (
                      <Text key={value} style={styles.yAxisLabel} numberOfLines={1}>
                        {formatYAxisLabel(value)}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.chartBars}>
                    {monthlyOrderValues.map((orderValue, index) => {
                      const maxValue = yAxisValues[0];
                      const barHeight = maxValue > 0 ? Math.max((orderValue / maxValue) * 100, 0) : 0;
                      return (
                        <View key={index} style={styles.barContainer}>
                          <View
                            style={[
                              styles.bar,
                              { height: `${barHeight}%` },
                            ]}
                          />
                        </View>
                      );
                    })}
                  </View>
                </View>
                <View style={styles.chartLabelsContainer}>
                  <View style={styles.yAxisSpacer} />
                  <View style={styles.chartLabels}>
                    {monthLabels.map((month, index) => (
                      <View key={`${month}-${index}`} style={styles.monthLabelContainer}>
                        <Text style={styles.monthLabel} numberOfLines={1}>
                          {month}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.totalEarnings}>
                Total order value last 6 months: ₹{totalOrderValue.toLocaleString('en-IN')}
              </Text>
            </>
          )}
        </SectionCard>

        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <AutoText style={styles.categoriesTitle} numberOfLines={3}>
              {t('dashboard.categoriesOperating')}
            </AutoText>
            <TouchableOpacity
              style={styles.addButton}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AddCategory')}
            >
              <AutoText style={styles.addButtonText} numberOfLines={1}>
                {t('dashboard.add')} +
              </AutoText>
            </TouchableOpacity>
          </View>
          {loadingCategories ? (
            <View style={styles.categoriesLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : userCategories.length === 0 ? (
            <View style={styles.noCategoriesContainer}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={32}
                color={theme.textSecondary}
              />
              <AutoText style={styles.noCategoriesText}>
                {t('dashboard.noCategoriesOperating') || 'No categories operating'}
              </AutoText>
              <AutoText style={styles.noCategoriesSubtext}>
                {t('dashboard.tapAddToSelect') || 'Tap the + button to add categories'}
              </AutoText>
            </View>
          ) : (
            <View style={styles.categoriesGrid}>
              {userCategories.map(category => (
                <CategoryBadge
                  key={category.id}
                  label={category.name}
                  icon={getCategoryIcon(category.name)}
                  image={category.image}
                  onPress={() => handleCategoryPress(category)}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Subcategories Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {selectedCategory?.name || t('dashboard.subcategories') || 'Subcategories'}
              </AutoText>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {loadingSubcategories ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <AutoText style={styles.modalLoadingText}>
                    {t('common.loading') || 'Loading subcategories...'}
                  </AutoText>
                </View>
              ) : !userSubcategoriesData?.data?.subcategories ? (
                <View style={styles.modalEmptyContainer}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <AutoText style={styles.modalEmptyText}>
                    {t('dashboard.noSubcategories') || 'No subcategories data available'}
                  </AutoText>
                </View>
              ) : categorySubcategories.length === 0 ? (
                <View style={styles.modalEmptyContainer}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <AutoText style={styles.modalEmptyText}>
                    {t('dashboard.noSubcategories') || 'No subcategories available'}
                  </AutoText>
                  <AutoText style={[styles.modalEmptyText, { fontSize: 12, marginTop: 8 }]}>
                    Category ID: {selectedCategory?.id}, Found: {categorySubcategories.length}
                  </AutoText>
                </View>
              ) : (
                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {categorySubcategories.map((subcat: any) => (
                    <View key={subcat.id} style={styles.modalSubcategoryItem}>
                      <View style={styles.modalSubcategoryRow}>
                        {/* Subcategory Image */}
                        {subcat.image ? (
                          <Image
                            source={{ uri: subcat.image }}
                            style={styles.modalSubcategoryImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.modalSubcategoryNoImage}>
                            <MaterialCommunityIcons
                              name="image-off"
                              size={24}
                              color={theme.textSecondary}
                            />
                            <AutoText style={styles.modalSubcategoryNoImageText}>
                              {t('dashboard.noImage') || 'No Image'}
                            </AutoText>
                          </View>
                        )}

                        {/* Subcategory Info */}
                        <View style={styles.modalSubcategoryInfo}>
                          <AutoText style={styles.modalSubcategoryName}>
                            {subcat.name}
                          </AutoText>
                          <AutoText style={styles.modalSubcategoryPrice}>
                            {t('dashboard.price') || 'Price'}: ₹{subcat.display_price || '0'}/{subcat.display_price_unit || 'kg'}
                          </AutoText>
                          {subcat.custom_price && (
                            <AutoText style={styles.modalSubcategoryDefaultPrice}>
                              {t('dashboard.defaultPrice') || 'Default'}: ₹{subcat.default_price || '0'}/{subcat.price_unit || 'kg'}
                            </AutoText>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* Participate Quantity Modal */}
      <Modal
        visible={participateQuantityModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setParticipateQuantityModalVisible(false);
          setSelectedBulkScrapRequestForParticipate(null);
          setParticipateQuantity('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {t('dashboard.participateInRequest') || 'Participate in Request'}
              </AutoText>
              <TouchableOpacity
                onPress={() => {
                  setParticipateQuantityModalVisible(false);
                  setSelectedBulkScrapRequestForParticipate(null);
                  setParticipateQuantity('');
                }}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {selectedBulkScrapRequestForParticipate && (
                <>
                  <AutoText style={styles.cancelModalOrderInfo}>
                    {t('dashboard.enterQuantityToParticipate') || 'Enter the quantity (in kg) you want to contribute:'}
                  </AutoText>
                  <AutoText style={styles.cancelModalOrderNumber}>
                    {t('dashboard.requestId') || 'Request'}: #{selectedBulkScrapRequestForParticipate.id}
                  </AutoText>
                  
                  <View style={styles.quantityInfoContainer}>
                    <View style={styles.quantityInfoRow}>
                      <AutoText style={styles.quantityInfoLabel}>
                        {t('dashboard.requestedQuantity') || 'Requested'}: 
                      </AutoText>
                      <AutoText style={styles.quantityInfoValue}>
                        {selectedBulkScrapRequestForParticipate.quantity?.toLocaleString('en-IN') || 0} kg
                      </AutoText>
                    </View>
                    {selectedBulkScrapRequestForParticipate.total_committed_quantity !== undefined && selectedBulkScrapRequestForParticipate.total_committed_quantity > 0 && (
                      <View style={styles.quantityInfoRow}>
                        <AutoText style={styles.quantityInfoLabel}>
                          {t('dashboard.committedQuantity') || 'Committed'}: 
                        </AutoText>
                        <AutoText style={styles.quantityInfoValue}>
                          {selectedBulkScrapRequestForParticipate.total_committed_quantity.toLocaleString('en-IN')} kg
                        </AutoText>
                      </View>
                    )}
                    <View style={styles.quantityInfoRow}>
                      <AutoText style={styles.quantityInfoLabel}>
                        {t('dashboard.remainingQuantity') || 'Remaining'}: 
                      </AutoText>
                      <AutoText style={[styles.quantityInfoValue, { color: theme.primary }]}>
                        {(selectedBulkScrapRequestForParticipate.quantity - (selectedBulkScrapRequestForParticipate.total_committed_quantity || 0)).toLocaleString('en-IN')} kg
                      </AutoText>
                    </View>
                  </View>

                  <View style={styles.quantityInputContainer}>
                    <AutoText style={styles.quantityInputLabel}>
                      {t('dashboard.yourQuantity') || 'Your Quantity (kg)'}:
                    </AutoText>
                    <TextInput
                      style={styles.quantityInput}
                      placeholder={t('dashboard.enterQuantity') || 'Enter quantity in kg...'}
                      placeholderTextColor={theme.textSecondary}
                      value={participateQuantity}
                      onChangeText={setParticipateQuantity}
                      keyboardType="numeric"
                      autoFocus={true}
                    />
                    <AutoText style={styles.quantityInputHint}>
                      {t('dashboard.leaveEmptyForRemaining') || 'Leave empty to commit all remaining quantity'}
                    </AutoText>
                  </View>
                </>
              )}

              <View style={styles.cancelModalButtons}>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalButtonCancel]}
                  onPress={() => {
                    setParticipateQuantityModalVisible(false);
                    setSelectedBulkScrapRequestForParticipate(null);
                    setParticipateQuantity('');
                  }}
                  activeOpacity={0.7}
                >
                  <AutoText style={styles.cancelModalButtonCancelText}>
                    {t('common.cancel') || 'Cancel'}
                  </AutoText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalButtonConfirm]}
                  onPress={handleConfirmParticipateBulkScrapRequest}
                  disabled={acceptingBulkScrapId !== null}
                  activeOpacity={0.7}
                >
                  {acceptingBulkScrapId ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <AutoText style={styles.cancelModalButtonConfirmText}>
                      {t('dashboard.participate') || 'Participate'}
                    </AutoText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Bulk Scrap Request Modal */}
      <Modal
        visible={cancelBulkScrapModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setCancelBulkScrapModalVisible(false);
          setSelectedBulkScrapRequestForCancel(null);
          setSelectedBulkScrapCancelReason('');
          setCustomBulkScrapCancelReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {t('dashboard.cancelRequest') || 'Cancel Request'}
              </AutoText>
              <TouchableOpacity
                onPress={() => {
                  setCancelBulkScrapModalVisible(false);
                  setSelectedBulkScrapRequestForCancel(null);
                  setSelectedBulkScrapCancelReason('');
                  setCustomBulkScrapCancelReason('');
                }}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <AutoText style={styles.cancelModalOrderInfo}>
                {t('dashboard.cancelRequestMessage') || 'Please select a reason for cancelling this request:'}
              </AutoText>
              {selectedBulkScrapRequestForCancel && (
                <AutoText style={styles.cancelModalOrderNumber}>
                  {t('dashboard.requestId') || 'Request'}: #{selectedBulkScrapRequestForCancel.id}
                </AutoText>
              )}

              <ScrollView
                style={styles.cancelReasonsList}
                showsVerticalScrollIndicator={false}
              >
                {cancellationReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.cancelReasonItem,
                      selectedBulkScrapCancelReason === reason.value && styles.cancelReasonItemSelected
                    ]}
                    onPress={() => {
                      setSelectedBulkScrapCancelReason(reason.value);
                      if (reason.value !== 'other') {
                        setCustomBulkScrapCancelReason('');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cancelReasonRadio}>
                      {selectedBulkScrapCancelReason === reason.value && (
                        <View style={styles.cancelReasonRadioSelected} />
                      )}
                    </View>
                    <AutoText style={styles.cancelReasonLabel}>
                      {reason.label}
                    </AutoText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedBulkScrapCancelReason === 'other' && (
                <View style={styles.customReasonContainer}>
                  <AutoText style={styles.customReasonLabel}>
                    {t('dashboard.pleaseSpecify') || 'Please specify:'}
                  </AutoText>
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder={t('dashboard.enterReason') || 'Enter cancellation reason...'}
                    placeholderTextColor={theme.textSecondary}
                    value={customBulkScrapCancelReason}
                    onChangeText={setCustomBulkScrapCancelReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              <View style={styles.cancelModalButtons}>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalButtonCancel]}
                  onPress={() => {
                    setCancelBulkScrapModalVisible(false);
                    setSelectedBulkScrapRequestForCancel(null);
                    setSelectedBulkScrapCancelReason('');
                    setCustomBulkScrapCancelReason('');
                  }}
                  activeOpacity={0.7}
                >
                  <AutoText style={styles.cancelModalButtonCancelText}>
                    {t('common.cancel') || 'Cancel'}
                  </AutoText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalButtonConfirm]}
                  onPress={handleConfirmRejectBulkScrapRequest}
                  disabled={rejectingBulkScrapId !== null}
                  activeOpacity={0.7}
                >
                  {rejectingBulkScrapId ? (
                    <ActivityIndicator size="small" color={theme.textPrimary} />
                  ) : (
                    <AutoText style={styles.cancelModalButtonConfirmText}>
                      {t('dashboard.confirmCancel') || 'Confirm Cancel'}
                    </AutoText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        visible={cancelModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setCancelModalVisible(false);
          setSelectedOrderForCancel(null);
          setSelectedCancelReason('');
          setCustomCancelReason('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {t('dashboard.cancelOrder') || 'Cancel Order'}
              </AutoText>
              <TouchableOpacity
                onPress={() => {
                  setCancelModalVisible(false);
                  setSelectedOrderForCancel(null);
                  setSelectedCancelReason('');
                  setCustomCancelReason('');
                }}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <AutoText style={styles.cancelModalOrderInfo}>
                {t('dashboard.cancelOrderMessage') || 'Please select a reason for cancelling this order:'}
              </AutoText>
              {selectedOrderForCancel && (
                <AutoText style={styles.cancelModalOrderNumber}>
                  {t('dashboard.orderNumber') || 'Order'}: #{selectedOrderForCancel.order_number}
                </AutoText>
              )}

              <ScrollView
                style={styles.cancelReasonsList}
                showsVerticalScrollIndicator={false}
              >
                {cancellationReasons.map((reason) => (
                  <TouchableOpacity
                    key={reason.value}
                    style={[
                      styles.cancelReasonItem,
                      selectedCancelReason === reason.value && styles.cancelReasonItemSelected
                    ]}
                    onPress={() => {
                      setSelectedCancelReason(reason.value);
                      if (reason.value !== 'other') {
                        setCustomCancelReason('');
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.cancelReasonRadio}>
                      {selectedCancelReason === reason.value && (
                        <View style={styles.cancelReasonRadioSelected} />
                      )}
                    </View>
                    <AutoText style={styles.cancelReasonLabel}>
                      {reason.label}
                    </AutoText>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {selectedCancelReason === 'other' && (
                <View style={styles.customReasonContainer}>
                  <AutoText style={styles.customReasonLabel}>
                    {t('dashboard.pleaseSpecify') || 'Please specify:'}
                  </AutoText>
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder={t('dashboard.enterReason') || 'Enter cancellation reason...'}
                    placeholderTextColor={theme.textSecondary}
                    value={customCancelReason}
                    onChangeText={setCustomCancelReason}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                  />
                </View>
              )}

              <View style={styles.cancelModalButtons}>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalButtonCancel]}
                  onPress={() => {
                    setCancelModalVisible(false);
                    setSelectedOrderForCancel(null);
                    setSelectedCancelReason('');
                    setCustomCancelReason('');
                  }}
                  activeOpacity={0.7}
                >
                  <AutoText style={styles.cancelModalButtonCancelText}>
                    {t('common.cancel') || 'Cancel'}
                  </AutoText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalButtonConfirm]}
                  onPress={handleConfirmCancel}
                  disabled={cancellingOrderId !== null}
                  activeOpacity={0.7}
                >
                  {cancellingOrderId ? (
                    <ActivityIndicator size="small" color={theme.textPrimary} />
                  ) : (
                    <AutoText style={styles.cancelModalButtonConfirmText}>
                      {t('dashboard.confirmCancel') || 'Confirm Cancel'}
                    </AutoText>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>
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
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '10@s',
      flexShrink: 1,
      marginRight: '12@s',
    },
    headerLogo: {
      width: '32@s',
      height: '32@s',
      marginTop: '2@vs',
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      marginTop: '4@vs',
    },
    iconRow: {
      flexDirection: 'row',
      gap: '12@s',
      alignItems: 'center',
      flexShrink: 0,
    },
    iconButton: {
      padding: '4@s',
    },
    switchButton: {
      borderRadius: '8@ms',
      overflow: 'hidden',
    },
    switchButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      gap: '4@s',
    },
    switchButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: '#FFFFFF',
    },
    scrollContent: {
      paddingHorizontal: '14@s',
      paddingTop: '12@vs',
      paddingBottom: '24@vs',
    },
    approvalStatusCard: {
      backgroundColor: theme.card,
      borderRadius: '14@ms',
      padding: '16@s',
      marginBottom: '14@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    approvalStatusContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    approvalStatusLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@s',
      flex: 1,
    },
    approvalStatusTextContainer: {
      flex: 1,
    },
    approvalStatusTitle: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    approvalStatusValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    sectionTitleContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: '8@s',
      marginBottom: '10@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
      marginBottom: '6@vs',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      flex: 1,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '12@vs',
    },
    price: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '20@s',
      color: theme.textPrimary,
    },
    acceptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent,
      paddingHorizontal: '16@s',
      paddingVertical: '10@vs',
      borderRadius: '12@ms',
      gap: '4@s',
    },
    acceptButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    activeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '10@vs',
      gap: '8@s',
    },
    activeHeaderLeft: {
      flex: 1,
      marginRight: '8@s',
    },
    viewAllButton: {
      marginTop: '8@vs',
      backgroundColor: theme.primary + '15',
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.primary + '30',
      paddingVertical: '6@vs',
      paddingHorizontal: '10@s',
      alignSelf: 'flex-start',
    },
    viewAllButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
    },
    viewAllIcon: {
      marginRight: '2@s',
    },
    viewAllText: {
      fontSize: '12@s',
      color: theme.primary,
      fontWeight: '600',
      fontFamily: 'Poppins-SemiBold',
    },
    statusTag: {
      backgroundColor: '#FFB3BA',
      paddingHorizontal: '10@s',
      paddingVertical: '3@vs',
      borderRadius: '10@ms',
      flexShrink: 0,
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: '#C2185B',
    },
    viewButton: {
      marginTop: '8@vs',
    },
    impactSection: {
      marginBottom: '12@vs',
    },
    impactRow: {
      flexDirection: 'row',
      gap: '8@s',
      marginTop: '8@vs',
    },
    impactCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: '10@ms',
      padding: '10@s',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    impactIcon: {
      marginBottom: '4@vs',
    },
    impactValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '2@vs',
    },
    impactLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '10@s',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: '2@vs',
    },
    impactSubLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '8@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '10@vs',
    },
    earningsChart: {
      height: '130@vs',
      marginTop: '8@vs',
      marginBottom: '10@vs',
    },
    chartContainer: {
      flexDirection: 'row',
      height: '100@vs',
      marginBottom: '5@vs',
    },
    yAxis: {
      width: '40@s',
      justifyContent: 'space-between',
      paddingRight: '5@s',
    },
    yAxisLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '8@s',
      color: theme.textSecondary,
      textAlign: 'right',
      numberOfLines: 1,
    },
    chartBars: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: '100@vs',
      gap: '4@s',
      paddingLeft: '4@s',
    },
    barContainer: {
      flex: 1,
      height: '100%',
      justifyContent: 'flex-end',
      alignItems: 'center',
    },
    bar: {
      width: '100%',
      backgroundColor: theme.primary,
      borderRadius: '4@ms',
      minHeight: '2@vs',
      maxHeight: '100%',
    },
    chartLabelsContainer: {
      flexDirection: 'row',
    },
    yAxisSpacer: {
      width: '40@s',
    },
    chartLabels: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: '4@s',
      paddingLeft: '4@s',
    },
    monthLabelContainer: {
      flex: 1,
      alignItems: 'center',
    },
    monthLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    totalEarnings: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    categoriesSection: {
      marginBottom: '10@vs',
    },
    categoriesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '10@vs',
      gap: '10@s',
    },
    categoriesTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      marginRight: '10@s',
    },
    addButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: '16@s',
      paddingVertical: '8@vs',
      borderRadius: '12@ms',
    },
    addButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    categoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    categoriesLoading: {
      paddingVertical: '20@vs',
      alignItems: 'center',
    },
    noCategoriesContainer: {
      paddingVertical: '30@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    noCategoriesText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    noCategoriesSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
      textAlign: 'center',
      opacity: 0.7,
    },
    subcategoriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: '8@s',
    },
    subcategoryBadge: {
      width: '48%',
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '10@vs',
    },
    subcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    subcategoryPrice: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.card,
      borderTopLeftRadius: '20@ms',
      borderTopRightRadius: '20@ms',
      maxHeight: '80%',
      height: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalBody: {
      flex: 1,
    },
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
    },
    modalCloseButton: {
      padding: '4@s',
    },
    modalLoadingContainer: {
      paddingVertical: '40@vs',
      alignItems: 'center',
    },
    modalLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
    },
    modalEmptyContainer: {
      paddingVertical: '40@vs',
      alignItems: 'center',
    },
    modalEmptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
      paddingBottom: '20@vs',
    },
    modalSubcategoryItem: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '16@s',
      marginBottom: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalSubcategoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@s',
    },
    modalSubcategoryImage: {
      width: '60@s',
      height: '60@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
    },
    modalSubcategoryNoImage: {
      width: '60@s',
      height: '60@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '4@vs',
    },
    modalSubcategoryNoImageText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '9@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    modalSubcategoryInfo: {
      flex: 1,
    },
    modalSubcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    modalSubcategoryPrice: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
      marginBottom: '4@vs',
    },
    modalSubcategoryDefaultPrice: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    chartLoadingContainer: {
      paddingVertical: '40@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    chartEmptyContainer: {
      paddingVertical: '40@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartEmptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    retryButton: {
      marginTop: '16@vs',
      paddingVertical: '10@vs',
      paddingHorizontal: '20@s',
      backgroundColor: theme.primary,
      borderRadius: '8@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    retryButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    joinB2BCard: {
      marginHorizontal: '18@s',
      marginBottom: '20@vs',
      borderRadius: '18@ms',
      overflow: 'hidden',
      elevation: 4,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
    },
    joinB2BGradient: {
      padding: '20@s',
    },
    joinB2BContent: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    joinB2BTextContainer: {
      flex: 1,
      paddingRight: '10@s',
    },
    joinB2BTitle: {
      fontFamily: 'Poppins-Bold',
      fontSize: '18@s',
      color: '#FFFFFF',
      marginBottom: '4@vs',
    },
    joinB2BDesc: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: 'rgba(255,255,255,0.9)',
      marginBottom: '16@vs',
      lineHeight: '18@vs',
    },
    joinB2BButton: {
      backgroundColor: '#FFFFFF',
      paddingHorizontal: '16@s',
      paddingVertical: '8@vs',
      borderRadius: '20@ms',
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: '6@s',
    },
    joinB2BButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: '#4CAF50',
    },
    joinB2BIconContainer: {
      marginLeft: '10@s',
    },
    activePickupLoading: {
      paddingVertical: '30@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activePickupLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    refreshingIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6@s',
      flexShrink: 0,
      marginLeft: '8@s',
    },
    refreshingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
    },
    mapButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6@s',
      marginTop: '8@vs',
      paddingVertical: '8@vs',
      paddingHorizontal: '12@s',
      backgroundColor: theme.card,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
    },
    acceptOrderLoading: {
      paddingVertical: '30@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptOrderLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
      marginBottom: '6@vs',
    },
    mapIcon: {
      marginLeft: 'auto',
    },
    acceptButtonDisabled: {
      opacity: 0.6,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: '8@s',
      alignItems: 'center',
    },
    cancelButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '10@vs',
      paddingHorizontal: '16@s',
      backgroundColor: theme.card,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
      minWidth: '80@s',
    },
    cancelButtonDisabled: {
      opacity: 0.6,
    },
    cancelButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    cancelModalOrderInfo: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginBottom: '8@vs',
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
    },
    cancelModalOrderNumber: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '16@vs',
      paddingHorizontal: '18@s',
    },
    cancelReasonsList: {
      flex: 1,
      paddingHorizontal: '18@s',
    },
    cancelReasonItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: '12@vs',
      paddingHorizontal: '12@s',
      marginBottom: '8@vs',
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelReasonItemSelected: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: theme.card,
    },
    cancelReasonRadio: {
      width: '20@s',
      height: '20@s',
      borderRadius: '10@ms',
      borderWidth: 2,
      borderColor: theme.border,
      marginRight: '12@s',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelReasonRadioSelected: {
      width: '12@s',
      height: '12@s',
      borderRadius: '6@ms',
      backgroundColor: theme.primary,
    },
    cancelReasonLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      flex: 1,
    },
    customReasonContainer: {
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
      paddingBottom: '8@vs',
    },
    customReasonLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    customReasonInput: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '12@s',
      minHeight: '80@vs',
      textAlignVertical: 'top',
    },
    cancelModalButtons: {
      flexDirection: 'row',
      gap: '12@s',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    cancelModalButton: {
      flex: 1,
      paddingVertical: '12@vs',
      borderRadius: '8@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelModalButtonCancel: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelModalButtonConfirm: {
      backgroundColor: theme.primary,
    },
    cancelModalButtonCancelText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    cancelModalButtonConfirmText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    quantityInfoContainer: {
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
      paddingBottom: '16@vs',
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      marginHorizontal: '18@s',
      marginTop: '12@vs',
      marginBottom: '16@vs',
    },
    quantityInfoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8@vs',
    },
    quantityInfoLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    quantityInfoValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    quantityInputContainer: {
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
    },
    quantityInputLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    quantityInput: {
      fontFamily: 'Poppins-Regular',
      fontSize: '16@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '12@s',
      marginBottom: '8@vs',
    },
    quantityInputHint: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    blurredCard: {
      opacity: 0.4,
    },
    subscriptionOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '18@ms',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 10,
    },
    subscriptionOverlayContent: {
      backgroundColor: theme.card,
      borderRadius: '16@ms',
      padding: '24@s',
      marginHorizontal: '20@s',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    subscriptionOverlayTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      marginTop: '12@vs',
      marginBottom: '8@vs',
      textAlign: 'center',
    },
    subscriptionOverlayText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: '20@vs',
      lineHeight: '20@vs',
    },
    subscriptionButton: {
      backgroundColor: theme.primary,
      paddingVertical: '12@vs',
      paddingHorizontal: '24@s',
      borderRadius: '8@ms',
      minWidth: '150@s',
    },
    subscriptionButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#FFFFFF',
      textAlign: 'center',
    },
  });

export default DashboardScreen;

