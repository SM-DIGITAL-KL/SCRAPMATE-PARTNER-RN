import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { ScaledSheet } from 'react-native-size-matters';
import { NativeMapView } from '../../components/NativeMapView';
import { ActivePickup } from '../../services/api/v2/orders';
import { getUserData } from '../../services/auth/authService';
import { getActivePickup } from '../../services/api/v2/orders';
import { locationTrackingService } from '../../services/location/locationTrackingService';
import { BulkScrapRequest, getBulkScrapRequests, getAcceptedBulkScrapRequests } from '../../services/api/v2/bulkScrap';
import { REDIS_CONFIG } from '../../config/redisConfig';

const BulkRequestTrackingScreen = ({ route, navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const { bulkRequest, orderId } = route.params || {};
  const [userData, setUserData] = useState<any>(null);
  const [orderData, setOrderData] = useState<ActivePickup | null>(null);
  const [loadingOrder, setLoadingOrder] = useState(false);

  // State for bulk request buyer location
  const [bulkRequestBuyerLocation, setBulkRequestBuyerLocation] = useState<{
    latitude: number;
    longitude: number;
    location?: string;
    buyerName?: string;
  } | null>(null);
  const [buyerLiveLocation, setBuyerLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingBuyerLocation, setLoadingBuyerLocation] = useState(false);

  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [vendorLocation, setVendorLocation] = useState<{ latitude: number; longitude: number; timestamp: string } | null>(null);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Fetch order data if orderId is provided
  useEffect(() => {
    const fetchOrderData = async () => {
      if (!orderId || !userData) return;

      setLoadingOrder(true);
      try {
        // Try to get order from active pickups
        const order = await getActivePickup(
          userData.id,
          (userData.user_type || 'R') as 'R' | 'S' | 'SR' | 'D'
        );
        
        // If order found and it matches our orderId, use it
        if (order && (order.order_id === parseInt(String(orderId)) || order.order_number === parseInt(String(orderId)))) {
          setOrderData(order);
        } else {
          // Order might be in a different status, try to find it from bulk request
          if (bulkRequest?.accepted_vendors) {
            const vendorInfo = bulkRequest.accepted_vendors.find((v: any) => 
              v.user_id === userData.id && (v.order_id === parseInt(String(orderId)) || v.order_number === parseInt(String(orderId)))
            );
            if (vendorInfo) {
              // Create a mock order object from bulk request data
              const mockOrder: any = {
                order_id: vendorInfo.order_id || vendorInfo.order_number,
                order_number: vendorInfo.order_number || vendorInfo.order_id,
                customer_id: bulkRequest.buyer_id,
                customer_name: bulkRequest.buyer_name,
                address: bulkRequest.location || '',
                latitude: bulkRequest.latitude,
                longitude: bulkRequest.longitude,
                status: vendorInfo.status === 'pickup_started' ? 3 : 
                        vendorInfo.status === 'arrived' ? 4 : 
                        vendorInfo.status === 'completed' ? 5 : 2,
                bulk_request_id: bulkRequest.id,
                bulk_request_bidding_price: vendorInfo.bidding_price,
                bulk_request_committed_quantity: vendorInfo.committed_quantity,
              };
              setOrderData(mockOrder as ActivePickup);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching order data:', error);
      } finally {
        setLoadingOrder(false);
      }
    };

    if (orderId && userData) {
      fetchOrderData();
    } else if (bulkRequest && userData) {
      // If we have bulk request, find the vendor's order
      const vendorInfo = bulkRequest.accepted_vendors?.find((v: any) => v.user_id === userData.id);
      if (vendorInfo?.order_id || vendorInfo?.order_number) {
        const oId = vendorInfo.order_id || vendorInfo.order_number;
        fetchOrderData();
      }
    }
  }, [orderId, bulkRequest, userData]);

  // Helper function to get buyer live location from Redis
  const getBuyerLocationFromRedis = async (bulkRequestId: number): Promise<{ latitude: number; longitude: number; timestamp: string } | null> => {
    try {
      if (!REDIS_CONFIG.REDIS_URL || !REDIS_CONFIG.REDIS_TOKEN) {
        console.warn('⚠️ Redis credentials not configured');
        return null;
      }

      const orderLocationKey = `location:order:${bulkRequestId}`;
      const redisUrl = REDIS_CONFIG.REDIS_URL.replace(/\/$/, '');

      const response = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REDIS_CONFIG.REDIS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['GET', orderLocationKey]),
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      
      if (result && result.result) {
        try {
          const locationData = JSON.parse(result.result);
          return {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            timestamp: locationData.timestamp
          };
        } catch (parseError) {
          console.error('❌ Error parsing location data:', parseError);
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching buyer location from Redis:', error);
      return null;
    }
  };

  // Fetch bulk request buyer location
  useEffect(() => {
    const fetchBulkRequestBuyerLocation = async () => {
      if (!bulkRequest || !userData) {
        return;
      }

      setLoadingBuyerLocation(true);
      try {
        // Use bulk request location as buyer location
        if (bulkRequest.latitude && bulkRequest.longitude) {
          const staticLocation = {
            latitude: bulkRequest.latitude,
            longitude: bulkRequest.longitude,
            location: bulkRequest.location || undefined,
            buyerName: bulkRequest.buyer_name || undefined
          };
          setBulkRequestBuyerLocation(staticLocation);

          // If pickup has started, try to get buyer's live location from Redis
          const vendorInfo = bulkRequest.accepted_vendors?.find((v: any) => v.user_id === userData.id);
          const vendorStatus = vendorInfo?.status || 'participated';
          if (vendorStatus === 'pickup_started' || vendorStatus === 'arrived' || vendorStatus === 'completed') {
            const liveLocation = await getBuyerLocationFromRedis(bulkRequest.id);
            if (liveLocation) {
              console.log('📍 Buyer live location from Redis:', liveLocation);
              setBuyerLiveLocation({
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude
              });
              setBulkRequestBuyerLocation({
                ...staticLocation,
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude
              });
            } else {
              setBuyerLiveLocation(null);
            }
          } else {
            setBuyerLiveLocation(null);
          }
        }
      } catch (error) {
        console.error('Error fetching bulk request buyer location:', error);
      } finally {
        setLoadingBuyerLocation(false);
      }
    };

    fetchBulkRequestBuyerLocation();

    // Poll buyer location from Redis every 30 seconds when pickup has started
    const vendorInfo = bulkRequest?.accepted_vendors?.find((v: any) => v.user_id === userData?.id);
    const vendorStatus = vendorInfo?.status || 'participated';
    
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    if ((vendorStatus === 'pickup_started' || vendorStatus === 'arrived' || vendorStatus === 'completed') && bulkRequest?.id) {
      pollingInterval = setInterval(async () => {
        const liveLocation = await getBuyerLocationFromRedis(bulkRequest.id);
        if (liveLocation) {
          console.log('📍 Buyer live location polled from Redis:', liveLocation);
          setBuyerLiveLocation({
            latitude: liveLocation.latitude,
            longitude: liveLocation.longitude
          });
          setBulkRequestBuyerLocation((prev) => {
            if (prev) {
              return {
                ...prev,
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude
              };
            }
            return prev;
          });
        }
      }, 30000); // Poll every 30 seconds
    }

    return () => {
      if (pollingInterval) {
        clearInterval(pollingInterval);
      }
    };
  }, [bulkRequest, userData]);

  // Determine destination: buyer location from bulk request
  const destination = useMemo(() => {
    if (bulkRequestBuyerLocation) {
      return {
        latitude: bulkRequestBuyerLocation.latitude,
        longitude: bulkRequestBuyerLocation.longitude
      };
    }
    
    return bulkRequest?.latitude && bulkRequest?.longitude
      ? { latitude: bulkRequest.latitude, longitude: bulkRequest.longitude }
      : { latitude: 9.1530, longitude: 76.7356 };
  }, [bulkRequestBuyerLocation, bulkRequest]);

  // Calculate distance
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

  const calculateEstimatedTime = (distanceKm: number): number => {
    const averageSpeed = 40; // km/h
    const timeInHours = distanceKm / averageSpeed;
    return Math.round(timeInHours * 60); // minutes
  };

  // Update distance and time when current location or destination changes
  useEffect(() => {
    if (currentLocation && destination) {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude
      );
      setCalculatedDistance(distance);
      const time = calculateEstimatedTime(distance);
      setEstimatedTime(time);
    }
  }, [currentLocation, destination]);

  // Helper function to get vendor location from Redis
  const getVendorLocationFromRedis = async (orderId: number): Promise<{ latitude: number; longitude: number; timestamp: string } | null> => {
    try {
      if (!REDIS_CONFIG.REDIS_URL || !REDIS_CONFIG.REDIS_TOKEN) {
        console.warn('⚠️ Redis credentials not configured');
        return null;
      }

      const orderLocationKey = `location:order:${orderId}`;
      const redisUrl = REDIS_CONFIG.REDIS_URL.replace(/\/$/, '');

      const response = await fetch(redisUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${REDIS_CONFIG.REDIS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(['GET', orderLocationKey]),
      });

      if (!response.ok) {
        return null;
      }

      const result = await response.json();
      
      if (result && result.result) {
        try {
          const locationData = JSON.parse(result.result);
          // Only return if this location is for the current vendor
          if (locationData.user_id === userData?.id) {
            return {
              latitude: locationData.latitude,
              longitude: locationData.longitude,
              timestamp: locationData.timestamp
            };
          }
          return null;
        } catch (parseError) {
          console.error('❌ Error parsing location data:', parseError);
          return null;
        }
      }

      return null;
    } catch (error) {
      console.error('❌ Error fetching vendor location from Redis:', error);
      return null;
    }
  };

  // Start vendor location tracking automatically when pickup has started
  useEffect(() => {
    if (!orderData || !userData || !bulkRequest) return;

    const vendorInfo = bulkRequest.accepted_vendors?.find((v: any) => v.user_id === userData.id);
    const vendorStatus = vendorInfo?.status || 'participated';
    const orderIdNum = orderData?.order_id || orderData?.order_number || orderId;

    // Start location tracking automatically when pickup has started
    if ((vendorStatus === 'pickup_started' || vendorStatus === 'arrived' || vendorStatus === 'completed') && orderIdNum && userData.user_type) {
      const userType = userData.user_type as 'R' | 'S' | 'SR' | 'D';
      if (['R', 'S', 'SR', 'D'].includes(userType)) {
        console.log(`📍 Starting automatic location tracking for vendor order ${orderIdNum}`);
        locationTrackingService.startTracking(
          parseInt(String(orderIdNum)),
          userData.id,
          userType
        );
      }
    }
  }, [orderData, userData, bulkRequest, orderId]);

  // Poll vendor location from Redis when pickup has started
  useEffect(() => {
    if (!orderData || !userData || !bulkRequest) return;

    const vendorInfo = bulkRequest.accepted_vendors?.find((v: any) => v.user_id === userData.id);
    const vendorStatus = vendorInfo?.status || 'participated';
    const orderIdNum = orderData?.order_id || orderData?.order_number || orderId;

    // Only poll if pickup has started and we have an order ID
    if ((vendorStatus === 'pickup_started' || vendorStatus === 'arrived' || vendorStatus === 'completed') && orderIdNum) {
      // Fetch initial location
      getVendorLocationFromRedis(parseInt(String(orderIdNum))).then((location) => {
        if (location) {
          setVendorLocation(location);
        }
      });

      // Poll every 30 seconds
      const pollingInterval = setInterval(async () => {
        const location = await getVendorLocationFromRedis(parseInt(String(orderIdNum)));
        if (location) {
          console.log('📍 Vendor location polled from Redis:', location);
          setVendorLocation(location);
        }
      }, 30000);

      return () => clearInterval(pollingInterval);
    }
  }, [orderData, userData, bulkRequest, orderId]);

  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

  if (loadingOrder) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <AutoText style={styles.headerTitle}>
            {t('deliveryTracking.orderTitle') || 'Bulk Request Tracking'}
          </AutoText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <AutoText style={styles.loadingText}>{t('common.loading') || 'Loading...'}</AutoText>
        </View>
      </View>
    );
  }

  if (!bulkRequest && !orderData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor={theme.background} />
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <AutoText style={styles.headerTitle}>
            {t('deliveryTracking.orderTitle') || 'Bulk Request Tracking'}
          </AutoText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <AutoText style={styles.emptyText}>
            {t('dashboard.requestNotFound') || 'Request not found'}
          </AutoText>
        </View>
      </View>
    );
  }

  const vendorInfo = bulkRequest?.accepted_vendors?.find((v: any) => v.user_id === userData?.id);
  const vendorStatus = vendorInfo?.status || orderData?.status || 2;
  const orderStatus = typeof vendorStatus === 'string' 
    ? (vendorStatus === 'pickup_started' ? 3 : vendorStatus === 'arrived' ? 4 : vendorStatus === 'completed' ? 5 : 2)
    : parseInt(String(vendorStatus || 2));

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('deliveryTracking.orderTitle') || 'Bulk Request Tracking'}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapContainer}>
          {bulkRequestBuyerLocation ? (
            <NativeMapView
              style={styles.map}
              destination={destination}
              routeProfile="driving"
              onLocationUpdate={async (location) => {
                const newLocation = {
                  latitude: location.latitude,
                  longitude: location.longitude
                };
                setCurrentLocation(newLocation);
                
                if (destination) {
                  const distance = calculateDistance(
                    newLocation.latitude,
                    newLocation.longitude,
                    destination.latitude,
                    destination.longitude
                  );
                  setCalculatedDistance(distance);
                  const time = calculateEstimatedTime(distance);
                  setEstimatedTime(time);
                }
              }}
              onMapReady={() => console.log('🗺️ Map ready (bulk request order)')}
            />
          ) : (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color={theme.primary} />
              <AutoText style={styles.mapPlaceholderText}>
                {t('common.loading') || 'Loading map...'}
              </AutoText>
            </View>
          )}
          
          {calculatedDistance !== null && (
            <View style={styles.distanceBar}>
              <View style={styles.distanceInfo}>
                <MaterialCommunityIcons
                  name="map-marker-distance"
                  size={16}
                  color={theme.primary}
                />
                <AutoText style={styles.distanceText}>
                  {calculatedDistance.toFixed(1)} km
                </AutoText>
              </View>
              <View style={styles.timeInfo}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={16}
                  color={theme.primary}
                />
                <AutoText style={styles.timeText}>
                  {estimatedTime !== null 
                    ? `${estimatedTime} ${t('common.minutes') || 'mins'}`
                    : ''}
                </AutoText>
              </View>
            </View>
          )}
        </View>

        <SectionCard style={styles.orderCard}>
          <AutoText style={styles.orderTitle}>
            {t('dashboard.orderNumber') || 'Order'}: #{orderData?.order_number || orderId || bulkRequest?.id}
          </AutoText>

          {bulkRequest?.buyer_name && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="account" size={14} color={theme.primary} />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.requestFrom') || 'Request from'}: {bulkRequest.buyer_name}
              </AutoText>
            </View>
          )}

          {bulkRequestBuyerLocation?.location && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color={theme.primary} />
              <AutoText style={styles.addressText} numberOfLines={4}>
                {bulkRequestBuyerLocation.location}
              </AutoText>
            </View>
          )}

          {/* Bidding Details Section */}
          {vendorInfo && (
            <View style={styles.biddingSection}>
              <AutoText style={styles.biddingSectionTitle}>
                {t('dashboard.biddingDetails') || 'Bidding Details'}:
              </AutoText>
              
              {vendorInfo.committed_quantity && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="weight-kilogram" size={14} color={theme.primary} />
                  <AutoText style={styles.detailText} numberOfLines={1}>
                    {t('dashboard.committedQuantity') || 'Committed Quantity'}: {vendorInfo.committed_quantity.toLocaleString('en-IN')} kg
                  </AutoText>
                </View>
              )}

              {vendorInfo.bidding_price && (
                <View style={styles.detailRow}>
                  <MaterialCommunityIcons name="tag" size={14} color={theme.primary} />
                  <AutoText style={styles.detailText} numberOfLines={1}>
                    {t('dashboard.biddingPrice') || 'Bidding Price'}: ₹{vendorInfo.bidding_price.toLocaleString('en-IN')}/kg
                  </AutoText>
                </View>
              )}

              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="file-document-outline" size={14} color={theme.primary} />
                <AutoText style={styles.detailText} numberOfLines={1}>
                  {t('dashboard.bulkRequestId') || 'Bulk Request'}: #{bulkRequest?.id}
                </AutoText>
              </View>
            </View>
          )}

        </SectionCard>
      </ScrollView>

      {/* Status Display */}
      <View style={styles.bottomRow}>
        {(() => {
          const getStatusInfo = (status: number | string) => {
            const statusNum = typeof status === 'string' 
              ? (status === 'pickup_started' ? 3 : status === 'arrived' ? 4 : status === 'completed' ? 5 : 2)
              : status;
            
            switch (statusNum) {
              case 3:
                return {
                  label: t('dashboard.statusPickupStarted') || 'Pickup Started',
                  color: theme.warning || '#FFA500',
                  icon: 'truck-delivery',
                };
              case 4:
                return {
                  label: t('dashboard.statusArrived') || 'Arrived',
                  color: theme.success || '#4CAF50',
                  icon: 'map-marker-check',
                };
              case 5:
                return {
                  label: t('orders.status.completed') || 'Completed',
                  color: theme.success || '#4CAF50',
                  icon: 'check-circle',
                };
              default:
                return {
                  label: t('dashboard.statusParticipated') || 'Participated',
                  color: theme.primary,
                  icon: 'account-check',
                };
            }
          };

          const statusInfo = getStatusInfo(orderStatus);

          return (
            <View style={styles.statusContainer}>
              <MaterialCommunityIcons name={statusInfo.icon as any} size={24} color={statusInfo.color} />
              <AutoText style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.label}
              </AutoText>
            </View>
          );
        })()}
      </View>
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
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    scrollContent: {
      paddingBottom: '12@vs',
      paddingHorizontal: 0,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '40@vs',
    },
    loadingText: {
      marginTop: '12@vs',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20@s',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '10@vs',
      textAlign: 'center',
    },
    mapContainer: {
      height: '240@vs',
      position: 'relative',
      backgroundColor: theme.background,
      marginTop: 0,
      borderRadius: '12@s',
      overflow: 'hidden',
    },
    map: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    mapPlaceholder: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.card,
    },
    mapPlaceholderText: {
      marginTop: '12@vs',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    distanceBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '14@s',
      paddingVertical: '10@vs',
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    distanceInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
    },
    timeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
    },
    orderCard: {
      marginHorizontal: '14@s',
      marginTop: '14@vs',
      marginBottom: '14@vs',
    },
    distanceText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    timeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    orderTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '6@s',
      marginBottom: '10@vs',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      flex: 1,
    },
    addressText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      flex: 1,
      lineHeight: '18@vs',
    },
    biddingSection: {
      marginTop: '16@vs',
      paddingTop: '16@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    biddingSectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    bottomRow: {
      flexDirection: 'row',
      gap: '8@s',
      paddingHorizontal: '14@s',
      paddingVertical: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '8@s',
      paddingVertical: '8@vs',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '16@s',
      textAlign: 'center',
    },
  });

export default BulkRequestTrackingScreen;

