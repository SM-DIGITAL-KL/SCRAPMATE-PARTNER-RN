import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, DeviceEventEmitter, ActivityIndicator, Modal, Alert, Platform, Vibration, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigationState, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { SectionCard } from '../../components/SectionCard';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useUserMode } from '../../context/UserModeContext';
import LinearGradient from 'react-native-linear-gradient';
import { getUserData } from '../../services/auth/authService';
import { useProfile } from '../../hooks/useProfile';
import { useBulkScrapRequests, useAcceptedBulkScrapRequests, useBulkScrapRequestsByBuyer, useAcceptBulkScrapRequest, useRejectBulkScrapRequest, useBulkSellRequests } from '../../hooks/useOrders';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '../../services/api/v2/categories';
import { useCategories, useUserCategories, useUserSubcategories } from '../../hooks/useCategories';
import { useDashboardStats } from '../../hooks/useStats';
import { CategoryBadge } from '../../components/CategoryBadge';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';
import { getSubscriptionPackages, SubscriptionPackage } from '../../services/api/v2/subscriptionPackages';
import LocationDisclosureModal from '../../components/LocationDisclosureModal';
import { hasShownDisclosure, requestLocationPermissionsWithDisclosure } from '../../utils/locationPermission';
import { useLivePrices } from '../../hooks/useLivePrices';


