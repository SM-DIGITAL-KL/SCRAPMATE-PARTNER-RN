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
import { createBulkSellRequest, BulkSellRequest } from '../../services/api/v2/bulkSell';
import { Category, Subcategory } from '../../services/api/v2/categories';
import { useCategories, useSubcategories } from '../../hooks/useCategories';
import { useUserMode } from '../../context/UserModeContext';
import { getSubscriptionPackages, saveUserSubscription, SubscriptionPackage } from '../../services/api/v2/subscriptionPackages';
import InstamojoWebView, { InstamojoPaymentResponse } from '../../components/InstamojoWebView';
import { createInstamojoPaymentRequest } from '../../services/api/v2/instamojo';
import { API_BASE_URL } from '../../services/api/apiConfig';
import { useProfile } from '../../hooks/useProfile';

// Reuse DistanceSlider from BulkScrapRequestScreen
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
        <View
          style={{
            height: 8,
            borderRadius: 4,
            backgroundColor: theme.border,
          }}
        />
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

const BulkSellRequestScreen = ({ navigation }: any) => {
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
  const [subcategoryDetails, setSubcategoryDetails] = useState<Map<number, { quantity: string; price: string }>>(new Map());
  const [locationAddress, setLocationAddress] = useState<string>('');
  const [additionalNotes, setAdditionalNotes] = useState<string>('');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number; address?: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingLocation, setIsLoadingLocation] = useState(false);
  const [selectedDocuments, setSelectedDocuments] = useState<Array<{ uri: string; name: string; type: string; size?: number }>>([]);
  
  // Modal states
  const [categoryModalVisible, setCategoryModalVisible] = useState(false);
  const [subcategoryModalVisible, setSubcategoryModalVisible] = useState(false);
  const [availabilityModalVisible, setAvailabilityModalVisible] = useState(false);
  
  // Availability options
  const availabilityOptions = [
    { value: 'immediate', label: t('bulkSellRequest.availabilityImmediate') || 'Immediate' },
    { value: 'within-week', label: t('bulkSellRequest.availabilityWithinWeek') || 'Within a Week' },
    { value: 'within-month', label: t('bulkSellRequest.availabilityWithinMonth') || 'Within a Month' },
    { value: 'custom', label: t('bulkSellRequest.availabilityCustom') || 'Custom' },
  ];
  
  const [selectedAvailability, setSelectedAvailability] = useState<string>('');
  const [subcategorySearchQuery, setSubcategorySearchQuery] = useState<string>('');
  const [preferredDistance, setPreferredDistance] = useState<number>(50);
  
  // Payment states
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [b2bSubscriptionPlan, setB2bSubscriptionPlan] = useState<SubscriptionPackage | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [showInstamojoWebView, setShowInstamojoWebView] = useState(false);
  const [instamojoPaymentUrl, setInstamojoPaymentUrl] = useState('');
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string>('');
  const [pendingBulkRequest, setPendingBulkRequest] = useState<BulkSellRequest | null>(null);

  // Fetch categories and subcategories
  const { data: categoriesData, isLoading: loadingCategories } = useCategories('all', true);
  const { data: subcategoriesData, isLoading: loadingSubcategories } = useSubcategories(
    undefined,
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
    
    if (subcategorySearchQuery.trim()) {
      const query = subcategorySearchQuery.toLowerCase().trim();
      filtered = filtered.filter((subcat: Subcategory) =>
        subcat.name?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [selectedCategories, subcategoriesData, subcategorySearchQuery]);

  // Calculate total quantity and average price
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

  // Initialize default prices for newly selected subcategories
  useEffect(() => {
    if (selectedSubcategories.length === 0) return;

    const newDetails = new Map(subcategoryDetails);
    let hasChanges = false;

    selectedSubcategories.forEach((subcat) => {
      const existingDetails = newDetails.get(subcat.id);
      // If subcategory doesn't have price set yet, initialize with default_price
      if (!existingDetails || !existingDetails.price || existingDetails.price === '') {
        const defaultPrice = subcat.default_price || '';
        newDetails.set(subcat.id, {
          quantity: existingDetails?.quantity || '',
          price: defaultPrice
        });
        hasChanges = true;
      }
    });

    // Also remove details for subcategories that are no longer selected
    const selectedIds = new Set(selectedSubcategories.map(s => s.id));
    const idsToRemove: number[] = [];
    newDetails.forEach((_, id) => {
      if (!selectedIds.has(id)) {
        idsToRemove.push(id);
      }
    });
    idsToRemove.forEach(id => {
      newDetails.delete(id);
      hasChanges = true;
    });

    if (hasChanges) {
      setSubcategoryDetails(newDetails);
    }
  }, [selectedSubcategories]);

  // Hide/show UI functions
  const hideUI = useCallback(() => {
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

  const showUI = useCallback(() => {
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

  useFocusEffect(
    React.useCallback(() => {
      return () => {
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  // Fetch profile data
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

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
    
    // Calculate payment amount based on the plan's percentage (default to 0.5% if plan not loaded)
    const percentage = b2bSubscriptionPlan?.pricePercentage ?? 0.5;
    const basePaymentAmount = totalOrderValue * (percentage / 100);
    // Calculate GST (18%) on payment amount
    const gstRate = 0.18; // 18% GST
    const gstAmount = basePaymentAmount * gstRate;
    const paymentAmount = basePaymentAmount + gstAmount;
    
    return { totalOrderValue, paymentAmount, basePaymentAmount, gstAmount, totalQuantity, avgPrice, percentage };
  }, [selectedSubcategories, subcategoryDetails, b2bSubscriptionPlan]);

  // Load B2B subscription plan early so payment calculations use correct percentage
  useFocusEffect(
    React.useCallback(() => {
      const loadData = async () => {
        try {
          // Load B2B subscription plan early so payment calculations use correct percentage
          try {
            await fetchB2BSubscriptionPlan();
          } catch (error) {
            console.warn('Failed to load B2B subscription plan:', error);
            // Don't block the screen if plan loading fails
          }
        } catch (error) {
          console.error('Error loading data:', error);
        }
      };
      loadData();
    }, [])
  );

  // Load location
  useEffect(() => {
    const loadLocation = async () => {
      if (!userData?.id) return;
      
      setIsLoadingLocation(true);
      try {
        const locationData = await getCurrentLocationWithAddress();
        if (locationData) {
          // Extract formatted address string from address object
          let addressString = '';
          if (locationData.address) {
            // Try formattedAddress first, then address field, then build from components
            if (locationData.address.formattedAddress) {
              addressString = locationData.address.formattedAddress;
            } else if (locationData.address.address) {
              addressString = locationData.address.address;
            } else {
              // Build address from components
              const parts: string[] = [];
              if (locationData.address.road) parts.push(locationData.address.road);
              if (locationData.address.houseNumber) parts.push(locationData.address.houseNumber);
              if (locationData.address.city) parts.push(locationData.address.city);
              if (locationData.address.state) parts.push(locationData.address.state);
              if (locationData.address.country) parts.push(locationData.address.country);
              
              if (parts.length > 0) {
                addressString = parts.join(', ');
              }
            }
          }
          
          setCurrentLocation({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            address: addressString
          });
          if (addressString) {
            setLocationAddress(addressString);
          }
        }
      } catch (error: any) {
        console.error('Error loading location:', error);
      } finally {
        setIsLoadingLocation(false);
      }
    };
    loadLocation();
  }, [userData?.id]);

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

      const newDocuments = pickedFiles.map((file: any) => ({
        uri: file.fileCopyUri || file.uri,
        name: file.name || 'document',
        type: file.type || 'application/pdf',
        size: file.size,
      }));

      setSelectedDocuments(prev => [...prev, ...newDocuments]);
    } catch (err: any) {
      if (DocumentPicker.isErrorWithCode?.(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.error('Error picking documents:', err);
      Alert.alert(
        t('common.error') || 'Error',
        err.message || t('bulkSellRequest.documentPickError') || 'Failed to pick documents'
      );
    }
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!userData?.id) {
      Alert.alert(t('common.error') || 'Error', t('common.loginRequired') || 'Please login first');
      return;
    }

    if (!currentLocation) {
      Alert.alert(t('common.error') || 'Error', t('bulkSellRequest.locationRequired') || 'Please enable location services');
      return;
    }

    if (selectedSubcategories.length === 0) {
      Alert.alert(t('common.error') || 'Error', t('bulkSellRequest.selectSubcategory') || 'Please select at least one subcategory');
      return;
    }

    // Validate quantities
    const hasValidQuantity = selectedSubcategories.some(sub => {
      const details = subcategoryDetails.get(sub.id);
      const qty = details?.quantity ? parseFloat(details.quantity) : 0;
      return !isNaN(qty) && qty > 0;
    });

    if (!hasValidQuantity) {
      Alert.alert(t('common.error') || 'Error', t('bulkSellRequest.quantityRequired') || 'Please enter quantity for at least one subcategory');
      return;
    }

    // Get total quantity from summary
    const totalQuantity = subcategorySummary.totalQuantity;

    // Validate minimum quantity requirement (100 kg)
    if (totalQuantity < 100) {
      Alert.alert(
        t('common.error') || 'Error',
        t('bulkSellRequest.minimumQuantityRequired') || 'Minimum quantity of 100 kg is required for bulk sell requests.'
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

    // Build subcategories array
    const subcategoriesArray = selectedSubcategories.map(sub => {
      const details = subcategoryDetails.get(sub.id);
      return {
        subcategory_id: sub.id,
        subcategory_name: sub.name,
        quantity: details?.quantity ? parseFloat(details.quantity) : 0,
        asking_price: details?.price ? parseFloat(details.price) : undefined,
      };
    }).filter(item => item.quantity > 0);

    const avgPrice = subcategorySummary.averagePrice > 0 ? subcategorySummary.averagePrice : undefined;

    // Build documents array
    const documentsArray = selectedDocuments.map(doc => ({
      uri: doc.uri,
      name: doc.name,
      type: doc.type,
    }));

    // Determine scrap type from first category
    const scrapType = selectedCategories.length > 0 ? selectedCategories[0].name : undefined;

    // Get address string (it's already a string from the location loading)
    const pickupLocation = currentLocation?.address || locationAddress || undefined;

    const request: BulkSellRequest = {
      seller_id: userData.id,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      scrap_type: scrapType,
      subcategories: subcategoriesArray.length > 0 ? subcategoriesArray : undefined,
      quantity: totalQuantity,
      asking_price: avgPrice,
      preferred_distance: preferredDistance,
      when_available: selectedAvailability || undefined,
      location: pickupLocation,
      additional_notes: additionalNotes || undefined,
      documents: documentsArray.length > 0 ? documentsArray : undefined
    };

    // Always require payment before creating request
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

  // Submit bulk sell request after payment approval
  const submitBulkSellRequest = async (request: BulkSellRequest) => {
    setIsSubmitting(true);
    try {
      const response = await createBulkSellRequest(request);

      if (response.status === 'success') {
        // Clear pending request
        setPendingBulkRequest(null);
        
        Alert.alert(
          t('common.success') || 'Success',
          t('bulkSellRequest.requestSubmitted') || `Your bulk sell request has been submitted! Notifications sent to ${response.data?.notified_users?.notified || 0} nearby users.`,
          [
            {
              text: t('common.ok') || 'OK',
              onPress: () => {
                // Navigate back to dashboard - reset navigation stack
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DealerDashboard' }],
                });
              }
            }
          ]
        );
      } else {
        throw new Error(response.msg || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error('Error submitting bulk sell request:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || t('bulkSellRequest.submitError') || 'Failed to submit request. Please try again.'
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
          // Submit bulk sell request after payment approval
          if (pendingBulkRequest) {
            await submitBulkSellRequest(pendingBulkRequest);
          }

          setShowPaymentModal(false);
          setIsProcessingPayment(false);
          
          Alert.alert(
            'Payment Submitted',
            `Payment verification submitted successfully!\nTransaction ID: ${transactionId}\nAmount: ₹${totalPaymentAmount.toFixed(2)}\n\nYour bulk sell request has been submitted!`,
            [
              {
                text: 'OK',
                onPress: () => {
                  // Refetch profile to check payment approval status
                  refetchProfile();
                  // Navigate back to dashboard
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'DealerDashboard' }],
                  });
                  // Clear the form after navigation
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
      Alert.alert('Payment Cancelled', 'Payment was cancelled. Please try again when ready.');
    } else {
      console.error('❌ Instamojo Payment Failed:', response);
      Alert.alert('Payment Failed', response.message || response.error || 'Payment failed. Please try again.');
    }
    
    // Reset state
    setInstamojoPaymentUrl('');
    setPaymentRequestId(null);
    setRedirectUrl('');
    setIsProcessingPayment(false);
  };

  // Handle Instamojo payment initiation
  const handleInstamojoPayment = async () => {
    if (isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    try {
      if (!userData?.id) {
        Alert.alert(t('bulkScrapRequest.error') || 'Error', t('bulkScrapRequest.userInfoNotFound') || 'User information not found');
        setIsProcessingPayment(false);
        return;
      }

      // Get user profile data for buyer information
      const shop = profileData?.shop as any;
      const buyerName = userData.name || shop?.shopname || 'User';
      const buyerEmail = userData.email || shop?.email || '';
      const buyerPhone = String(userData.mob_num || shop?.contact || '').replace(/\D/g, '');

      if (!buyerEmail || !buyerPhone) {
        Alert.alert(
          t('bulkScrapRequest.incompleteProfile') || 'Incomplete Profile',
          t('bulkScrapRequest.incompleteProfileMessage') || 'Please complete your profile with email and phone number before making payment.'
        );
        setIsProcessingPayment(false);
        return;
      }

      // Create redirect URL - use v2 API endpoint for payment callback
      const redirectUrlValue = `${API_BASE_URL}/v2/instamojo/payment-redirect`;
      setRedirectUrl(redirectUrlValue);

      // Calculate GST (18%) for B2B users
      const baseAmount = calculateOrderValue.basePaymentAmount || paymentAmount / 1.18;
      const gstRate = 0.18; // 18% GST
      const gstAmount = baseAmount * gstRate;
      const totalAmount = baseAmount + gstAmount;
      
      // Round to 2 decimal places for Instamojo (required format)
      const roundedTotalAmount = parseFloat(totalAmount.toFixed(2));

      // Create payment request via API
      console.log('💳 Creating Instamojo payment request:', {
        userId: userData.id,
        packageId: b2bSubscriptionPlan?.id,
        baseAmount: baseAmount,
        gstAmount: gstAmount,
        totalAmount: roundedTotalAmount,
        purpose: b2bSubscriptionPlan?.name || 'B2B Subscription Payment',
        buyerName,
        buyerEmail,
        buyerPhone,
      });

      // Create payment request via API with total amount (base + GST for B2B)
      const paymentRequest = await createInstamojoPaymentRequest({
        purpose: b2bSubscriptionPlan?.name || 'B2B Subscription Payment',
        amount: roundedTotalAmount.toFixed(2),
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
      console.error('❌ Error creating Instamojo payment request:', error);
      Alert.alert(
        t('bulkScrapRequest.paymentFailed') || 'Payment Failed',
        error.message || t('bulkScrapRequest.paymentFailedMessage') || 'Failed to initiate payment. Please try again.'
      );
      setIsProcessingPayment(false);
    }
  };

  // For now, return a simple placeholder that matches the structure
  // We'll enhance this later with the full UI from BulkScrapRequestScreen
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>{t('bulkSellRequest.title') || 'Bulk Sell Request'}</AutoText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Scrap Details Section */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.scrapDetails') || 'Scrap Details'}</AutoText>
            
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
                          setSelectedSubcategories(prev => prev.filter(s => selectedCategories.find(c => c.id === cat.id) ? false : true));
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

            {/* Subcategory Details */}
            {selectedSubcategories.length > 0 && (
              <View style={styles.subcategoryDetailsContainer}>
                {selectedSubcategories.map((subcat) => {
                  const details = subcategoryDetails.get(subcat.id) || { quantity: '', price: '' };
                  return (
                    <View key={subcat.id} style={styles.subcategoryDetailCard}>
                      <AutoText style={styles.subcategoryDetailTitle}>{subcat.name}</AutoText>
                      <View style={styles.subcategoryDetailRow}>
                        <View style={styles.subcategoryDetailInput}>
                          <AutoText style={styles.subcategoryDetailLabel}>
                            {t('bulkScrapRequest.quantityLabel') || 'Quantity'} (kg)
                          </AutoText>
                          <TextInput
                            style={styles.input}
                            placeholder="0"
                            placeholderTextColor={theme.textSecondary}
                            value={details.quantity}
                            onChangeText={(text) => {
                              const newDetails = new Map(subcategoryDetails);
                              const current = newDetails.get(subcat.id) || { quantity: '', price: '' };
                              newDetails.set(subcat.id, { ...current, quantity: text });
                              setSubcategoryDetails(newDetails);
                            }}
                            keyboardType="numeric"
                            onFocus={hideUI}
                          />
                        </View>
                        <View style={styles.subcategoryDetailInput}>
                          <AutoText style={styles.subcategoryDetailLabel}>
                            {t('bulkSellRequest.sellingPrice') || 'Selling Price'} (₹/kg)
                          </AutoText>
                          <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            placeholderTextColor={theme.textSecondary}
                            value={details.price}
                            onChangeText={(text) => {
                              const newDetails = new Map(subcategoryDetails);
                              const current = newDetails.get(subcat.id) || { quantity: '', price: '' };
                              newDetails.set(subcat.id, { ...current, price: text });
                              setSubcategoryDetails(newDetails);
                            }}
                            keyboardType="decimal-pad"
                            onFocus={hideUI}
                          />
                        </View>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Availability & Distance */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('bulkSellRequest.whenAvailable') || 'When Available'}</AutoText>
            <View style={styles.formRow}>
              <TouchableOpacity 
                style={styles.dropdown} 
                activeOpacity={0.7}
                onPress={() => setAvailabilityModalVisible(true)}
              >
                <AutoText style={[styles.dropdownText, selectedAvailability && styles.dropdownTextSelected]}>
                  {selectedAvailability 
                    ? availabilityOptions.find(opt => opt.value === selectedAvailability)?.label || selectedAvailability
                    : t('bulkSellRequest.whenAvailable') || 'When is this available?'}
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

          {/* Pickup Location & Additional Information */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('bulkSellRequest.pickupLocation') || 'Pickup Location & Additional Information'}</AutoText>
            <View style={styles.formRow}>
              {isLoadingLocation ? (
                <View style={[styles.input, styles.loadingContainer]}>
                  <ActivityIndicator size="small" color={theme.primary} />
                  <AutoText style={styles.loadingText}>{t('bulkScrapRequest.loadingLocation') || 'Getting location...'}</AutoText>
                </View>
              ) : currentLocation && locationAddress ? (
                <View style={styles.locationDisplayContainer}>
                  <MaterialCommunityIcons name="map-marker" size={20} color={theme.primary} />
                  <AutoText style={styles.locationDisplayText} numberOfLines={3}>
                    {locationAddress}
                  </AutoText>
                </View>
              ) : (
                <View style={styles.locationDisplayContainer}>
                  <MaterialCommunityIcons name="map-marker-off" size={20} color={theme.textSecondary} />
                  <AutoText style={[styles.locationDisplayText, { color: theme.textSecondary }]}>
                    {t('bulkSellRequest.locationNotAvailable') || 'Location not available. Please enable location services.'}
                  </AutoText>
                </View>
              )}
              <AutoText style={styles.inputLabel}>
                {t('bulkSellRequest.pickupLocationLabel') || 'Pickup will be at your current location'}
              </AutoText>
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

          {/* Documents Section */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.attachments') || 'Attachments'}</AutoText>
            <TouchableOpacity
              style={styles.documentButton}
              onPress={handlePickDocuments}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="file-document-outline" size={20} color={theme.primary} />
              <AutoText style={styles.documentButtonText}>
                {t('bulkScrapRequest.uploadDocument') || 'Upload Document'}
              </AutoText>
            </TouchableOpacity>
            {selectedDocuments.length > 0 && (
              <View style={styles.documentsList}>
                {selectedDocuments.map((doc, index) => (
                  <View key={index} style={styles.documentItem}>
                    <MaterialCommunityIcons name="file-document" size={20} color={theme.primary} />
                    <AutoText style={styles.documentItemText} numberOfLines={1}>
                      {doc.name}
                    </AutoText>
                    <TouchableOpacity
                      onPress={() => setSelectedDocuments(prev => prev.filter((_, i) => i !== index))}
                      style={styles.removeDocumentButton}
                    >
                      <MaterialCommunityIcons name="close-circle" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
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
                            {t('bulkSellRequest.sellingPrice') || 'Selling Price'}:
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
                            setSelectedCategories(prev => prev.filter(c => c.id !== category.id));
                            setSelectedSubcategories(prev => prev.filter(sub => Number(sub.main_category_id) !== Number(category.id)));
                          } else {
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

      {/* Subcategory Selection Modal */}
      <Modal
        visible={subcategoryModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setSubcategoryModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>{t('bulkScrapRequest.selectSubcategory') || 'Select Subcategory'}</AutoText>
              <TouchableOpacity
                onPress={() => setSubcategoryModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalSearchContainer}>
              <TextInput
                style={styles.modalSearchInput}
                placeholder={t('common.search') || 'Search...'}
                placeholderTextColor={theme.textSecondary}
                value={subcategorySearchQuery}
                onChangeText={setSubcategorySearchQuery}
              />
              <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} style={styles.modalSearchIcon} />
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent}>
              {loadingSubcategories ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <AutoText style={styles.modalLoadingText}>{t('common.loading') || 'Loading...'}</AutoText>
                </View>
              ) : subcategories.length === 0 ? (
                <View style={styles.modalEmptyContainer}>
                  <AutoText style={styles.modalEmptyText}>{t('common.noData') || 'No subcategories available'}</AutoText>
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
                  {subcategories.map((subcat: Subcategory) => {
                    const isSelected = selectedSubcategories.some(s => s.id === subcat.id);
                    return (
                      <TouchableOpacity
                        key={subcat.id}
                        style={[
                          styles.modalItem,
                          isSelected && styles.modalItemSelected
                        ]}
                        onPress={() => {
                          if (isSelected) {
                            setSelectedSubcategories(prev => prev.filter(s => s.id !== subcat.id));
                          } else {
                            setSelectedSubcategories(prev => [...prev, subcat]);
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
                        {subcat.image ? (
                          <Image source={{ uri: subcat.image }} style={styles.modalItemImage} resizeMode="cover" />
                        ) : (
                          <View style={styles.modalItemIcon}>
                            <MaterialCommunityIcons name="package-variant-closed" size={24} color={theme.primary} />
                          </View>
                        )}
                        <AutoText style={styles.modalItemText}>{subcat.name}</AutoText>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Availability Selection Modal */}
      <Modal
        visible={availabilityModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setAvailabilityModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>{t('bulkSellRequest.whenAvailable') || 'When Available'}</AutoText>
              <TouchableOpacity
                onPress={() => setAvailabilityModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalScrollContent}>
              {availabilityOptions.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalItem,
                    selectedAvailability === option.value && styles.modalItemSelected
                  ]}
                  onPress={() => {
                    setSelectedAvailability(option.value);
                    setAvailabilityModalVisible(false);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={styles.modalItemIcon}>
                    <MaterialCommunityIcons 
                      name="calendar-clock" 
                      size={24} 
                      color={selectedAvailability === option.value ? theme.primary : theme.textSecondary} 
                    />
                  </View>
                  <AutoText style={[
                    styles.modalItemText,
                    selectedAvailability === option.value && styles.modalItemTextSelected
                  ]}>
                    {option.label}
                  </AutoText>
                  {selectedAvailability === option.value && (
                    <MaterialCommunityIcons name="check" size={24} color={theme.primary} />
                  )}
                </TouchableOpacity>
              ))}
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
                {t('bulkScrapRequest.paymentRequiredMessage') || 'You need to pay 0.5% of the total order value as B2B subscription fee before submitting your bulk sell request.'}
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
                        {b2bSubscriptionPlan.description || `B2B subscription plan - Pay ${b2bSubscriptionPlan.pricePercentage ?? 0.5}% of each order value when accepting orders`}
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

      <Animated.View
        style={[
          styles.submitButtonContainer,
          {
            transform: [{ translateY: buttonTranslateY }],
            opacity: buttonOpacity,
          },
        ]}
      >
        <GreenButton
          title={t('bulkSellRequest.submitRequest') || 'Submit Request'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting || !currentLocation || selectedSubcategories.length === 0}
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
    section: {
      marginBottom: '24@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    orderDetail: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      lineHeight: '20@vs',
    },
    submitButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '16@s',
      paddingBottom: '32@vs',
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.border,
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
    dropdownDisabled: {
      opacity: 0.5,
    },
    dropdownText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      flex: 1,
    },
    dropdownTextSelected: {
      color: theme.textPrimary,
      fontFamily: 'Poppins-Medium',
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
      backgroundColor: theme.primary + '15',
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
    subcategoryDetailsContainer: {
      marginTop: '12@vs',
      gap: '12@vs',
    },
    subcategoryDetailCard: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
    },
    subcategoryDetailTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    subcategoryDetailRow: {
      flexDirection: 'row',
      gap: '12@s',
    },
    subcategoryDetailInput: {
      flex: 1,
    },
    subcategoryDetailLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '6@vs',
    },
    distanceSliderContainer: {
      marginTop: '8@vs',
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
      fontSize: '14@s',
      color: theme.primary,
    },
    documentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.primary,
      borderStyle: 'dashed',
      borderRadius: '12@ms',
      padding: '14@vs',
      gap: '8@s',
    },
    documentButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    documentsList: {
      marginTop: '12@vs',
      gap: '8@vs',
    },
    documentItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '12@s',
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
      gap: '8@s',
    },
    documentItemText: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    removeDocumentButton: {
      padding: '4@s',
    },
    summaryContainer: {
      gap: '12@vs',
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: '8@vs',
    },
    summaryLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    summaryValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
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
    locationDisplayContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      padding: '14@vs',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      gap: '12@s',
    },
    locationDisplayText: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
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
    modalSearchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: theme.background,
    },
    modalSearchInput: {
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
    modalSearchIcon: {
      marginLeft: '10@s',
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
      backgroundColor: theme.primary + '15',
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
    modalItemTextSelected: {
      color: theme.primary,
      fontFamily: 'Poppins-SemiBold',
    },
    modalDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      lineHeight: '20@vs',
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '14@vs',
      paddingHorizontal: '20@s',
      borderRadius: '12@ms',
      marginTop: '16@vs',
    },
    uploadButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
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
  });

export default BulkSellRequestScreen;

