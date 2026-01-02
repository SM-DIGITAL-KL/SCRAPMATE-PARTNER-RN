import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getCompletedPickups } from '../../services/api/v2/orders';
import { ActivePickup } from '../../services/api/v2/orders';
import { getUserData } from '../../services/auth/authService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';
import { useFocusEffect } from '@react-navigation/native';
import { useProfile } from '../../hooks/useProfile';

const B2CMyOrdersScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [userData, setUserData] = useState<any>(null);
  const queryClient = useQueryClient();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  const userType = userData?.user_type as 'R' | 'S' | 'SR' | 'D' | undefined;
  const isB2CUser = userData?.user_type === 'R' || userData?.user_type === 'SR';

  // Fetch profile data to check subscription status
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);

  // Check subscription status for R and SR type users (SR users can have B2C shops)
  const isSubscribed = React.useMemo(() => {
    if (!profileData || (userData?.user_type !== 'R' && userData?.user_type !== 'SR')) return true; // Non-R/SR users are always considered subscribed
    const b2cShop = (profileData.b2cShop || profileData.shop) as any;
    if (!b2cShop) return false;
    
    // Check if subscribed
    if (b2cShop.is_subscribed === false) return false;
    if (b2cShop.is_subscription_ends === true) return false;
    
    // Check if subscription has ended
    if (b2cShop.subscription_ends_at) {
      const endsAt = new Date(b2cShop.subscription_ends_at);
      const now = new Date();
      if (endsAt < now) return false;
    }
    
    // Default to subscribed if is_subscribed is true or not set (backward compatibility)
    return b2cShop.is_subscribed !== false;
  }, [profileData, userData?.user_type]);

  // Fetch completed pickups for B2C users (R and SR types - SR users can have B2C shops)
  const { data: completedPickups, isLoading: loadingPickups, refetch: refetchPickups, isRefetching: isRefetchingPickups } = useQuery<ActivePickup[]>({
    queryKey: queryKeys.orders.completedPickups(userData?.id || 0, userType || 'R'),
    queryFn: async () => {
      const result = await getCompletedPickups(userData!.id, userType!);
      console.log('📦 [B2CMyOrdersScreen] Fetched completed pickups:', result?.length || 0);
      if (result && result.length > 0) {
        console.log('   Order IDs:', result.map(o => o.order_id || o.order_number).join(', '));
        console.log('   Order statuses:', result.map(o => o.status).join(', '));
        // Check for customer app orders (orders without bulk_request_id)
        const customerAppOrders = result.filter(o => !o.bulk_request_id);
        console.log('   Customer app orders:', customerAppOrders.length);
        // For SR users, filter to only show orders from B2C shops (shop_type = 3)
        if (userData?.user_type === 'SR') {
          console.log('   Filtering for SR user - showing only B2C shop orders');
        }
      }
      return result;
    },
    enabled: !!userData?.id && !!userType && (userType === 'R' || userType === 'SR'),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Sort orders: Status 6 (Accepted by others) first, then Status 7 (Cancelled), then Status 5 (Completed)
  // Within each status group, sort by date descending (most recent first)
  // IMPORTANT: Include ALL orders from customer app (no filtering by bulk_request_id)
  // For SR users, the backend already filters by shop_id (which includes both B2C and B2B shops)
  // We only show customer app orders (no bulk_request_id) here
  const sortedOrders = useMemo(() => {
    if (!completedPickups) return [];
    
    // Filter to only show customer app orders (no bulk_request_id)
    // This ensures we don't show bulk buy/sell orders in B2C My Orders
    const customerAppOrders = completedPickups.filter(o => {
      const bulkRequestId = o.bulk_request_id;
      return !bulkRequestId || bulkRequestId === null || bulkRequestId === '' || bulkRequestId === undefined;
    });
    
    // Log all orders to debug
    console.log('📋 [B2CMyOrdersScreen] Sorting orders:', completedPickups.length);
    console.log('   Customer app orders (no bulk_request_id):', customerAppOrders.length);
    if (userData?.user_type === 'SR') {
      console.log('   SR user - showing customer app orders from all shops');
    }
    
    return [...customerAppOrders].sort((a, b) => {
      // First, sort by status: 6 comes before 7, 7 comes before 5
      if (a.status !== b.status) {
        // Status priority: 6 > 7 > 5
        if (a.status === 6) return -1;
        if (b.status === 6) return 1;
        if (a.status === 7) return -1;
        if (b.status === 7) return 1;
        return b.status - a.status;
      }
      
      // If same status, sort by date descending (most recent first)
      // For cancelled orders, use cancelled_at if available
      const dateA = a.status === 7 && a.cancelled_at
        ? new Date(a.cancelled_at).getTime()
        : (a.pickup_completed_at 
          ? new Date(a.pickup_completed_at).getTime() 
          : (a.accepted_at ? new Date(a.accepted_at).getTime() : new Date(a.created_at).getTime()));
      const dateB = b.status === 7 && b.cancelled_at
        ? new Date(b.cancelled_at).getTime()
        : (b.pickup_completed_at 
          ? new Date(b.pickup_completed_at).getTime() 
          : (b.accepted_at ? new Date(b.accepted_at).getTime() : new Date(b.created_at).getTime()));
      return dateB - dateA;
    });
  }, [completedPickups, userData?.user_type]);

  // Debug: Log when data changes
  useEffect(() => {
    console.log('🔍 [B2CMyOrdersScreen] State:', {
      userData: userData ? { id: userData.id, user_type: userData.user_type } : null,
      userType,
      completedPickupsCount: completedPickups?.length || 0,
      sortedOrdersCount: sortedOrders?.length || 0,
      loadingPickups,
    });
  }, [userData, userType, completedPickups, sortedOrders, loadingPickups]);

  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id && (userType === 'R' || userType === 'SR')) {
        console.log('🔄 [B2CMyOrdersScreen] Refetching on focus...');
        // Refetch completed pickups for B2C users (R and SR types)
        refetchPickups();
        
        // Also invalidate recycling stats cache to force refresh (even if cache exists)
        queryClient.invalidateQueries({
          queryKey: queryKeys.recycling.stats(userData.id, 'shop')
        });
      } else {
        console.log('⚠️ [B2CMyOrdersScreen] Not refetching - conditions not met:', {
          hasUserId: !!userData?.id,
          userType,
          isB2CUser: userType === 'R' || userType === 'SR',
        });
      }
    }, [userData?.id, userType, refetchPickups, queryClient])
  );

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  const calculateTotalAmount = (order: ActivePickup) => {
    try {
      if (!order.orderdetails) return 0;
      const items = Array.isArray(order.orderdetails) 
        ? order.orderdetails 
        : typeof order.orderdetails === 'string' 
          ? JSON.parse(order.orderdetails) 
          : [];
      
      return items.reduce((total: number, item: any) => {
        const amount = parseFloat(item.actual_amount || item.amount || 0);
        return total + (isNaN(amount) ? 0 : amount);
      }, 0);
    } catch {
      return 0;
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('myOrders.title') || 'My Orders'}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 20 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefetchingPickups}
            onRefresh={() => {
              refetchPickups();
              // Also invalidate recycling stats cache to force refresh (even if cache exists)
              queryClient.invalidateQueries({
                queryKey: queryKeys.recycling.stats(userData?.id, 'shop')
              });
            }}
            tintColor={theme.primary}
          />
        }
      >
        {loadingPickups ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <AutoText style={styles.loadingText}>
              {t('common.loading') || 'Loading...'}
            </AutoText>
          </View>
        ) : !sortedOrders || sortedOrders.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="check-circle-outline"
              size={64}
              color={theme.textSecondary}
            />
            <AutoText style={styles.emptyText}>
              {t('orders.noCompletedPickups') || 'No completed pickups yet'}
            </AutoText>
            <AutoText style={styles.emptySubtext}>
              {t('orders.noCompletedPickupsSubtext') || 'Your completed pickup orders will appear here'}
            </AutoText>
          </View>
        ) : (
          sortedOrders.map((order, index) => {
            const totalAmount = calculateTotalAmount(order);
            const orderNumber = order.order_number || order.order_id;
            const isAcceptedByOther = order.status === 6 || order.accepted_by_other || false;
            const isCancelled = order.status === 7 || order.cancelled_by_vendor || false;
            const statusLabel = order.status_label || (order.status === 5 ? 'Completed' : order.status === 6 ? 'Accepted by other Partner' : order.status === 7 ? 'Cancelled' : null);

            return (
              <View key={order.order_id || index} style={[styles.orderCard, !isSubscribed && styles.blurredCard]}>
                <View style={styles.orderHeader}>
                  <View style={
                    isCancelled 
                      ? styles.statusChipCancelled 
                      : (isAcceptedByOther ? styles.statusChipAcceptedByOther : styles.statusChipCompleted)
                  }>
                    <MaterialCommunityIcons
                      name={isCancelled ? "close-circle" : (isAcceptedByOther ? "alert-circle" : "check-circle")}
                      size={14}
                      color={isCancelled ? "#C62828" : (isAcceptedByOther ? theme.primary : "#4CAF50")}
                    />
                    <Text style={[
                      styles.statusText, 
                      isCancelled && styles.statusTextCancelled,
                      isAcceptedByOther && styles.statusTextAcceptedByOther
                    ]} numberOfLines={1}>
                      {isCancelled
                        ? (t('orders.status.cancelled') || 'Cancelled')
                        : (isAcceptedByOther 
                          ? (t('orders.status.acceptedByOther') || 'Accepted by other Partner')
                          : (statusLabel || t('orders.status.completed') || 'Completed'))}
                    </Text>
                  </View>
                  <AutoText style={styles.orderDate} numberOfLines={1}>
                    {formatDate(
                      isCancelled && order.cancelled_at
                        ? order.cancelled_at
                        : (order.display_date || order.pickup_completed_at || order.accepted_at || order.created_at)
                    )}
                  </AutoText>
                </View>
                
                <AutoText style={styles.orderNumber}>
                  {t('dashboard.orderNumber') || 'Order'}: #{orderNumber}
                </AutoText>
                
                {order.customer_name && (
                  <AutoText style={[styles.customerName, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                    {order.customer_name}
                  </AutoText>
                )}

                {!isAcceptedByOther && !isCancelled && (
                  <>
                    <AutoText style={styles.amount} numberOfLines={1}>
                      ₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </AutoText>
                    
                    <AutoText style={styles.earningsDescription} numberOfLines={2}>
                      {t('myOrders.earningsForPickup') || 'Earnings for pickup'}
                    </AutoText>
                  </>
                )}
                
                {isAcceptedByOther && (
                  <AutoText style={styles.acceptedByOtherMessage} numberOfLines={2}>
                    {t('orders.acceptedByOtherMessage') || 'This order was accepted by another partner before you could accept it.'}
                  </AutoText>
                )}

                {isCancelled && (
                  <>
                    <AutoText style={styles.cancelledMessage} numberOfLines={2}>
                      {t('orders.cancelledMessage') || 'You cancelled this order.'}
                    </AutoText>
                    {order.cancellation_reason && (
                      <AutoText style={styles.cancellationReason} numberOfLines={2}>
                        {t('orders.cancellationReason') || 'Reason'}: {order.cancellation_reason}
                      </AutoText>
                    )}
                  </>
                )}
                
                <TouchableOpacity 
                  style={[styles.viewDetailsButton, !isSubscribed && styles.viewDetailsButtonDisabled]}
                  onPress={() => {
                    if (!isSubscribed) {
                      return;
                    }
                    navigation.navigate('DeliveryTracking', {
                      orderId: orderNumber,
                      order: order,
                    });
                  }}
                  disabled={!isSubscribed}
                >
                  <MaterialCommunityIcons
                    name="file-document-outline"
                    size={18}
                    color={theme.primary}
                  />
                  <AutoText style={styles.viewDetailsText} numberOfLines={1}>
                    {t('orders.viewDetails') || 'View Details'}
                  </AutoText>
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={theme.primary}
                  />
                </TouchableOpacity>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.card,
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
    },
    scrollContent: {
      paddingHorizontal: '14@s',
      paddingTop: '14@vs',
      paddingBottom: '24@vs',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
    },
    loadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
    },
    emptyText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginTop: '16@vs',
    },
    emptySubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
      textAlign: 'center',
    },
    orderCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '12@vs',
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10@vs',
    },
    statusChipCompleted: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '4@s',
      paddingHorizontal: '10@s',
      paddingVertical: '5@vs',
      borderRadius: '10@ms',
      backgroundColor: '#E8F5E9',
    },
    statusChipAcceptedByOther: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '4@s',
      paddingHorizontal: '10@s',
      paddingVertical: '5@vs',
      borderRadius: '10@ms',
      backgroundColor: '#FFF3E0',
    },
    statusChipCancelled: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '4@s',
      paddingHorizontal: '10@s',
      paddingVertical: '5@vs',
      borderRadius: '10@ms',
      backgroundColor: '#FFEBEE',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: '#4CAF50',
    },
    statusTextAcceptedByOther: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.primary,
    },
    statusTextCancelled: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: '#C62828',
    },
    acceptedByOtherMessage: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginBottom: '12@vs',
      marginTop: '4@vs',
    },
    cancelledMessage: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      fontStyle: 'italic',
      marginBottom: '8@vs',
      marginTop: '4@vs',
    },
    cancellationReason: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      marginBottom: '12@vs',
      marginTop: '4@vs',
    },
    orderNumber: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    customerName: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '8@vs',
    },
    orderDate: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    amount: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: '3@vs',
    },
    earningsDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginBottom: '12@vs',
    },
    viewDetailsButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8@s',
      paddingVertical: '12@vs',
      paddingHorizontal: '16@s',
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: '10@ms',
      backgroundColor: 'transparent',
      marginTop: '8@vs',
    },
    viewDetailsText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.primary,
    },
    blurredCard: {
      opacity: 0.6,
    },
    viewDetailsButtonDisabled: {
      opacity: 0.5,
    },
  });

export default B2CMyOrdersScreen;