const DealerDashboardScreen = () => {
  const { theme, isDark, themeName } = useTheme();
  const { mode, setMode } = useUserMode();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [acceptingBulkScrapId, setAcceptingBulkScrapId] = useState<string | number | null>(null);
  const [rejectingBulkScrapId, setRejectingBulkScrapId] = useState<string | number | null>(null);
  const [cancelBulkScrapModalVisible, setCancelBulkScrapModalVisible] = useState(false);
  const [selectedBulkScrapRequestForCancel, setSelectedBulkScrapRequestForCancel] = useState<any | null>(null);
  const [selectedBulkScrapCancelReason, setSelectedBulkScrapCancelReason] = useState<string>('');
  const [customBulkScrapCancelReason, setCustomBulkScrapCancelReason] = useState<string>('');
  const [participateQuantityModalVisible, setParticipateQuantityModalVisible] = useState(false);
  const [selectedBulkScrapRequestForParticipate, setSelectedBulkScrapRequestForParticipate] = useState<any | null>(null);
  const [participateQuantity, setParticipateQuantity] = useState<string>('');
  const [activeBulkMode, setActiveBulkMode] = useState<'buy' | 'sell'>('buy');
  const [showSubscriptionPlansModal, setShowSubscriptionPlansModal] = useState(false);
  const [b2bSubscriptionPlans, setB2bSubscriptionPlans] = useState<SubscriptionPackage[]>([]);
  const [loadingSubscriptionPlans, setLoadingSubscriptionPlans] = useState(false);
  const [showLocationDisclosure, setShowLocationDisclosure] = useState(false);
  const [disclosureAccepted, setDisclosureAccepted] = useState(false);
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

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
  const { data: allCategoriesData, refetch: refetchAllCategories } = useCategories('b2b', true);

  // Fetch dashboard statistics with 365-day cache
  const {
    data: dashboardStatsData,
    isLoading: loadingStats,
    error: statsError,
    refetch: refetchStats
  } = useDashboardStats('b2b', !!userData?.id, true);

  // Fetch live prices
  const {
    data: livePricesData,
    isLoading: loadingLivePrices,
    error: livePricesError,
    refetch: refetchLivePrices
  } = useLivePrices(undefined, undefined, true);

  // Debug: Log live prices data
  React.useEffect(() => {
    if (livePricesData) {
      console.log('📊 [B2B Dashboard] Live Prices Data:', {
        status: livePricesData.status,
        msg: livePricesData.msg,
        dataLength: livePricesData.data?.length || 0,
        hasData: !!livePricesData.data,
        firstItem: livePricesData.data?.[0]
      });
    }
    if (livePricesError) {
      console.error('❌ [B2B Dashboard] Live Prices Error:', livePricesError);
    }
  }, [livePricesData, livePricesError]);

  // Refetch all category data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          console.log('🔄 Dashboard focused - refetching category data and stats...');
          // Just refetch, no need to invalidate on focus
          refetchUserCategories();
          refetchUserSubcategories();
          refetchAllCategories();
          // Refetch dashboard stats to get latest incremental updates
          refetchStats();
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, refetchUserCategories, refetchUserSubcategories, refetchAllCategories, refetchStats, queryClient])
  );

  // Listen for navigation events to refetch when returning from AddCategoryScreen
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userData?.id) {
        console.log('🔄 Navigation focus - refetching category data...');
        // Refetch all category-related data
        refetchUserCategories();
        refetchUserSubcategories();
        refetchAllCategories();
      }
    });

    return unsubscribe;
  }, [navigation, userData?.id, refetchUserCategories, refetchUserSubcategories, refetchAllCategories, queryClient]);

  // Process user categories
  const userCategories = React.useMemo(() => {
    if (!userCategoriesData?.data?.category_ids || !allCategoriesData?.data) {
      return [];
    }
    const userCategoryIds = userCategoriesData.data.category_ids.map(id => Number(id));
    return allCategoriesData.data.filter(cat => {
      const catId = Number(cat.id);
      const matches = userCategoryIds.includes(catId);
      
      // Debug logging
      if (!matches && userCategoryIds.length > 0) {
        console.log(`🔍 Category "${cat.name}" (ID: ${catId}) not in user categories:`, {
          userCategoryIds,
          catIdType: typeof cat.id,
          userCategoryIdsTypes: userCategoryIds.map(id => typeof id)
        });
      }
      
      return matches;
    });
  }, [userCategoriesData, allCategoriesData]);

  // Process category subcategories - only show user's selected subcategories for the selected category
  const categorySubcategories = React.useMemo(() => {
    if (!selectedCategory?.id || !userSubcategoriesData?.data?.subcategories) {
      return [];
    }
    
    // Convert category ID to number for comparison
    const categoryId = Number(selectedCategory.id);
    
    // Filter user's subcategories by the selected category
    // Use Number() conversion to handle type mismatches (string vs number)
    console.log(`🔍 Filtering subcategories for category "${selectedCategory.name}" (ID: ${categoryId})`);
    console.log(`📊 Total user subcategories: ${userSubcategoriesData.data.subcategories.length}`);
    
    const userSubcatsForCategory = userSubcategoriesData.data.subcategories.filter(
      (us: any) => {
        const subcatCategoryId = Number(us.main_category_id);
        const matches = subcatCategoryId === categoryId;
        
        return matches;
      }
    );
    
    console.log(`✅ Found ${userSubcatsForCategory.length} subcategories for category "${selectedCategory.name}"`);
    
    if (userSubcatsForCategory.length === 0) {
      // Debug logging when no subcategories found
      console.log(`⚠️ No subcategories found for category "${selectedCategory.name}" (ID: ${categoryId})`);
      console.log(`📋 All user subcategories:`, userSubcategoriesData.data.subcategories.map((us: any) => ({
        name: us.name,
        subcategory_id: us.subcategory_id,
        main_category_id: us.main_category_id,
        main_category_id_type: typeof us.main_category_id,
        main_category_id_number: Number(us.main_category_id)
      })));
      return [];
    }
    
    // Return user's subcategories with their custom prices
    return userSubcatsForCategory.map((userSubcat: any) => ({
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
  }, [selectedCategory?.id, selectedCategory?.name, userSubcategoriesData]);

  // Refetch when modal opens to ensure we have latest subcategories
  React.useEffect(() => {
    if (modalVisible && userData?.id && selectedCategory?.id) {
      // Force refetch to get latest data
      refetchUserSubcategories();
      refetchUserCategories();
    }
  }, [modalVisible, userData?.id, selectedCategory?.id, refetchUserSubcategories, refetchUserCategories]);

  // Load user data and check location disclosure
  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
        
        // Check if location disclosure needs to be shown (only on Android)
        if (Platform.OS === 'android' && data?.id) {
          const disclosureShown = await hasShownDisclosure();
          if (!disclosureShown) {
            // Small delay to ensure dashboard is fully loaded
            setTimeout(() => {
              setShowLocationDisclosure(true);
            }, 1000);
          }
        }
      };
      loadUserData();
    }, [])
  );

  // Handle location disclosure acceptance
  const handleLocationDisclosureAccept = async () => {
    setDisclosureAccepted(true);
    setShowLocationDisclosure(false);
    
    // Request location permissions with disclosure
    try {
      const result = await requestLocationPermissionsWithDisclosure(async () => {
        return true; // User accepted the disclosure
      });
      
      if (result.foregroundGranted) {
        console.log('✅ Location permissions granted');
        if (result.backgroundGranted) {
          console.log('✅ Background location permission granted');
        } else {
          console.log('⚠️ Background location permission not granted');
        }
      }
    } catch (error) {
      console.error('Error requesting location permissions:', error);
    }
  };

  const handleLocationDisclosureDecline = () => {
    setShowLocationDisclosure(false);
    // User declined - they can still use the app, but location features may be limited
  };

  // Fetch profile data with refetch capability
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);
  
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
    userData?.user_type || 'S',
    userLocation?.latitude,
    userLocation?.longitude,
    !!userData?.id && !!userData?.user_type
  );

  // Get accepted bulk scrap purchase requests
  const { data: acceptedBulkScrapRequests, isLoading: loadingAcceptedBulkScrapRequests, refetch: refetchAcceptedBulkScrapRequests } = useAcceptedBulkScrapRequests(
    userData?.id,
    userData?.user_type || 'S',
    userLocation?.latitude,
    userLocation?.longitude,
    !!userData?.id && !!userData?.user_type
  );

  // Get bulk scrap purchase requests created by this user (as buyer)
  const { data: myBulkBuyRequests, isLoading: loadingMyBulkBuyRequests, refetch: refetchMyBulkBuyRequests } = useBulkScrapRequestsByBuyer(
    userData?.id,
    !!userData?.id
  );

  // Get bulk sell requests (only for 'S' users)
  const { data: bulkSellRequests, isLoading: loadingBulkSellRequests, refetch: refetchBulkSellRequests } = useBulkSellRequests(
    userData?.id,
    userData?.user_type || 'S',
    userLocation?.latitude,
    userLocation?.longitude,
    !!userData?.id && userData?.user_type === 'S'
  );

  // Filter active bulk sell requests
  const activeBulkSellRequests = React.useMemo(() => {
    if (!bulkSellRequests || userData?.user_type !== 'S') return [];
    return bulkSellRequests.filter((req: any) => req.status === 'active');
  }, [bulkSellRequests, userData?.user_type]);

  // Show all requests except completed ones (filter out completed status)
  const allMyBulkBuyRequests = React.useMemo(() => {
    if (!myBulkBuyRequests) return [];
    // Filter out completed requests - they should not show in dashboard
    return myBulkBuyRequests.filter((req: any) => req.status !== 'completed');
  }, [myBulkBuyRequests]);

  // Get first request for display (most recent)
  const myActiveBulkBuyRequest = allMyBulkBuyRequests && allMyBulkBuyRequests.length > 0
    ? allMyBulkBuyRequests[0]
    : null;

  // Filter out accepted and rejected requests from the main list
  // For SR users in B2B dashboard, hide all bulk requests (they should only see them in B2C dashboard)
  const nonAcceptedBulkScrapRequests = React.useMemo(() => {
    // Hide bulk requests for SR users in B2B dashboard
    if (userData?.user_type === 'SR') {
      return [];
    }
    
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
  }, [bulkScrapRequests, acceptedBulkScrapRequests, userData?.id, userData?.user_type]);

  // Get first accepted request for "Active Buy Requests" section
  // For SR users in B2B dashboard, hide accepted bulk requests
  const activeBuyRequest = React.useMemo(() => {
    // Hide accepted bulk requests for SR users in B2B dashboard
    if (userData?.user_type === 'SR') {
      return null;
    }
    return acceptedBulkScrapRequests && acceptedBulkScrapRequests.length > 0
    ? acceptedBulkScrapRequests[0]
    : null;
  }, [acceptedBulkScrapRequests, userData?.user_type]);

  // Filter accepted bulk requests for SR users (hide them in B2B dashboard)
  const filteredAcceptedBulkScrapRequests = React.useMemo(() => {
    // Hide accepted bulk requests for SR users in B2B dashboard
    if (userData?.user_type === 'SR') {
      return [];
    }
    return acceptedBulkScrapRequests || [];
  }, [acceptedBulkScrapRequests, userData?.user_type]);

  // Helper functions for status display
  const getStatusLabel = (status: string) => {
    const statusLower = (status || 'active').toLowerCase();
    switch (statusLower) {
      case 'active': return t('dashboard.statusActive') || 'Active';
      case 'order_full_filled': return t('dashboard.statusOrderFullFilled') || 'Order Full Filled';
      case 'pickup_started': return t('dashboard.statusPickupStarted') || 'Pickup Started';
      case 'arrived': return t('dashboard.statusArrived') || 'Arrived';
      case 'completed': return t('dashboard.statusCompleted') || 'Completed';
      case 'cancelled': return t('dashboard.statusCancelled') || 'Cancelled';
      default: return status || 'Active';
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = (status || 'active').toLowerCase();
    switch (statusLower) {
      case 'active': return theme.warning || '#FFA500';
      case 'order_full_filled': return theme.info || '#2196F3';
      case 'pickup_started': return theme.warning || '#FFA500';
      case 'arrived': return theme.success || '#4CAF50';
      case 'completed': return theme.success || '#4CAF50';
      case 'cancelled': return theme.error || '#F44336';
      default: return theme.textSecondary;
    }
  };

  // Debug: Log bulk scrap requests data
  React.useEffect(() => {
    console.log('🔍 [B2B Dashboard] Bulk Scrap Requests Debug:', {
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
  
  // Accept/reject bulk scrap request mutations
  const acceptBulkScrapMutation = useAcceptBulkScrapRequest();
  const rejectBulkScrapMutation = useRejectBulkScrapRequest();
  
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
  // Check if user has active B2B subscription
  const hasActiveB2BSubscription = React.useMemo(() => {
    if (!profileData) return false;
    const shop = profileData.shop as any;
    const invoices = (profileData as any)?.invoices || [];
    
    // Check if shop has active subscription
    const isSubscribed = shop?.is_subscribed === true;
    const subscriptionEndsAt = shop?.subscription_ends_at;
    
    // Check if subscription is still valid
    if (isSubscribed && subscriptionEndsAt) {
      const endDate = new Date(subscriptionEndsAt);
      const now = new Date();
      if (endDate >= now) {
        // Check if there's an approved invoice
        const approvedInvoice = invoices.find((inv: any) => 
          inv?.approval_status === 'approved' && inv?.type === 'Paid'
        );
        return !!approvedInvoice;
      }
    }
    
    return false;
  }, [profileData]);

  // Fetch B2B subscription plans
  const fetchB2BSubscriptionPlans = async () => {
    try {
      setLoadingSubscriptionPlans(true);
      const response = await getSubscriptionPackages('b2b');
      if (response.status === 'success' && response.data) {
        setB2bSubscriptionPlans(response.data);
      }
    } catch (error) {
      console.error('Error fetching B2B subscription plans:', error);
      Alert.alert(
        t('common.error') || 'Error',
        'Failed to load subscription plans. Please try again.'
      );
    } finally {
      setLoadingSubscriptionPlans(false);
    }
  };

  const handleConfirmParticipateBulkScrapRequest = async () => {
    if (!selectedBulkScrapRequestForParticipate || !userData?.id) return;

    // Check if user has active B2B subscription
    if (!hasActiveB2BSubscription) {
      // Fetch subscription plans and show modal
      await fetchB2BSubscriptionPlans();
      setShowSubscriptionPlansModal(true);
      return;
    }

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
        userType: (userData?.user_type || 'S') as 'R' | 'S' | 'SR',
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

      // Refetch bulk scrap requests and accepted requests
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

  // Handle subscription plan selection and navigate to subscription plans screen
  const handleSelectSubscriptionPlan = (plan: SubscriptionPackage) => {
    setShowSubscriptionPlansModal(false);
    // Navigate to subscription plans screen with the selected plan
    navigation.navigate('SubscriptionPlans' as never, { 
      selectedPlanId: plan.id,
      fromBulkBuy: true,
      bulkBuyRequest: selectedBulkScrapRequestForParticipate 
    } as never);
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
        userType: (userData?.user_type || 'S') as 'R' | 'S' | 'SR',
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

      // Refetch bulk scrap requests and accepted requests
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

  // Cancellation reasons
  const cancellationReasons = React.useMemo(() => [
    { value: 'too_far', label: t('dashboard.cancelReasonTooFar') || 'Too far from my location' },
    { value: 'low_price', label: t('dashboard.cancelReasonLowPrice') || 'Price is too low' },
    { value: 'wrong_category', label: t('dashboard.cancelReasonWrongCategory') || 'Not my category' },
    { value: 'unavailable', label: t('dashboard.cancelReasonUnavailable') || 'I am unavailable' },
    { value: 'other', label: t('dashboard.cancelReasonOther') || 'Other reason' },
  ], [t]);
  
  // Refetch profile and bulk scrap requests when screen comes into focus to get latest data
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          refetchProfile();
          // Refetch bulk scrap requests and accepted requests
          if (userLocation && userData?.user_type) {
            refetchBulkScrapRequests();
            refetchAcceptedBulkScrapRequests();
          }
          // Refetch user's own bulk buy requests
          if (userData?.id) {
            refetchMyBulkBuyRequests();
          }
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, userData?.user_type, userLocation, refetchProfile, refetchBulkScrapRequests])
  );

  // Handle category press - open modal only if subcategories exist
  const handleCategoryPress = (category: Category) => {
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
    const syncB2BStatus = async () => {
      if (profileData?.shop?.approval_status && userData?.id) {
        try {
          const approvalStatus = profileData.shop.approval_status;
          await AsyncStorage.setItem('@b2b_status', approvalStatus);
          console.log('✅ DealerDashboardScreen: Synced @b2b_status to AsyncStorage:', approvalStatus);
          
          // If rejected, navigate to signup screen
          if (approvalStatus === 'rejected') {
            console.log('✅ B2B approval status is rejected - navigating to signup screen');
            // Check if company info already exists - if so, go directly to DocumentUpload
            const shop = profileData?.shop;
            const hasCompanyInfo = shop?.company_name && shop?.company_name.trim() !== '';
            
            if (hasCompanyInfo) {
              // Company info exists - navigate to DocumentUpload with existing signup data
              console.log('✅ Company info exists - navigating to DocumentUpload');
              setTimeout(() => {
                navigation.reset({
                  index: 0,
                  routes: [{
                    name: 'DocumentUpload',
                    params: {
                      signupData: {
                        companyName: shop.company_name || '',
                        gstNumber: shop.gst_number || '',
                        panNumber: shop.pan_number || '',
                        businessAddress: shop.address || '',
                        contactPersonName: shop.contact_person_name || '',
                        contactNumber: shop.contact || '',
                        contactEmail: shop.contact_email || '',
                        latitude: shop.latitude || null,
                        longitude: shop.longitude || null,
                        pincode: shop.pincode || '',
                        placeId: shop.place_id || '',
                        state: shop.state || '',
                        place: shop.place || '',
                        location: shop.location || '',
                        houseName: shop.house_name || '',
                        nearbyLocation: shop.nearby_location || '',
                      },
                    },
                  }],
                });
              }, 500);
            } else {
              // No company info - navigate to DealerSignup
              console.log('✅ No company info - navigating to DealerSignup');
              setTimeout(() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DealerSignup' }],
                });
              }, 500);
            }
          }
          // If B2B is approved, add B2C to allowed dashboards
          else if (approvalStatus === 'approved') {
            const storedDashboards = await AsyncStorage.getItem('@allowed_dashboards');
            let dashboards: ('b2b' | 'b2c' | 'delivery')[] = [];
            
            if (storedDashboards) {
              try {
                dashboards = JSON.parse(storedDashboards);
              } catch (e) {
                console.error('Error parsing allowed dashboards:', e);
              }
            }
            
            // Ensure B2B is in the list
            if (!dashboards.includes('b2b')) {
              dashboards.push('b2b');
            }
            
            // Add B2C if not already present
            if (!dashboards.includes('b2c')) {
              dashboards.push('b2c');
              console.log('✅ DealerDashboardScreen: B2B approved - added B2C to allowed dashboards');
              await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(dashboards));
              
              // Emit event to notify AppNavigator to refresh allowed dashboards
              DeviceEventEmitter.emit('B2B_STATUS_UPDATED');
            }
          }
        } catch (error) {
          console.error('❌ Error syncing B2B status:', error);
        }
      }
    };
    
    syncB2BStatus();
  }, [profileData?.shop?.approval_status, userData?.id]);

  // If signup is complete (has all documents), allow dashboard access
  // Even if approval status is pending, user can access dashboard

  const handleSwitchMode = async () => {
    if (isSwitchingMode) return;
    setIsSwitchingMode(true);
    try {
      // If user_type is 'S' and approved, upgrade to 'SR' and create R shop
      if (userData?.user_type === 'S' && profileData?.shop?.approval_status === 'approved') {
        try {
          const { upgradeToSR } = await import('../../services/api/v2/profile');
          const response = await upgradeToSR(userData.id);
          console.log('✅ User upgraded to SR and R shop created:', response);
          
          // Verify the upgrade was successful
          if (response.status === 'success' && response.data?.user_type === 'SR') {
            console.log('✅ Upgrade verified: user_type is SR');
          } else {
            console.warn('⚠️ Upgrade response does not confirm SR user_type:', response);
          }
          
          // Wait a bit for cache to clear
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Refetch profile to get updated user_type from API
          await refetchProfile();
          
          // Get fresh user data from API (not from AsyncStorage cache)
          const { getProfile } = await import('../../services/api/v2/profile');
          const { setUserData: setUserDataStorage } = await import('../../services/auth/authService');
          const freshProfile = await getProfile(userData.id);
          
          // Extract user data from profile and update AsyncStorage
          const updatedUserData = {
            id: freshProfile.id,
            name: freshProfile.name,
            email: freshProfile.email || '',
            phone_number: freshProfile.phone,
            user_type: freshProfile.user_type,
            app_type: freshProfile.app_type,
          };
          
          // Update AsyncStorage with fresh data
          await setUserDataStorage(updatedUserData);
          
          console.log('✅ Updated userData after upgrade:', { 
            id: updatedUserData?.id, 
            user_type: updatedUserData?.user_type 
          });
          
          // Verify user_type is SR
          if (updatedUserData?.user_type !== 'SR') {
            console.error('❌ User type is not SR after upgrade:', updatedUserData?.user_type);
            Alert.alert(
              t('common.error') || 'Error',
              t('dashboard.upgradeVerificationError') || 'Upgrade completed but user type verification failed. Please refresh the app.',
              [{ text: t('common.ok') || 'OK' }]
            );
            setIsSwitchingMode(false);
            return;
          }
          
          setUserData(updatedUserData);
        } catch (upgradeError: any) {
          console.error('Error upgrading to SR:', upgradeError);
          // If upgrade fails, still allow mode switch if user is already SR
          if (upgradeError?.message?.includes('already has R shop') || upgradeError?.message?.includes('User type must be')) {
            // User might already be SR, continue with mode switch
            console.log('⚠️ Upgrade error, but continuing with mode switch');
            // Still refetch to get latest data
            await refetchProfile();
            const updatedUserData = await getUserData();
            setUserData(updatedUserData);
          } else {
            Alert.alert(
              t('common.error') || 'Error',
              upgradeError?.message || t('dashboard.upgradeError') || 'Failed to upgrade account. Please try again.',
              [{ text: t('common.ok') || 'OK' }]
            );
            setIsSwitchingMode(false);
            return;
          }
        }
      }
      
      // After upgrade (or if already SR), refresh user data from API
      if (userData?.user_type === 'SR' || (userData?.user_type === 'S' && profileData?.shop?.approval_status === 'approved')) {
        try {
          const { getProfile } = await import('../../services/api/v2/profile');
          const { setUserData: setUserDataStorage } = await import('../../services/auth/authService');
          const freshProfile = await getProfile(userData.id);
          
          // Extract user data from profile and update AsyncStorage
          const updatedUserData = {
            id: freshProfile.id,
            name: freshProfile.name,
            email: freshProfile.email || '',
            phone_number: freshProfile.phone,
            user_type: freshProfile.user_type,
            app_type: freshProfile.app_type,
          };
          
          // Update AsyncStorage with fresh data
          await setUserDataStorage(updatedUserData);
          setUserData(updatedUserData);
        } catch (refreshError) {
          console.error('Error refreshing user data:', refreshError);
          // Continue anyway - the upgrade might have succeeded
        }
      }
      
      await setMode('b2c');
    } catch (error) {
      console.error('Error switching mode:', error);
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.modeSwitchError') || 'Failed to switch mode. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    } finally {
      setIsSwitchingMode(false);
    }
  };

  // Commented out static data for purchase orders and sales orders
  // const purchaseOrders = [
  //   { id: 'PO-2024-001', status: 'Invoiced', quantity: 2.5, amount: 150000, date: '2024-07-28' },
  //   { id: 'PO-2024-002', status: 'Pending', quantity: 1.0, amount: 60000, date: '2024-07-27' },
  // ];

  // const salesOrders = [
  //   { id: 'SO-2024-005', status: 'Completed', quantity: 5.0, amount: 300000, date: '2024-07-29' },
  //   { id: 'SO-2024-006', status: 'Shipped', quantity: 3.0, amount: 180000, date: '2024-07-26' },
  // ];

  // const formatQuantity = (qty: number) => `${qty} ${t('dealerDashboard.metricTons')}`;
  // const formatAmount = (amt: number) => `₹${amt.toLocaleString('en-IN')}`;
  
  // const getStatusTranslation = (status: string) => {
  //   switch (status) {
  //     case 'Invoiced':
  //       return t('dealerDashboard.invoiced');
  //     case 'Pending':
  //       return t('common.pending');
  //     case 'Completed':
  //       return t('common.completed');
  //     case 'Shipped':
  //       return t('dealerDashboard.shipped');
  //     default:
  //       return status;
  //   }
  // };

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
    <>
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('../../assets/images/logoDark.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <AutoText style={styles.headerTitle} numberOfLines={1}>
            B2B
          </AutoText>
        </View>
        <View style={styles.iconRow}>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
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
              <MaterialCommunityIcons name="account" size={16} color="#FFFFFF" />
              <Text style={styles.switchButtonText}>
                {isSwitchingMode ? '...' : 'B2C'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={() => {
              navigation.navigate('UserProfile', { profileData });
            }}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scrap rates card */}
        <SectionCard>
          <View style={styles.livePricesHeader}>
            <AutoText style={styles.sectionTitle}>{t('dealerDashboard.liveScrapPrices')}</AutoText>
            <View style={styles.livePricesHeaderRight}>
              {loadingLivePrices && (
                <ActivityIndicator size="small" color={theme.primary} style={{ marginRight: 10 }} />
              )}
              {livePricesData?.data && livePricesData.data.length > 0 && (
                <TouchableOpacity
                  onPress={() => navigation.navigate('LivePrices' as never)}
                  style={styles.viewAllButton}
                >
                  <AutoText style={styles.viewAllButtonText}>
                    {t('common.viewAll') || 'View All'}
                  </AutoText>
                  <MaterialCommunityIcons name="chevron-right" size={16} color={theme.primary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
          
          {livePricesError ? (
            <View style={styles.errorContainer}>
              <AutoText style={styles.errorText}>
                {t('common.error') || 'Error'}: {livePricesError?.message || 'Failed to load live prices'}
              </AutoText>
            </View>
          ) : loadingLivePrices && (!livePricesData?.data || livePricesData.data.length === 0) ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.loadingText}>
                {t('common.loading') || 'Loading live prices...'}
              </AutoText>
            </View>
          ) : livePricesData?.data && livePricesData.data.length > 0 ? (
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.livePricesScrollContent}
            >
              {livePricesData.data.slice(0, 10).map((price, index) => {
                // Get the primary price (buy_price or sell_price or lme_price or mcx_price)
                const primaryPrice = price.buy_price || price.sell_price || price.lme_price || price.mcx_price || 'N/A';
                const priceLabel = price.item || price.category || 'Price';
                const location = price.location || '';
                
                return (
                  <View key={index} style={styles.priceColumn}>
                    <AutoText style={styles.priceLabel} numberOfLines={1}>
                      {priceLabel}
                    </AutoText>
                    {location ? (
                      <AutoText style={styles.priceLocation} numberOfLines={1}>
                        {location}
                      </AutoText>
                    ) : null}
                    <View style={styles.priceValueRow}>
                      <AutoText style={styles.priceValue}>
                        {primaryPrice.includes('₹') ? primaryPrice : `₹${primaryPrice}`}
                      </AutoText>
                    </View>
                    {price.buy_price && price.sell_price && (
                      <AutoText style={styles.priceRange}>
                        Buy: ₹{price.buy_price} | Sell: ₹{price.sell_price}
                      </AutoText>
                    )}
                    <AutoText style={styles.dailyLabel}>{t('dealerDashboard.daily')}</AutoText>
                  </View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={styles.emptyContainer}>
              <AutoText style={styles.emptyText}>
                {t('common.noData') || 'No live prices available'}
              </AutoText>
            </View>
          )}
        </SectionCard>

        {/* Action buttons - Toggle between Bulk Buy and Bulk Sell */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              activeBulkMode === 'buy' ? styles.toggleButtonActive : styles.toggleButtonInactive
            ]}
            onPress={() => {
              setActiveBulkMode('buy');
              navigation.navigate('BulkScrapRequest');
            }}
            activeOpacity={0.8}
          >
            <AutoText style={[
              styles.toggleButtonText,
              activeBulkMode === 'buy' ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive
            ]}>
              {t('dealerDashboard.initiateNewRequest')}
            </AutoText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              activeBulkMode === 'sell' ? styles.toggleButtonActive : styles.toggleButtonInactive
            ]}
            onPress={() => {
              setActiveBulkMode('sell');
              navigation.navigate('BulkSellRequest');
            }}
            activeOpacity={0.8}
          >
            <AutoText style={[
              styles.toggleButtonText,
              activeBulkMode === 'sell' ? styles.toggleButtonTextActive : styles.toggleButtonTextInactive
            ]}>
              {t('dealerDashboard.bulkSell')}
            </AutoText>
          </TouchableOpacity>
        </View>

        {/* Bulk Scrap Purchase Requests Section */}
        {bulkScrapRequestsError && (
          <SectionCard>
            <AutoText style={[styles.orderDetail, { color: theme.error || '#FF4444' }]} numberOfLines={3}>
              {t('common.error') || 'Error'}: {bulkScrapRequestsError?.message || 'Failed to load bulk scrap requests'}
            </AutoText>
          </SectionCard>
        )}
        {loadingBulkScrapRequests ? (
          <SectionCard>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.loadingText}>
                {t('common.loading') || 'Loading bulk scrap requests...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : (
          <>
            {nonAcceptedBulkScrapRequests && nonAcceptedBulkScrapRequests.length > 0 && (
              <SectionCard>
                <AutoText style={styles.sectionTitle} numberOfLines={2}>
                  {t('dashboard.bulkScrapRequests') || 'Bulk Scrap Purchase Requests'} ({nonAcceptedBulkScrapRequests.length})
                </AutoText>
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
                  <SectionCard key={`bulk-scrap-${request.id}-${index}`} style={index > 0 ? { marginTop: 12 } : undefined}>
                    <AutoText style={styles.orderDetail} numberOfLines={1}>
                      {t('dashboard.requestFrom') || 'Request from'}: {request.buyer_name || `User #${request.buyer_id}`}
                    </AutoText>
                    {request.subcategories && request.subcategories.length > 0 ? (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="package-variant"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={3}>
                          {subcategoriesText}
                        </AutoText>
                      </View>
                    ) : request.scrap_type && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="package-variant"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={1}>
                          {request.scrap_type}
                        </AutoText>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                      <MaterialCommunityIcons
                        name="weight-kilogram"
                        size={14}
                        color={theme.primary}
                        style={{ marginRight: 8, marginTop: 2 }}
                      />
                      <AutoText style={styles.orderDetail} numberOfLines={1}>
                        {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
                      </AutoText>
                    </View>
                    {/* Show progress if vendors have committed */}
                    {request.total_committed_quantity !== undefined && request.total_committed_quantity > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="progress-check"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={1}>
                          {t('dashboard.committed') || 'Committed'}: {request.total_committed_quantity.toLocaleString('en-IN')} kg / {request.quantity.toLocaleString('en-IN')} kg
                          {' '}({((request.total_committed_quantity / request.quantity) * 100).toFixed(0)}%)
                        </AutoText>
                      </View>
                    )}
                    {request.preferred_price && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="currency-inr"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={1}>
                          {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{request.preferred_price.toLocaleString('en-IN')} / kg
                        </AutoText>
                      </View>
                    )}
                    {request.location && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={2}>
                          {request.location}
                        </AutoText>
                      </View>
                    )}
                    {request.distance_km !== undefined && request.distance_km !== null && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="map-marker-distance"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={1}>
                          {request.distance_km.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                        </AutoText>
                      </View>
                    )}
                    {request.additional_notes && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="note-text"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={3}>
                          {request.additional_notes}
                        </AutoText>
                      </View>
                    )}
                    {request.documents && request.documents.length > 0 && (
                      <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                        <MaterialCommunityIcons
                          name="file-document"
                          size={14}
                          color={theme.primary}
                          style={{ marginRight: 8, marginTop: 2 }}
                        />
                        <AutoText style={styles.orderDetail} numberOfLines={1}>
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
                          style={[styles.acceptButton, isProcessing && styles.acceptButtonDisabled]}
                          onPress={(e) => {
                            e.stopPropagation();
                            if (Platform.OS === 'ios') {
                              Vibration.vibrate(10);
                            } else {
                              Vibration.vibrate(50);
                            }
                            handleAcceptBulkScrapRequest(request);
                          }}
                          disabled={isProcessing}
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
                );
              })
            ) : (
              nonAcceptedBulkScrapRequests && nonAcceptedBulkScrapRequests.length === 0 && (
                <SectionCard>
                  <AutoText style={styles.orderDetail} numberOfLines={2}>
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
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.loadingText}>
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
                {filteredAcceptedBulkScrapRequests && filteredAcceptedBulkScrapRequests.length > 1 && (
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
                        {t('dashboard.viewAll') || 'View All'} ({filteredAcceptedBulkScrapRequests.length})
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
                <AutoText style={styles.activeStatusText} numberOfLines={1}>
                  {t('dashboard.statusAccepted') || 'Accepted'}
                </AutoText>
              </View>
            </View>
            {activeBuyRequest.buyer_name && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="account"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={1}>
                  {t('dashboard.requestFrom') || 'Request from'}: {activeBuyRequest.buyer_name}
                </AutoText>
              </View>
            )}
            {activeBuyRequest.subcategories && activeBuyRequest.subcategories.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={3}>
                  {activeBuyRequest.subcategories.map((s: any) => s.subcategory_name).join(', ')}
                </AutoText>
              </View>
            ) : activeBuyRequest.scrap_type && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={1}>
                  {activeBuyRequest.scrap_type}
                </AutoText>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
              <MaterialCommunityIcons
                name="weight-kilogram"
                size={14}
                color={theme.primary}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <AutoText style={styles.orderDetail} numberOfLines={1}>
                {activeBuyRequest.quantity.toLocaleString('en-IN')} kg ({(activeBuyRequest.quantity / 1000).toFixed(2)} tons)
              </AutoText>
            </View>
            {activeBuyRequest.preferred_price && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={1}>
                  {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{activeBuyRequest.preferred_price.toLocaleString('en-IN')} / kg
                </AutoText>
              </View>
            )}
            {activeBuyRequest.location && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={2}>
                  {activeBuyRequest.location}
                </AutoText>
              </View>
            )}
            {activeBuyRequest.distance_km !== undefined && activeBuyRequest.distance_km !== null && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="map-marker-distance"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={1}>
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

        {/* My Bulk Buy Requests Section */}
        {loadingMyBulkBuyRequests ? (
          <SectionCard>
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.loadingText}>
                {t('common.loading') || 'Loading my bulk buy requests...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : myActiveBulkBuyRequest ? (
          <SectionCard>
            <View style={styles.activeHeader}>
              <View style={styles.activeHeaderLeft}>
                <AutoText style={styles.sectionTitle} numberOfLines={2}>
                  {t('dashboard.myBulkBuyRequests') || 'My Bulk Buy Requests'}
                </AutoText>
                {allMyBulkBuyRequests && allMyBulkBuyRequests.length > 0 && (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('MyBulkBuyRequests')}
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
                        {t('dashboard.viewAll') || 'View All'} ({allMyBulkBuyRequests.length})
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
              {myActiveBulkBuyRequest && (
                <View style={[styles.statusTag, { backgroundColor: getStatusColor(myActiveBulkBuyRequest.status || 'active') + '20' }]}>
                  <AutoText style={[styles.activeStatusText, { color: getStatusColor(myActiveBulkBuyRequest.status || 'active') }]} numberOfLines={1}>
                    {getStatusLabel(myActiveBulkBuyRequest.status || 'active')}
                  </AutoText>
                </View>
              )}
            </View>
            {myActiveBulkBuyRequest.subcategories && myActiveBulkBuyRequest.subcategories.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={3}>
                  {myActiveBulkBuyRequest.subcategories.map((s: any) => s.subcategory_name).join(', ')}
                </AutoText>
              </View>
            ) : myActiveBulkBuyRequest.scrap_type && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="package-variant"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={1}>
                  {myActiveBulkBuyRequest.scrap_type}
                </AutoText>
              </View>
            )}
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
              <MaterialCommunityIcons
                name="weight-kilogram"
                size={14}
                color={theme.primary}
                style={{ marginRight: 8, marginTop: 2 }}
              />
              <AutoText style={styles.orderDetail} numberOfLines={1}>
                {myActiveBulkBuyRequest.quantity.toLocaleString('en-IN')} kg ({(myActiveBulkBuyRequest.quantity / 1000).toFixed(2)} tons)
              </AutoText>
            </View>
            {myActiveBulkBuyRequest.preferred_price && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="currency-inr"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={1}>
                  {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{myActiveBulkBuyRequest.preferred_price.toLocaleString('en-IN')} / kg
                </AutoText>
              </View>
            )}
            {myActiveBulkBuyRequest.location && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color={theme.primary}
                  style={{ marginRight: 8, marginTop: 2 }}
                />
                <AutoText style={styles.orderDetail} numberOfLines={2}>
                  {myActiveBulkBuyRequest.location}
                </AutoText>
              </View>
            )}
            {myActiveBulkBuyRequest.accepted_vendors && myActiveBulkBuyRequest.accepted_vendors.length > 0 && (
              <View style={{ marginTop: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
                  <MaterialCommunityIcons
                    name="account-group"
                    size={16}
                    color={theme.primary}
                    style={{ marginRight: 8 }}
                  />
                  <AutoText style={styles.participatingVendorsTitle}>
                    {t('dashboard.participatingVendors') || 'Participating Vendors'} ({myActiveBulkBuyRequest.accepted_vendors.length})
                  </AutoText>
                </View>
                {myActiveBulkBuyRequest.accepted_vendors.map((vendor: any, index: number) => {
                  // Get vendor status
                  const vendorStatus = vendor.status || 'participated';
                  
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
                    <View key={index} style={styles.vendorCard}>
                      <View style={styles.vendorHeader}>
                        <MaterialCommunityIcons
                          name="account-circle"
                          size={20}
                          color={theme.primary}
                          style={{ marginRight: 8 }}
                        />
                        <View style={{ flex: 1 }}>
                          <AutoText style={styles.vendorId}>
                            {t('dashboard.vendor') || 'Vendor'} #{vendor.user_id}
                            {vendor.user_type && ` (${vendor.user_type})`}
                          </AutoText>
                        </View>
                        {/* Status Badge */}
                        <View style={[styles.vendorStatusBadge, { backgroundColor: statusInfo.bgColor }]}>
                          <MaterialCommunityIcons
                            name={statusInfo.icon as any}
                            size={12}
                            color={statusInfo.color}
                            style={{ marginRight: 4 }}
                          />
                          <AutoText style={[styles.vendorStatusBadgeText, { color: statusInfo.color }]}>
                            {statusInfo.label}
                          </AutoText>
                        </View>
                      </View>
                      <View style={styles.vendorDetails}>
                        <View style={styles.vendorDetailRow}>
                          <MaterialCommunityIcons
                            name="weight-kilogram"
                            size={14}
                            color={theme.textSecondary}
                            style={{ marginRight: 6 }}
                          />
                          <AutoText style={styles.vendorDetailLabel}>
                            {t('dashboard.committedQuantity') || 'Committed'}: 
                          </AutoText>
                          <AutoText style={styles.vendorDetailValue}>
                            {vendor.committed_quantity ? vendor.committed_quantity.toLocaleString('en-IN') : '0'} kg
                          </AutoText>
                        </View>
                        {vendor.bidding_price && (
                          <View style={styles.vendorDetailRow}>
                            <MaterialCommunityIcons
                              name="currency-inr"
                              size={14}
                              color={theme.textSecondary}
                              style={{ marginRight: 6 }}
                            />
                            <AutoText style={styles.vendorDetailLabel}>
                              {t('dashboard.biddingPrice') || 'Bidding Price'}: 
                            </AutoText>
                            <AutoText style={styles.vendorDetailValue}>
                              ₹{vendor.bidding_price.toLocaleString('en-IN')} / kg
                            </AutoText>
                          </View>
                        )}
                        {vendor.accepted_at && (
                          <View style={styles.vendorDetailRow}>
                            <MaterialCommunityIcons
                              name="clock-outline"
                              size={14}
                              color={theme.textSecondary}
                              style={{ marginRight: 6 }}
                            />
                            <AutoText style={styles.vendorDetailLabel}>
                              {t('dashboard.participatedAt') || 'Participated'}: 
                            </AutoText>
                            <AutoText style={styles.vendorDetailValue}>
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
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {myActiveBulkBuyRequest.latitude && myActiveBulkBuyRequest.longitude && (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => navigation.navigate('FullscreenMap', {
                  destination: {
                    latitude: myActiveBulkBuyRequest.latitude!,
                    longitude: myActiveBulkBuyRequest.longitude!
                  },
                  requestId: myActiveBulkBuyRequest.id?.toString()
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

        {/* Available Bulk Sell Requests Section (only for 'S' users) */}
        {userData?.user_type === 'S' && (
          <>
            {loadingBulkSellRequests ? (
              <SectionCard>
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <AutoText style={styles.loadingText}>
                    {t('common.loading') || 'Loading bulk sell requests...'}
                  </AutoText>
                </View>
              </SectionCard>
            ) : activeBulkSellRequests && activeBulkSellRequests.length > 0 ? (
              <SectionCard>
                <View style={styles.activeHeader}>
                  <View style={styles.activeHeaderLeft}>
                    <AutoText style={styles.sectionTitle} numberOfLines={2}>
                      {t('bulkSellRequest.availableRequests') || 'Available Bulk Sell Requests'}
                    </AutoText>
                    {activeBulkSellRequests.length > 1 && (
                      <TouchableOpacity
                        onPress={() => navigation.navigate('AvailableBulkSellRequests')}
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
                            {t('dashboard.viewAll') || 'View All'} ({activeBulkSellRequests.length})
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
                </View>
                {activeBulkSellRequests.slice(0, 1).map((request: any, index: number) => {
                  const quantityInTons = (request.quantity / 1000).toFixed(2);
                  const subcategoriesText = request.subcategories && request.subcategories.length > 0
                    ? request.subcategories.map((s: any) => s.subcategory_name).join(', ')
                    : request.scrap_type || 'Scrap';
                  
                  return (
                    <TouchableOpacity
                      key={request.id}
                      onPress={() => navigation.navigate('BulkSellRequestDetails', { request })}
                      activeOpacity={0.7}
                    >
                      <View style={{ marginTop: index > 0 ? 12 : 0 }}>
                        <AutoText style={styles.orderDetail} numberOfLines={1}>
                          {t('bulkSellRequest.seller') || 'Seller'}: {request.seller_name || `Seller #${request.seller_id}`}
                        </AutoText>
                        {request.subcategories && request.subcategories.length > 0 ? (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                            <MaterialCommunityIcons
                              name="package-variant"
                              size={14}
                              color={theme.primary}
                              style={{ marginRight: 8, marginTop: 2 }}
                            />
                            <AutoText style={styles.orderDetail} numberOfLines={2}>
                              {subcategoriesText}
                            </AutoText>
                          </View>
                        ) : request.scrap_type && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                            <MaterialCommunityIcons
                              name="package-variant"
                              size={14}
                              color={theme.primary}
                              style={{ marginRight: 8, marginTop: 2 }}
                            />
                            <AutoText style={styles.orderDetail} numberOfLines={1}>
                              {request.scrap_type}
                            </AutoText>
                          </View>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                          <MaterialCommunityIcons
                            name="weight-kilogram"
                            size={14}
                            color={theme.primary}
                            style={{ marginRight: 8, marginTop: 2 }}
                          />
                          <AutoText style={styles.orderDetail} numberOfLines={1}>
                            {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
                          </AutoText>
                        </View>
                        {request.asking_price && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                            <MaterialCommunityIcons
                              name="currency-inr"
                              size={14}
                              color={theme.primary}
                              style={{ marginRight: 8, marginTop: 2 }}
                            />
                            <AutoText style={styles.orderDetail} numberOfLines={1}>
                              {t('bulkSellRequest.sellingPrice') || 'Selling Price'}: ₹{request.asking_price.toLocaleString('en-IN')} / kg
                            </AutoText>
                          </View>
                        )}
                        {request.distance_km !== undefined && request.distance_km !== null && (
                          <View style={{ flexDirection: 'row', alignItems: 'flex-start', marginTop: 8 }}>
                            <MaterialCommunityIcons
                              name="map-marker-distance"
                              size={14}
                              color={theme.primary}
                              style={{ marginRight: 8, marginTop: 2 }}
                            />
                            <AutoText style={styles.orderDetail} numberOfLines={1}>
                              {request.distance_km.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                            </AutoText>
                          </View>
                        )}
                        <View style={{ marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: theme.border }}>
                          <AutoText style={[styles.orderDetail, { color: theme.primary, textAlign: 'right' }]}>
                            {t('common.viewDetails') || 'View Details'} →
                          </AutoText>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </SectionCard>
            ) : null}
          </>
        )}

        {/* Purchase Orders - Commented out static data */}
        {/* <View style={styles.sectionHeader}>
          <AutoText style={styles.sectionTitle}>{t('dealerDashboard.purchaseOrders')}</AutoText>
          <TouchableOpacity activeOpacity={0.7}>
            <AutoText style={styles.viewAllLink}>{t('dealerDashboard.viewAll')}</AutoText>
          </TouchableOpacity>
        </View>

        {purchaseOrders.map((order) => (
          <SectionCard key={order.id} style={styles.orderCard}>
            <TouchableOpacity
              style={styles.orderRow}
              activeOpacity={0.7}
              onPress={() => {}}
            >
              <View style={styles.orderInfo}>
                <AutoText style={styles.orderId}>{order.id}</AutoText>
                <View style={styles.orderDetails}>
                  <AutoText style={styles.orderDetail}>{formatQuantity(order.quantity)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{formatAmount(order.amount)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{order.date}</AutoText>
                </View>
                <View style={[styles.statusBadge, order.status === 'Invoiced' && styles.statusBadgeSuccess]}>
                  <AutoText style={styles.statusText}>
                    {getStatusTranslation(order.status)}
                  </AutoText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </SectionCard>
        ))} */}

        {/* Sales Orders - Commented out static data */}
        {/* <View style={styles.sectionHeader}>
          <AutoText style={styles.sectionTitle}>{t('dealerDashboard.salesOrders')}</AutoText>
          <TouchableOpacity activeOpacity={0.7}>
            <AutoText style={styles.viewAllLink}>{t('dealerDashboard.viewAll')}</AutoText>
          </TouchableOpacity>
        </View>

        {salesOrders.map((order) => (
          <SectionCard key={order.id} style={styles.orderCard}>
            <TouchableOpacity
              style={styles.orderRow}
              activeOpacity={0.7}
              onPress={() => {}}
            >
              <View style={styles.orderInfo}>
                <AutoText style={styles.orderId}>{order.id}</AutoText>
                <View style={styles.orderDetails}>
                  <AutoText style={styles.orderDetail}>{formatQuantity(order.quantity)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{formatAmount(order.amount)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{order.date}</AutoText>
                </View>
                <View style={[styles.statusBadge, order.status === 'Completed' && styles.statusBadgeSuccess]}>
                  <AutoText style={styles.statusText}>
                    {getStatusTranslation(order.status)}
                  </AutoText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </SectionCard>
        ))} */}

        {/* Categories Operating Section */}
        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <AutoText style={styles.categoriesTitle} numberOfLines={3}>
              {t('dashboard.categoriesOperating') || 'Categories Operating'}
            </AutoText>
            <TouchableOpacity 
              style={styles.addButton} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AddCategory')}
            >
              <AutoText style={styles.addButtonText} numberOfLines={1}>
                {t('dashboard.add') || 'Add'} +
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

      {/* B2B Subscription Plans Modal */}
      <Modal
        visible={showSubscriptionPlansModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowSubscriptionPlansModal(false);
          setB2bSubscriptionPlans([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {t('dashboard.b2bSubscriptionRequired') || 'B2B Subscription Required'}
              </AutoText>
              <TouchableOpacity
                onPress={() => {
                  setShowSubscriptionPlansModal(false);
                  setB2bSubscriptionPlans([]);
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
                {t('dashboard.b2bSubscriptionRequiredMessage') || 'You need an active B2B subscription to participate in bulk buy requests. Please select a subscription plan:'}
              </AutoText>

              {loadingSubscriptionPlans ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <AutoText style={{ marginTop: 10, color: theme.textSecondary }}>
                    {t('common.loading') || 'Loading subscription plans...'}
                  </AutoText>
                </View>
              ) : b2bSubscriptionPlans.length > 0 ? (
                <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                  {b2bSubscriptionPlans.map((plan) => (
                    <TouchableOpacity
                      key={plan.id}
                      style={[
                        styles.subscriptionPlanCard,
                        { 
                          backgroundColor: theme.card,
                          borderColor: theme.border,
                          marginBottom: 12
                        }
                      ]}
                      onPress={() => handleSelectSubscriptionPlan(plan)}
                      activeOpacity={0.7}
                    >
                      <View style={{ flex: 1 }}>
                        <AutoText style={[styles.subscriptionPlanName, { color: theme.textPrimary }]}>
                          {plan.name}
                        </AutoText>
                        {plan.description && (
                          <AutoText 
                            style={[styles.subscriptionPlanDescription, { color: theme.textSecondary }]}
                            numberOfLines={10}
                          >
                            {plan.description}
                          </AutoText>
                        )}
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                          <AutoText style={[styles.subscriptionPlanPrice, { color: theme.primary }]}>
                            {plan.isPercentageBased && plan.pricePercentage !== undefined
                              ? `${plan.pricePercentage.toFixed(1)}% per order`
                              : `₹${plan.price.toLocaleString('en-IN')}/${plan.duration}`}
                          </AutoText>
                          {plan.popular && (
                            <View style={{ 
                              marginLeft: 8, 
                              paddingHorizontal: 8, 
                              paddingVertical: 4, 
                              backgroundColor: theme.primary + '20',
                              borderRadius: 4
                            }}>
                              <AutoText style={{ fontSize: 10, color: theme.primary, fontWeight: '600' }}>
                                POPULAR
                              </AutoText>
                            </View>
                          )}
                        </View>
                      </View>
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={24}
                        color={theme.textSecondary}
                      />
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ) : (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <AutoText style={{ color: theme.textSecondary, textAlign: 'center' }}>
                    {t('dashboard.noSubscriptionPlansAvailable') || 'No subscription plans available. Please contact support.'}
                  </AutoText>
                </View>
              )}

              <View style={styles.cancelModalButtons}>
                <TouchableOpacity
                  style={[styles.cancelModalButton, styles.cancelModalButtonCancel]}
                  onPress={() => {
                    setShowSubscriptionPlansModal(false);
                    setB2bSubscriptionPlans([]);
                  }}
                  activeOpacity={0.7}
                >
                  <AutoText style={styles.cancelModalButtonCancelText}>
                    {t('common.cancel') || 'Cancel'}
                  </AutoText>
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
    </View>
    
    {/* Location Disclosure Modal */}
    <LocationDisclosureModal
      visible={showLocationDisclosure}
      onAccept={handleLocationDisclosureAccept}
      onDecline={handleLocationDisclosureDecline}
    />
  </>
  );
};

export default DealerDashboardScreen;

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
      paddingHorizontal: '18@s',
      paddingTop: '18@vs',
      paddingBottom: '24@vs',
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: '16@vs',
      gap: '8@s',
    },
    statCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: '14@ms',
      padding: '12@s',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      borderWidth: 1,
      borderColor: theme.border,
    },
    statIconWrapper: {
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '6@vs',
    },
    statValue: {
      fontFamily: 'Poppins-Bold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '2@vs',
    },
    statLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    statSubLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '8@s',
      color: theme.textSecondary,
      opacity: 0.7,
      marginTop: '2@vs',
      textAlign: 'center',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '14@vs',
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: '14@s',
    },
    livePricesHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12@vs',
    },
    livePricesHeaderRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    viewAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      borderRadius: '8@ms',
      backgroundColor: theme.primary + '15',
    },
    viewAllButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.primary,
      marginRight: '4@s',
    },
    livePricesScrollContent: {
      paddingRight: '10@s',
      gap: '14@s',
    },
    priceColumn: {
      flex: 1,
      minWidth: '140@s',
      maxWidth: '160@s',
      padding: '12@s',
      backgroundColor: theme.cardBackground || theme.background,
      borderRadius: '8@s',
      marginRight: '10@s',
    },
    priceLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginBottom: '8@vs',
    },
    priceValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
      marginBottom: '4@vs',
    },
    priceValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '20@s',
      color: theme.textPrimary,
    },
    priceLocation: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    priceRange: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
    },
    errorContainer: {
      padding: '12@s',
      alignItems: 'center',
    },
    errorText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.error || '#F44336',
    },
    // loadingContainer, loadingText, emptyContainer, emptyText are defined earlier
    changePositive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '4@s',
      backgroundColor: theme.accent + '40',
      paddingVertical: '4@vs',
      paddingHorizontal: '8@s',
      borderRadius: '8@ms',
    },
    changeText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
    },
    dailyLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: '12@s',
      marginBottom: '18@vs',
    },
    buttonContainer: {
      flex: 1,
    },
    toggleButton: {
      flex: 1,
      paddingVertical: '14@vs',
      paddingHorizontal: '16@s',
      borderRadius: '10@ms',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
    },
    toggleButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    toggleButtonInactive: {
      backgroundColor: 'transparent',
      borderColor: theme.border,
    },
    toggleButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
    },
    toggleButtonTextActive: {
      color: '#FFFFFF',
    },
    toggleButtonTextInactive: {
      color: theme.textPrimary,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@vs',
      marginTop: '4@vs',
    },
    viewAllLink: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    orderCard: {
      marginBottom: '12@vs',
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    orderInfo: {
      flex: 1,
    },
    orderId: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    orderDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8@vs',
    },
    orderDetail: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingVertical: '4@vs',
      paddingHorizontal: '10@s',
      borderRadius: '8@ms',
      backgroundColor: theme.border,
      marginTop: '8@vs',
    },
    statusBadgeSuccess: {
      backgroundColor: theme.accent + '40',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.primary,
    },
    categoriesSection: {
      marginTop: '18@vs',
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
    modalBody: {
      flex: 1,
    },
    // modalHeader, modalTitle, modalCloseButton are defined later for live prices modal
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
    subscriptionPlanCard: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '16@s',
      borderRadius: '12@ms',
      borderWidth: 1,
      marginBottom: '12@vs',
    },
    subscriptionPlanName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      marginBottom: '4@vs',
    },
    subscriptionPlanDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      marginBottom: '4@vs',
    },
    subscriptionPlanPrice: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
    },
    // loadingContainer and loadingText are defined earlier
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
    acceptButtonDisabled: {
      opacity: 0.6,
    },
    actionButtonsRow: {
      flexDirection: 'row',
      gap: '8@s',
      alignItems: 'center',
      marginTop: '12@vs',
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
    activeStatusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: '#C2185B',
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
    participatingVendorsTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    vendorCard: {
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      padding: '12@s',
      marginBottom: '8@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    vendorHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8@vs',
      gap: '8@s',
    },
    vendorId: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
      flex: 1,
    },
    vendorStatusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '8@s',
      paddingVertical: '4@vs',
      borderRadius: '10@ms',
    },
    vendorStatusBadgeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '10@s',
    },
    vendorDetails: {
      marginLeft: '28@s',
    },
    vendorDetailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '6@vs',
    },
    vendorDetailLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginRight: '6@s',
    },
    vendorDetailValue: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    // Modal Styles
    modalContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.card,
    },
    modalCloseButton: {
      padding: '8@s',
    },
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginHorizontal: '18@s',
      marginVertical: '12@vs',
      borderRadius: '12@ms',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchIcon: {
      marginRight: '12@s',
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      padding: 0,
    },
    searchClearButton: {
      padding: '4@s',
      marginLeft: '8@s',
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      padding: '18@s',
      paddingBottom: '40@vs',
    },
    priceCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '16@s',
      marginBottom: '16@vs',
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    priceCardHeader: {
      marginBottom: '12@vs',
    },
    priceCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      marginBottom: '8@vs',
    },
    priceCardItem: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      flex: 1,
      marginRight: '8@s',
    },
    locationBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.primary + '15',
      paddingHorizontal: '8@s',
      paddingVertical: '4@vs',
      borderRadius: '6@ms',
      maxWidth: '120@s',
    },
    locationBadgeText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '10@s',
      color: theme.primary,
      marginLeft: '4@s',
    },
    categoryBadgeContainer: {
      alignSelf: 'flex-start',
      backgroundColor: theme.accent + '20',
      paddingHorizontal: '10@s',
      paddingVertical: '4@vs',
      borderRadius: '6@ms',
    },
    categoryBadgeText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.accent,
    },
    priceCardBody: {
      marginTop: '8@vs',
    },
    priceColumnFull: {
      width: '100%',
    },
    priceValueContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
    },
    priceValueLarge: {
      fontFamily: 'Poppins-Bold',
      fontSize: '24@s',
      color: theme.primary,
    },
    originalPriceContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginLeft: '12@s',
    },
    originalPriceLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginRight: '4@s',
    },
    originalPriceValue: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      textDecorationLine: 'line-through',
    },
    priceDetailsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: '12@vs',
      paddingTop: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      gap: '12@s',
    },
    priceDetailItem: {
      flex: 1,
      minWidth: '80@s',
      backgroundColor: theme.background,
      padding: '10@s',
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    priceDetailLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    priceDetailValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    cityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: '8@vs',
      paddingTop: '8@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    cityText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginLeft: '6@s',
    },
  });


