import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  TextInput,
  Image,
  PanResponder,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { createBulkPurchaseRequest, BulkScrapPurchaseRequest, getPendingBulkBuyOrders } from '../../services/api/v2/bulkScrap';
import { useProfile } from '../../hooks/useProfile';
import { GreenButton } from '../../components/GreenButton';
import { useCategories, useSubcategories } from '../../hooks/useCategories';
import { Category, Subcategory } from '../../services/api/v2/categories';

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

const PendingBulkBuyOrderDetailScreen = ({ navigation, route }: any) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [userData, setUserData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preferredDistance, setPreferredDistance] = useState<number>(50);
  const [order, setOrder] = useState<any>(route?.params?.order || null);
  const [refreshing, setRefreshing] = useState(false);

  // Initialize distance from order
  useEffect(() => {
    if (order?.preferred_distance) {
      setPreferredDistance(order.preferred_distance);
    }
  }, [order?.preferred_distance]);

  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Fetch profile to check payment approval status
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);

  // Function to refetch order data
  const refetchOrder = useCallback(async () => {
    if (!userData?.id || !order?.id) return;
    
    try {
      setRefreshing(true);
      console.log('🔄 Refetching pending order data...', { orderId: order.id, currentStatus: order.status });
      const pendingOrders = await getPendingBulkBuyOrders(userData.id);
      const updatedOrder = pendingOrders.find((o: any) => String(o.id) === String(order.id));
      
      if (updatedOrder) {
        console.log('✅ Updated order data received:', {
          id: updatedOrder.id,
          status: updatedOrder.status,
          previousStatus: order.status,
          statusChanged: updatedOrder.status !== order.status
        });
        setOrder(updatedOrder);
        // Update route params so navigation back also has updated data
        navigation.setParams({ order: updatedOrder });
      } else {
        console.warn('⚠️ Updated order not found in refetch results. Order may have been submitted or cancelled.');
      }
    } catch (error) {
      console.error('❌ Error refetching order:', error);
    } finally {
      setRefreshing(false);
    }
  }, [userData?.id, order?.id, navigation]);

  // Refetch order and profile when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      if (userData?.id && order?.id) {
        // Small delay to ensure navigation is complete, then refetch
        const timer = setTimeout(() => {
          console.log('🔄 Screen focused, refetching order and profile...');
          refetchOrder();
          refetchProfile();
        }, 300);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, order?.id, refetchProfile, refetchOrder])
  );

  // Update order when route params change
  useEffect(() => {
    if (route.params?.order) {
      setOrder(route.params.order);
    }
  }, [route.params?.order]);

  // Check payment status from order status, payment_status field, or invoices
  const paymentStatus = useMemo(() => {
    // Priority 1: Check order.status field (this is what the list screen uses)
    // Map order.status to payment status
    if (order?.status) {
      let mappedStatus = 'pending';
      if (order.status === 'payment_approved') {
        mappedStatus = 'approved';
      } else if (order.status === 'pending_payment') {
        mappedStatus = 'pending';
      } else if (order.status === 'submitted') {
        mappedStatus = 'approved'; // Submitted means payment was approved
      }
      
      console.log('Payment status from order.status:', order.status, '→', mappedStatus);
      return {
        status: mappedStatus,
        invoice: null,
        source: 'order.status'
      };
    }
    
    // Priority 2: Check if order has payment_status field (from backend)
    if (order?.payment_status) {
      console.log('Payment status from order.payment_status:', order.payment_status);
      return {
        status: order.payment_status,
        invoice: null,
        source: 'order.payment_status'
      };
    }
    
    // Priority 3: Check invoices (fallback)
    if (!profileData || !order?.transaction_id) {
      console.log('No profile data or transaction_id, defaulting to pending');
      return {
        status: 'pending',
        invoice: null,
        source: 'default'
      };
    }
    
    const invoices = (profileData as any)?.invoices || [];
    
    // Find invoice matching the transaction ID (check both payment_moj_id and payment_req_id)
    const matchingInvoice = invoices.find((inv: any) => {
      const mojId = inv?.payment_moj_id?.toString() || '';
      const reqId = inv?.payment_req_id?.toString() || '';
      const orderTxId = order.transaction_id?.toString() || '';
      
      return mojId === orderTxId || reqId === orderTxId || 
             mojId.includes(orderTxId) || reqId.includes(orderTxId) ||
             orderTxId.includes(mojId) || orderTxId.includes(reqId);
    });
    
    if (!matchingInvoice) {
      console.log('No matching invoice found for transaction_id:', order.transaction_id, 'defaulting to pending');
      return {
        status: 'pending',
        invoice: null,
        source: 'default'
      };
    }
    
    const status = matchingInvoice.approval_status || 'pending';
    console.log('Payment status found from invoice:', status, 'for transaction:', order.transaction_id);
    
    return {
      status: status,
      invoice: matchingInvoice,
      source: 'invoice'
    };
  }, [profileData, order?.transaction_id, order?.payment_status, order?.status]);

  // Check if payment is approved
  const isPaymentApproved = useMemo(() => {
    // Check order.status first (same as list screen)
    if (order?.status === 'payment_approved' || order?.status === 'submitted') {
      return true;
    }
    // Then check paymentStatus
    const status = paymentStatus?.status || order?.payment_status || 'pending';
    return status === 'approved';
  }, [paymentStatus, order?.payment_status, order?.status]);

  // Fetch categories and subcategories to get names
  const { data: categoriesData } = useCategories('all', true);
  const { data: subcategoriesData } = useSubcategories(undefined, 'all', true);

  const categories = useMemo(() => {
    return categoriesData?.data || [];
  }, [categoriesData]);

  const allSubcategories = useMemo(() => {
    return subcategoriesData?.data || [];
  }, [subcategoriesData]);

  // Parse subcategories from order and match with fetched data
  const orderSubcategories = useMemo(() => {
    if (!order?.subcategories) return [];
    try {
      const subs = typeof order.subcategories === 'string' 
        ? JSON.parse(order.subcategories) 
        : order.subcategories;
      return Array.isArray(subs) ? subs : [];
    } catch {
      return [];
    }
  }, [order?.subcategories]);

  // Get category names from subcategory IDs
  const selectedCategories = useMemo(() => {
    if (orderSubcategories.length === 0) return [];
    const categoryIds = new Set<number>();
    orderSubcategories.forEach((sub: any) => {
      if (sub.subcategory_id) {
        const subcat = allSubcategories.find((s: Subcategory) => s.id === sub.subcategory_id);
        if (subcat?.main_category_id) {
          categoryIds.add(Number(subcat.main_category_id));
        }
      }
    });
    return categories.filter((cat: Category) => categoryIds.has(Number(cat.id)));
  }, [orderSubcategories, allSubcategories, categories]);

  // Parse documents from order
  const documents = useMemo(() => {
    if (!order?.documents) return [];
    try {
      const docs = typeof order.documents === 'string' 
        ? JSON.parse(order.documents) 
        : order.documents;
      return Array.isArray(docs) ? docs : [];
    } catch {
      return [];
    }
  }, [order?.documents]);

  // Check if order is already submitted
  const isOrderSubmitted = useMemo(() => {
    const status = order?.status?.toLowerCase() || '';
    return status === 'submitted' || status === 'completed';
  }, [order?.status]);

  // Submit bulk buy request
  const handleSubmit = async () => {
    if (!userData?.id || !order) {
      Alert.alert(t('common.error') || 'Error', t('orders.orderDataNotFound') || 'Order data not found.');
      return;
    }

    // Check if order is already submitted
    if (isOrderSubmitted) {
      Alert.alert(t('common.error') || 'Error', t('orders.orderAlreadySubmitted') || 'This order has already been submitted.');
      return;
    }

    if (!isPaymentApproved) {
      Alert.alert(t('common.error') || 'Error', t('orders.paymentMustBeApproved') || 'Payment must be approved before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const request: BulkScrapPurchaseRequest = {
        buyer_id: userData.id,
        latitude: order.latitude,
        longitude: order.longitude,
        scrap_type: order.scrap_type || undefined,
        subcategories: orderSubcategories.length > 0 ? orderSubcategories : undefined,
        subcategory_id: order.subcategory_id || undefined,
        quantity: order.quantity || 0,
        preferred_price: order.preferred_price || undefined,
        when_needed: order.when_needed || undefined,
        preferred_distance: preferredDistance,
        location: order.location || undefined,
        additional_notes: order.additional_notes || undefined,
        documents: documents.length > 0 ? documents : undefined,
        pending_order_id: order.id // Pass the pending order ID so backend can mark it as submitted
      };

      console.log('📤 Submitting bulk purchase request with pending_order_id:', order.id);

      const response = await createBulkPurchaseRequest(request);

      if (response.status === 'success') {
        Alert.alert(
          'Success',
          `Your bulk scrap purchase request has been submitted! Notifications sent to ${(response.data as any)?.notified_shops?.total || (response.data as any)?.notified_shops?.with_fcm_tokens || response.data?.notified_users?.total || (response.data as any)?.notifications?.success_count || 0} nearby users.`,
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to UserProfile screen (profile settings) and reset navigation stack
                // This ensures the order detail screen is removed from the stack
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'UserProfile' }],
                });
              }
            }
          ]
        );
      } else {
        throw new Error(response.msg || 'Failed to submit request');
      }
    } catch (error: any) {
      console.error('Error submitting bulk scrap request:', error);
      Alert.alert(t('common.error') || 'Error', error.message || t('orders.failedToSubmitRequest') || 'Failed to submit request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const styles = ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: '8@s',
      marginRight: '8@s',
    },
    headerTitle: {
      flex: 1,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    scrollContent: {
      padding: '18@s',
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
    formRow: {
      marginBottom: '16@vs',
    },
    dropdown: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '16@s',
      paddingVertical: '14@vs',
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
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
      marginTop: '12@vs',
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '8@s',
    },
    selectedItem: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.background,
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      borderRadius: '20@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    selectedItemText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textPrimary,
      marginRight: '6@s',
    },
    input: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      paddingHorizontal: '16@s',
      paddingVertical: '14@vs',
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: '48@vs',
    },
    inputLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '6@vs',
    },
    textArea: {
      minHeight: '100@vs',
      textAlignVertical: 'top',
    },
    summaryContainer: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '16@s',
      borderWidth: 1,
      borderColor: theme.border,
    },
    summarySubcategoryItem: {
      marginBottom: '16@vs',
      paddingBottom: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    summarySubcategoryHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '12@vs',
    },
    summarySubcategoryImage: {
      width: '40@s',
      height: '40@s',
      borderRadius: '8@ms',
      marginRight: '12@s',
    },
    summarySubcategoryIcon: {
      width: '40@s',
      height: '40@s',
      borderRadius: '8@ms',
      backgroundColor: theme.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: '12@s',
    },
    summarySubcategoryName: {
      flex: 1,
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    summarySubcategoryDetails: {
      marginLeft: '52@s',
    },
    summaryDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: '8@vs',
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
    summaryDetailRowTotal: {
      marginTop: '8@vs',
      paddingTop: '8@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    summaryDetailTotalLabel: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    summaryDetailTotalValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.primary,
    },
    statusContainer: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '16@s',
      marginTop: '24@vs',
      marginBottom: '24@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    distanceSliderContainer: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '16@s',
      borderWidth: 1,
      borderColor: theme.border,
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
    statusRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@vs',
    },
    statusLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
    },
    statusValue: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    rejectedReasonContainer: {
      marginTop: '12@vs',
      padding: '12@s',
      backgroundColor: '#F8D7DA',
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: '#F44336',
    },
    rejectedReasonText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: '#721C24',
    },
    bottomButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      padding: '16@s',
      paddingBottom: insets.bottom + 16,
      backgroundColor: theme.background,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
  });

  if (!order) {
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
          <AutoText style={styles.headerTitle}>{t('pendingOrders.orderDetails') || 'Order Details'}</AutoText>
          <View style={styles.backButton} />
        </View>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <AutoText style={{ color: theme.textSecondary }}>{t('pendingOrders.noOrders') || 'Order not found'}</AutoText>
        </View>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    // Handle order.status values (same as list screen)
    switch (status) {
      case 'pending_payment':
      case 'pending':
        return '#FFA500';
      case 'payment_approved':
      case 'approved':
      case 'submitted':
        return '#4CAF50';
      case 'cancelled':
      case 'rejected':
        return '#F44336';
      default:
        // Fallback to lowercase check for backward compatibility
        switch (status?.toLowerCase()) {
          case 'approved':
            return '#4CAF50';
          case 'rejected':
            return '#F44336';
          case 'pending':
            return '#FFA500';
          default:
            return theme.textSecondary;
        }
    }
  };

  const getStatusLabel = (status: string) => {
    // Handle order.status values (same as list screen)
    switch (status) {
      case 'pending_payment':
        return t('pendingOrders.pendingPayment') || 'Pending Payment Approval';
      case 'payment_approved':
        return t('pendingOrders.paymentApproved') || 'Payment Approved';
      case 'submitted':
        return t('pendingOrders.submitted') || 'Submitted';
      case 'cancelled':
        return t('pendingOrders.cancelled') || 'Cancelled';
      default:
        // Fallback to lowercase check for backward compatibility
        switch (status?.toLowerCase()) {
          case 'approved':
            return t('pendingOrders.paymentApproved') || 'Approved';
          case 'rejected':
            return t('userProfile.rejected') || 'Rejected';
          case 'pending':
            return t('pendingOrders.pendingPayment') || 'Pending';
          default:
            return status || 'Pending';
        }
    }
  };

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
        <AutoText style={styles.headerTitle}>Order Details</AutoText>
        <View style={styles.backButton} />
      </View>

      <ScrollView 
        style={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 200 }}
      >
        {/* Scrap Details - Read Only */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.scrapDetails') || 'Scrap Details'}</AutoText>
          
          {/* Categories */}
          {selectedCategories.length > 0 && (
            <View style={styles.formRow}>
              <View style={[styles.dropdown, styles.dropdownDisabled]}>
                <AutoText style={[styles.dropdownText, styles.dropdownTextSelected]}>
                  {selectedCategories.map((cat: Category) => cat.name).join(', ') || 'N/A'}
                </AutoText>
              </View>
            </View>
          )}

          {/* Subcategories */}
          {orderSubcategories.length > 0 && (
            <View style={styles.formRow}>
              <View style={styles.selectedItemsContainer}>
                {orderSubcategories.map((sub: any, index: number) => {
                  const subcat = allSubcategories.find((s: Subcategory) => s.id === sub.subcategory_id);
                  return (
                    <View key={index} style={styles.selectedItem}>
                      <AutoText style={styles.selectedItemText}>
                        {sub.subcategory_name || subcat?.name || `Subcategory ${index + 1}`}
                      </AutoText>
                    </View>
                  );
                })}
              </View>
            </View>
          )}
        </View>

        {/* Preferred Distance - Editable */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('pendingOrders.preferredDistanceLabel') || 'Preferred Distance'}</AutoText>
          <View style={styles.formRow}>
            <View style={styles.distanceSliderContainer}>
              <View style={styles.distanceSliderHeader}>
                <AutoText style={styles.distanceSliderLabel}>
                  {t('pendingOrders.preferredDistanceLabel') || 'Preferred Distance'}
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
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.locationAdditional') || 'Location & Additional Information'}</AutoText>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, styles.dropdownDisabled]}
              value={order.location || ''}
              editable={false}
              multiline
            />
            <AutoText style={styles.inputLabel}>{t('pendingOrders.location') || 'Location'}</AutoText>
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, styles.textArea, styles.dropdownDisabled]}
              value={order.additional_notes || ''}
              editable={false}
              multiline
            />
            <AutoText style={styles.inputLabel}>{t('pendingOrders.additionalNotes') || 'Additional Notes'}</AutoText>
          </View>
        </View>

        {/* Summary Section */}
        {orderSubcategories.length > 0 && (
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.summary') || 'Summary'}</AutoText>
            <View style={styles.summaryContainer}>
              {orderSubcategories.map((sub: any, index: number) => {
                const subcat = allSubcategories.find((s: Subcategory) => s.id === sub.subcategory_id);
                const quantity = sub.quantity || 0;
                const price = sub.preferred_price || 0;
                const estimatedValue = quantity > 0 && price > 0 ? quantity * price : 0;
                
                return (
                  <View key={index} style={styles.summarySubcategoryItem}>
                    <View style={styles.summarySubcategoryHeader}>
                      <View style={styles.summarySubcategoryIcon}>
                        <MaterialCommunityIcons name="package-variant-closed" size={20} color={theme.primary} />
                      </View>
                      <AutoText style={styles.summarySubcategoryName} numberOfLines={2}>
                        {sub.subcategory_name || subcat?.name || `Subcategory ${index + 1}`}
                      </AutoText>
                    </View>
                    
                    <View style={styles.summarySubcategoryDetails}>
                      <View style={styles.summaryDetailRow}>
                        <AutoText style={styles.summaryDetailLabel}>{t('pendingOrders.quantity') || 'Quantity'}:</AutoText>
                        <AutoText style={styles.summaryDetailValue}>
                          {quantity > 0 ? `${quantity.toLocaleString('en-IN')} ${t('common.kg') || 'kg'}` : '-'}
                        </AutoText>
                      </View>
                      
                      <View style={styles.summaryDetailRow}>
                        <AutoText style={styles.summaryDetailLabel}>{t('pendingOrders.preferredPrice') || 'Preferred Price'}:</AutoText>
                        <AutoText style={styles.summaryDetailValue}>
                          {price > 0 ? `${t('common.currencySymbol') || '₹'}${price.toFixed(2)} / ${t('common.kg') || 'kg'}` : '-'}
                        </AutoText>
                      </View>
                      
                      {estimatedValue > 0 && (
                        <View style={[styles.summaryDetailRow, styles.summaryDetailRowTotal]}>
                          <AutoText style={styles.summaryDetailTotalLabel}>{t('pendingOrders.estimatedValue') || 'Estimated Value'}:</AutoText>
                          <AutoText style={styles.summaryDetailTotalValue}>
                            {t('common.currencySymbol') || '₹'}{estimatedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                          </AutoText>
                        </View>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* Payment & Approval Status */}
        <View style={styles.statusContainer}>
          <AutoText style={styles.sectionTitle}>{t('pendingOrders.paymentStatus') || 'Payment & Approval Status'}</AutoText>
          <View style={styles.statusRow}>
            <AutoText style={styles.statusLabel}>{t('pendingOrders.transactionId') || 'Transaction ID'}:</AutoText>
            <AutoText style={styles.statusValue}>{order.transaction_id || 'N/A'}</AutoText>
          </View>
          <View style={styles.statusRow}>
            <AutoText style={styles.statusLabel}>{t('pendingOrders.paymentAmount') || 'Payment Amount'}:</AutoText>
            <AutoText style={styles.statusValue}>
              {t('common.currencySymbol') || '₹'}{parseFloat(order.payment_amount || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </AutoText>
          </View>
          <View style={styles.statusRow}>
            <AutoText style={styles.statusLabel}>{t('pendingOrders.paymentStatus') || 'Payment Status'}:</AutoText>
            <AutoText style={[styles.statusValue, { color: getStatusColor(order?.status || 'pending_payment') }]}>
              {getStatusLabel(order?.status || 'pending_payment')}
            </AutoText>
          </View>
          {paymentStatus?.status === 'rejected' && paymentStatus?.invoice?.approval_notes && (
            <View style={styles.rejectedReasonContainer}>
              <AutoText style={styles.rejectedReasonText}>
                {t('pendingOrders.rejectionReason') || 'Rejection Reason'}: {paymentStatus.invoice.approval_notes}
              </AutoText>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Submit Button */}
      <View style={styles.bottomButtonContainer}>
        <GreenButton
          title={isSubmitting ? (t('buttons.submitting') || 'Submitting...') : (t('buttons.submitOrder') || 'Submit Order')}
          onPress={handleSubmit}
          disabled={isSubmitting || !isPaymentApproved || isOrderSubmitted}
        />
      </View>
    </View>
  );
};

export default PendingBulkBuyOrderDetailScreen;

