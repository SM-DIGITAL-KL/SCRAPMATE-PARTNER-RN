import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useBulkScrapRequestsByBuyer } from '../../hooks/useOrders';
import { getUserData } from '../../services/auth/authService';
import { BulkScrapRequest } from '../../services/api/v2/bulkScrap';
import { getCurrentLocationWithAddress } from '../../components/LocationView';

type SortOption = 'recent' | 'oldest' | 'price_high' | 'price_low' | 'status' | 'nearest';

const MyBulkBuyRequestsScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [userData, setUserData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  // Load user data and location
  useEffect(() => {
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

  // Fetch all bulk buy requests created by this user
  const { data: bulkBuyRequests, isLoading, refetch } = useBulkScrapRequestsByBuyer(
    userData?.id,
    !!userData?.id
  );

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

  // Sort requests based on selected option
  const sortedRequests = useMemo(() => {
    if (!bulkBuyRequests || bulkBuyRequests.length === 0) return [];
    
    const sorted = [...bulkBuyRequests];
    
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
        return sorted.sort((a, b) => (b.preferred_price || 0) - (a.preferred_price || 0));
      case 'price_low':
        return sorted.sort((a, b) => (a.preferred_price || 0) - (b.preferred_price || 0));
      case 'status':
        return sorted.sort((a, b) => {
          // Sort by status: active > order_full_filled > pickup_started > arrived > completed > cancelled
          const statusOrder: Record<string, number> = { 
            'active': 6, 
            'order_full_filled': 5, 
            'pickup_started': 4,
            'arrived': 3,
            'completed': 2, 
            'cancelled': 1 
          };
          const statusA = (a.status || 'active').toLowerCase();
          const statusB = (b.status || 'active').toLowerCase();
          return (statusOrder[statusB] || 0) - (statusOrder[statusA] || 0);
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
  }, [bulkBuyRequests, sortBy, userLocation]);

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

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

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: t('sort.recent') || 'Most Recent', value: 'recent' },
    { label: t('sort.nearest') || 'Nearest First', value: 'nearest' },
    { label: t('sort.oldest') || 'Oldest First', value: 'oldest' },
    { label: t('sort.priceHigh') || 'Price: High to Low', value: 'price_high' },
    { label: t('sort.priceLow') || 'Price: Low to High', value: 'price_low' },
    { label: t('sort.status') || 'By Status', value: 'status' },
  ];

  const renderRequestCard = (request: BulkScrapRequest) => {
    const quantityInTons = (request.quantity / 1000).toFixed(2);
    const subcategoriesText = request.subcategories && request.subcategories.length > 0
      ? request.subcategories.map((s: any) => s.subcategory_name).join(', ')
      : request.scrap_type || 'Scrap';

    return (
      <TouchableOpacity
        key={request.id}
        style={styles.requestCard}
        onPress={() => {
          // Navigate to bulk request details
          navigation.navigate('BulkRequestDetails', {
            request: request
          });
        }}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.requestInfo}>
            <AutoText style={styles.requestNumber}>
              #{request.id}
            </AutoText>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status || 'active') + '20' }]}>
              <AutoText style={[styles.statusText, { color: getStatusColor(request.status || 'active') }]}>
                {getStatusLabel(request.status || 'active')}
              </AutoText>
            </View>
          </View>
          {request.preferred_price && (
            <AutoText style={styles.price}>
              ₹{request.preferred_price.toLocaleString('en-IN')}/kg
            </AutoText>
          )}
        </View>

        <View style={styles.detailRow}>
          <MaterialCommunityIcons
            name="package-variant"
            size={16}
            color={theme.primary}
          />
          <AutoText style={styles.detailText} numberOfLines={2}>
            {subcategoriesText}
          </AutoText>
        </View>

        <View style={styles.detailRow}>
          <MaterialCommunityIcons
            name="weight-kilogram"
            size={16}
            color={theme.primary}
          />
          <AutoText style={styles.detailText} numberOfLines={1}>
            {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
          </AutoText>
        </View>

        {request.location && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={2}>
              {request.location}
            </AutoText>
          </View>
        )}

        {request.accepted_vendors && request.accepted_vendors.length > 0 && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="account-check"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              {request.accepted_vendors.length} {t('dashboard.vendorsAccepted') || 'vendor(s) accepted'}
            </AutoText>
          </View>
        )}

        {request.when_needed && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              {t('dashboard.whenNeeded') || 'When needed'}: {request.when_needed}
            </AutoText>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            {request.created_at && (
              <View style={styles.timeInfo}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={theme.textSecondary}
                />
                <AutoText style={styles.timeText}>
                  {new Date(request.created_at).toLocaleString()}
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
            {t('dashboard.myBulkBuyRequests') || 'My Bulk Buy Requests'}
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
          ) : sortedRequests.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={64}
                color={theme.textSecondary}
              />
              <AutoText style={styles.emptyText}>
                {t('dashboard.noBulkBuyRequests') || 'No bulk buy requests'}
              </AutoText>
            </View>
          ) : (
            sortedRequests.map((request: BulkScrapRequest) => renderRequestCard(request))
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
    requestCard: {
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
    requestInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    requestNumber: {
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

export default MyBulkBuyRequestsScreen;

