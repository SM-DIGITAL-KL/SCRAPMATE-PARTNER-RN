import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useAcceptedBulkScrapRequests } from '../../hooks/useOrders';
import { getUserData } from '../../services/auth/authService';
import { BulkScrapRequest } from '../../services/api/v2/bulkScrap';
import { getCurrentLocationWithAddress } from '../../components/LocationView';

type SortOption = 'recent' | 'oldest' | 'price_high' | 'price_low' | 'status' | 'nearest';

const ActiveBuyRequestsListScreen = ({ navigation, route }: any) => {
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

  // Fetch all accepted bulk scrap requests
  const { data: acceptedRequests, isLoading, refetch } = useAcceptedBulkScrapRequests(
    userData?.id,
    userData?.user_type || 'R',
    userLocation?.latitude,
    userLocation?.longitude,
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
    if (!acceptedRequests || acceptedRequests.length === 0) return [];
    
    const sorted = [...acceptedRequests];
    
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
          // Sort by status: active > completed > cancelled
          const statusOrder: Record<string, number> = { 'active': 3, 'completed': 2, 'cancelled': 1 };
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
  }, [acceptedRequests, sortBy, userLocation]);

  const getStatusLabel = (status: string) => {
    const statusLower = (status || 'active').toLowerCase();
    switch (statusLower) {
      case 'active': return t('dashboard.statusActive') || 'Active';
      case 'completed': return t('dashboard.statusCompleted') || 'Completed';
      case 'cancelled': return t('dashboard.statusCancelled') || 'Cancelled';
      default: return status || 'Active';
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = (status || 'active').toLowerCase();
    switch (statusLower) {
      case 'active': return theme.warning || '#FFA500';
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
          {t('dashboard.activeBuyRequests') || 'Active Buy Requests'}
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
        ) : sortedRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="package-variant-closed"
              size={64}
              color={theme.textSecondary}
            />
            <AutoText style={styles.emptyText}>
              {t('dashboard.noActiveBuyRequests') || 'No active buy requests'}
            </AutoText>
          </View>
        ) : (
          sortedRequests.map((request: BulkScrapRequest) => {
            const quantityInTons = (request.quantity / 1000).toFixed(2);
            const subcategoriesText = request.subcategories && request.subcategories.length > 0
              ? request.subcategories.map((s: any) => s.subcategory_name).join(', ')
              : request.scrap_type || 'Scrap';

            // Find current user's vendor status in accepted_vendors
            const currentUserVendor = userData?.id 
              ? request.accepted_vendors?.find((v: any) => {
                  const vendorUserId = typeof v.user_id === 'string' ? parseInt(v.user_id) : (typeof v.user_id === 'number' ? v.user_id : parseInt(String(v.user_id)));
                  const currentUserId = typeof userData.id === 'string' ? parseInt(userData.id) : (typeof userData.id === 'number' ? userData.id : parseInt(String(userData.id)));
                  return vendorUserId === currentUserId;
                })
              : null;
            
            // Get vendor status
            const vendorStatus = currentUserVendor?.status || 'participated';
            
            // Get status label and color for vendor
            const getVendorStatusInfo = (status: string) => {
              switch (status) {
                case 'participated':
                  return {
                    label: t('dashboard.statusParticipated') || 'Participated',
                    color: theme.primary,
                    bgColor: theme.primary + '20'
                  };
                case 'order_full_filled':
                  return {
                    label: t('dashboard.statusOrderFullFilled') || 'Order Full Filled',
                    color: theme.info || '#2196F3',
                    bgColor: (theme.info || '#2196F3') + '20'
                  };
                case 'pickup_started':
                  return {
                    label: t('dashboard.statusPickupStarted') || 'Pickup Started',
                    color: theme.warning || '#FFA500',
                    bgColor: (theme.warning || '#FFA500') + '20'
                  };
                case 'arrived':
                  return {
                    label: t('dashboard.statusArrived') || 'Arrived',
                    color: theme.success || '#4CAF50',
                    bgColor: (theme.success || '#4CAF50') + '20'
                  };
                case 'completed':
                  return {
                    label: t('dashboard.statusCompleted') || 'Completed',
                    color: theme.success || '#4CAF50',
                    bgColor: (theme.success || '#4CAF50') + '20'
                  };
                default:
                  return {
                    label: t('dashboard.statusParticipated') || 'Participated',
                    color: theme.textSecondary,
                    bgColor: theme.textSecondary + '20'
                  };
              }
            };

            const vendorStatusInfo = getVendorStatusInfo(vendorStatus);

            return (
              <TouchableOpacity
                key={request.id}
                style={styles.requestCard}
                onPress={() => {
                  // Navigate to bulk request tracking screen
                  const vendorInfo = request.accepted_vendors?.find((v: any) => {
                    const vendorUserId = typeof v.user_id === 'string' ? parseInt(v.user_id) : (typeof v.user_id === 'number' ? v.user_id : parseInt(String(v.user_id)));
                    const currentUserId = typeof userData.id === 'string' ? parseInt(userData.id) : (typeof userData.id === 'number' ? userData.id : parseInt(String(userData.id)));
                    return vendorUserId === currentUserId;
                  }) as any;
                  navigation.navigate('BulkRequestTracking', {
                    bulkRequest: request,
                    orderId: vendorInfo?.order_id || vendorInfo?.order_number || request.id
                  });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.requestInfo}>
                    <AutoText style={styles.requestId}>
                      #{request.id}
                    </AutoText>
                    <View style={[styles.statusBadge, { backgroundColor: vendorStatusInfo.bgColor }]}>
                      <AutoText style={[styles.statusText, { color: vendorStatusInfo.color }]}>
                        {vendorStatusInfo.label}
                      </AutoText>
                    </View>
                  </View>
                  {request.preferred_price && (
                    <AutoText style={styles.price}>
                      ₹{request.preferred_price.toLocaleString('en-IN')}/kg
                    </AutoText>
                  )}
                </View>

                {request.buyer_name && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="account"
                      size={16}
                      color={theme.primary}
                    />
                    <AutoText style={styles.detailText} numberOfLines={1}>
                      {t('dashboard.requestFrom') || 'Request from'}: {request.buyer_name}
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

                {request.distance_km !== undefined && request.distance_km !== null && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="map-marker-distance"
                      size={16}
                      color={theme.primary}
                    />
                    <AutoText style={styles.detailText} numberOfLines={1}>
                      {request.distance_km.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                    </AutoText>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <View style={styles.footerInfo}>
                    {(request as any).accepted_at && (
                      <View style={styles.timeInfo}>
                        <MaterialCommunityIcons
                          name="clock-outline"
                          size={14}
                          color={theme.textSecondary}
                        />
                        <AutoText style={styles.timeText}>
                          {t('dashboard.participatedAt') || 'Participated'}: {new Date((request as any).accepted_at).toLocaleString()}
                        </AutoText>
                      </View>
                    )}
                    {!((request as any).accepted_at) && request.created_at && (
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
          })
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
  requestId: {
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

export default ActiveBuyRequestsListScreen;

