import React, { useState, useEffect, useRef } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, Alert, Platform, Vibration, ActivityIndicator, Image, Modal, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';
import { NativeMapView, getAddressFromCoordinates } from '../../components/NativeMapView';
import { PickupRequest } from '../../services/api/v2/orders';
import { useAcceptPickupRequest } from '../../hooks/useOrders';
import { getUserData } from '../../services/auth/authService';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

interface OrderDetailsScreenProps {
  route: {
    params: {
      order: PickupRequest;
    };
  };
  navigation: any;
}

const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({ route, navigation }) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  // Get screen dimensions for image viewer (must be before styles)
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  const styles = useMemo(() => getStyles(theme, themeName, screenWidth, screenHeight), [theme, themeName, screenWidth, screenHeight]);
  const { order } = route.params;
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const queryClient = useQueryClient();
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const imageScrollViewRef = useRef<ScrollView>(null);
  
  // Track address lookup to prevent repeated calls
  const addressFetchedRef = useRef(false);
  const addressFailedRef = useRef(false);
  
  // Destination coordinates from order
  const destination = order.latitude && order.longitude 
    ? { latitude: order.latitude, longitude: order.longitude }
    : null;
  
  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Accept order mutation
  const acceptPickupMutation = useAcceptPickupRequest();

  // Handle accept order
  const handleAcceptOrder = async () => {
    if (!order || !userData?.id) return;
    
    try {
      await acceptPickupMutation.mutateAsync({
        orderId: order.order_number,
        userId: userData.id,
        userType: 'R'
      });
      
      // Show success message
      Alert.alert(
        t('dashboard.orderAccepted') || 'Order Accepted',
        t('dashboard.orderAcceptedMessage') || `Order #${order.order_number} has been accepted successfully!`,
        [
          {
            text: t('common.ok') || 'OK',
            onPress: () => {
              // Invalidate and refetch orders
              queryClient.invalidateQueries({ 
                queryKey: queryKeys.orders.availablePickupRequests(userData.id, 'R') 
              });
              queryClient.invalidateQueries({ 
                queryKey: queryKeys.orders.activePickup(userData.id, 'R') 
              });
              // Navigate back
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error accepting order:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error?.message || t('dashboard.orderAcceptError') || 'Failed to accept order. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
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
          {t('dashboard.orderDetails') || 'Order Details'}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {destination ? (
          <View style={styles.mapContainer}>
            <NativeMapView
              style={styles.map}
              destination={destination}
              routeProfile="driving"
              onLocationUpdate={async (location) => {
                setCurrentLocation({
                  latitude: location.latitude,
                  longitude: location.longitude
                });
                console.log('📍 Current location:', location);
                
                // Get and log address for debugging - only once (success or failure)
                if (!addressFetchedRef.current && !addressFailedRef.current) {
                  try {
                    const address = await getAddressFromCoordinates(location.latitude, location.longitude);
                    addressFetchedRef.current = true;
                    console.log('📍 Address:', address.address || address.formattedAddress);
                  } catch (error) {
                    addressFailedRef.current = true;
                    console.warn('⚠️ Failed to get address:', error);
                  }
                }
              }}
              onMapReady={() => {
                console.log('🗺️ Map is ready');
              }}
            />
            <View style={styles.mapFloatingButtons}>
              <TouchableOpacity 
                style={styles.floatingButton}
                onPress={() => navigation.navigate('FullscreenMap', { destination, orderId: order.order_number?.toString() })}
              >
                <MaterialCommunityIcons
                  name="fullscreen"
                  size={18}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>
            {order.distance_km !== undefined && order.distance_km !== null && (
              <View style={styles.distanceBar}>
                <AutoText style={styles.distanceText}>
                  {order.distance_km.toFixed(1)} km
                </AutoText>
                <AutoText style={styles.timeText}>
                  {Math.round(order.distance_km * 2)} mins
                </AutoText>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.noMapContainer}>
            <MaterialCommunityIcons
              name="map-marker-off"
              size={48}
              color={theme.textSecondary}
            />
            <AutoText style={styles.noMapText}>
              {t('dashboard.noLocationAvailable') || 'Location not available'}
            </AutoText>
          </View>
        )}

        <SectionCard style={styles.orderCard}>
          <AutoText style={styles.orderTitle}>
            {t('dashboard.orderNumber') || 'Order'}: #{order.order_number}
          </AutoText>
          
          {order.customer_name && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="account"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {order.customer_name}
              </AutoText>
            </View>
          )}
          
          {order.customer_phone && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="phone"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {order.customer_phone}
              </AutoText>
            </View>
          )}
          
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={14}
              color={theme.primary}
            />
            <AutoText style={styles.addressText} numberOfLines={4}>
              {order.address || t('dashboard.addressNotProvided') || 'Address not provided'}
            </AutoText>
          </View>

          {order.scrap_description && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="package-variant"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={3}>
                {order.scrap_description}
                {order.estimated_weight_kg > 0 && ` (${order.estimated_weight_kg} kg)`}
              </AutoText>
            </View>
          )}

          {order.preferred_pickup_time && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="calendar"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.today') || 'Today'}, {order.preferred_pickup_time}
              </AutoText>
            </View>
          )}

          <View style={styles.priceRow}>
            <AutoText style={styles.priceLabel}>
              {t('dashboard.estimatedPrice') || 'Estimated Price'}:
            </AutoText>
            <AutoText style={styles.price}>
              ₹{order.estimated_price?.toLocaleString('en-IN') || '0'}
            </AutoText>
          </View>

          {order.images && order.images.length > 0 && (
            <View style={styles.imagesSection}>
              <AutoText style={styles.imagesTitle} numberOfLines={1}>
                {t('dashboard.orderImages') || 'Order Images'}:
              </AutoText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
                {order.images.map((imageUrl, index) => {
                  // Filter out null/undefined/empty strings
                  if (!imageUrl) return null;
                  
                  return (
                    <TouchableOpacity
                      key={index}
                      style={styles.imageContainer}
                      onPress={() => {
                        setSelectedImageIndex(index);
                        setImageViewerVisible(true);
                      }}
                      activeOpacity={0.8}
                    >
                      {imageUrl ? (
                        <Image
                          source={{ uri: imageUrl }}
                          style={styles.orderImage}
                          resizeMode="cover"
                          onError={(error) => {
                            console.error(`Error loading image ${index}:`, error.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <View style={styles.imagePlaceholder}>
                          <MaterialCommunityIcons
                            name="image-off"
                            size={24}
                            color={theme.textSecondary}
                          />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </SectionCard>
      </ScrollView>

      {/* Only show accept button if order is not already accepted (status 1 or 2) */}
      {order.status === 1 || order.status === 2 ? (
        <View style={styles.bottomRow}>
          <GreenButton
            title={acceptPickupMutation.isPending 
              ? (t('common.loading') || 'Loading...') 
              : (t('dashboard.acceptOrder') || 'Accept Order')}
            onPress={() => {
              // Haptic feedback
              if (Platform.OS === 'ios') {
                Vibration.vibrate(10);
              } else {
                Vibration.vibrate(50);
              }
              handleAcceptOrder();
            }}
            style={styles.acceptButton}
            disabled={acceptPickupMutation.isPending}
          />
        </View>
      ) : (
        <View style={styles.bottomRow}>
          <AutoText style={styles.orderStatusText}>
            {order.status === 3 
              ? (t('dashboard.orderAccepted') || 'Order Accepted')
              : order.status === 4
              ? (t('dashboard.orderCompleted') || 'Order Completed')
              : (t('dashboard.orderStatus') || 'Order Status')}
          </AutoText>
        </View>
      )}

      {/* Image Viewer Modal */}
      <Modal
        visible={imageViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}
      >
        <View style={styles.imageViewerContainer}>
          <StatusBar
            barStyle="light-content"
            backgroundColor="rgba(0, 0, 0, 0.9)"
          />
          
          {/* Header */}
          <View style={[styles.imageViewerHeader, { paddingTop: insets.top + 10 }]}>
            <TouchableOpacity
              onPress={() => setImageViewerVisible(false)}
              style={styles.imageViewerCloseButton}
            >
              <MaterialCommunityIcons
                name="close"
                size={28}
                color="#FFFFFF"
              />
            </TouchableOpacity>
            <AutoText style={styles.imageViewerTitle}>
              {selectedImageIndex !== null && order.images
                ? `${(selectedImageIndex + 1)} / ${order.images.filter(img => img).length}`
                : ''}
            </AutoText>
            <View style={{ width: 28 }} />
          </View>

          {/* Image ScrollView */}
          {selectedImageIndex !== null && order.images && (
            <ScrollView
              ref={imageScrollViewRef}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => {
                const newIndex = Math.round(event.nativeEvent.contentOffset.x / screenWidth);
                setSelectedImageIndex(newIndex);
              }}
              style={styles.imageViewerScroll}
            >
              {order.images.filter(img => img).map((imageUrl, index) => (
                <View key={index} style={[styles.imageViewerItem, { width: screenWidth }]}>
                  <Image
                    source={{ uri: imageUrl }}
                    style={styles.imageViewerImage}
                    resizeMode="contain"
                    onError={(error) => {
                      console.error(`Error loading fullscreen image ${index}:`, error.nativeEvent.error);
                    }}
                  />
                </View>
              ))}
            </ScrollView>
          )}

          {/* Navigation Arrows */}
          {selectedImageIndex !== null && order.images && order.images.filter(img => img).length > 1 && (
            <>
              {selectedImageIndex > 0 && (
                <TouchableOpacity
                  style={[styles.imageViewerArrow, styles.imageViewerArrowLeft]}
                  onPress={() => {
                    const newIndex = selectedImageIndex - 1;
                    setSelectedImageIndex(newIndex);
                  }}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={32}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
              {selectedImageIndex < order.images.filter(img => img).length - 1 && (
                <TouchableOpacity
                  style={[styles.imageViewerArrow, styles.imageViewerArrowRight]}
                  onPress={() => {
                    const newIndex = selectedImageIndex + 1;
                    setSelectedImageIndex(newIndex);
                  }}
                >
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={32}
                    color="#FFFFFF"
                  />
                </TouchableOpacity>
              )}
            </>
          )}
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme: any, themeName?: string, screenWidth?: number, screenHeight?: number) => {
  const width = screenWidth || Dimensions.get('window').width;
  const height = screenHeight || Dimensions.get('window').height;
  
  return ScaledSheet.create({
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
    mapFloatingButtons: {
      position: 'absolute',
      right: '12@s',
      top: '12@vs',
      gap: '10@vs',
    },
    floatingButton: {
      width: '36@s',
      height: '36@s',
      borderRadius: '18@s',
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    distanceBar: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: '14@s',
      paddingVertical: '10@vs',
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    distanceText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    timeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    noMapContainer: {
      height: '200@vs',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.card,
      marginHorizontal: '14@s',
      marginTop: '14@vs',
      borderRadius: '12@s',
    },
    noMapText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    orderCard: {
      marginHorizontal: '14@s',
      marginTop: '14@vs',
      marginBottom: '14@vs',
    },
    orderTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '8@s',
      marginBottom: '12@vs',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
      flex: 1,
    },
    addressText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
      flex: 1,
      lineHeight: '20@vs',
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '8@vs',
      paddingTop: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    priceLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    price: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.primary,
    },
    imagesSection: {
      marginTop: '12@vs',
      paddingTop: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    imagesTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    imagesScroll: {
      flexDirection: 'row',
    },
    imageContainer: {
      width: '100@s',
      height: '100@s',
      borderRadius: '8@ms',
      backgroundColor: theme.background,
      marginRight: '10@s',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    orderImage: {
      width: '100%',
      height: '100%',
    },
    imagePlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    bottomRow: {
      paddingHorizontal: '14@s',
      paddingVertical: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
    },
    acceptButton: {
      width: '100%',
    },
    orderStatusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      textAlign: 'center',
      paddingVertical: '12@vs',
    },
    // Image Viewer Modal Styles
    imageViewerContainer: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.95)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerHeader: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingTop: '50@vs',
      paddingBottom: '16@vs',
      zIndex: 10,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    imageViewerCloseButton: {
      width: '40@s',
      height: '40@s',
      borderRadius: '20@s',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    imageViewerTitle: {
      fontFamily: 'Poppins-Medium',
      fontSize: '16@s',
      color: '#FFFFFF',
    },
    imageViewerScroll: {
      flex: 1,
    },
    imageViewerItem: {
      height: height,
      justifyContent: 'center',
      alignItems: 'center',
    },
    imageViewerImage: {
      width: width,
      height: height,
    },
    imageViewerArrow: {
      position: 'absolute',
      top: '50%',
      width: '50@s',
      height: '50@s',
      borderRadius: '25@s',
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10,
    },
    imageViewerArrowLeft: {
      left: '20@s',
    },
    imageViewerArrowRight: {
      right: '20@s',
    },
  });
};

export default OrderDetailsScreen;

