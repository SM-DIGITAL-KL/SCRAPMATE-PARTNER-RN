import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useBulkSellRequests } from '../../hooks/useOrders';
import { getUserData } from '../../services/auth/authService';
import { BulkSellRequestItem } from '../../services/api/v2/bulkSell';
import { getCurrentLocationWithAddress } from '../../components/LocationView';
import { SectionCard } from '../../components/SectionCard';

type SortOption = 'recent' | 'oldest' | 'price_high' | 'price_low' | 'nearest';

const AvailableBulkSellRequestsScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [userData, setUserData] = useState<any>(null);
  const [sortBy, setSortBy] = useState<SortOption>('recent');
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Load user data and location
  React.useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();

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

  // Fetch bulk sell requests (only 'S' users can see these)
  const { data: requests, isLoading, refetch, error } = useBulkSellRequests(
    userData?.id,
    userData?.user_type || 'S',
    userLocation?.latitude,
    userLocation?.longitude,
    !!userData?.id && userData?.user_type === 'S'
  );

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  // Calculate distance between two coordinates
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Sort requests
  const sortedRequests = useMemo(() => {
    if (!requests || requests.length === 0) return [];
    
    const sorted = [...requests];
    
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
        return sorted.sort((a, b) => (b.asking_price || 0) - (a.asking_price || 0));
      case 'price_low':
        return sorted.sort((a, b) => (a.asking_price || 0) - (b.asking_price || 0));
      case 'nearest':
        if (!userLocation) {
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
  }, [requests, sortBy, userLocation]);

  const sortOptions: { label: string; value: SortOption }[] = [
    { label: t('sort.recent') || 'Most Recent', value: 'recent' },
    { label: t('sort.nearest') || 'Nearest First', value: 'nearest' },
    { label: t('sort.priceHigh') || 'Price: High to Low', value: 'price_high' },
    { label: t('sort.priceLow') || 'Price: Low to High', value: 'price_low' },
    { label: t('sort.oldest') || 'Oldest First', value: 'oldest' },
  ];

  const getStatusLabel = (status: string) => {
    const statusLower = (status || 'active').toLowerCase();
    switch (statusLower) {
      case 'active': return t('dashboard.statusActive') || 'Active';
      case 'sold': return t('bulkSellRequest.statusSold') || 'Sold';
      case 'cancelled': return t('dashboard.statusCancelled') || 'Cancelled';
      default: return status || 'Active';
    }
  };

  const getStatusColor = (status: string) => {
    const statusLower = (status || 'active').toLowerCase();
    switch (statusLower) {
      case 'active': return theme.warning || '#FFA500';
      case 'sold': return theme.success || '#4CAF50';
      case 'cancelled': return theme.error || '#F44336';
      default: return theme.textSecondary;
    }
  };

  // Check if user is 'S' type
  if (userData && userData.user_type !== 'S') {
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
          <AutoText style={styles.headerTitle}>
            {t('bulkSellRequest.availableRequests') || 'Available Bulk Sell Requests'}
          </AutoText>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyContainer}>
          <MaterialCommunityIcons
            name="alert-circle"
            size={48}
            color={theme.textSecondary}
          />
          <AutoText style={styles.emptyText}>
            {t('bulkSellRequest.onlySUsers') || 'Only S type users can view bulk sell requests'}
          </AutoText>
        </View>
      </View>
    );
  }

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
        <AutoText style={styles.headerTitle}>
          {t('bulkSellRequest.availableRequests') || 'Available Bulk Sell Requests'}
        </AutoText>
        <TouchableOpacity
          onPress={() => setShowSortOptions(!showSortOptions)}
          style={styles.sortButton}
        >
          <MaterialCommunityIcons name="sort" size={24} color={theme.primary} />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      {showSortOptions && (
        <View style={styles.sortOptionsContainer}>
          {sortOptions.map((option) => (
            <TouchableOpacity
              key={option.value}
              style={[
                styles.sortOption,
                sortBy === option.value && styles.sortOptionActive
              ]}
              onPress={() => {
                setSortBy(option.value);
                setShowSortOptions(false);
              }}
            >
              <AutoText style={[
                styles.sortOptionText,
                sortBy === option.value && styles.sortOptionTextActive
              ]}>
                {option.label}
              </AutoText>
              {sortBy === option.value && (
                <MaterialCommunityIcons name="check" size={20} color={theme.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <AutoText style={styles.loadingText}>
              {t('common.loading') || 'Loading...'}
            </AutoText>
          </View>
        ) : error ? (
          <SectionCard>
            <AutoText style={[styles.errorText, { color: theme.error || '#FF4444' }]}>
              {t('common.error') || 'Error'}: {error?.message || 'Failed to load requests'}
            </AutoText>
          </SectionCard>
        ) : sortedRequests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="package-variant-closed"
              size={64}
              color={theme.textSecondary}
            />
            <AutoText style={styles.emptyText}>
              {t('bulkSellRequest.noRequests') || 'No bulk sell requests available'}
            </AutoText>
            <AutoText style={styles.emptySubtext}>
              {t('bulkSellRequest.noRequestsSubtext') || 'Check back later for new requests'}
            </AutoText>
          </View>
        ) : (
          sortedRequests.map((request: BulkSellRequestItem, index: number) => {
            const quantityInTons = (request.quantity / 1000).toFixed(2);
            const subcategoriesText = request.subcategories && request.subcategories.length > 0
              ? request.subcategories.map((s: any) => s.subcategory_name).join(', ')
              : request.scrap_type || 'Scrap';
            
            const distance = request.distance_km || (userLocation && request.latitude && request.longitude
              ? calculateDistance(userLocation.latitude, userLocation.longitude, request.latitude, request.longitude)
              : null);

            return (
              <TouchableOpacity
                key={request.id}
                style={[styles.requestCard, index > 0 && styles.requestCardMargin]}
                onPress={() => {
                  navigation.navigate('BulkSellRequestDetails', { request });
                }}
                activeOpacity={0.7}
              >
                <View style={styles.cardHeader}>
                  <View style={styles.cardHeaderLeft}>
                    <MaterialCommunityIcons
                      name="store"
                      size={20}
                      color={theme.primary}
                    />
                    <AutoText style={styles.sellerName} numberOfLines={1}>
                      {request.seller_name || `Seller #${request.seller_id}`}
                    </AutoText>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: getStatusColor(request.status) + '15' }]}>
                    <AutoText style={[styles.statusText, { color: getStatusColor(request.status) }]}>
                      {getStatusLabel(request.status)}
                    </AutoText>
                  </View>
                </View>

                {request.subcategories && request.subcategories.length > 0 ? (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="package-variant"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <AutoText style={styles.detailText} numberOfLines={2}>
                      {subcategoriesText}
                    </AutoText>
                  </View>
                ) : request.scrap_type && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="package-variant"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <AutoText style={styles.detailText} numberOfLines={1}>
                      {request.scrap_type}
                    </AutoText>
                  </View>
                )}

                <View style={styles.detailRow}>
                  <MaterialCommunityIcons
                    name="weight-kilogram"
                    size={16}
                    color={theme.textSecondary}
                  />
                  <AutoText style={styles.detailText}>
                    {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
                  </AutoText>
                </View>

                {request.asking_price && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="currency-inr"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <AutoText style={styles.detailText}>
                      {t('bulkSellRequest.sellingPrice') || 'Selling Price'}: ₹{request.asking_price.toLocaleString('en-IN')} / kg
                    </AutoText>
                  </View>
                )}

                {request.total_committed_quantity !== undefined && request.total_committed_quantity > 0 && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="progress-check"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <AutoText style={styles.detailText}>
                      {t('dashboard.committed') || 'Committed'}: {request.total_committed_quantity.toLocaleString('en-IN')} kg / {request.quantity.toLocaleString('en-IN')} kg
                    </AutoText>
                  </View>
                )}

                {distance !== null && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="map-marker-distance"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <AutoText style={styles.detailText}>
                      {distance.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                    </AutoText>
                  </View>
                )}

                {request.location && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons
                      name="map-marker"
                      size={16}
                      color={theme.textSecondary}
                    />
                    <AutoText style={styles.detailText} numberOfLines={2}>
                      {request.location}
                    </AutoText>
                  </View>
                )}

                <View style={styles.cardFooter}>
                  <AutoText style={styles.viewDetailsText}>
                    {t('common.viewDetails') || 'View Details'} →
                  </AutoText>
                </View>
              </TouchableOpacity>
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
    sortButton: {
      width: 24,
      alignItems: 'flex-end',
    },
    sortOptionsContainer: {
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingVertical: '8@vs',
    },
    sortOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
    },
    sortOptionActive: {
      backgroundColor: theme.primary + '10',
    },
    sortOptionText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    sortOptionTextActive: {
      fontFamily: 'Poppins-SemiBold',
      color: theme.primary,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: '16@s',
      paddingBottom: '32@vs',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
    },
    loadingText: {
      marginTop: '16@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
      paddingHorizontal: '32@s',
    },
    emptyText: {
      marginTop: '16@vs',
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    emptySubtext: {
      marginTop: '8@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    errorText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
    },
    requestCard: {
      backgroundColor: theme.card,
      borderRadius: '16@ms',
      padding: '16@s',
      marginBottom: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    requestCardMargin: {
      marginTop: 0,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12@vs',
    },
    cardHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: '12@s',
    },
    sellerName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginLeft: '8@s',
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      borderRadius: '12@ms',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: '8@vs',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginLeft: '8@s',
      flex: 1,
    },
    cardFooter: {
      marginTop: '12@vs',
      paddingTop: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    viewDetailsText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
      textAlign: 'right',
    },
  });

export default AvailableBulkSellRequestsScreen;

