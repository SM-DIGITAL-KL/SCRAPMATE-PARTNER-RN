import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, Modal, Dimensions, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { ScaledSheet } from 'react-native-size-matters';
import { NativeMapView, getAddressFromCoordinates } from '../../components/NativeMapView';
import { ActivePickup, OrderItem } from '../../services/api/v2/orders';
import { useSubcategories } from '../../hooks/useCategories';
import { getUserData } from '../../services/auth/authService';
import { startPickup } from '../../services/api/v2/orders';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

const DeliveryTrackingScreen = ({ route, navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  
  // Get screen dimensions for image viewer (must be before styles)
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;
  
  const styles = useMemo(() => getStyles(theme, themeName, screenWidth, screenHeight), [theme, themeName, screenWidth, screenHeight]);
  const { orderId, order } = route.params || { orderId: 'DEL12345', order: null };
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const imageScrollViewRef = useRef<ScrollView>(null);
  const [startingPickup, setStartingPickup] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const queryClient = useQueryClient();
  
  // Track address lookup to prevent repeated calls
  const addressFetchedRef = useRef(false);
  const addressFailedRef = useRef(false);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);
  
  // Use order data if provided, otherwise use default coordinates
  const orderData = order as ActivePickup | null;
  
  // Console log order data details
  useEffect(() => {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 [DeliveryTrackingScreen] Order Data Details:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('Route params:', { orderId, order: order ? 'EXISTS' : 'NULL' });
    console.log('Order Data:', orderData);
    if (orderData) {
      console.log('  ✅ Order ID:', orderData.order_id);
      console.log('  ✅ Order Number:', orderData.order_number);
      console.log('  ✅ Customer ID:', orderData.customer_id);
      console.log('  ✅ Customer Name:', orderData.customer_name || 'NOT PROVIDED');
      console.log('  ✅ Customer Phone:', orderData.customer_phone || 'NOT PROVIDED');
      console.log('  ✅ Address:', orderData.address || 'NOT PROVIDED');
      console.log('  ✅ Latitude:', orderData.latitude);
      console.log('  ✅ Longitude:', orderData.longitude);
      console.log('  ✅ Scrap Description:', orderData.scrap_description || 'NOT PROVIDED');
      console.log('  ✅ Estimated Weight:', orderData.estimated_weight_kg, 'kg');
      console.log('  ✅ Estimated Price:', orderData.estimated_price);
      console.log('  ✅ Status:', orderData.status);
      console.log('  ✅ Preferred Pickup Time:', orderData.preferred_pickup_time || 'NOT PROVIDED');
      console.log('  ✅ Pickup Time Display:', orderData.pickup_time_display || 'NOT PROVIDED');
      console.log('  ✅ Created At:', orderData.created_at || 'NOT PROVIDED');
      console.log('  ✅ Images Count:', orderData.images?.length || 0);
      console.log('  ✅ Images:', orderData.images || []);
      console.log('  ✅ Order Details Count:', orderData.orderdetails?.length || 0);
      console.log('  ✅ Order Details:', orderData.orderdetails || []);
      if (orderData.orderdetails && orderData.orderdetails.length > 0) {
        console.log('  📋 Order Items Breakdown:');
        orderData.orderdetails.forEach((item: any, index: number) => {
          console.log(`    Item ${index + 1}:`, {
            subcategory_id: item.subcategory_id,
            category_id: item.category_id,
            name: item.name,
            category_name: item.category_name,
            material_name: item.material_name,
            quantity: item.quantity,
            qty: item.qty,
            weight: item.weight
          });
        });
      }
    } else {
      console.log('  ❌ Order Data is NULL');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  }, [orderData, orderId, order]);
  
  const destination = orderData?.latitude && orderData?.longitude
    ? { latitude: orderData.latitude, longitude: orderData.longitude }
    : { latitude: 9.1530, longitude: 76.7356 };
  
  // Calculate distance if available (default to 3.5km if not provided)
  const distanceKm = 3.5; // Default distance, can be calculated from coordinates if needed
  const estimatedTime = Math.round(distanceKm * 2);
  
  // Fetch all subcategories to get images (pass undefined to get all)
  const { data: subcategoriesData, isLoading: loadingSubcategories, error: subcategoriesError } = useSubcategories(undefined, 'b2c', true);
  
  // Parse order items and match with subcategory images
  const orderItemsWithImages = useMemo(() => {
    console.log('🔍 [DeliveryTracking] Parsing order items...');
    console.log('📦 Order data:', orderData);
    console.log('📦 Order details:', orderData?.orderdetails);
    console.log('📦 Subcategories data:', subcategoriesData);
    
    if (!orderData?.orderdetails) {
      console.log('⚠️ [DeliveryTracking] No orderdetails found');
      return [];
    }
    
    if (!subcategoriesData?.data) {
      console.log('⚠️ [DeliveryTracking] No subcategories data found');
      return [];
    }
    
    const items = orderData.orderdetails;
    console.log('📋 Order items (raw):', items);
    
    // Deduplicate items by subcategory_id to avoid showing the same item multiple times
    const uniqueItems: OrderItem[] = [];
    const seenSubcategoryIds = new Set<number | string>();
    
    items.forEach((item: OrderItem) => {
      const subcategoryId = item.subcategory_id || item.subcategoryId || item.category_id || item.categoryId;
      const key = subcategoryId ? String(subcategoryId) : null;
      
      // If we haven't seen this subcategory_id before, add it
      // If no subcategory_id, use a combination of name and other properties as key
      if (key && !seenSubcategoryIds.has(key)) {
        seenSubcategoryIds.add(key);
        uniqueItems.push(item);
      } else if (!key) {
        // For items without subcategory_id, use name as key
        const nameKey = item.name || item.category_name || item.material_name || 'unknown';
        if (!seenSubcategoryIds.has(nameKey)) {
          seenSubcategoryIds.add(nameKey);
          uniqueItems.push(item);
        }
      }
    });
    
    console.log('📋 Unique order items (after deduplication):', uniqueItems);
    console.log('📊 Original count:', items.length, '→ Unique count:', uniqueItems.length);
    
    // subcategoriesData.data is an array of Subcategory objects (SubcategoriesResponse.data: Subcategory[])
    const subcategories = Array.isArray(subcategoriesData.data) 
      ? subcategoriesData.data 
      : [];
    
    console.log('🏷️ Subcategories count:', subcategories.length);
    console.log('🏷️ Sample subcategories:', subcategories.slice(0, 3).map((s: any) => ({ id: s.id, name: s.name, image: s.image })));
    
    const mappedItems = uniqueItems.map((item: OrderItem) => {
      // Try multiple ways to get subcategory ID
      const subcategoryId = item.subcategory_id || item.subcategoryId || item.category_id || item.categoryId;
      const subcategoryIdNum = subcategoryId ? Number(subcategoryId) : null;
      
      console.log(`🔍 Looking for subcategory ID: ${subcategoryId} (as number: ${subcategoryIdNum}) in item:`, item);
      
      // Try to find subcategory with flexible matching (string vs number)
      const subcategory = subcategories.find((sub: any) => {
        const subId = Number(sub.id);
        const match = sub.id === subcategoryId || 
                     subId === subcategoryIdNum || 
                     sub.id === String(subcategoryId) ||
                     String(sub.id) === String(subcategoryId);
        
        if (match) {
          console.log(`✅ Found subcategory match:`, { 
            id: sub.id, 
            name: sub.name, 
            image: sub.image,
            matchedWith: subcategoryId
          });
        }
        return match;
      });
      
      if (!subcategory && subcategoryId) {
        console.log(`❌ No subcategory found for ID: ${subcategoryId}`);
        console.log(`   Available subcategory IDs:`, subcategories.slice(0, 5).map((s: any) => s.id));
      }
      
      return {
        ...item,
        subcategoryImage: subcategory?.image || null,
        subcategoryName: subcategory?.name || item.name || item.category_name || item.material_name || 'Unknown',
        quantity: item.quantity || item.qty || 0,
        weight: item.weight || 0
      };
    });
    
    console.log('✅ Mapped items with images:', mappedItems.map((item: any) => ({ 
      name: item.subcategoryName, 
      image: item.subcategoryImage ? 'YES' : 'NO',
      subcategoryId: item.subcategory_id || item.category_id
    })));
    
    return mappedItems;
  }, [orderData?.orderdetails, subcategoriesData?.data]);
  
  // Scroll to selected image when index changes
  useEffect(() => {
    if (imageViewerVisible && selectedImageIndex !== null && imageScrollViewRef.current) {
      imageScrollViewRef.current.scrollTo({
        x: selectedImageIndex * screenWidth,
        animated: true
      });
    }
  }, [selectedImageIndex, imageViewerVisible, screenWidth]);
  
  // Log destination to verify it's passed correctly
  useEffect(() => {
    console.log('🎯 DeliveryTrackingScreen - Destination:', destination);
    console.log('🎯 DeliveryTrackingScreen - Order data:', orderData);
    console.log('🏷️ Subcategories loading:', loadingSubcategories);
    console.log('🏷️ Subcategories error:', subcategoriesError);
    console.log('🏷️ Subcategories data:', subcategoriesData);
  }, [destination, orderData, loadingSubcategories, subcategoriesError, subcategoriesData]);

  // Handle start pickup
  const handleStartPickup = async () => {
    if (!orderData || !userData) {
      Alert.alert(
        t('common.error') || 'Error',
        t('orders.missingData') || 'Order or user data is missing'
      );
      return;
    }

    const userType = userData.user_type;
    if (!userType || !['R', 'S', 'SR', 'D'].includes(userType)) {
      Alert.alert(
        t('common.error') || 'Error',
        t('orders.invalidUserType') || 'Invalid user type'
      );
      return;
    }

    try {
      setStartingPickup(true);
      
      const result = await startPickup(
        orderData.order_id || orderData.order_number || orderId,
        userData.id,
        userType as 'R' | 'S' | 'SR' | 'D'
      );

      // Invalidate and refetch active pickup
      await queryClient.invalidateQueries({
        queryKey: queryKeys.orders.activePickup(userData.id, userType as 'R' | 'S' | 'SR' | 'D')
      });

      Alert.alert(
        t('orders.pickupStarted') || 'Pickup Started',
        t('orders.pickupStartedMessage') || 'Pickup has been started successfully',
        [
          {
            text: t('common.ok') || 'OK',
            onPress: () => {
              // Optionally navigate back or refresh
              navigation.goBack();
            }
          }
        ]
      );
    } catch (error: any) {
      console.error('Error starting pickup:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error.message || t('orders.failedToStartPickup') || 'Failed to start pickup'
      );
    } finally {
      setStartingPickup(false);
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
          {t('deliveryTracking.orderTitle')}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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
                  console.log('📍 Address Details:', {
                    houseNumber: address.houseNumber,
                    road: address.road,
                    neighborhood: address.neighborhood,
                    suburb: address.suburb,
                    city: address.city,
                    state: address.state,
                    postcode: address.postcode,
                    country: address.country,
                    formattedAddress: address.formattedAddress
                  });
                } catch (error) {
                  addressFailedRef.current = true;
                  console.warn('⚠️ Failed to get address:', error);
                }
              }
              
              // Log destination and route info
              console.log('🎯 Destination:', destination);
              console.log('🗺️ Route will be drawn from current location to destination');
            }}
            onMapReady={() => {
              console.log('🗺️ Map is ready');
            }}
          />
          <View style={styles.mapFloatingButtons}>
            <TouchableOpacity 
              style={styles.floatingButton}
              onPress={() => navigation.navigate('FullscreenMap', { destination, orderId })}
            >
              <MaterialCommunityIcons
                name="fullscreen"
                size={18}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.floatingButton}>
              <MaterialCommunityIcons
                name="phone"
                size={16}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.floatingButton}>
              <MaterialCommunityIcons
                name="message-text"
                size={16}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {orderData && (
          <View style={styles.distanceBar}>
            <AutoText style={styles.distanceText}>
              {distanceKm.toFixed(1)} km
            </AutoText>
            <AutoText style={styles.timeText}>
              {estimatedTime} mins
            </AutoText>
          </View>
        )}

        <SectionCard style={styles.orderCard}>
          <AutoText style={styles.orderTitle}>
            {t('dashboard.orderNumber') || 'Order'}: #{orderData?.order_number || orderId}
          </AutoText>
          
          {orderData?.customer_name && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="account"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {orderData.customer_name}
              </AutoText>
            </View>
          )}
          
          {orderData?.customer_phone && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="phone"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {orderData.customer_phone}
              </AutoText>
            </View>
          )}
          
          {orderData?.address && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.addressText} numberOfLines={4}>
                {orderData.address}
              </AutoText>
            </View>
          )}
          
          {(orderItemsWithImages.length > 0 || orderData?.scrap_description) && (
            <View style={styles.itemsSection}>
              <AutoText style={styles.itemsTitle} numberOfLines={1}>
                {t('deliveryTracking.itemsForPickup') || 'Items for Pickup'}:
              </AutoText>
              
              {orderItemsWithImages.length > 0 ? (
                // Display items with images
                orderItemsWithImages.map((item: any, index: number) => (
                  <View key={index} style={styles.itemRow}>
                    {/* Subcategory Image */}
                    <View style={styles.itemImageContainer}>
                      {item.subcategoryImage ? (
                        <Image
                          source={{ uri: item.subcategoryImage }}
                          style={styles.itemImage}
                          resizeMode="cover"
                          onError={(error: any) => {
                            console.error(`Error loading subcategory image for item ${index}:`, error.nativeEvent.error);
                          }}
                        />
                      ) : (
                        <View style={styles.itemImagePlaceholder}>
                          <MaterialCommunityIcons
                            name="image-off"
                            size={20}
                            color={theme.textSecondary}
                          />
                        </View>
                      )}
                    </View>
                    
                    {/* Item Details */}
                    <View style={styles.itemDetails}>
                      <AutoText style={styles.itemName} numberOfLines={1}>
                        {item.subcategoryName}
                      </AutoText>
                      {(item.quantity > 0 || item.weight > 0) && (
                        <AutoText style={styles.itemQuantity} numberOfLines={1}>
                          {item.quantity > 0 && `${item.quantity} ${item.weight > 0 ? '× ' : ''}`}
                          {item.weight > 0 && `${item.weight} kg`}
                        </AutoText>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                // Fallback to scrap_description if no items parsed
                <>
                  <AutoText style={styles.itemText} numberOfLines={3}>
                    {orderData.scrap_description}
                    {orderData.estimated_weight_kg > 0 && ` (${orderData.estimated_weight_kg} kg)`}
                  </AutoText>
                  {orderData?.orderdetails && (
                    <AutoText style={styles.debugText} numberOfLines={1}>
                      Debug: orderdetails exists but not parsed. Count: {Array.isArray(orderData.orderdetails) ? orderData.orderdetails.length : 'N/A'}
                    </AutoText>
                  )}
                  {loadingSubcategories && (
                    <AutoText style={styles.debugText} numberOfLines={1}>
                      Debug: Loading subcategories...
                    </AutoText>
                  )}
                  {!loadingSubcategories && !subcategoriesData?.data && (
                    <AutoText style={styles.debugText} numberOfLines={1}>
                      Debug: Subcategories not loaded. Error: {subcategoriesError ? 'Yes' : 'No'}
                    </AutoText>
                  )}
                </>
              )}
            </View>
          )}
          
          {orderData?.preferred_pickup_time && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="calendar"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.today') || 'Today'}, {orderData.preferred_pickup_time}
              </AutoText>
            </View>
          )}
          
          {orderData?.estimated_price && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.estimatedPrice') || 'Estimated Price'}: ₹{orderData.estimated_price.toLocaleString('en-IN')}
              </AutoText>
            </View>
          )}
          
          {orderData?.images && orderData.images.length > 0 && (
            <View style={styles.imagesSection}>
              <AutoText style={styles.imagesTitle} numberOfLines={1}>
                {t('dashboard.orderImages') || 'Order Images'}:
              </AutoText>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
                {orderData.images.map((imageUrl, index) => {
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

      <View style={styles.bottomRow}>
        <GreenButton
          title={t('deliveryTracking.assignDeliveryPartner')}
          onPress={() =>
            navigation.navigate('AssignPartner', { orderId })
          }
          style={styles.assignButton}
        />
        <TouchableOpacity
          style={[styles.pickupButton, startingPickup && styles.pickupButtonDisabled]}
          onPress={handleStartPickup}
          activeOpacity={0.7}
          disabled={startingPickup || !orderData || !userData}
        >
          {startingPickup ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <AutoText style={styles.pickupButtonText} numberOfLines={1}>
              {t('deliveryTracking.myselfPickup')}
            </AutoText>
          )}
        </TouchableOpacity>
      </View>

      {/* Image Viewer Modal */}
      {orderData?.images && orderData.images.length > 0 && (
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
                {selectedImageIndex !== null && orderData.images
                  ? `${(selectedImageIndex + 1)} / ${orderData.images.filter(img => img).length}`
                  : ''}
              </AutoText>
              <View style={{ width: 28 }} />
            </View>

            {/* Image ScrollView */}
            {selectedImageIndex !== null && orderData.images && (
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
                {orderData.images.filter(img => img).map((imageUrl, index) => (
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
            {selectedImageIndex !== null && orderData.images && orderData.images.filter(img => img).length > 1 && (
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
                {selectedImageIndex < orderData.images.filter(img => img).length - 1 && (
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
      )}
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
    mapPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    mapPinContainer: {
      alignItems: 'center',
      justifyContent: 'center',
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
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: '14@s',
      paddingVertical: '10@vs',
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    orderCard: {
      marginHorizontal: '14@s',
      marginTop: '14@vs',
      marginBottom: '14@vs',
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
    itemsSection: {
      marginTop: '10@vs',
    },
    itemsTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    itemRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '10@vs',
      gap: '10@s',
    },
    itemImageContainer: {
      width: '50@s',
      height: '50@s',
      borderRadius: '8@ms',
      backgroundColor: theme.background,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.border,
    },
    itemImage: {
      width: '100%',
      height: '100%',
    },
    itemImagePlaceholder: {
      width: '100%',
      height: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    itemDetails: {
      flex: 1,
    },
    itemName: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
      marginBottom: '2@vs',
    },
    itemQuantity: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
    },
    itemText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '3@vs',
    },
    debugText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    bottomRow: {
      flexDirection: 'row',
      gap: '8@s',
      paddingHorizontal: '14@s',
      paddingVertical: '8@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    assignButton: {
      flex: 1,
    },
    pickupButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '10@vs',
      borderRadius: '10@ms',
      borderColor: theme.primary,
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    pickupButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
      textAlign: 'center',
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

export default DeliveryTrackingScreen;

