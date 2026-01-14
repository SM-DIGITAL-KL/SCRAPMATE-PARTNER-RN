import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, ScrollView, KeyboardAvoidingView, Platform, Keyboard, Animated, Easing, Alert, ActivityIndicator, Modal, Image, PanResponder } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from '@react-native-documents/picker';
import { useTheme } from '../../components/ThemeProvider';
import { useTabBar } from '../../context/TabBarContext';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { getCurrentLocationWithAddress } from '../../components/LocationView';
import { createBulkPurchaseRequest, BulkScrapPurchaseRequest, savePendingBulkBuyOrder } from '../../services/api/v2/bulkScrap';
import { Category, Subcategory } from '../../services/api/v2/categories';
import { useCategories, useSubcategories } from '../../hooks/useCategories';
import { useUserMode } from '../../context/UserModeContext';
import { getSubscriptionPackages, saveUserSubscription, SubscriptionPackage } from '../../services/api/v2/subscriptionPackages';
import InstamojoWebView, { InstamojoPaymentResponse } from '../../components/InstamojoWebView';
import { createInstamojoPaymentRequest } from '../../services/api/v2/instamojo';
import { API_BASE_URL } from '../../services/api/apiConfig';
import { useProfile } from '../../hooks/useProfile';

// Custom Distance Slider Component
interface DistanceSliderProps {
  value: number;
  onValueChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  theme: any;
}
const DistanceSlider: React.FC<DistanceSliderProps> = ({
  value,
  onValueChange,
  min,
  max,
  step,
  theme,
}) => {
  const trackWidth = useRef(0);
  const startValue = useRef(value);
  const THUMB_SIZE = 24;

  const clamp = (val: number) => Math.min(max, Math.max(min, val));

  const valueToX = (val: number) =>
    ((val - min) / (max - min)) * (trackWidth.current - THUMB_SIZE);

  const xToValue = (x: number) => {
    const percent = x / (trackWidth.current - THUMB_SIZE);
    const raw = min + percent * (max - min);
    const stepped = Math.round(raw / step) * step;
    return clamp(stepped);
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        startValue.current = value;
      },
      onPanResponderMove: (_, gesture) => {
        if (!trackWidth.current) return;

        const startX = valueToX(startValue.current);
        const nextX = clamp(
          xToValue(startX + gesture.dx)
        );

        onValueChange(nextX);
      },
    })
  ).current;

  const thumbLeft =
    trackWidth.current > 0
      ? valueToX(value)
      : 0;

  return (
    <View style={{ width: '100%', paddingVertical: 16 }}>
      <View
        style={{ height: 40, justifyContent: 'center' }}
        onLayout={e => {
          trackWidth.current = e.nativeEvent.layout.width;
        }}
      >
        {/* Track */}
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.border,
          }}
        />

        {/* Filled Track */}
        <View
          style={{
            position: 'absolute',
            left: 0,
            width: thumbLeft + THUMB_SIZE / 2,
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.primary,
          }}
        />

        {/* Thumb */}
        <View
          {...panResponder.panHandlers}
          style={{
            position: 'absolute',
            left: thumbLeft,
            width: THUMB_SIZE,
            height: THUMB_SIZE,
            borderRadius: THUMB_SIZE / 2,
            backgroundColor: theme.primary,
            top: -8,
            borderWidth: 3,
            borderColor: theme.background,
            elevation: 4,
          }}
        />
      </View>

      {/* Labels */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
        <AutoText style={{ fontSize: 12, color: theme.textSecondary }}>
          {min} km
        </AutoText>
        <AutoText style={{ fontSize: 12, color: theme.textSecondary }}>
          {max} km
        </AutoText>
      </View>
    </View>
  );
};

const BulkScrapRequestScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { mode } = useUserMode();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { setTabBarVisible } = useTabBar();
  const buttonTranslateY = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  // Form state
  const [userData, setUserData] = useState<any>(null);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const [selectedSubcategories, setSelectedSubcategories] = useState<Subcategory[]>([]);
  // Store quantity and price for each subcategory
  const [subcategoryDetails, setSubcategoryDetails] = useState<Map<number, { quantity: string; price: string }>>(new Map());
  const [location, setLocation] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Array<{ uri: string; name: string; type: string; size?: number }>>([]);
  
  // Modal states
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [subcategoryModalVisible, setSubcategoryModalVisible] = useState(false);
  const [frequencyModalVisible, setFrequencyModalVisible] = useState(false);
  
  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [b2bSubscriptionPlan, setB2bSubscriptionPlan] = useState<SubscriptionPackage | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showInstamojoWebView, setShowInstamojoWebView] = useState(false);
  const [instamojoPaymentUrl, setInstamojoPaymentUrl] = useState('');
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [pendingBulkRequest, setPendingBulkRequest] = useState<BulkScrapPurchaseRequest | null>(null);
  
  // Fetch profile to check payment approval status
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);
  
  // Frequency options
  const frequencyOptions = [
    { value: 'one-time', label: t('bulkScrapRequest.frequencyOneTime') || 'One-time' },
    { value: 'daily', label: t('bulkScrapRequest.frequencyDaily') || 'Daily' },
    { value: 'weekly', label: t('bulkScrapRequest.frequencyWeekly') || 'Weekly' },
    { value: 'monthly', label: t('bulkScrapRequest.frequencyMonthly') || 'Monthly' },
    { value: 'as-needed', label: t('bulkScrapRequest.frequencyAsNeeded') || 'As Needed' },
    { value: 'custom', label: t('bulkScrapRequest.frequencyCustom') || 'Custom' },
  ];
  
  const [selectedFrequency, setSelectedFrequency] = useState<string>('');
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState<string>('');
  const [preferredDistance, setPreferredDistance] = useState<number>(50); // Default 50 km

  // Fetch categories and subcategories
  const { data: categoriesData, isLoading: loadingCategories } = useCategories('all', true);
  const { data: subcategoriesData, isLoading: loadingSubcategories } = useSubcategories(
    undefined, // Fetch all subcategories when categories are selected
    'all',
    selectedCategories.length > 0
  );

  const categories = useMemo(() => {
    return categoriesData?.data || [];
  }, [categoriesData]);

  const subcategories = useMemo(() => {
    if (!subcategoriesData?.data || selectedCategories.length === 0) {
      return [];
    }
    const selectedCategoryIds = selectedCategories.map(cat => Number(cat.id));
    let filtered = subcategoriesData.data.filter((subcat: Subcategory) => 
      selectedCategoryIds.includes(Number(subcat.main_category_id))
    );
    
    // Apply search filter if query exists
    if (subcategorySearchQuery.trim()) {
      const query = subcategorySearchQuery.toLowerCase().trim();
      filtered = filtered.filter((subcat: Subcategory) =>
        subcat.name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [selectedCategories, subcategoriesData, subcategorySearchQuery]);

  // Calculate total quantity and average price from all subcategory details
  const subcategorySummary = useMemo(() => {
    if (selectedSubcategories.length === 0) {
      return { totalQuantity: 0, averagePrice: 0, subcategoryCount: 0 };
    }

    const quantities = selectedSubcategories
      .map(sub => {
        const details = subcategoryDetails.get(sub.id);
        return details?.quantity ? parseFloat(details.quantity) : 0;
      })
      .filter(qty => !isNaN(qty) && qty > 0);

    const prices = selectedSubcategories
      .map(sub => {
        const details = subcategoryDetails.get(sub.id);
        return details?.price ? parseFloat(details.price) : undefined;
      })
      .filter((price): price is number => price !== undefined && !isNaN(price) && price > 0);

    const totalQuantity = quantities.length > 0
      ? quantities.reduce((sum, qty) => sum + qty, 0)
      : 0;

    const averagePrice = prices.length > 0
      ? prices.reduce((sum, price) => sum + price, 0) / prices.length
      : 0;

    return {
      totalQuantity,
      averagePrice,
      subcategoryCount: selectedSubcategories.length,
      quantityCount: quantities.length,
      priceCount: prices.length
    };
  }, [selectedSubcategories, subcategoryDetails]);

  // Function to hide UI (tab bar and button)
  const hideUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(false);
        Animated.parallel([
          Animated.timing(buttonTranslateY, {
            toValue: 100,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Function to show UI (tab bar and button)
  const showUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(true);
        Animated.parallel([
          Animated.timing(buttonTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Show UI when keyboard closes
  useEffect(() => {
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        showUI();
      }
    );

    return () => {
      hideSubscription.remove();
    };
  }, [showUI]);

  // Restore tab bar visibility when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Restore tab bar when leaving screen
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  // Handle document picker
  const handlePickDocuments = async () => {
    try {
      const pickedFiles = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
        allowMultiSelection: true,
        mode: 'import',
      });

      if (!pickedFiles || pickedFiles.length === 0) {
        return;
      }

      // Add new documents to the existing list
      const newDocuments = pickedFiles.map((file: any) => ({
        uri: file.fileCopyUri || file.uri,
        name: file.name || 'document',
        type: file.type || 'application/pdf',
        size: file.size,
      }));

      setSelectedDocuments(prev => [...prev, ...newDocuments]);
    } catch (err: any) {
      if (DocumentPicker.isErrorWithCode?.(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        // User canceled the picker
        return;
      }
      console.error('Error picking documents:', err);
      Alert.alert(
        t('common.error') || 'Error',
        err.message || t('bulkScrapRequest.documentPickError') || 'Failed to pick documents'
      );
    }
  };

  // Remove a document
  const handleRemoveDocument = (index: number) => {
    setSelectedDocuments(prev => prev.filter((_, i) => i !== index));
  };

  // Load user data and get current location
  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        try {
          // Load user data
          const data = await getUserData();
          setUserData(data);

          // Get current location
          setIsLoadingLocation(true);
          try {
            const locationData = await getCurrentLocationWithAddress();
            if (locationData) {
              setCurrentLocation({
                latitude: locationData.latitude,
                longitude: locationData.longitude
              });
              // Set location text if address is available
              if (locationData.address?.formattedAddress) {
                setLocation(locationData.address.formattedAddress);
              }
            }
          } catch (locError) {
            console.error('Error getting location:', locError);
            Alert.alert(
              t('common.error') || 'Error',
              t('bulkScrapRequest.locationError') || 'Could not get your location. Please enable location services.'
            );
          } finally {
            setIsLoadingLocation(false);
          }
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };
      loadData();
    }, [t])
  );

  // Calculate total order value and payment amount (percentage-based)
  const calculateOrderValue = useMemo(() => {
    // Calculate total order value by summing (quantity * price) for each subcategory
    let totalOrderValue = 0;
    let totalQuantity = 0;
    
    selectedSubcategories.forEach(sub => {
      const details = subcategoryDetails.get(sub.id);
      const quantity = details?.quantity ? parseFloat(details.quantity) : 0;
      const price = details?.price ? parseFloat(details.price) : 0;
      
      if (!isNaN(quantity) && quantity > 0 && !isNaN(price) && price > 0) {
        const subcategoryValue = quantity * price;
        totalOrderValue += subcategoryValue;
        totalQuantity += quantity;
      }
    });
    
    // Calculate average price for display purposes
    const subcategoryPrices = selectedSubcategories
      .map(sub => {
        const details = subcategoryDetails.get(sub.id);
        return details?.price ? parseFloat(details.price) : undefined;
      })
      .filter((price): price is number => price !== undefined && !isNaN(price) && price > 0);
    
    const avgPrice = subcategoryPrices.length > 0
      ? subcategoryPrices.reduce((sum, price) => sum + price, 0) / subcategoryPrices.length
      : 0;
    
    // Calculate payment amount based on the plan's percentage (default to 1% if plan not loaded)
    const percentage = b2bSubscriptionPlan?.pricePercentage || 1;
    const basePaymentAmount = totalOrderValue * (percentage / 100);
    // Calculate GST (18%) on payment amount
    const gstRate = 0.18; // 18% GST
    const gstAmount = basePaymentAmount * gstRate;
    const paymentAmount = basePaymentAmount + gstAmount;
    
    return { totalOrderValue, paymentAmount, basePaymentAmount, gstAmount, totalQuantity, avgPrice, percentage };
  }, [selectedSubcategories, subcategoryDetails, b2bSubscriptionPlan]);

  // Fetch B2B subscription plan (percentage-based per order)
  const fetchB2BSubscriptionPlan = async () => {
    try {
      const response = await getSubscriptionPackages('b2b');
      if (response.status === 'success' && response.data) {
        // Find the percentage-based per order plan (look for 1% or any percentage-based plan)
        const plan = response.data.find((p: SubscriptionPackage) => 
          p.isPercentageBased && (p.pricePercentage === 1 || p.pricePercentage === 0.5)
        ) || response.data.find((p: SubscriptionPackage) => p.isPercentageBased);
        if (plan) {
          setB2bSubscriptionPlan(plan);
          return plan;
        }
      }
      throw new Error('B2B subscription plan (percentage-based per order) not found');
    } catch (error) {
      console.error('Error fetching B2B subscription plan:', error);
      Alert.alert(
        t('common.error') || 'Error',
        'Failed to load subscription plan. Please try again.'
      );
      return null;
    }
  };

  // Check payment status
  const paymentStatus = useMemo(() => {
    if (!profileData) return null;
    const invoices = (profileData as any)?.invoices || [];
    
    // Find B2B subscription invoices (percentage-based per order)
    const b2bInvoices = invoices
      .filter((inv: any) => 
        inv?.type === 'Paid' &&
        (inv?.name?.includes('B2B') || inv?.name?.includes('Per Order') || inv?.name?.includes('%'))
      )
      .sort((a: any, b: any) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA;
      });
    
    if (b2bInvoices.length === 0) return null;
    
    const latestInvoice = b2bInvoices[0];
    return {
      status: latestInvoice.approval_status || 'pending',
      invoice: latestInvoice
    };
  }, [profileData]);

  // Check if payment is approved for this bulk buy request
  // Note: We don't auto-submit anymore - orders are only created after admin approves payment
  // The pending order is saved to database and admin will approve/reject it
  const checkPaymentApproval = useMemo(() => {
    return paymentStatus?.status === 'approved';
  }, [paymentStatus]);


  // Handle form submission
  const handleSubmit = async () => {
    if (!userData?.id) {
      Alert.alert(
        t('common.error') || 'Error',
        t('bulkScrapRequest.userNotFound') || 'User not found. Please try again.'
      );
      return;
    }

    if (!currentLocation) {
      Alert.alert(
        t('common.error') || 'Error',
        t('bulkScrapRequest.locationRequired') || 'Location is required. Please enable location services.'
      );
      return;
    }

    // Validate that at least one subcategory is selected with quantity
    if (selectedSubcategories.length === 0) {
      Alert.alert(
        t('common.error') || 'Error',
        t('bulkScrapRequest.selectSubcategoryRequired') || 'Please select at least one subcategory.'
      );
      return;
    }
    
    const hasSubcategoryQuantities = selectedSubcategories.some(sub => {
      const details = subcategoryDetails.get(sub.id);
      return details?.quantity && parseFloat(details.quantity) > 0;
    });
    
    if (!hasSubcategoryQuantities) {
      Alert.alert(
        t('common.error') || 'Error',
        t('bulkScrapRequest.quantityRequired') || 'Please enter a valid quantity for at least one subcategory.'
      );
      return;
    }

    // Calculate total order value and payment amount
    const { totalOrderValue, paymentAmount } = calculateOrderValue;
    
    if (totalOrderValue <= 0 || paymentAmount <= 0) {
      Alert.alert(
        t('common.error') || 'Error',
        'Please enter valid quantity and price to calculate order value.'
      );
      return;
    }

    // Build request data
    const categoryNames = selectedCategories.map(cat => cat.name).join(', ');
    const subcategoryNames = selectedSubcategories.map(sub => sub.name).join(', ');
    const scrapType = subcategoryNames || categoryNames || undefined;
    
    const subcategoryQuantities = selectedSubcategories
      .map(sub => {
        const details = subcategoryDetails.get(sub.id);
        return details?.quantity ? parseFloat(details.quantity) : 0;
      })
      .filter(qty => !isNaN(qty) && qty > 0);
    
    const totalQuantity = subcategoryQuantities.length > 0
      ? subcategoryQuantities.reduce((sum, qty) => sum + qty, 0)
      : 0;
    
    const subcategoryPrices = selectedSubcategories
      .map(sub => {
        const details = subcategoryDetails.get(sub.id);
        return details?.price ? parseFloat(details.price) : undefined;
      })
      .filter((price): price is number => price !== undefined && !isNaN(price) && price > 0);
    
    const avgPrice = subcategoryPrices.length > 0
      ? subcategoryPrices.reduce((sum, price) => sum + price, 0) / subcategoryPrices.length
      : undefined;
    
    const subcategoriesArray = selectedSubcategories
      .map(sub => {
        const details = subcategoryDetails.get(sub.id);
        if (!details || !details.quantity || parseFloat(details.quantity) <= 0) {
          return null;
        }
        return {
          subcategory_id: sub.id,
          subcategory_name: sub.name,
          quantity: parseFloat(details.quantity),
          preferred_price: details.price ? parseFloat(details.price) : undefined
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    const subcategoryId = selectedSubcategories.length > 0 ? selectedSubcategories[0].id : undefined;

    const documentsArray = selectedDocuments.map(doc => ({
      uri: doc.uri,
      name: doc.name,
      type: doc.type
    }));

    const request: BulkScrapPurchaseRequest = {
      buyer_id: userData.id,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      scrap_type: scrapType,
      subcategories: subcategoriesArray.length > 0 ? subcategoriesArray : undefined,
      subcategory_id: subcategoryId,
      quantity: totalQuantity,
      preferred_price: avgPrice,
      when_needed: selectedFrequency || undefined,
      preferred_distance: preferredDistance,
      location: location || undefined,
      additional_notes: additionalNotes || undefined,
      documents: documentsArray.length > 0 ? documentsArray : undefined
    };

    // Don't check for pending orders - each new bulk buy request is independent
    // Always require payment before creating order
    // Fetch subscription plan and show payment modal
    const plan = await fetchB2BSubscriptionPlan();
    if (!plan) {
      return;
    }

    // Store the request for later submission after payment approval
    setPendingBulkRequest(request);
    // Payment amount is percentage-based on total order value
    setPaymentAmount(paymentAmount);
    setB2bSubscriptionPlan(plan);
    setShowPaymentModal(true);
  };

  // Submit bulk buy request after payment approval
  const submitBulkBuyRequest = async (request: BulkScrapPurchaseRequest) => {
    setIsSubmitting(true);
    try {
      const response = await createBulkPurchaseRequest(request);

      if (response.status === 'success') {
        // Clear pending request
        setPendingBulkRequest(null);
        
        // Safely get notification count
        const notificationCount = response?.data?.notified_shops?.total 
          || response?.data?.notified_shops?.with_fcm_tokens 
          || response?.data?.notifications?.success_count 
          || 0;
        
        Alert.alert(
          t('common.success') || 'Success',
          t('bulkScrapRequest.requestSubmitted') || `Your bulk scrap purchase request has been submitted! Notifications sent to ${notificationCount} nearby users.`,
          [
            {
              text: t('common.ok') || 'OK',
              onPress: () => {
                if (mode === 'b2b') {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'DealerDashboard' }],
                  });
                } else if (mode === 'b2c') {
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Dashboard' }],
                  });
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      } else {
        throw new Error(response.msg || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error('Error submitting bulk scrap request:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || t('bulkScrapRequest.submitError') || 'Failed to submit request. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Instamojo WebView payment response
  const handleInstamojoResponse = async (response: InstamojoPaymentResponse) => {
    console.log('📱 Instamojo Payment Response:', response);
    
    // Close WebView
    setShowInstamojoWebView(false);
    
    if (!b2bSubscriptionPlan || !userData?.id) {
      Alert.alert('Error', 'Payment data not found. Please try again.');
      setInstamojoPaymentUrl('');
      setPaymentRequestId(null);
      setRedirectUrl('');
      return;
    }

    if (response.status === 'success' && response.paymentId) {
      // Payment successful - save subscription
      const transactionId = response.paymentId;
      const requestId = response.paymentRequestId || paymentRequestId || null;
      
      // Calculate total amount (base + GST)
      const basePaymentAmount = calculateOrderValue.basePaymentAmount || paymentAmount / 1.18;
      const gstAmount = calculateOrderValue.gstAmount || basePaymentAmount * 0.18;
      const totalPaymentAmount = basePaymentAmount + gstAmount;
      
      console.log('✅ Payment successful, saving subscription:', {
        userId: userData.id,
        packageId: b2bSubscriptionPlan.id,
        transactionId,
        paymentRequestId: requestId,
        baseAmount: basePaymentAmount,
        gstAmount: gstAmount,
        totalAmount: totalPaymentAmount,
      });

      try {
        // Save subscription with transaction details (use total amount including GST)
        const saveResult = await saveUserSubscription(
          userData.id,
          b2bSubscriptionPlan.id,
          {
            transactionId: transactionId,
            paymentRequestId: requestId,
            responseCode: '00',
            approvalRefNo: transactionId,
            amount: response.amount || totalPaymentAmount.toFixed(2),
            paymentMethod: 'Instamojo',
          }
        );

        if (saveResult.status === 'success') {
          // Save pending bulk buy order with payment transaction ID
          if (pendingBulkRequest) {
            try {
              await savePendingBulkBuyOrder(
                userData.id,
                pendingBulkRequest,
                transactionId,
                totalPaymentAmount,
                b2bSubscriptionPlan.id
              );
              console.log('✅ Pending bulk buy order saved with transaction ID:', transactionId);
            } catch (pendingOrderError: any) {
              console.error('Error saving pending bulk buy order:', pendingOrderError);
              // Don't block the payment success flow if pending order save fails
            }
          }

          setShowPaymentModal(false);
          setIsProcessingPayment(false);
          
          Alert.alert(
            'Payment Submitted',
            `Payment verification submitted successfully!\nTransaction ID: ${transactionId}\nAmount: ₹${totalPaymentAmount.toFixed(2)}\n\nOur admin team will review your payment. Once approved, your bulk buy order will be created automatically.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  // Refetch profile to check payment approval status
                  refetchProfile();
                  // Replace current screen with pending orders screen to prevent going back to bulk buy request
                  navigation.replace('PendingBulkBuyOrders', { fromPayment: true });
                  // Clear the form after navigation so user can create new orders
                  setPendingBulkRequest(null);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Subscription Error',
            saveResult.msg || 'Payment was successful but subscription activation failed. Please contact support with Transaction ID: ' + transactionId
          );
        }
      } catch (saveError: any) {
        console.error('Error saving subscription:', saveError);
        Alert.alert(
          'Subscription Error',
          `Payment was successful but subscription activation failed.\n\nTransaction ID: ${transactionId}\n\nError: ${saveError.message || 'Unknown error'}\n\nPlease contact support with the Transaction ID.`
        );
      }
    } else if (response.status === 'cancelled') {
      console.log('⚠️ Instamojo Payment Cancelled');
      Alert.alert('Payment Cancelled', 'Payment was cancelled. Please try again to complete your bulk buy order.');
    } else {
      console.error('❌ Instamojo Payment Failed:', response);
      Alert.alert('Payment Failed', response.message || response.error || 'Payment failed. Please try again.');
    }
    
    // Reset state
    setInstamojoPaymentUrl('');
    setPaymentRequestId(null);
    setRedirectUrl('');
  };

  // Handle Instamojo payment
  const handleInstamojoPayment = async () => {
    if (isProcessingPayment || !b2bSubscriptionPlan || !userData?.id) return;
    
    setIsProcessingPayment(true);
    try {
      // Get user profile data for buyer information
      const shop = profileData?.shop as any;
      const buyerName = userData.name || shop?.shopname || 'User';
      const buyerEmail = userData.email || shop?.email || '';
      const buyerPhone = String(userData.mob_num || shop?.contact || '').replace(/\D/g, '');

      if (!buyerEmail || !buyerPhone) {
        Alert.alert(
          'Incomplete Profile',
          'Please ensure your email and phone number are set in your profile before making a payment.'
        );
        setIsProcessingPayment(false);
        return;
      }

      // Create redirect URL - use v2 API endpoint for payment callback
      const redirectUrlValue = `${API_BASE_URL}/v2/instamojo/payment-redirect`;
      setRedirectUrl(redirectUrlValue);

      // Calculate GST for payment amount
      const basePaymentAmount = calculateOrderValue.basePaymentAmount || paymentAmount / 1.18;
      const gstRate = 0.18; // 18% GST
      const gstAmount = basePaymentAmount * gstRate;
      const totalPaymentAmount = basePaymentAmount + gstAmount;

      // Create payment request via API
      console.log('💳 Creating Instamojo payment request for bulk buy:', {
        userId: userData.id,
        packageId: b2bSubscriptionPlan.id,
        baseAmount: basePaymentAmount,
        gstAmount: gstAmount,
        totalAmount: totalPaymentAmount,
        purpose: `Bulk Buy Order Payment - ${b2bSubscriptionPlan.name || 'B2B Subscription'}`,
        buyerName,
        buyerEmail,
        buyerPhone,
      });

      // Create payment request via API with total amount (base + GST)
      const paymentRequest = await createInstamojoPaymentRequest({
        purpose: `Bulk Buy Order Payment - ${b2bSubscriptionPlan.name || 'B2B Subscription'}`,
        amount: totalPaymentAmount.toString(),
        buyer_name: buyerName,
        email: buyerEmail,
        phone: buyerPhone,
        redirect_url: redirectUrlValue,
        send_email: false,
        send_sms: false,
        allow_repeated_payments: false,
      });

      if (!paymentRequest.data?.longurl) {
        throw new Error('Failed to get payment URL from Instamojo');
      }

      console.log('✅ Instamojo payment request created:', {
        payment_request_id: paymentRequest.data.payment_request_id,
        longurl: paymentRequest.data.longurl,
      });

      setPaymentRequestId(paymentRequest.data.payment_request_id);
      setInstamojoPaymentUrl(paymentRequest.data.longurl);
      setShowInstamojoWebView(true);
      setIsProcessingPayment(false);
    } catch (error: any) {
      console.error('Error processing Instamojo payment:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to create payment request. Please try again.'
      );
      setIsProcessingPayment(false);
    }
  };


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>{t('bulkScrapRequest.title')}</AutoText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Payment Status Banner - Only show rejected */}
        {paymentStatus && paymentStatus.status === 'rejected' && (
          <View style={[styles.paymentStatusBanner, { backgroundColor: '#F8D7DA', borderColor: '#F44336' }]}>
            <MaterialCommunityIcons name="alert-circle" size={20} color="#F44336" />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <AutoText style={{ fontSize: 14, fontWeight: '600', color: '#721C24', marginBottom: 4 }}>
                Payment Rejected
              </AutoText>
              <AutoText style={{ fontSize: 12, color: '#721C24' }}>
                {paymentStatus.invoice?.approval_notes || 'Your payment was rejected. Please make payment again to submit your bulk buy request.'}
              </AutoText>
            </View>
          </View>
        )}
        {/* Scrap Details */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.scrapDetails')}</AutoText>
          <View style={styles.formRow}>
            <TouchableOpacity 
              style={styles.dropdown} 
              activeOpacity={0.7}
              onPress={() => setCategoryModalVisible(true)}
            >
              <AutoText style={[styles.dropdownText, selectedCategories.length > 0 && styles.dropdownTextSelected]} numberOfLines={1}>
                {selectedCategories.length > 0 
                  ? `${selectedCategories.length} ${selectedCategories.length === 1 ? 'category' : 'categories'} selected`
                  : t('bulkScrapRequest.selectScrapType')}
              </AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            {selectedCategories.length > 0 && (
              <View style={styles.selectedItemsContainer}>
                {selectedCategories.map((cat) => (
                  <View key={cat.id} style={styles.selectedItem}>
                    <AutoText style={styles.selectedItemText}>{cat.name}</AutoText>
                    <TouchableOpacity
                      onPress={() => {
                        setSelectedCategories(prev => prev.filter(c => c.id !== cat.id));
                        // Remove subcategories from removed category
                        setSelectedSubcategories(prev => prev.filter(sub => Number(sub.main_category_id) !== Number(cat.id)));
                      }}
                      style={styles.removeItemButton}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={styles.formRow}>
            <TouchableOpacity 
              style={[styles.dropdown, selectedCategories.length === 0 && styles.dropdownDisabled]} 
              activeOpacity={0.7}
              onPress={() => {
                if (selectedCategories.length > 0) {
                  setSubcategoryModalVisible(true);
                } else {
                  Alert.alert(
                    t('common.warning') || 'Warning',
                    t('bulkScrapRequest.selectCategoryFirst') || 'Please select a category first'
                  );
                }
              }}
              disabled={selectedCategories.length === 0}
            >
              <AutoText style={[styles.dropdownText, selectedSubcategories.length > 0 && styles.dropdownTextSelected]} numberOfLines={1}>
                {selectedSubcategories.length > 0 
                  ? `${selectedSubcategories.length} ${selectedSubcategories.length === 1 ? 'subcategory' : 'subcategories'} selected`
                  : t('bulkScrapRequest.selectSubcategory')}
              </AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
            {selectedSubcategories.length > 0 && (
              <View style={styles.selectedItemsContainer}>
                {selectedSubcategories.map((subcat) => (
                  <View key={subcat.id} style={styles.selectedItem}>
                    <AutoText style={styles.selectedItemText}>{subcat.name}</AutoText>
                    <TouchableOpacity
                      onPress={() => setSelectedSubcategories(prev => prev.filter(s => s.id !== subcat.id))}
                      style={styles.removeItemButton}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Pricing & Delivery */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.pricingDelivery')}</AutoText>
          <View style={styles.formRow}>
            <TouchableOpacity 
              style={styles.dropdown} 
              activeOpacity={0.7}
              onPress={() => setFrequencyModalVisible(true)}
            >
              <AutoText style={[styles.dropdownText, selectedFrequency && styles.dropdownTextSelected]}>
                {selectedFrequency 
                  ? frequencyOptions.find(opt => opt.value === selectedFrequency)?.label || selectedFrequency
                  : t('bulkScrapRequest.frequencyQuestion')}
              </AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Preferred Distance Slider */}
          <View style={styles.formRow}>
            <View style={styles.distanceSliderContainer}>
              <View style={styles.distanceSliderHeader}>
                <AutoText style={styles.distanceSliderLabel}>
                  {t('bulkScrapRequest.preferredDistance') || 'Preferred Distance'}
                </AutoText>
                <AutoText style={styles.distanceSliderValue}>
                  {preferredDistance} {t('common.km') || 'km'}
                </AutoText>
              </View>
              <DistanceSlider
                value={preferredDistance}
                onValueChange={setPreferredDistance}
                min={0}
                max={3000}
                step={50}
                theme={theme}
              />
            </View>
          </View>
        </View>

        {/* Location & Additional Information */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.locationAdditional')}</AutoText>
          <View style={styles.formRow}>
            {isLoadingLocation ? (
              <View style={[styles.input, styles.loadingContainer]}>
                <ActivityIndicator size="small" color={theme.primary} />
                <AutoText style={styles.loadingText}>{t('bulkScrapRequest.loadingLocation') || 'Getting location...'}</AutoText>
              </View>
            ) : (
              <TextInput
                style={styles.input}
                placeholder={t('bulkScrapRequest.locationPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={location}
                onChangeText={setLocation}
                onFocus={hideUI}
              />
            )}
            <AutoText style={styles.inputLabel}>{t('bulkScrapRequest.locationLabel')}</AutoText>
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('bulkScrapRequest.additionalNotesPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              value={additionalNotes}
              onChangeText={setAdditionalNotes}
              onFocus={hideUI}
            />
            <AutoText style={styles.inputLabel}>{t('bulkScrapRequest.additionalNotesLabel')}</AutoText>
          </View>
        </View>

        {/* Summary Section */}
        {selectedSubcategories.length > 0 && (
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.summary') || 'Summary'}</AutoText>
            <View style={styles.summaryContainer}>
              {selectedSubcategories.map((subcat) => {
                const details = subcategoryDetails.get(subcat.id) || { quantity: '', price: '' };
                const quantity = details.quantity ? parseFloat(details.quantity) : 0;
                const price = details.price ? parseFloat(details.price) : 0;
                const estimatedValue = quantity > 0 && price > 0 ? quantity * price : 0;
                
                return (
                  <View key={subcat.id} style={styles.summarySubcategoryItem}>
                    <View style={styles.summarySubcategoryHeader}>
                      {subcat.image ? (
                        <Image source={{ uri: subcat.image }} style={styles.summarySubcategoryImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.summarySubcategoryIcon}>
                          <MaterialCommunityIcons name="package-variant-closed" size={20} color={theme.primary} />
                        </View>
                      )}
                      <AutoText style={styles.summarySubcategoryName} numberOfLines={2}>
                        {subcat.name}
                      </AutoText>
                    </View>
                    
                    <View style={styles.summarySubcategoryDetails}>
                      <View style={styles.summaryDetailRow}>
                        <AutoText style={styles.summaryDetailLabel}>
                          {t('bulkScrapRequest.quantityLabel') || 'Quantity'}:
                        </AutoText>
                        <AutoText style={styles.summaryDetailValue}>
                          {quantity > 0 ? `${quantity.toLocaleString('en-IN')} kgs` : '-'}
                        </AutoText>
                      </View>
                      
                      <View style={styles.summaryDetailRow}>
                        <AutoText style={styles.summaryDetailLabel}>
                          {t('bulkScrapRequest.preferredPriceLabel') || 'Preferred Price'}:
                        </AutoText>
                        <AutoText style={styles.summaryDetailValue}>
                          {price > 0 ? `₹${price.toFixed(2)} / kg` : '-'}
                        </AutoText>
                      </View>
                      
                      {estimatedValue > 0 && (
                        <View style={[styles.summaryDetailRow, styles.summaryDetailRowTotal]}>
                          <AutoText style={styles.summaryDetailTotalLabel}>
                            {t('bulkScrapRequest.estimatedValue') || 'Estimated Value'}:
                          </AutoText>
                          <AutoText style={styles.summaryDetailTotalValue}>
                            ₹{estimatedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </AutoText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
              
              {/* Grand Total */}
              {subcategorySummary.totalQuantity > 0 && subcategorySummary.averagePrice > 0 && (
                <View style={[styles.summaryRow, styles.summaryTotalRow]}>
                  <View style={styles.summaryItem}>
                    <MaterialCommunityIcons name="calculator" size={24} color={theme.primary} />
                    <View style={styles.summaryItemContent}>
                      <AutoText style={styles.summaryTotalLabel}>
                        {t('bulkScrapRequest.grandTotal') || 'Grand Total'}
                      </AutoText>
                      <AutoText style={styles.summaryTotalValue}>
                        ₹{(subcategorySummary.totalQuantity * subcategorySummary.averagePrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </AutoText>
                      <AutoText style={styles.summaryTotalSubtext}>
                        {subcategorySummary.totalQuantity.toLocaleString('en-IN')} kgs × ₹{subcategorySummary.averagePrice.toFixed(2)} / kg
                      </AutoText>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Attachments */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.attachments')}</AutoText>
          <View style={styles.fileUploadArea}>
            <TouchableOpacity 
              style={styles.uploadButton} 
              activeOpacity={0.7}
              onPress={handlePickDocuments}
            >
              <MaterialCommunityIcons name="upload" size={24} color={theme.primary} />
              <AutoText style={styles.uploadButtonText}>
                {t('bulkScrapRequest.uploadDocument') || 'Upload Documents'}
              </AutoText>
            </TouchableOpacity>
            {selectedDocuments.length === 0 ? (
              <AutoText style={styles.fileStatusText}>
                {t('bulkScrapRequest.noFileSelected') || 'No documents selected'}
              </AutoText>
            ) : (
              <AutoText style={styles.fileStatusText}>
                {selectedDocuments.length} {selectedDocuments.length === 1 ? 'document' : 'documents'} selected
              </AutoText>
            )}
          </View>
          
          {/* Selected Documents List */}
          {selectedDocuments.length > 0 && (
            <View style={styles.documentsListContainer}>
              {selectedDocuments.map((doc, index) => (
                <View key={index} style={styles.documentItem}>
                  <View style={styles.documentItemLeft}>
                    <MaterialCommunityIcons 
                      name={doc.type?.includes('pdf') ? 'file-pdf-box' : 'file-image'} 
                      size={24} 
                      color={theme.primary} 
                    />
                    <View style={styles.documentItemInfo}>
                      <AutoText style={styles.documentItemName} numberOfLines={1}>
                        {doc.name}
                      </AutoText>
                      {doc.size && (
                        <AutoText style={styles.documentItemSize}>
                          {(doc.size / 1024).toFixed(2)} KB
                        </AutoText>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.removeDocumentButton}
                    onPress={() => handleRemoveDocument(index)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="close-circle" size={24} color="#FF4444" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Category Selection Modal */}
      <Modal
        visible={categoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>{t('bulkScrapRequest.selectScrapType') || 'Select Scrap Type'}</AutoText>
              <TouchableOpacity
                onPress={() => setCategoryModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent}>
              {loadingCategories ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <AutoText style={styles.modalLoadingText}>{t('common.loading') || 'Loading...'}</AutoText>
                </View>
              ) : categories.length === 0 ? (
                <View style={styles.modalEmptyContainer}>
                  <AutoText style={styles.modalEmptyText}>{t('common.noData') || 'No categories available'}</AutoText>
                </View>
              ) : (
                <>
                  {selectedCategories.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearAllButton}
                      onPress={() => {
                        setSelectedCategories([]);
                        setSelectedSubcategories([]);
                      }}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color={theme.primary} />
                      <AutoText style={styles.clearAllText}>Clear All ({selectedCategories.length})</AutoText>
                    </TouchableOpacity>
                  )}
                  {categories.map((category: Category) => {
                    const isSelected = selectedCategories.some(cat => cat.id === category.id);
                    return (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.modalItem,
                          isSelected && styles.modalItemSelected
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            // Deselect category
                            setSelectedCategories(prev => prev.filter(c => c.id !== category.id));
                            // Remove subcategories from deselected category
                            setSelectedSubcategories(prev => prev.filter(sub => Number(sub.main_category_id) !== Number(category.id)));
                          } else {
                            // Select category
                            setSelectedCategories(prev => [...prev, category]);
                          }
                        }}
                        activeOpacity={0.7}
                      >
                        <View style={styles.checkboxContainer}>
                          <MaterialCommunityIcons 
                            name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"} 
                            size={24} 
                            color={isSelected ? theme.primary : theme.textSecondary} 
                          />
                        </View>
                        {category.image ? (
                          <Image source={{ uri: category.image }} style={styles.modalItemImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.modalItemIcon}>
                            <MaterialCommunityIcons name="package-variant" size={24} color={theme.primary} />
                          </View>
                        )}
                        <AutoText style={styles.modalItemText}>{category.name}</AutoText>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Frequency Selection Modal */}
      <Modal
        visible={frequencyModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setFrequencyModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>{t('bulkScrapRequest.frequencyQuestion') || 'How often do you need scrap?'}</AutoText>
              <TouchableOpacity
                onPress={() => setFrequencyModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent}>
              {frequencyOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalItem,
                    selectedFrequency === option.value && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedFrequency(option.value);
                    setFrequencyModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalItemIcon}>
                    <MaterialCommunityIcons 
                      name={
                        option.value === 'one-time' ? 'calendar-clock' :
                        option.value === 'daily' ? 'calendar-today' :
                        option.value === 'weekly' ? 'calendar-week' :
                        option.value === 'monthly' ? 'calendar-month' :
                        option.value === 'as-needed' ? 'calendar-question' :
                        'calendar-edit'
                      } 
                      size={24} 
                      color={theme.primary} 
                    />
                  </View>
                  <AutoText style={styles.modalItemText}>{option.label}</AutoText>
                  {selectedFrequency === option.value && (
                    <MaterialCommunityIcons name="check-circle" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Subcategory Selection Modal */}
      <Modal
        visible={subcategoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setSubcategoryModalVisible(false);
          setSubcategorySearchQuery(''); // Clear search when modal closes
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>
                {t('bulkScrapRequest.selectSubcategory') || 'Select Subcategories'}
                {selectedCategories.length > 0 && ` (${selectedCategories.length} ${selectedCategories.length === 1 ? 'category' : 'categories'})`}
              </AutoText>
              <TouchableOpacity
                onPress={() => {
                  setSubcategoryModalVisible(false);
                  setSubcategorySearchQuery(''); // Clear search when modal closes
                }}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            {/* Search Input */}
            <View style={styles.searchContainer}>
              <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                placeholder={t('common.search') || 'Search subcategories...'}
                placeholderTextColor={theme.textSecondary}
                value={subcategorySearchQuery}
                onChangeText={setSubcategorySearchQuery}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {subcategorySearchQuery.length > 0 && (
                <TouchableOpacity
                  onPress={() => setSubcategorySearchQuery('')}
                  style={styles.clearSearchButton}
                >
                  <MaterialCommunityIcons name="close-circle" size={20} color={theme.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent}>
              {loadingSubcategories ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <AutoText style={styles.modalLoadingText}>{t('common.loading') || 'Loading...'}</AutoText>
                </View>
              ) : subcategories.length === 0 ? (
                <View style={styles.modalEmptyContainer}>
                  <AutoText style={styles.modalEmptyText}>
                    {selectedCategories.length === 0 
                      ? t('bulkScrapRequest.selectCategoryFirst') || 'Please select a category first'
                      : subcategorySearchQuery.trim()
                        ? t('common.noResults') || 'No subcategories found'
                        : t('dashboard.noSubcategories') || 'No subcategories available'}
                  </AutoText>
                </View>
              ) : (
                <>
                  {selectedSubcategories.length > 0 && (
                    <TouchableOpacity
                      style={styles.clearAllButton}
                      onPress={() => setSelectedSubcategories([])}
                      activeOpacity={0.7}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color={theme.primary} />
                      <AutoText style={styles.clearAllText}>Clear All ({selectedSubcategories.length})</AutoText>
                    </TouchableOpacity>
                  )}
                  {subcategories.map((subcategory: Subcategory) => {
                    const isSelected = selectedSubcategories.some(sub => sub.id === subcategory.id);
                    const details = subcategoryDetails.get(subcategory.id) || { quantity: '', price: '' };
                    
                    return (
                      <View key={subcategory.id} style={[styles.subcategoryItemContainer, isSelected && styles.subcategoryItemSelected]}>
                        <TouchableOpacity
                          style={styles.subcategoryItemHeader}
                          onPress={() => {
                            if (isSelected) {
                              setSelectedSubcategories(prev => prev.filter(s => s.id !== subcategory.id));
                              // Remove details when deselected
                              setSubcategoryDetails(prev => {
                                const newMap = new Map(prev);
                                newMap.delete(subcategory.id);
                                return newMap;
                              });
                            } else {
                              setSelectedSubcategories(prev => [...prev, subcategory]);
                              // Initialize details when selected - auto-populate price from default_price
                              setSubcategoryDetails(prev => {
                                const newMap = new Map(prev);
                                const defaultPrice = subcategory.default_price || '';
                                newMap.set(subcategory.id, { 
                                  quantity: '', 
                                  price: defaultPrice // Auto-populate with admin-added default price
                                });
                                return newMap;
                              });
                            }
                          }}
                          activeOpacity={0.7}
                        >
                          <View style={styles.checkboxContainer}>
                            <MaterialCommunityIcons 
                              name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"} 
                              size={24} 
                              color={isSelected ? theme.primary : theme.textSecondary} 
                            />
                          </View>
                          {subcategory.image ? (
                            <Image source={{ uri: subcategory.image }} style={styles.modalItemImage} resizeMode="cover" />
                          ) : (
                            <View style={styles.modalItemIcon}>
                              <MaterialCommunityIcons name="package-variant-closed" size={24} color={theme.primary} />
                            </View>
                          )}
                          <AutoText style={styles.modalItemText}>{subcategory.name}</AutoText>
                        </TouchableOpacity>
                        
                        {/* Quantity and Price Inputs - Show when selected */}
                        {isSelected && (
                          <View style={styles.subcategoryInputsContainer}>
                            <View style={styles.subcategoryInputRow}>
                              <View style={styles.subcategoryInputWrapper}>
                                <AutoText style={styles.subcategoryInputLabel}>
                                  {t('bulkScrapRequest.quantityLabel') || 'Quantity (in kgs)'}
                                </AutoText>
                                <TextInput
                                  style={styles.subcategoryInput}
                                  placeholder={t('bulkScrapRequest.quantityPlaceholder') || 'e.g., 50000'}
                                  placeholderTextColor={theme.textSecondary}
                                  keyboardType="numeric"
                                  value={details.quantity}
                                  onChangeText={(text: string) => {
                                    setSubcategoryDetails(prev => {
                                      const newMap = new Map(prev);
                                      const current = newMap.get(subcategory.id) || { quantity: '', price: '' };
                                      newMap.set(subcategory.id, { ...current, quantity: text });
                                      return newMap;
                                    });
                                  }}
                                />
                              </View>
                              <View style={styles.subcategoryInputWrapper}>
                                <AutoText style={styles.subcategoryInputLabel}>
                                  {t('bulkScrapRequest.preferredPriceLabel') || 'Preferred Price (per kg)'}
                                </AutoText>
                                <TextInput
                                  style={styles.subcategoryInput}
                                  placeholder={t('bulkScrapRequest.preferredPricePlaceholder') || 'e.g., 0.25'}
                                  placeholderTextColor={theme.textSecondary}
                                  keyboardType="numeric"
                                  value={details.price}
                                  onChangeText={(text: string) => {
                                    setSubcategoryDetails(prev => {
                                      const newMap = new Map(prev);
                                      const current = newMap.get(subcategory.id) || { quantity: '', price: '' };
                                      newMap.set(subcategory.id, { ...current, price: text });
                                      return newMap;
                                    });
                                  }}
                                />
                              </View>
                            </View>
                          </View>
                        )}
                      </View>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* B2B Subscription Payment Modal */}
      <Modal
        visible={showPaymentModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          if (!isProcessingPayment) {
            setShowPaymentModal(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>
                {t('bulkScrapRequest.paymentRequired') || 'Payment Required'}
              </AutoText>
              <TouchableOpacity
                onPress={() => {
                  if (!isProcessingPayment) {
                    setShowPaymentModal(false);
                  }
                }}
                style={styles.modalCloseButton}
                disabled={isProcessingPayment}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent}>
              <AutoText 
                style={[styles.modalDescription, { marginBottom: 16, textAlign: 'left' }]}
                numberOfLines={10}
              >
                {t('bulkScrapRequest.paymentRequiredMessage') || 'You need to pay 0.5% of the total order value as B2B subscription fee before submitting your bulk buy request.'}
              </AutoText>

              {b2bSubscriptionPlan && (
                <>
                  <View style={[styles.modalItem, { marginBottom: 16 }]}>
                    <View style={{ flex: 1 }}>
                      <AutoText style={[styles.modalItemText, { marginBottom: 8 }]}>
                        {b2bSubscriptionPlan.displayname || b2bSubscriptionPlan.name}
                      </AutoText>
                      <AutoText 
                        style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}
                        numberOfLines={10}
                      >
                        {b2bSubscriptionPlan.description || `B2B subscription plan - Pay ${b2bSubscriptionPlan.pricePercentage || 1}% of each order value when accepting orders`}
                      </AutoText>
                      <AutoText style={{ fontSize: 14, color: theme.primary, fontWeight: '600', marginTop: 8 }}>
                        Total Order Value: ₹{calculateOrderValue.totalOrderValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </AutoText>
                      <AutoText style={{ fontSize: 16, color: theme.primary, fontWeight: '700', marginTop: 4 }}>
                        Payment Amount: ₹{paymentAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ({calculateOrderValue.percentage}%)
                      </AutoText>
                      {/* Show GST breakdown */}
                      {calculateOrderValue.gstAmount > 0 && (
                        <View style={{ marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: theme.border }}>
                          <AutoText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>
                            Base Amount: ₹{calculateOrderValue.basePaymentAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </AutoText>
                          <AutoText style={{ fontSize: 12, color: theme.textSecondary, marginBottom: 4 }}>
                            GST (18%): ₹{calculateOrderValue.gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </AutoText>
                          <AutoText style={{ fontSize: 14, color: theme.primary, fontWeight: '600', marginTop: 4 }}>
                            Total Payment: ₹{paymentAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                      </AutoText>
                        </View>
                      )}
                    </View>
                  </View>

                  <TouchableOpacity
                    style={[styles.uploadButton, { backgroundColor: theme.primary }]}
                    onPress={handleInstamojoPayment}
                    disabled={isProcessingPayment}
                    activeOpacity={0.7}
                  >
                    {isProcessingPayment ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons name="credit-card" size={20} color="#FFFFFF" />
                        <AutoText style={[styles.uploadButtonText, { color: '#FFFFFF', marginLeft: 8 }]}>
                          {t('bulkScrapRequest.payNow') || 'Pay Now'}
                        </AutoText>
                      </>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Instamojo WebView Modal */}
      {showInstamojoWebView && instamojoPaymentUrl && (
        <InstamojoWebView
          visible={showInstamojoWebView}
          onClose={() => {
            setShowInstamojoWebView(false);
            setInstamojoPaymentUrl('');
            setPaymentRequestId(null);
            setRedirectUrl('');
          }}
          onPaymentResponse={handleInstamojoResponse}
          paymentUrl={instamojoPaymentUrl}
          redirectUrl={redirectUrl}
        />
      )}

      {/* Submit Button */}
      <Animated.View
        style={[
          styles.bottomButtonContainer,
          {
            transform: [{ translateY: buttonTranslateY }],
            opacity: buttonOpacity,
          },
        ]}
      >
        <GreenButton
          title={isSubmitting ? (t('common.submitting') || 'Submitting...') : t('bulkScrapRequest.submitRequest')}
          onPress={handleSubmit}
          disabled={isSubmitting || isLoadingLocation}
        />
      </Animated.View>
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
    backButton: {
      width: 24,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      paddingHorizontal: '18@s',
      paddingTop: '18@vs',
      paddingBottom: '100@vs',
    },
    paymentStatusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '12@s',
      borderRadius: '12@ms',
      marginHorizontal: '18@s',
      marginTop: '12@vs',
      marginBottom: '12@vs',
      borderWidth: 1,
      gap: '10@s',
    },
    section: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '16@s',
      marginBottom: '18@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '14@vs',
    },
    formRow: {
      marginBottom: '16@vs',
    },
    input: {
      height: '52@vs',
      borderWidth: 1,
      borderRadius: '14@ms',
      borderColor: theme.border,
      paddingHorizontal: '14@s',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    textArea: {
      height: '100@vs',
      textAlignVertical: 'top',
      paddingTop: '14@vs',
    },
    inputLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '6@vs',
    },
    dropdown: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: '14@ms',
      paddingVertical: '14@vs',
      paddingHorizontal: '18@s',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.background,
    },
    dropdownText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    dropdownTextSelected: {
      color: theme.textPrimary,
      fontFamily: 'Poppins-Medium',
    },
    dropdownDisabled: {
      opacity: 0.5,
    },
    fileUploadArea: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: '14@ms',
      borderStyle: 'dashed',
      padding: '24@s',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
      paddingVertical: '12@vs',
      paddingHorizontal: '18@s',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.primary,
      marginBottom: '12@vs',
    },
    uploadButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    fileStatusText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    documentsListContainer: {
      marginTop: '16@vs',
      gap: '12@vs',
    },
    documentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16@s',
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    documentItemLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: '12@s',
    },
    documentItemInfo: {
      flex: 1,
    },
    documentItemName: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    documentItemSize: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    removeDocumentButton: {
      padding: '4@s',
    },
    distanceSliderContainer: {
      width: '100%',
      paddingVertical: '8@vs',
    },
    distanceSliderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@vs',
    },
    distanceSliderLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    distanceSliderValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.primary,
    },
    loadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8@s',
    },
    loadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginLeft: '8@s',
    },
    bottomButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: '18@vs',
      paddingHorizontal: '18@s',
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
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
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
    },
    modalCloseButton: {
      padding: '4@s',
    },
    modalBody: {
      flex: 1,
    },
    modalScrollContent: {
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
      paddingBottom: '20@vs',
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
    modalItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '16@s',
      marginBottom: '12@vs',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      gap: '12@s',
    },
    modalItemSelected: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: theme.accent + '20',
    },
    modalItemImage: {
      width: '50@s',
      height: '50@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
    },
    modalItemIcon: {
      width: '50@s',
      height: '50@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalItemText: {
      flex: 1,
      fontFamily: 'Poppins-Medium',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    checkboxContainer: {
      marginRight: '8@s',
    },
    clearAllButton: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '12@s',
      marginBottom: '12@vs',
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.primary,
      gap: '8@s',
    },
    clearAllText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    selectedItemsContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '8@s',
      marginTop: '8@vs',
    },
    selectedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      backgroundColor: theme.accent + '20',
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.primary,
      gap: '6@s',
    },
    selectedItemText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    removeItemButton: {
      padding: '2@s',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    searchIcon: {
      marginRight: '10@s',
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      paddingVertical: '8@vs',
      paddingHorizontal: '12@s',
      backgroundColor: theme.card,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    clearSearchButton: {
      marginLeft: '8@s',
      padding: '4@s',
    },
    subcategoryItemContainer: {
      marginBottom: '12@vs',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    subcategoryItemSelected: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: theme.accent + '10',
    },
    subcategoryItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '16@s',
      gap: '12@s',
    },
    subcategoryInputsContainer: {
      paddingHorizontal: '16@s',
      paddingBottom: '16@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
    },
    subcategoryInputRow: {
      flexDirection: 'row',
      gap: '12@s',
      marginTop: '12@vs',
    },
    subcategoryInputWrapper: {
      flex: 1,
    },
    subcategoryInputLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '6@vs',
    },
    subcategoryInput: {
      height: '44@vs',
      borderWidth: 1,
      borderRadius: '8@ms',
      borderColor: theme.border,
      paddingHorizontal: '12@s',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    summaryContainer: {
      gap: '12@vs',
    },
    summaryRow: {
      marginBottom: '8@vs',
    },
    summaryItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '16@s',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      gap: '12@s',
    },
    summaryItemContent: {
      flex: 1,
    },
    summaryLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    summaryValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
    },
    summaryTotalRow: {
      marginTop: '8@vs',
    },
    summaryTotalLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    summaryTotalValue: {
      fontFamily: 'Poppins-Bold',
      fontSize: '20@s',
      color: theme.primary,
    },
    summaryTotalSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
    },
    summarySubcategoryItem: {
      marginBottom: '16@vs',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '16@s',
    },
    summarySubcategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '12@vs',
      gap: '12@s',
    },
    summarySubcategoryImage: {
      width: '40@s',
      height: '40@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
    },
    summarySubcategoryIcon: {
      width: '40@s',
      height: '40@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    summarySubcategoryName: {
      flex: 1,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    summarySubcategoryDetails: {
      gap: '8@vs',
    },
    summaryDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: '6@vs',
    },
    summaryDetailRowTotal: {
      marginTop: '8@vs',
      paddingTop: '8@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    summaryDetailLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
    },
    summaryDetailValue: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    summaryDetailTotalLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    summaryDetailTotalValue: {
      fontFamily: 'Poppins-Bold',
      fontSize: '16@s',
      color: theme.primary,
    },
    modalDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginBottom: '20@vs',
      lineHeight: '20@s',
      textAlign: 'left',
    },
    inputContainer: {
      marginBottom: '20@vs',
    },
    inputLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    textInput: {
      borderWidth: 1,
      borderRadius: '8@ms',
      paddingHorizontal: '12@s',
      paddingVertical: '12@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      minHeight: '44@vs',
    },
    hintText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginTop: '6@vs',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: '12@s',
      marginTop: '8@vs',
    },
    modalButton: {
      flex: 1,
      paddingVertical: '14@vs',
      borderRadius: '8@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    verifyButton: {
      // backgroundColor set inline
    },
    modalButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
    },
  });

export default BulkScrapRequestScreen;

