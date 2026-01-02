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
import { useBulkScrapRequestsByBuyer, useBulkSellRequestsBySeller } from '../../hooks/useOrders';
import { SectionCard } from '../../components/SectionCard';

const MyOrdersScreen = ({ navigation }: any) => {
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
  const isB2BUser = userData?.user_type === 'S';

  // Fetch profile data to check subscription status
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);

  // Check subscription status for R type users
  const isSubscribed = React.useMemo(() => {
    if (!profileData || userData?.user_type !== 'R') return true; // Non-R users are always considered subscribed
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

  // Fetch completed pickups for B2C and B2B users (to show individual orders from bulk requests)
  const { data: completedPickups, isLoading: loadingPickups, refetch: refetchPickups, isRefetching: isRefetchingPickups } = useQuery<ActivePickup[]>({
    queryKey: queryKeys.orders.completedPickups(userData?.id || 0, userType || 'R'),
    queryFn: () => getCompletedPickups(userData!.id, userType!),
    enabled: !!userData?.id && !!userType && ['R', 'S', 'SR', 'D'].includes(userType),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch completed bulk buy requests for B2B users
  const { data: bulkBuyRequests, isLoading: loadingBulkBuy, refetch: refetchBulkBuy, isRefetching: isRefetchingBulkBuy } = useBulkScrapRequestsByBuyer(
    isB2BUser ? userData?.id : undefined,
    isB2BUser && !!userData?.id
  );

  // Fetch completed bulk sell requests for B2B users
  const { data: bulkSellRequests, isLoading: loadingBulkSell, refetch: refetchBulkSell, isRefetching: isRefetchingBulkSell } = useBulkSellRequestsBySeller(
    isB2BUser ? userData?.id : undefined,
    isB2BUser && !!userData?.id
  );

  // Filter and sort completed bulk buy requests (most recent first)
  const completedBulkBuyRequests = React.useMemo(() => {
    if (!bulkBuyRequests) return [];
    const completed = bulkBuyRequests.filter((req: any) => req.status === 'completed');
    return completed.sort((a: any, b: any) => {
      const dateA = new Date(a.completed_at || a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.completed_at || b.updated_at || b.created_at).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [bulkBuyRequests]);

  // Filter and sort completed bulk sell requests (most recent first)
  const completedBulkSellRequests = React.useMemo(() => {
    if (!bulkSellRequests) return [];
    const completed = bulkSellRequests.filter((req: any) => req.status === 'completed');
    return completed.sort((a: any, b: any) => {
      const dateA = new Date(a.completed_at || a.updated_at || a.created_at).getTime();
      const dateB = new Date(b.completed_at || b.updated_at || b.created_at).getTime();
      return dateB - dateA; // Most recent first
    });
  }, [bulkSellRequests]);

  const isLoading = isB2BUser ? (loadingBulkBuy || loadingBulkSell || loadingPickups) : loadingPickups;
  const isRefetching = isB2BUser ? (isRefetchingBulkBuy || isRefetchingBulkSell || isRefetchingPickups) : isRefetchingPickups;
  
  const refetch = React.useCallback(() => {
    if (isB2BUser) {
      refetchBulkBuy();
      refetchBulkSell();
      refetchPickups(); // Also refetch completed pickups for B2B users
    } else {
      refetchPickups();
    }
  }, [isB2BUser, refetchBulkBuy, refetchBulkSell, refetchPickups]);

  // Sort orders: Status 6 (Accepted by others) first, then Status 7 (Cancelled), then Status 5 (Completed)
  // Within each status group, sort by date descending (most recent first)
  const sortedOrders = useMemo(() => {
    if (!completedPickups) return [];
    
    return [...completedPickups].sort((a, b) => {
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
  }, [completedPickups]);

  // Filter completed pickups for B2B users (only show orders from bulk buy or bulk sell requests)
  // Exclude regular B2C orders from customer_app - those should only show in B2C profile settings
  const completedBulkOrders = React.useMemo(() => {
    if (!completedPickups || !isB2BUser) return [];
    // Filter orders that are from bulk requests (have bulk_request_id)
    // Exclude regular B2C orders from customer_app (which don't have bulk_request_id)
    // For B2B users (S or SR), we only want to show orders from bulk buy or bulk sell requests
    // Regular B2C orders from customer_app should NOT appear here - they should only show in B2C profile settings
    return sortedOrders.filter((order: any) => {
      // Only show orders that have a valid bulk_request_id (from bulk buy or bulk sell requests)
      // This explicitly excludes regular B2C orders from customer_app
      const bulkRequestId = order.bulk_request_id;
      const hasValidBulkRequestId = bulkRequestId !== null && 
                                    bulkRequestId !== undefined && 
                                    bulkRequestId !== '' &&
                                    (typeof bulkRequestId === 'number' || typeof bulkRequestId === 'string');
      
      // If order doesn't have bulk_request_id, it's a regular B2C order from customer_app - exclude it
      if (!hasValidBulkRequestId) {
        return false;
      }
      
      return true;
    });
  }, [completedPickups, sortedOrders, isB2BUser]);

  // Debug log to check if orders accepted by others are being returned
  useEffect(() => {
    if (completedPickups) {
      const acceptedByOthers = completedPickups.filter(o => o.status === 6 || o.accepted_by_other);
      console.log('📦 MyOrdersScreen: Total orders:', completedPickups.length);
      console.log('   Orders accepted by others (status 6):', acceptedByOthers.length);
      if (acceptedByOthers.length > 0) {
        console.log('   Order numbers accepted by others:', acceptedByOthers.map(o => o.order_number || o.order_id).join(', '));
      }
    }
  }, [completedPickups]);

  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        if (isB2BUser) {
          // Refetch bulk requests and completed pickups for B2B users
          refetchBulkBuy();
          refetchBulkSell();
          refetchPickups();
        } else if (userType) {
          // Refetch completed pickups for B2C users
          refetchPickups();
          
          // Also invalidate recycling stats cache to force refresh (even if cache exists)
          queryClient.invalidateQueries({
            queryKey: queryKeys.recycling.stats(userData.id, 'shop')
          });
        }
      }
    }, [userData?.id, userType, isB2BUser, refetchBulkBuy, refetchBulkSell, refetchPickups, queryClient])
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
            refreshing={isRefetching}
            onRefresh={() => {
              if (isB2BUser) {
                // Refetch bulk requests for B2B users
                refetchBulkBuy();
                refetchBulkSell();
              } else {
                // Refetch completed pickups for B2C users
                refetchPickups();
                // Also invalidate recycling stats cache to force refresh (even if cache exists)
                queryClient.invalidateQueries({
                  queryKey: queryKeys.recycling.stats(userData?.id, 'shop')
                });
              }
            }}
            tintColor={theme.primary}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <AutoText style={styles.loadingText}>
              {t('common.loading') || 'Loading...'}
            </AutoText>
          </View>
        ) : isB2BUser ? (
          // B2B Users: Show completed bulk buy and bulk sell requests
          <>
            {/* Completed Bulk Buy Requests */}
            {completedBulkBuyRequests && completedBulkBuyRequests.length > 0 && (
              <SectionCard style={styles.sectionCard}>
                <AutoText style={styles.sectionTitle}>
                  {t('dashboard.myBulkBuyRequests') || 'My Bulk Buy Requests'}
                </AutoText>
                {completedBulkBuyRequests.map((request: any, index: number) => {
                  const quantityInTons = request.quantity ? (request.quantity / 1000).toFixed(2) : '0.00';
                  const subcategoriesText = request.subcategories && request.subcategories.length > 0
                    ? request.subcategories.map((s: any) => s.subcategory_name || s.name).join(', ')
                    : request.scrap_type || 'Scrap';
                  
                  return (
                    <TouchableOpacity
                      key={request.id || index}
                      style={styles.bulkRequestCard}
                      onPress={() => navigation.navigate('BulkRequestDetails', { requestId: request.id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.bulkRequestHeader}>
                        <View style={[styles.statusChip, { backgroundColor: theme.success + '20' }]}>
                          <MaterialCommunityIcons name="check-circle" size={14} color={theme.success} />
                          <AutoText style={[styles.statusText, { color: theme.success }]} numberOfLines={1}>
                            {t('dashboard.statusCompleted') || 'Completed'}
                          </AutoText>
                        </View>
                        <AutoText style={styles.orderDate} numberOfLines={1}>
                          {formatDate(request.completed_at || request.updated_at || request.created_at)}
                        </AutoText>
                      </View>
                      
                      <AutoText style={styles.orderNumber}>
                        {t('dashboard.requestNumber') || 'Request'}: #{request.id}
                      </AutoText>
                      
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="package-variant" size={16} color={theme.primary} />
                        <AutoText style={styles.detailText} numberOfLines={2}>
                          {subcategoriesText}
                        </AutoText>
                      </View>

                      {request.quantity && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons name="weight-kilogram" size={16} color={theme.primary} />
                          <AutoText style={styles.detailText} numberOfLines={1}>
                            {t('dashboard.requestedQuantity') || 'Requested'}: {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
                          </AutoText>
                        </View>
                      )}

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

                      <TouchableOpacity 
                        style={styles.viewDetailsButton}
                        onPress={() => navigation.navigate('BulkRequestDetails', { requestId: request.id })}
                      >
                        <MaterialCommunityIcons name="file-document-outline" size={18} color={theme.primary} />
                        <AutoText style={styles.viewDetailsText} numberOfLines={1}>
                          {t('orders.viewDetails') || 'View Details'}
                        </AutoText>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.primary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </SectionCard>
            )}

            {/* Completed Bulk Sell Requests */}
            {completedBulkSellRequests && completedBulkSellRequests.length > 0 && (
              <SectionCard style={styles.sectionCard}>
                <AutoText style={styles.sectionTitle}>
                  {t('bulkSellRequest.myBulkSellRequests') || 'My Bulk Sell Requests'}
                </AutoText>
                {completedBulkSellRequests.map((request: any, index: number) => {
                  const quantityInTons = request.total_quantity ? (request.total_quantity / 1000).toFixed(2) : '0.00';
                  const subcategoriesText = request.subcategories && request.subcategories.length > 0
                    ? request.subcategories.map((s: any) => s.subcategory_name || s.name).join(', ')
                    : request.scrap_type || 'Scrap';
                  
                  return (
                    <TouchableOpacity
                      key={request.id || index}
                      style={styles.bulkRequestCard}
                      onPress={() => navigation.navigate('BulkSellRequestDetails', { request })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.bulkRequestHeader}>
                        <View style={[styles.statusChip, { backgroundColor: theme.success + '20' }]}>
                          <MaterialCommunityIcons name="check-circle" size={14} color={theme.success} />
                          <AutoText style={[styles.statusText, { color: theme.success }]} numberOfLines={1}>
                            {t('dashboard.statusCompleted') || 'Completed'}
                          </AutoText>
                        </View>
                        <AutoText style={styles.orderDate} numberOfLines={1}>
                          {formatDate(request.completed_at || request.updated_at || request.created_at)}
                        </AutoText>
                      </View>
                      
                      <AutoText style={styles.orderNumber}>
                        {t('dashboard.requestNumber') || 'Request'}: #{request.id}
                      </AutoText>
                      
                      <View style={styles.detailRow}>
                        <MaterialCommunityIcons name="package-variant" size={16} color={theme.primary} />
                        <AutoText style={styles.detailText} numberOfLines={2}>
                          {subcategoriesText}
                        </AutoText>
                      </View>

                      {request.total_quantity && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons name="weight-kilogram" size={16} color={theme.primary} />
                          <AutoText style={styles.detailText} numberOfLines={1}>
                            {t('dashboard.quantity') || 'Quantity'}: {request.total_quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
                          </AutoText>
                        </View>
                      )}

                      {request.total_committed_quantity !== undefined && request.total_committed_quantity > 0 && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons name="progress-check" size={16} color={theme.primary} />
                          <AutoText style={styles.detailText} numberOfLines={1}>
                            {t('dashboard.committedQuantity') || 'Committed'}: {request.total_committed_quantity.toLocaleString('en-IN')} kg
                          </AutoText>
                        </View>
                      )}

                      {request.asking_price && (
                        <View style={styles.detailRow}>
                          <MaterialCommunityIcons name="currency-inr" size={16} color={theme.primary} />
                          <AutoText style={styles.detailText} numberOfLines={1}>
                            {t('bulkSellRequest.sellingPrice') || 'Selling Price'}: ₹{request.asking_price.toLocaleString('en-IN')} / kg
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

                      <TouchableOpacity 
                        style={styles.viewDetailsButton}
                        onPress={() => navigation.navigate('BulkSellRequestDetails', { request })}
                      >
                        <MaterialCommunityIcons name="file-document-outline" size={18} color={theme.primary} />
                        <AutoText style={styles.viewDetailsText} numberOfLines={1}>
                          {t('orders.viewDetails') || 'View Details'}
                        </AutoText>
                        <MaterialCommunityIcons name="chevron-right" size={20} color={theme.primary} />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  );
                })}
              </SectionCard>
            )}

            {/* Completed Orders from Bulk Requests */}
            {completedBulkOrders && completedBulkOrders.length > 0 && (
              <SectionCard style={styles.sectionCard}>
                <AutoText style={styles.sectionTitle}>
                  {t('orders.completedOrders') || 'Completed Orders'}
                </AutoText>
                {completedBulkOrders.map((order: any, index: number) => {
                  const orderDetails = typeof order.orderdetails === 'string' 
                    ? JSON.parse(order.orderdetails) 
                    : (Array.isArray(order.orderdetails) ? order.orderdetails : []);
                  
                  const totalAmount = orderDetails.reduce((sum: number, item: any) => {
                    return sum + (parseFloat(item.actual_amount || item.amount || 0));
                  }, 0);

                  return (
                    <TouchableOpacity
                      key={order.id || order.order_id || index}
                      style={styles.orderCard}
                      onPress={() => navigation.navigate('OrderDetails', { orderId: order.id || order.order_id })}
                      activeOpacity={0.7}
                    >
                      <View style={styles.orderHeader}>
                        <View style={[styles.statusChip, { backgroundColor: theme.success + '20' }]}>
                          <MaterialCommunityIcons name="check-circle" size={14} color={theme.success} />
                          <AutoText style={[styles.statusText, { color: theme.success }]} numberOfLines={1}>
                            {t('orders.status.completed') || 'Completed'}
                          </AutoText>
                        </View>
                        <AutoText style={styles.orderDate} numberOfLines={1}>
                          {formatDate(order.pickup_completed_at || order.updated_at || order.created_at)}
                        </AutoText>
                      </View>
                      <AutoText style={styles.orderNumber}>
                        {t('orders.orderNumber') || 'Order'}: #{order.order_number || order.order_id}
                      </AutoText>
                      {order.estim_weight && (
                        <AutoText style={styles.orderInfo} numberOfLines={1}>
                          {t('orders.weight') || 'Weight'}: {order.estim_weight.toLocaleString('en-IN')} kg
                        </AutoText>
                      )}
                      {totalAmount > 0 && (
                        <AutoText style={styles.orderInfo} numberOfLines={1}>
                          {t('orders.totalAmount') || 'Total Amount'}: ₹{totalAmount.toLocaleString('en-IN')}
                        </AutoText>
                      )}
                      {order.bulk_request_id && (
                        <AutoText style={styles.orderInfo} numberOfLines={1}>
                          {t('dashboard.bulkRequest') || 'Bulk Request'}: #{order.bulk_request_id}
                        </AutoText>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </SectionCard>
            )}

            {/* Empty state for B2B users */}
            {(!completedBulkBuyRequests || completedBulkBuyRequests.length === 0) && 
             (!completedBulkSellRequests || completedBulkSellRequests.length === 0) &&
             (!completedBulkOrders || completedBulkOrders.length === 0) && (
              <View style={styles.emptyContainer}>
                <MaterialCommunityIcons
                  name="check-circle-outline"
                  size={64}
                  color={theme.textSecondary}
                />
                <AutoText style={styles.emptyText}>
                  {t('orders.noCompletedRequests') || 'No completed requests yet'}
                </AutoText>
                <AutoText style={styles.emptySubtext}>
                  {t('orders.noCompletedRequestsSubtext') || 'Your completed bulk buy and bulk sell requests will appear here'}
                </AutoText>
              </View>
            )}
          </>
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
    statusChipPending: {
      paddingHorizontal: '10@s',
      paddingVertical: '5@vs',
      borderRadius: '10@ms',
      backgroundColor: theme.accent,
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
      color: theme.primary, // Use theme color for "Accepted by other Partner"
    },
    statusTextCancelled: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: '#C62828', // Dark red color for "Cancelled" status - highly visible
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
    statusTextPending: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.textPrimary,
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
    subscriptionOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      borderRadius: '12@ms',
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
    viewDetailsButtonDisabled: {
      opacity: 0.5,
    },
    sectionCard: {
      marginBottom: '16@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    bulkRequestCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '12@vs',
    },
    bulkRequestHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8@vs',
    },
    bulkRequestInfo: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    orderInfo: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
      paddingHorizontal: '10@s',
      paddingVertical: '4@vs',
      borderRadius: '12@ms',
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
  });

export default MyOrdersScreen;

