import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, Alert } from 'react-native';
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
import { getCurrentLocationWithAddress } from '../../components/LocationView';

type SortOption = 'recent' | 'oldest' | 'price_high' | 'price_low' | 'status' | 'nearest';

const ActivePickupsListScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [userData, setUserData] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Load user data and location
  React.useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();

    // Get user location for nearest sort
    const loadUserLocation = async () => {
      try {
        const locationData = await getCurrentLocationWithAddress();
        if (locationData && locationData.latitude && locationData.longitude) {
          setUserLocation({
            latitude: locationData.latitude,
            longitude: locationData.longitude
          });
        }
      } catch (error) {
        console.warn('Could not get user location for sorting:', error);
      }
    };
    loadUserLocation();
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
    
    // For R type users, require explicit subscription confirmation
    return b2cShop.is_subscribed === true;
  }, [profileData, userData?.user_type]);

  // Fetch all active pickups
  const { data: activePickups, isLoading, refetch } = useAllActivePickups(
    userData?.id,
    'R', // B2C dashboard is for R (Retailer) type users
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

  // Console log to verify backend response
  React.useEffect(() => {
    if (activePickups && activePickups.length > 0) {
      console.log('📦 [ActivePickupsList] Received active pickups from backend:', activePickups.length);
      console.log('📦 [ActivePickupsList] Filtered active pickups (excluding bulk requests):', filteredActivePickups.length);
      activePickups.forEach((pickup: ActivePickup, index: number) => {
        console.log(`\n📦 Pickup ${index + 1} (Order #${pickup.order_number}):`);
        console.log('   preferred_pickup_date:', (pickup as any)?.preferred_pickup_date);
        console.log('   preferred_pickup_time_slot:', (pickup as any)?.preferred_pickup_time_slot);
        console.log('   preferred_pickup_time:', pickup?.preferred_pickup_time);
        console.log('   pickup_time_display:', pickup?.pickup_time_display);
        console.log('   bulk_request_id:', (pickup as any)?.bulk_request_id);
      });
    } else if (activePickups && activePickups.length === 0) {
      console.log('📦 [ActivePickupsList] No active pickups received from backend');
    }
  }, [activePickups, filteredActivePickups]);

  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Sort orders based on selected option
  const sortedPickups = useMemo(() => {
    if (!filteredActivePickups || filteredActivePickups.length === 0) return [];
    
    const sorted = [...filteredActivePickups];
    
    switch (sortBy) {
      case 'recent':
        return sorted.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateB - dateA;
        });
      case 'oldest':
        return sorted.sort((a, b) => {
          const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
          const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
          return dateA - dateB;
        });
      case 'price_high':
        return sorted.sort((a, b) => (b.estimated_price || 0) - (a.estimated_price || 0));
      case 'price_low':
        return sorted.sort((a, b) => (a.estimated_price || 0) - (b.estimated_price || 0));
      case 'status':
        return sorted.sort((a, b) => {
          // Sort by status: 4 (Arrived) > 3 (Initiated) > 2 (Accepted)
          return (b.status || 0) - (a.status || 0);
        });
      case 'nearest':
        if (!userLocation) {
          // If no location, fallback to recent
          return sorted.sort((a, b) => {
            const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
            const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
            return dateB - dateA;
          });
        }
        return sorted.sort((a, b) => {
          const distA = (a.latitude && a.longitude) 
            ? calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude)
            : Infinity;
          const distB = (b.latitude && b.longitude)
            ? calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude)
            : Infinity;
          return distA - distB;
        });
      default:
        return sorted;
    }
  }, [filteredActivePickups, sortBy, userLocation]);

  const getStatusLabel = (status: number | string) => {
    // Convert to number if it's a string
    const statusNum = typeof status === 'string' ? parseInt(status) : status;
    switch (statusNum) {
      case 2: return t('dashboard.statusAccepted') || 'Accepted';
      case 3: return t('dashboard.statusPickupInitiated') || 'Pickup Initiated';
      case 4: return t('dashboard.statusArrived') || 'Arrived Location';
      default: return t('dashboard.statusScheduled') || 'Scheduled';
    }
  };

  const getStatusColor = (status: number | string) => {
    // Convert to number if it's a string
    const statusNum = typeof status === 'string' ? parseInt(status) : status;
    switch (statusNum) {
      case 2: return theme.warning || '#FFA500';
      case 3: return theme.info || '#2196F3';
      case 4: return theme.success || '#4CAF50';
      default: return theme.textSecondary;
    }
  };

  // Helper function to format scheduled date and time - same format as customer app
  const formatScheduledDateTime = (pickup: ActivePickup): string => {
    try {
      const preferredDate = (pickup as any)?.preferred_pickup_date;
      const preferredTimeSlot = (pickup as any)?.preferred_pickup_time_slot;
      
      // Console log to verify backend data
      console.log('🕐 [ActivePickupsList] Formatting scheduled date/time for order:', pickup.order_number);
      console.log('   preferred_pickup_date:', preferredDate);
      console.log('   preferred_pickup_time_slot:', preferredTimeSlot);
      console.log('   preferred_pickup_time:', pickup?.preferred_pickup_time);
      console.log('   pickup_time_display:', pickup?.pickup_time_display);
      console.log('   Full pickup object:', JSON.stringify(pickup, null, 2));
      
      // Use backend formatted fields if available (from updated backend)
      if (preferredDate && preferredTimeSlot) {
        console.log('   ✅ Using backend formatted fields:', `${preferredDate}, ${preferredTimeSlot}`);
        return `${preferredDate}, ${preferredTimeSlot}`;
      }
      
      // If we have time slot but no date, try to get date from preferred_pickup_time or use pickup_time_display
      if (preferredTimeSlot) {
        console.log('   ⚠️  Has time slot but checking date...');
        if (preferredDate) {
          console.log('   ✅ Using time slot with date:', `${preferredDate}, ${preferredTimeSlot}`);
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
        console.log('   ⚠️  Only time slot available, returning:', preferredTimeSlot);
        return preferredTimeSlot;
      }
      
      // Fallback: parse from preferred_pickup_time if backend hasn't been updated yet
      const preferredTime = pickup?.preferred_pickup_time;
      console.log('   🔄 Falling back to parsing preferred_pickup_time:', preferredTime);
      
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
            
            const result = `${formattedDate}, ${timeSlot}`;
            console.log('   ✅ Parsed from preferred_pickup_time:', result);
            return result;
          } catch (e) {
            console.error('   ❌ Error parsing preferred_pickup_time date:', e);
          }
        }
      }
      
      // Final fallback
      const fallback = pickup?.pickup_time_display || t('dashboard.today') || 'Today';
      console.log('   ⚠️  Using final fallback:', fallback);
      return fallback;
    } catch (error) {
      console.error('Error formatting scheduled date/time:', error);
      return pickup?.pickup_time_display || t('dashboard.today') || 'Today';
    }
  };

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: t('sort.recent') || 'Most Recent', value: 'recent' },
    { label: t('sort.nearest') || 'Nearest First', value: 'nearest' },
    { label: t('sort.oldest') || 'Oldest First', value: 'oldest' },
    { label: t('sort.priceHigh') || 'Price: High to Low', value: 'price_high' },
    { label: t('sort.priceLow') || 'Price: Low to High', value: 'price_low' },
    { label: t('sort.status') || 'By Status', value: 'status' },
  ];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('dashboard.activePickups') || 'Active Pickups'}
        </AutoText>
        <TouchableOpacity onPress={() => setShowSortOptions(!showSortOptions)}>
          <MaterialCommunityIcons
            name={showSortOptions ? "close" : "sort"}
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      {showSortOptions && (
        <View style={styles.sortContainer}>
          <AutoText style={styles.sortTitle}>
            {t('sort.sortBy') || 'Sort By'}
          </AutoText>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionSelected
              ]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortOptions(false);
              }}
            >
              <AutoText style={[
                styles.sortOptionText,
                sortBy === option.value && styles.sortOptionTextSelected
              ]}>
                {option.label}
              </AutoText>
              {sortBy === option.value && (
                <MaterialCommunityIcons
                  name="check"
                  size={20}
                  color={theme.primary}
                />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <AutoText style={styles.loadingText}>
              {t('common.loading') || 'Loading...'}
            </AutoText>
          </View>
        ) : sortedPickups.length === 0 ? (
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
          sortedPickups.map((pickup: ActivePickup) => (
            <TouchableOpacity
              key={pickup.order_id}
              style={styles.pickupCard}
              onPress={() => {
                navigation.navigate('DeliveryTracking', {
                  orderId: pickup.order_number?.toString(),
                  order: pickup
                });
              }}
              activeOpacity={0.7}
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
                  {pickup.pickup_initiated_at && (
                    <View style={styles.timeInfo}>
                      <MaterialCommunityIcons
                        name="clock-outline"
                        size={14}
                        color={theme.textSecondary}
                      />
                      <AutoText style={styles.timeText}>
                        {new Date(pickup.pickup_initiated_at).toLocaleString()}
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
          ))
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, themeName: string) => ScaledSheet.create({
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
  },
  headerTitle: {
    fontSize: '18@ms',
    fontWeight: '600',
    color: theme.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  sortContainer: {
    backgroundColor: theme.cardBackground,
    padding: '12@ms',
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  sortTitle: {
    fontSize: '14@ms',
    fontWeight: '600',
    color: theme.textPrimary,
    marginBottom: '8@ms',
  },
  sortOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: '10@ms',
    paddingHorizontal: '12@ms',
    borderRadius: '8@ms',
    marginBottom: '4@ms',
  },
  sortOptionSelected: {
    backgroundColor: theme.primary + '15',
  },
  sortOptionText: {
    fontSize: '14@ms',
    color: theme.textPrimary,
  },
  sortOptionTextSelected: {
    color: theme.primary,
    fontWeight: '600',
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
});

export default ActivePickupsListScreen;

