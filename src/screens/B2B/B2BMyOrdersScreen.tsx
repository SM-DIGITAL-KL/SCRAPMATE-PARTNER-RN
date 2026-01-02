import React, { useState, useEffect, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
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
import { useBulkScrapRequestsByBuyer, useBulkSellRequestsBySeller } from '../../hooks/useOrders';
import { SectionCard } from '../../components/SectionCard';

const B2BMyOrdersScreen = ({ navigation }: any) => {
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

  // Fetch completed pickups for B2B users (to show individual orders from bulk requests)
  const { data: completedPickups, isLoading: loadingPickups, refetch: refetchPickups, isRefetching: isRefetchingPickups } = useQuery<ActivePickup[]>({
    queryKey: queryKeys.orders.completedPickups(userData?.id || 0, userType || 'S'),
    queryFn: () => getCompletedPickups(userData!.id, userType!),
    enabled: !!userData?.id && !!userType && ['S', 'SR'].includes(userType),
    staleTime: 30 * 1000,
    gcTime: 5 * 60 * 1000,
  });

  // Fetch completed bulk buy requests for B2B users
  const { data: bulkBuyRequests, isLoading: loadingBulkBuy, refetch: refetchBulkBuy, isRefetching: isRefetchingBulkBuy } = useBulkScrapRequestsByBuyer(
    userData?.id,
    !!userData?.id
  );

  // Fetch completed bulk sell requests for B2B users
  const { data: bulkSellRequests, isLoading: loadingBulkSell, refetch: refetchBulkSell, isRefetching: isRefetchingBulkSell } = useBulkSellRequestsBySeller(
    userData?.id,
    !!userData?.id
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

  // Sort orders: Status 6 (Accepted by others) first, then Status 7 (Cancelled), then Status 5 (Completed)
  const sortedOrders = useMemo(() => {
    if (!completedPickups) return [];
    
    return [...completedPickups].sort((a, b) => {
      if (a.status !== b.status) {
        if (a.status === 6) return -1;
        if (b.status === 6) return 1;
        if (a.status === 7) return -1;
        if (b.status === 7) return 1;
        return b.status - a.status;
      }
      
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
    if (!completedPickups) return [];
    // Filter orders that are from bulk requests (have bulk_request_id)
    // Exclude regular B2C orders from customer_app (which don't have bulk_request_id)
    return sortedOrders.filter((order: any) => {
      const bulkRequestId = order.bulk_request_id;
      const hasValidBulkRequestId = bulkRequestId !== null && 
                                    bulkRequestId !== undefined && 
                                    bulkRequestId !== '' &&
                                    (typeof bulkRequestId === 'number' || typeof bulkRequestId === 'string');
      
      if (!hasValidBulkRequestId) {
        return false;
      }
      
      return true;
    });
  }, [completedPickups, sortedOrders]);

  const isLoading = loadingBulkBuy || loadingBulkSell || loadingPickups;
  const isRefetching = isRefetchingBulkBuy || isRefetchingBulkSell || isRefetchingPickups;
  
  const refetch = React.useCallback(() => {
    refetchBulkBuy();
    refetchBulkSell();
    refetchPickups();
  }, [refetchBulkBuy, refetchBulkSell, refetchPickups]);

  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        refetchBulkBuy();
        refetchBulkSell();
        refetchPickups();
      }
    }, [userData?.id, refetchBulkBuy, refetchBulkSell, refetchPickups])
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
            onRefresh={refetch}
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
        ) : (
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
    statusChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
      paddingHorizontal: '10@s',
      paddingVertical: '4@vs',
      borderRadius: '12@ms',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.success,
    },
    orderNumber: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    orderDate: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    orderInfo: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
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
  });

export default B2BMyOrdersScreen;


