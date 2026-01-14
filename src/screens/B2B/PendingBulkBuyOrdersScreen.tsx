import React, { useState, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { getPendingBulkBuyOrders } from '../../services/api/v2/bulkScrap';

const PendingBulkBuyOrdersScreen = ({ navigation, route }: any) => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [userData, setUserData] = useState<any>(null);
  const [pendingOrders, setPendingOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
      };
      loadUserData();
    }, [])
  );

  const fetchPendingOrders = async () => {
    if (!userData?.id) return;

    try {
      setLoading(true);
      // Fetch orders with isSubmitted=false to exclude submitted orders
      const orders = await getPendingBulkBuyOrders(userData.id, false);
      
      // Log all orders with their statuses for debugging
      console.log('📋 Raw orders from API:', orders.map((o: any) => ({
        id: o.id,
        status: o.status,
        transaction_id: o.transaction_id
      })));
      
      // Additional frontend filter to ensure submitted orders are removed (safety check)
      const filteredOrders = orders.filter((order: any) => {
        const status = order.status?.toLowerCase() || '';
        const isSubmitted = status === 'submitted' || status === 'completed';
        if (isSubmitted) {
          console.log(`🚫 Filtering out submitted order: ${order.id} with status: ${order.status}`);
        }
        return !isSubmitted;
      });
      
      // Log status breakdown
      const statusBreakdown: Record<string, number> = {};
      filteredOrders.forEach((order: any) => {
        const status = order.status || 'unknown';
        statusBreakdown[status] = (statusBreakdown[status] || 0) + 1;
      });
      console.log('📊 Status breakdown:', statusBreakdown);
      
      setPendingOrders(filteredOrders);
      console.log(`📋 Loaded ${filteredOrders.length} pending orders (excluded ${orders.length - filteredOrders.length} submitted orders)`);
    } catch (error: any) {
      console.error('Error fetching pending orders:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || 'Failed to load pending orders'
      );
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        console.log('🔄 PendingBulkBuyOrdersScreen: Refreshing orders on focus');
        fetchPendingOrders();
      }
    }, [userData?.id])
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    // Handle null/undefined
    if (!status) {
      return '#FFA500'; // Default to pending color
    }
    
    // Normalize to lowercase for comparison
    const normalizedStatus = status.toLowerCase().trim();
    
    switch (normalizedStatus) {
      case 'pending_payment':
      case 'pending':
        return '#FFA500';
      case 'payment_approved':
      case 'approved':
        return '#4CAF50';
      case 'submitted':
        return '#2196F3';
      case 'cancelled':
      case 'canceled':
        return '#F44336';
      default:
        return theme.textSecondary;
    }
  };

  const getStatusLabel = (status: string) => {
    // Handle null/undefined
    if (!status) {
      console.warn('⚠️ getStatusLabel called with null/undefined status');
      return t('pendingOrders.pendingPayment') || 'Pending Payment Approval';
    }
    
    // Normalize to lowercase for comparison
    const normalizedStatus = status.toLowerCase().trim();
    
    switch (normalizedStatus) {
      case 'pending_payment':
      case 'pending':
        return t('pendingOrders.pendingPayment') || 'Pending Payment Approval';
      case 'payment_approved':
      case 'approved':
        return t('pendingOrders.paymentApproved') || 'Payment Approved';
      case 'submitted':
        return t('pendingOrders.submitted') || 'Submitted';
      case 'cancelled':
      case 'canceled':
        return t('pendingOrders.cancelled') || 'Cancelled';
      default:
        console.warn('⚠️ Unknown status value:', status);
        return status || 'Pending';
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
      padding: '16@s',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '40@s',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '16@s',
      color: theme.textSecondary,
      textAlign: 'center',
      marginTop: '16@vs',
    },
    orderCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '16@s',
      marginBottom: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '12@vs',
    },
    orderId: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: '12@s',
      paddingVertical: '4@vs',
      borderRadius: '12@ms',
      backgroundColor: theme.background,
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
    },
    orderInfo: {
      marginTop: '8@vs',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8@vs',
    },
    infoLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textSecondary,
      width: '120@s',
    },
    infoValue: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textPrimary,
      flex: 1,
    },
    viewDetailsButton: {
      marginTop: '12@vs',
      paddingVertical: '10@vs',
      paddingHorizontal: '16@s',
      backgroundColor: theme.primary,
      borderRadius: '8@ms',
      alignItems: 'center',
    },
    viewDetailsButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.card,
      borderRadius: '16@ms',
      padding: '20@s',
      width: '90%',
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20@vs',
    },
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
    },
    closeButton: {
      padding: '4@s',
    },
    modalBody: {
      maxHeight: '70%',
    },
    subcategoryItem: {
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      padding: '12@s',
      marginBottom: '8@vs',
    },
    subcategoryName: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    subcategoryDetails: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            // Always navigate to UserProfile instead of going back
            // This prevents going back to bulk buy request screen
            navigation.navigate('UserProfile');
          }} 
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>
          {t('pendingOrders.title') || 'Pending Orders'}
        </AutoText>
        <View style={styles.backButton} />
      </View>

      {loading ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : pendingOrders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons name="package-variant" size={64} color={theme.textSecondary} />
          <AutoText style={styles.emptyText}>
            {t('pendingOrders.noOrders') || 'No pending orders found'}
          </AutoText>
        </View>
      ) : (
        <ScrollView 
          style={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await fetchPendingOrders();
                setRefreshing(false);
              }}
              colors={[theme.primary]}
              tintColor={theme.primary}
            />
          }
        >
          {pendingOrders.map((order) => {
            // Log status for debugging
            if (order.status) {
              console.log(`📋 Order ${order.id} status:`, {
                raw: order.status,
                normalized: order.status?.toLowerCase(),
                label: getStatusLabel(order.status),
                color: getStatusColor(order.status)
              });
            }
            return (
            <View key={order.id} style={styles.orderCard}>
              <View style={styles.orderHeader}>
                <AutoText style={styles.orderId}>
                  {t('pendingOrders.orderId') || 'Order ID'}: {order.id}
                </AutoText>
                <View style={[styles.statusBadge, { borderColor: getStatusColor(order.status || 'pending_payment') }]}>
                  <AutoText style={[styles.statusText, { color: getStatusColor(order.status || 'pending_payment') }]}>
                    {getStatusLabel(order.status || 'pending_payment')}
                  </AutoText>
                </View>
              </View>

              <View style={styles.orderInfo}>
                <View style={styles.infoRow}>
                  <AutoText style={styles.infoLabel}>
                    {t('pendingOrders.transactionId') || 'Transaction ID'}:
                  </AutoText>
                  <AutoText style={styles.infoValue}>{order.transaction_id}</AutoText>
                </View>
                <View style={styles.infoRow}>
                  <AutoText style={styles.infoLabel}>
                    {t('pendingOrders.paymentAmount') || 'Payment Amount'}:
                  </AutoText>
                  <AutoText style={styles.infoValue}>
                    ₹{parseFloat(order.payment_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                  </AutoText>
                </View>
                <View style={styles.infoRow}>
                  <AutoText style={styles.infoLabel}>
                    {t('pendingOrders.totalQuantity') || 'Total Quantity'}:
                  </AutoText>
                  <AutoText style={styles.infoValue}>
                    {order.quantity.toLocaleString('en-IN')} kg
                  </AutoText>
                </View>
                {order.location && (
                  <View style={styles.infoRow}>
                    <AutoText style={styles.infoLabel}>
                      {t('pendingOrders.location') || 'Location'}:
                    </AutoText>
                    <AutoText style={styles.infoValue} numberOfLines={2}>
                      {order.location}
                    </AutoText>
                  </View>
                )}
                <View style={styles.infoRow}>
                  <AutoText style={styles.infoLabel}>
                    {t('pendingOrders.createdAt') || 'Created At'}:
                  </AutoText>
                  <AutoText style={styles.infoValue}>{formatDate(order.created_at)}</AutoText>
                </View>
              </View>

              <TouchableOpacity
                style={styles.viewDetailsButton}
                onPress={() => {
                  navigation.navigate('PendingBulkBuyOrderDetail', { order });
                }}
              >
                <AutoText style={styles.viewDetailsButtonText}>
                  {t('pendingOrders.viewDetails') || 'View Details'}
                </AutoText>
              </TouchableOpacity>
            </View>
            );
          })}
        </ScrollView>
      )}

      {/* Details Modal */}
      <Modal
        visible={showDetailsModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>
                {t('pendingOrders.orderDetails') || 'Order Details'}
              </AutoText>
              <TouchableOpacity
                onPress={() => setShowDetailsModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            {selectedOrder && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={true}>
                <View style={styles.orderInfo}>
                  <View style={styles.infoRow}>
                    <AutoText style={styles.infoLabel}>
                      {t('pendingOrders.orderId') || 'Order ID'}:
                    </AutoText>
                    <AutoText style={styles.infoValue}>{selectedOrder.id}</AutoText>
                  </View>
                  <View style={styles.infoRow}>
                    <AutoText style={styles.infoLabel}>
                      {t('pendingOrders.transactionId') || 'Transaction ID'}:
                    </AutoText>
                    <AutoText style={styles.infoValue}>{selectedOrder.transaction_id}</AutoText>
                  </View>
                  <View style={styles.infoRow}>
                    <AutoText style={styles.infoLabel}>
                      {t('pendingOrders.paymentAmount') || 'Payment Amount'}:
                    </AutoText>
                    <AutoText style={styles.infoValue}>
                      ₹{parseFloat(selectedOrder.payment_amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </AutoText>
                  </View>
                  <View style={styles.infoRow}>
                    <AutoText style={styles.infoLabel}>
                      {t('pendingOrders.status') || 'Status'}:
                    </AutoText>
                    <AutoText style={[styles.infoValue, { color: getStatusColor(selectedOrder.status) }]}>
                      {getStatusLabel(selectedOrder.status)}
                    </AutoText>
                  </View>
                  {selectedOrder.scrap_type && (
                    <View style={styles.infoRow}>
                      <AutoText style={styles.infoLabel}>
                        {t('pendingOrders.scrapType') || 'Scrap Type'}:
                      </AutoText>
                      <AutoText style={styles.infoValue}>{selectedOrder.scrap_type}</AutoText>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <AutoText style={styles.infoLabel}>
                      {t('pendingOrders.totalQuantity') || 'Total Quantity'}:
                    </AutoText>
                    <AutoText style={styles.infoValue}>
                      {selectedOrder.quantity.toLocaleString('en-IN')} kg
                    </AutoText>
                  </View>
                  {selectedOrder.preferred_price && (
                    <View style={styles.infoRow}>
                      <AutoText style={styles.infoLabel}>
                        {t('pendingOrders.preferredPrice') || 'Preferred Price'}:
                      </AutoText>
                      <AutoText style={styles.infoValue}>
                        ₹{parseFloat(selectedOrder.preferred_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / kg
                      </AutoText>
                    </View>
                  )}
                  {selectedOrder.when_needed && (
                    <View style={styles.infoRow}>
                      <AutoText style={styles.infoLabel}>
                        {t('pendingOrders.whenNeeded') || 'When Needed'}:
                      </AutoText>
                      <AutoText style={styles.infoValue}>{selectedOrder.when_needed}</AutoText>
                    </View>
                  )}
                  {selectedOrder.preferred_distance && (
                    <View style={styles.infoRow}>
                      <AutoText style={styles.infoLabel}>
                        {t('pendingOrders.preferredDistance') || 'Preferred Distance'}:
                      </AutoText>
                      <AutoText style={styles.infoValue}>
                        {selectedOrder.preferred_distance} km
                      </AutoText>
                    </View>
                  )}
                  {selectedOrder.location && (
                    <View style={styles.infoRow}>
                      <AutoText style={styles.infoLabel}>
                        {t('pendingOrders.location') || 'Location'}:
                      </AutoText>
                      <AutoText style={styles.infoValue} numberOfLines={3}>
                        {selectedOrder.location}
                      </AutoText>
                    </View>
                  )}
                  {selectedOrder.additional_notes && (
                    <View style={styles.infoRow}>
                      <AutoText style={styles.infoLabel}>
                        {t('pendingOrders.additionalNotes') || 'Additional Notes'}:
                      </AutoText>
                      <AutoText style={styles.infoValue} numberOfLines={5}>
                        {selectedOrder.additional_notes}
                      </AutoText>
                    </View>
                  )}

                  {selectedOrder.subcategories && selectedOrder.subcategories.length > 0 && (
                    <View style={{ marginTop: '16@vs' }}>
                      <AutoText style={[styles.infoLabel, { marginBottom: '12@vs' }]}>
                        {t('pendingOrders.subcategories') || 'Subcategories'}:
                      </AutoText>
                      {selectedOrder.subcategories.map((sub: any, index: number) => (
                        <View key={index} style={styles.subcategoryItem}>
                          <AutoText style={styles.subcategoryName}>
                            {sub.subcategory_name || `Subcategory ${index + 1}`}
                          </AutoText>
                          <AutoText style={styles.subcategoryDetails}>
                            {t('pendingOrders.quantity') || 'Quantity'}: {sub.quantity?.toLocaleString('en-IN') || 0} kg
                            {sub.preferred_price && ` | ${t('pendingOrders.price') || 'Price'}: ₹${parseFloat(sub.preferred_price).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / kg`}
                          </AutoText>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <AutoText style={styles.infoLabel}>
                      {t('pendingOrders.createdAt') || 'Created At'}:
                    </AutoText>
                    <AutoText style={styles.infoValue}>{formatDate(selectedOrder.created_at)}</AutoText>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default PendingBulkBuyOrdersScreen;

