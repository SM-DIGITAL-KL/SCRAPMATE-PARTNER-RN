import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useAllActivePickups } from '../../hooks/useOrders';
import { getUserData } from '../../services/auth/authService';
import { ActivePickup } from '../../services/api/v2/orders';
import { useProfile } from '../../hooks/useProfile';

const PickupStatusScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [userData, setUserData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

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

  // Fetch all active pickups
  const { data: activePickups, isLoading, refetch } = useAllActivePickups(
    userData?.id,
    userData?.user_type || 'R',
    !!userData?.id
  );

  // Filter out bulk request orders from active pickups (only show customer orders)
  // Bulk request orders have a bulk_request_id field
  const filteredActivePickups = React.useMemo(() => {
    if (!activePickups || activePickups.length === 0) return [];
    // Filter out orders that have bulk_request_id field
    return activePickups.filter((pickup: any) => {
      // If bulk_request_id exists and is not null/undefined, exclude it
      return pickup?.bulk_request_id === null || pickup?.bulk_request_id === undefined;
    });
  }, [activePickups]);

  // Group pickups by status
  // Note: getAllActivePickups API returns only status 2 (Accepted), 3 (Pickup Initiated), or 4 (Arrived)
  const groupedPickups = useMemo(() => {
    if (!filteredActivePickups || filteredActivePickups.length === 0) {
      return {
        accepted: [], // Status 2 (Accepted)
        onTheWay: [], // Status 3 (Pickup Initiated)
        arrived: [] // Status 4 (Arrived)
      };
    }

    const accepted: ActivePickup[] = [];
    const onTheWay: ActivePickup[] = [];
    const arrived: ActivePickup[] = [];

    filteredActivePickups.forEach((pickup: ActivePickup) => {
      const status = parseInt(String(pickup.status || 0));
      
      if (status === 2) {
        accepted.push(pickup);
      } else if (status === 3) {
        onTheWay.push(pickup);
      } else if (status === 4) {
        arrived.push(pickup);
      }
    });

    return { accepted, onTheWay, arrived };
  }, [filteredActivePickups]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const getStatusLabel = (status: number | string) => {
    const statusNum = typeof status === 'string' ? parseInt(status) : status;
    switch (statusNum) {
      case 2: return t('dashboard.statusAccepted') || 'Accepted';
      case 3: return t('dashboard.statusPickupInitiated') || 'Pickup Initiated';
      case 4: return t('dashboard.statusArrived') || 'Arrived Location';
      default: return t('dashboard.statusScheduled') || 'Scheduled';
    }
  };

  const getStatusColor = (status: number | string) => {
    const statusNum = typeof status === 'string' ? parseInt(status) : status;
    switch (statusNum) {
      case 2: return theme.warning || '#FFA500';
      case 3: return theme.info || '#2196F3';
      case 4: return theme.success || '#4CAF50';
      default: return theme.textSecondary;
    }
  };

  // Helper function to format scheduled date and time
  const formatScheduledDateTime = (pickup: ActivePickup): string => {
    try {
      const preferredDate = (pickup as any)?.preferred_pickup_date;
      const preferredTimeSlot = (pickup as any)?.preferred_pickup_time_slot;
      
      if (preferredDate && preferredTimeSlot) {
        return `${preferredDate}, ${preferredTimeSlot}`;
      }
      
      if (preferredTimeSlot) {
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
              console.error('Error parsing date:', e);
            }
          }
        }
        return preferredTimeSlot;
      }
      
      if (pickup?.preferred_pickup_time) {
        const dateTimeMatch = pickup.preferred_pickup_time.match(/(\d{4}-\d{2}-\d{2})\s+(.+)/);
        if (dateTimeMatch) {
          const dateStr = dateTimeMatch[1];
          const timeSlot = dateTimeMatch[2];
          
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
            
            return `${formattedDate}, ${timeSlot}`;
          } catch (e) {
            console.error('Error parsing date:', e);
          }
        }
      }
      
      return pickup?.pickup_time_display || t('dashboard.today') || 'Today';
    } catch (error) {
      console.error('Error formatting scheduled date/time:', error);
      return pickup?.pickup_time_display || t('dashboard.today') || 'Today';
    }
  };

  const renderPickupCard = (pickup: ActivePickup) => {
    return (
      <TouchableOpacity
        key={pickup.order_id}
        style={[styles.pickupCard, !isSubscribed && styles.blurredCard]}
        onPress={() => {
          if (!isSubscribed) {
            return;
          }
          navigation.navigate('DeliveryTracking', {
            orderId: pickup.order_number?.toString(),
            order: pickup
          });
        }}
        activeOpacity={isSubscribed ? 0.7 : 1}
        disabled={!isSubscribed}
      >
        <View style={styles.cardHeader}>
          <View style={styles.orderInfo}>
            <AutoText style={styles.orderNumber}>
              #{pickup.order_number}
            </AutoText>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(pickup.status) + '20' }]}>
              <AutoText style={[styles.statusText, { color: getStatusColor(pickup.status) }]}>
                {pickup.status_label || getStatusLabel(pickup.status)}
              </AutoText>
            </View>
          </View>
          <AutoText style={styles.price}>
            ₹{pickup.estimated_price?.toLocaleString('en-IN') || '0'}
          </AutoText>
        </View>

        {pickup.customer_name && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="account"
              size={16}
              color={theme.primary}
              style={!isSubscribed ? { opacity: 0 } : undefined}
            />
            <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
              {pickup.customer_name}
            </AutoText>
          </View>
        )}

        <View style={styles.detailRow}>
          <MaterialCommunityIcons
            name="package-variant"
            size={16}
            color={theme.primary}
          />
          <AutoText style={styles.detailText} numberOfLines={2}>
            {pickup.scrap_description} ({pickup.estimated_weight_kg} kg)
          </AutoText>
        </View>

        {((pickup as any)?.preferred_pickup_time_slot || pickup?.preferred_pickup_time || (pickup as any)?.preferred_pickup_date) && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color={theme.primary}
            />
            <AutoText style={[styles.detailText, { flex: 1 }]} numberOfLines={1}>
              {formatScheduledDateTime(pickup)}
            </AutoText>
          </View>
        )}

        {pickup.address && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={2}>
              {pickup.address}
            </AutoText>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            {pickup.accepted_at && (
              <View style={styles.timeInfo}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={theme.textSecondary}
                />
                <AutoText style={styles.timeText}>
                  {new Date(pickup.accepted_at).toLocaleString()}
                </AutoText>
              </View>
            )}
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.textSecondary}
          />
        </View>
      </TouchableOpacity>
    );
  };

  const renderStatusSection = (title: string, pickups: ActivePickup[], icon: string) => {
    if (pickups.length === 0) return null;

    return (
      <View style={styles.statusSection}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <MaterialCommunityIcons
              name={icon}
              size={20}
              color={theme.primary}
            />
            <AutoText style={styles.sectionTitle}>
              {title} ({pickups.length})
            </AutoText>
          </View>
        </View>
        {pickups.map(pickup => renderPickupCard(pickup))}
      </View>
    );
  };

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
          <AutoText style={styles.headerTitle} numberOfLines={1}>
            {t('pickupStatus.title') || 'Pickup Status'}
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
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <AutoText style={styles.loadingText}>
                {t('common.loading') || 'Loading...'}
              </AutoText>
            </View>
          ) : (
            <>
              {groupedPickups.accepted.length === 0 && 
               groupedPickups.onTheWay.length === 0 && 
               groupedPickups.arrived.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={64}
                    color={theme.textSecondary}
                  />
                  <AutoText style={styles.emptyText}>
                    {t('dashboard.noActivePickups') || 'No active pickups'}
                  </AutoText>
                </View>
              ) : (
                <>
                  {renderStatusSection(
                    t('pickupStatus.pendingPickups') || 'Accepted Pickups',
                    groupedPickups.accepted,
                    'clock-time-four-outline'
                  )}
                  {renderStatusSection(
                    t('pickupStatus.onTheWay') || 'On The Way',
                    groupedPickups.onTheWay,
                    'truck-delivery'
                  )}
                  {renderStatusSection(
                    t('pickupStatus.arrivedAtPickup') || 'Arrived At Pickup',
                    groupedPickups.arrived,
                    'map-marker-check'
                  )}
                </>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </>
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
      paddingHorizontal: '16@ms',
      paddingVertical: '12@ms',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    headerTitle: {
      fontSize: '18@ms',
      fontWeight: '600',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      padding: '16@ms',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '40@ms',
    },
    loadingText: {
      marginTop: '12@ms',
      fontSize: '14@ms',
      color: theme.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@ms',
    },
    emptyText: {
      marginTop: '16@ms',
      fontSize: '16@ms',
      color: theme.textSecondary,
    },
    statusSection: {
      marginBottom: '24@ms',
    },
    sectionHeader: {
      marginBottom: '12@ms',
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@ms',
    },
    sectionTitle: {
      fontSize: '16@ms',
      fontWeight: '600',
      color: theme.textPrimary,
    },
    pickupCard: {
      backgroundColor: theme.cardBackground,
      borderRadius: '12@ms',
      padding: '16@ms',
      marginBottom: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@ms',
    },
    orderInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    orderNumber: {
      fontSize: '16@ms',
      fontWeight: '600',
      color: theme.textPrimary,
      marginRight: '8@ms',
    },
    statusBadge: {
      paddingHorizontal: '8@ms',
      paddingVertical: '4@ms',
      borderRadius: '6@ms',
    },
    statusText: {
      fontSize: '12@ms',
      fontWeight: '500',
    },
    price: {
      fontSize: '18@ms',
      fontWeight: '700',
      color: theme.primary,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: '8@ms',
    },
    detailText: {
      fontSize: '14@ms',
      color: theme.textPrimary,
      marginLeft: '8@ms',
      flex: 1,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '12@ms',
      paddingTop: '12@ms',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerInfo: {
      flex: 1,
    },
    timeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeText: {
      fontSize: '12@ms',
      color: theme.textSecondary,
      marginLeft: '4@ms',
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
      backgroundColor: theme.cardBackground,
      borderRadius: '16@ms',
      padding: '24@ms',
      marginHorizontal: '20@ms',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    subscriptionOverlayTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@ms',
      color: theme.textPrimary,
      marginTop: '12@ms',
      marginBottom: '8@ms',
      textAlign: 'center',
    },
    subscriptionOverlayText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@ms',
      color: theme.textSecondary,
      textAlign: 'center',
      marginBottom: '20@ms',
      lineHeight: '20@ms',
    },
    subscriptionButton: {
      backgroundColor: theme.primary,
      paddingVertical: '12@ms',
      paddingHorizontal: '24@ms',
      borderRadius: '8@ms',
      minWidth: '150@ms',
    },
    subscriptionButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@ms',
      color: '#FFFFFF',
      textAlign: 'center',
    },
  });

export default PickupStatusScreen;
