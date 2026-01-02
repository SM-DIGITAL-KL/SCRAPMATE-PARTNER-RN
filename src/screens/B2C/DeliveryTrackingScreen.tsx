import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, Modal, Dimensions, ActivityIndicator, Alert, TextInput, Linking } from 'react-native';
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
import { startPickup, arrivedLocation, completePickup } from '../../services/api/v2/orders';
import { useProfile } from '../../hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';
import { locationTrackingService } from '../../services/location/locationTrackingService';
import { BulkScrapRequest, getBulkScrapRequests, getAcceptedBulkScrapRequests } from '../../services/api/v2/bulkScrap';
import { getLocationByOrder } from '../../services/api/v2/location';
import { getProfile } from '../../services/api/v2/profile';
import { BulkRequestMapView } from '../../components/BulkRequestMapView';
import { getActivePickup } from '../../services/api/v2/orders';
import { REDIS_CONFIG } from '../../config/redisConfig';


const PaymentSection = React.memo(({
  orderData,
  orderItemsWithImages,
  paymentDetails,
  updatePaymentDetail,
  totalAmount,
  t,
  theme,
  styles
}: any) => {
  // Safety check for order status
  const status = parseInt(String(orderData?.status || 0));
  if (!orderData || status < 4) return null;

  // Safety check for items
  if (!Array.isArray(orderItemsWithImages) || orderItemsWithImages.length === 0) return null;

  try {
    return (
      <View style={styles.paymentSection}>
        <AutoText style={styles.paymentSectionTitle} numberOfLines={1}>
          {t('deliveryTracking.paymentDetails') || 'Payment Details'}:
        </AutoText>

        {orderItemsWithImages.map((item: any, index: number) => {
          if (!item) return null;
          const key = item.itemKey || String(index);
          const detail = (paymentDetails && paymentDetails[key]) ? paymentDetails[key] : { weight: '', amount: '' };

          return (
            <View key={`payment-${key}`} style={styles.paymentItemRow}>
              <View style={styles.paymentItemInfo}>
                <AutoText style={styles.paymentItemName} numberOfLines={1}>
                  {item.subcategoryName || 'Unknown'}
                </AutoText>
              </View>

              <View style={styles.paymentInputsRow}>
                <View style={styles.paymentInputContainer}>
                  <AutoText style={styles.paymentInputLabel}>
                    {t('deliveryTracking.weight') || 'Weight (kg)'}
                  </AutoText>
                  <TextInput
                    style={[styles.paymentInput, { borderColor: theme.border, color: theme.textPrimary }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    value={String(detail.weight || '')}
                    onChangeText={(v) => updatePaymentDetail(key, 'weight', v)}
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.paymentInputContainer}>
                  <AutoText style={styles.paymentInputLabel}>
                    {t('deliveryTracking.amount') || 'Amount (₹)'}
                  </AutoText>
                  <TextInput
                    style={[styles.paymentInput, { borderColor: theme.border, color: theme.textPrimary }]}
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    value={String(detail.amount || '')}
                    onChangeText={(v) => updatePaymentDetail(key, 'amount', v)}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>
            </View>
          );
        })}

        <View style={styles.paymentTotalRow}>
          <AutoText style={styles.paymentTotalLabel}>
            {t('deliveryTracking.totalAmount') || 'Total Amount'}:
          </AutoText>
          <AutoText style={styles.paymentTotalAmount}>
            ₹{(typeof totalAmount === 'number' ? totalAmount : 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </AutoText>
        </View>
      </View>
    );
  } catch (error) {
    console.error('Error rendering PaymentSection:', error);
    return null;
  }
});

const DeliveryTrackingScreen = ({ route, navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  // Helper function to get order status text
  const getOrderStatusText = (status: number): string => {
    switch (status) {
      case 0:
        return t('orders.status.pending') || 'Pending';
      case 1:
        return t('orders.status.accepted') || 'Accepted';
      case 2:
        return t('orders.status.accepted') || 'Accepted';
      case 3:
        return t('orders.status.pickupInitiated') || 'Pickup Initiated';
      case 4:
        return t('orders.status.arrived') || 'Arrived Location';
      case 5:
        return t('orders.status.completed') || 'Completed';
      default:
        return t('orders.status.unknown') || 'Unknown';
    }
  };

  // Get screen dimensions for image viewer (must be before styles)
  const screenWidth = Dimensions.get('window').width;
  const screenHeight = Dimensions.get('window').height;

  const styles = useMemo(() => getStyles(theme, themeName, screenWidth, screenHeight), [theme, themeName, screenWidth, screenHeight]);
  const { orderId, order, bulkRequest } = route.params || { orderId: 'DEL12345', order: null, bulkRequest: null };
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // State for bulk request vendor locations (for B2B buyers viewing bulk request details)
  const [bulkVendorLocations, setBulkVendorLocations] = useState<any[]>([]);
  const [loadingVendorLocations, setLoadingVendorLocations] = useState(false);
  
  // State for bulk request buyer location (for participating vendors viewing their order)
  const [bulkRequestBuyerLocation, setBulkRequestBuyerLocation] = useState<{
    latitude: number;
    longitude: number;
    location?: string;
    buyerName?: string;
  } | null>(null);
  const [buyerLiveLocation, setBuyerLiveLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loadingBuyerLocation, setLoadingBuyerLocation] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const imageScrollViewRef = useRef<ScrollView>(null);
  const [startingPickup, setStartingPickup] = useState(false);
  const [markingArrived, setMarkingArrived] = useState(false);
  const [completingPickup, setCompletingPickup] = useState(false);
  const [showStartPickupModal, setShowStartPickupModal] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const queryClient = useQueryClient();

  // Payment details state: { key: { weight: string, amount: string } }
  const [paymentDetails, setPaymentDetails] = useState<Record<string, { weight: string; amount: string }>>({});

  // Track address lookup to prevent repeated calls
  const addressFetchedRef = useRef(false);
  const addressFailedRef = useRef(false);

  // Use order data if provided, otherwise use default coordinates
  const orderData = order as ActivePickup | null;

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
    
    // For R type users, require explicit subscription confirmation
    return b2cShop.is_subscribed === true;
  }, [profileData, userData?.user_type]);

  // Helper function to get buyer live location from Redis
  const getBuyerLocationFromRedis = async (bulkRequestId: number): Promise<{ latitude: number; longitude: number; timestamp: string } | null> => {
    try {
      if (!REDIS_CONFIG.REDIS_URL || !REDIS_CONFIG.REDIS_TOKEN) {
        console.warn('⚠️ Redis credentials not configured');
        return null;
      }

      // Use bulk request ID as order ID for Redis key (same pattern used in locationTrackingService)
      const orderLocationKey = `location:order:${bulkRequestId}`;
      const redisUrl = REDIS_CONFIG.REDIS_URL.replace(/\/$/, '');

      // Upstash Redis REST API: GET command
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

  // Fetch bulk request buyer location (for participating vendors)
  useEffect(() => {
    const fetchBulkRequestBuyerLocation = async () => {
      if (!orderData || !userData) {
        return;
      }

      const orderDataAny = orderData as any;
      const bulkRequestId = orderDataAny?.bulk_request_id;
      
      if (!bulkRequestId) {
        return; // Not a bulk request order
      }

      setLoadingBuyerLocation(true);
      try {
        // Fetch bulk request details to get buyer static location
        // Try to get from accepted requests first (faster)
        const acceptedRequests = await getAcceptedBulkScrapRequests(
          userData.id,
          undefined,
          undefined,
          userData.user_type || 'R'
        );
        
        let foundRequest = acceptedRequests.find((req: BulkScrapRequest) => req.id === parseInt(String(bulkRequestId)));
        
        // If not found in accepted requests, try all requests
        if (!foundRequest) {
          const allRequests = await getBulkScrapRequests(
            userData.id,
            undefined,
            undefined,
            userData.user_type || 'R'
          );
          foundRequest = allRequests.find((req: BulkScrapRequest) => req.id === parseInt(String(bulkRequestId)));
        }

        if (foundRequest && foundRequest.latitude && foundRequest.longitude) {
          // Get buyer's static location from request
          const staticLocation = {
            latitude: foundRequest.latitude,
            longitude: foundRequest.longitude,
            location: foundRequest.location || undefined,
            buyerName: foundRequest.buyer_name || undefined
          };
          setBulkRequestBuyerLocation(staticLocation);

          // If pickup has started (status >= 3), try to get buyer's live tracking location from Redis
          const orderStatus = parseInt(String(orderData.status || 0));
          if (orderStatus >= 3) {
            // Try to get buyer's live location from Redis
            const liveLocation = await getBuyerLocationFromRedis(parseInt(String(bulkRequestId)));
            if (liveLocation) {
              console.log('📍 Buyer live location from Redis:', liveLocation);
              setBuyerLiveLocation({
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude
              });
              // Update bulkRequestBuyerLocation to use live location
              setBulkRequestBuyerLocation({
                ...staticLocation,
                latitude: liveLocation.latitude,
                longitude: liveLocation.longitude
              });
            } else {
              // No live location found, use static location
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
    const orderStatus = orderData ? parseInt(String(orderData.status || 0)) : 0;
    const orderDataAny = orderData as any;
    const bulkRequestId = orderDataAny?.bulk_request_id;
    
    let pollingInterval: ReturnType<typeof setInterval> | null = null;
    if (orderStatus >= 3 && bulkRequestId) {
      // Poll Redis for buyer's live location every 30 seconds
      pollingInterval = setInterval(async () => {
        const liveLocation = await getBuyerLocationFromRedis(parseInt(String(bulkRequestId)));
        if (liveLocation) {
          console.log('📍 Buyer live location polled from Redis:', liveLocation);
          setBuyerLiveLocation({
            latitude: liveLocation.latitude,
            longitude: liveLocation.longitude
          });
          // Update bulkRequestBuyerLocation to use live location
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
  }, [orderData, userData]);

  // Fetch vendor locations for bulk request (for B2B buyers viewing bulk request details)
  useEffect(() => {
    const fetchBulkVendorLocations = async () => {
      if (!bulkRequest || !bulkRequest.accepted_vendors || bulkRequest.accepted_vendors.length === 0) {
        return;
      }

      setLoadingVendorLocations(true);
      try {
        const vendorsWithLocations = await Promise.all(
          bulkRequest.accepted_vendors.map(async (vendor: any) => {
            try {
              // Get vendor profile for shop location
              const profile = await getProfile(vendor.user_id);
              const shopData = profile?.shop || profile?.b2cShop || profile?.b2bShop;
              
              let shopLatitude: number | undefined;
              let shopLongitude: number | undefined;
              
              if (shopData?.lat_log) {
                const [lat, lng] = shopData.lat_log.split(',').map(Number);
                if (!isNaN(lat) && !isNaN(lng)) {
                  shopLatitude = lat;
                  shopLongitude = lng;
                }
              }

              // Check if vendor has started pickup (status >= 'pickup_started')
              let liveLocation: { latitude: number; longitude: number } | null = null;
              if (vendor.status && (vendor.status === 'pickup_started' || vendor.status === 'arrived' || vendor.status === 'completed')) {
                // Try to get order for this vendor
                if (vendor.order_id || vendor.order_number) {
                  const orderId = vendor.order_id || vendor.order_number;
                  const locationData = await getLocationByOrder(orderId);
                  if (locationData?.vendor) {
                    liveLocation = {
                      latitude: locationData.vendor.latitude,
                      longitude: locationData.vendor.longitude
                    };
                  }
                }
              }

              return {
                user_id: vendor.user_id,
                user_type: vendor.user_type,
                shop_id: vendor.shop_id,
                committed_quantity: vendor.committed_quantity,
                bidding_price: vendor.bidding_price,
                status: vendor.status || 'participated',
                shopname: shopData?.shopname || `Vendor ${vendor.user_id}`,
                address: shopData?.address || undefined,
                shopLatitude,
                shopLongitude,
                liveLocation, // Live tracking location if pickup started
                order_id: vendor.order_id,
                order_number: vendor.order_number
              };
            } catch (error) {
              console.error(`Error fetching location for vendor ${vendor.user_id}:`, error);
              return {
                user_id: vendor.user_id,
                user_type: vendor.user_type,
                shop_id: vendor.shop_id,
                committed_quantity: vendor.committed_quantity,
                bidding_price: vendor.bidding_price,
                status: vendor.status || 'participated',
                order_id: vendor.order_id,
                order_number: vendor.order_number
              };
            }
          })
        );

        setBulkVendorLocations(vendorsWithLocations);
      } catch (error) {
        console.error('Error fetching bulk vendor locations:', error);
      } finally {
        setLoadingVendorLocations(false);
      }
    };

    fetchBulkVendorLocations();

    // Refresh vendor locations every 30 seconds if bulk request is provided
    const interval = setInterval(() => {
      if (bulkRequest) {
        fetchBulkVendorLocations();
      }
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [bulkRequest]);

  // Debug: Log order data to see what fields are available
  useEffect(() => {
    if (orderData) {
      console.log('📦 [DeliveryTracking] Order data received:', {
        order_id: orderData.order_id,
        order_number: orderData.order_number,
        customer_name: orderData.customer_name,
        customer_phone: orderData.customer_phone,
        customerName: (orderData as any).customerName,
        customerPhone: (orderData as any).customerPhone,
        customer: (orderData as any).customer,
        address: orderData.address,
        customerdetails: (orderData as any).customerdetails,
        allKeys: Object.keys(orderData),
      });
    } else {
      console.log('⚠️ [DeliveryTracking] No order data provided');
    }
  }, [orderData]);

  // Determine destination: For bulk request orders, use buyer location; otherwise use order destination
  const destination = useMemo(() => {
    // If this is a bulk request order and we have buyer location, use that
    if (bulkRequestBuyerLocation) {
      return {
        latitude: bulkRequestBuyerLocation.latitude,
        longitude: bulkRequestBuyerLocation.longitude
      };
    }
    
    // Otherwise use order destination
    return orderData?.latitude && orderData?.longitude
      ? { latitude: orderData.latitude, longitude: orderData.longitude }
      : { latitude: 9.1530, longitude: 76.7356 };
  }, [bulkRequestBuyerLocation, orderData]);

  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  
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
    return R * c; // Distance in km
  };
  
  // Calculate estimated travel time based on distance and route profile
  const calculateEstimatedTime = (distanceKm: number, routeProfile: 'driving' | 'cycling' | 'walking' = 'driving'): number => {
    // Average speeds in km/h
    const averageSpeeds = {
      driving: 40, // Average city driving speed (can vary from 30-60 km/h)
      cycling: 15,
      walking: 5
    };
    
    const speed = averageSpeeds[routeProfile];
    const timeInHours = distanceKm / speed;
    return Math.round(timeInHours * 60); // Convert to minutes
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
      
      const time = calculateEstimatedTime(distance, 'driving');
      setEstimatedTime(time);
      console.log('📍 [DeliveryTracking] Calculated distance:', distance.toFixed(1), 'km, Time:', time, 'mins');
    }
  }, [currentLocation, destination]);
  
  // Initialize with fallback distance if available (only once)
  useEffect(() => {
    if (calculatedDistance === null && destination && orderData) {
      // Check if orderData has distance_km property
      const orderWithDistance = orderData as any;
      if (orderWithDistance.distance_km !== undefined && orderWithDistance.distance_km !== null) {
        const fallbackDistance = orderWithDistance.distance_km;
        setCalculatedDistance(fallbackDistance);
        setEstimatedTime(calculateEstimatedTime(fallbackDistance, 'driving'));
        console.log('📍 [DeliveryTracking] Using order distance as initial value:', fallbackDistance.toFixed(1), 'km');
      }
    }
  }, [destination, orderData]);

  // Fetch all subcategories to get images (pass undefined to get all)
  const { data: subcategoriesData, isLoading: loadingSubcategories, error: subcategoriesError } = useSubcategories(undefined, 'b2c', true);

  // Parse order items and match with subcategory images
  const orderItemsWithImages = useMemo(() => {
    console.log('🔍 [DeliveryTracking] Parsing order items...');

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

    // Deduplicate items
    const uniqueItems: OrderItem[] = [];
    const seenKeys = new Set<string>();

    items.forEach((item: OrderItem) => {
      const materialName = item.material_name || item.name || item.category_name || '';
      const categoryId = item.category_id || item.categoryId || '';
      const key = `${materialName}-${categoryId}`;

      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        uniqueItems.push(item);
      }
    });

    console.log('📋 Unique order items:', uniqueItems.length);

    const subcategories = Array.isArray(subcategoriesData.data) ? subcategoriesData.data : [];

    const mappedItems = uniqueItems.map((item: OrderItem, index: number) => {
      try {
        const materialName = item.material_name || item.name || item.category_name || '';

        // Try to find subcategory by name matching
        const subcategory = subcategories.find((sub: any) => {
          const subName = (sub.name || '').toLowerCase().trim();
          const itemName = materialName.toLowerCase().trim();
          return subName === itemName || subName.includes(itemName) || itemName.includes(subName);
        });

        const weight = item.expected_weight_kg || item.weight || 0;
        const quantity = item.quantity || item.qty || 0;
        const pricePerKg = item.price_per_kg || 0;

        // IMPORTANT: Use category_id as the key for consistency
        const itemKey = String(item.category_id || item.categoryId || index);

        console.log(`✅ Mapped item ${index}: ${materialName} with key: ${itemKey}`);

        return {
          ...item,
          itemKey: itemKey, // Store the key we'll use
          subcategoryImage: subcategory?.image || null,
          subcategoryName: subcategory?.name || materialName || 'Unknown',
          quantity: quantity,
          weight: weight,
          price_per_kg: pricePerKg
        };
      } catch (error) {
        console.error('Error processing item:', error);
        return {
          ...item,
          itemKey: String(index),
          subcategoryImage: null,
          subcategoryName: item.material_name || 'Unknown',
          quantity: 0,
          weight: item.expected_weight_kg || 0,
          price_per_kg: item.price_per_kg || 0
        };
      }
    });

    console.log('✅ Mapped items count:', mappedItems.length);
    return mappedItems;
  }, [orderData?.orderdetails, subcategoriesData?.data]);

  // Initialize payment details
  useEffect(() => {
    if (!orderItemsWithImages || orderItemsWithImages.length === 0) {
      return;
    }

    setPaymentDetails(prev => {
      // Only initialize if empty
      if (Object.keys(prev).length > 0) {
        return prev;
      }

      const orderStatus = orderData ? parseInt(String(orderData.status || 0)) : 0;
      const isCompleted = orderStatus === 5;

      const initialDetails: Record<string, { weight: string; amount: string }> = {};

      orderItemsWithImages.forEach((item: any) => {
        const key = item.itemKey || '0';
        
        // For completed orders, use actual_weight and actual_amount from orderdetails
        if (isCompleted && orderData?.orderdetails) {
          try {
            const orderDetails = Array.isArray(orderData.orderdetails) 
              ? orderData.orderdetails 
              : typeof orderData.orderdetails === 'string' 
                ? JSON.parse(orderData.orderdetails) 
                : [];
            
            const orderItem = orderDetails.find((od: any) => {
              const odCategoryId = od.category_id ? String(od.category_id) : null;
              const odSubcategoryId = od.subcategory_id ? String(od.subcategory_id) : null;
              const itemCategoryId = item.category_id ? String(item.category_id) : null;
              const itemSubcategoryId = item.subcategory_id ? String(item.subcategory_id) : null;
              
              return (odCategoryId && odCategoryId === itemCategoryId) ||
                     (odSubcategoryId && odSubcategoryId === itemSubcategoryId) ||
                     (odCategoryId && odCategoryId === itemSubcategoryId) ||
                     (odSubcategoryId && odSubcategoryId === itemCategoryId);
            });

            if (orderItem) {
              initialDetails[key] = {
                weight: String(orderItem.actual_weight || orderItem.weight || ''),
                amount: String(orderItem.actual_amount || orderItem.amount || '')
              };
              console.log(`💰 Init payment from completed order [${key}]: ${item.subcategoryName} - ${orderItem.actual_weight}kg = ₹${orderItem.actual_amount}`);
              return;
            }
          } catch (error) {
            console.error('Error parsing orderdetails for completed order:', error);
          }
        }
        
        // For active orders, calculate from weight and price_per_kg
        const weight = item.weight || 0;
        const pricePerKg = item.price_per_kg || 0;
        const amount = weight && pricePerKg ? (weight * pricePerKg).toFixed(2) : '';

        initialDetails[key] = {
          weight: String(weight || ''),
          amount: String(amount || '')
        };

        console.log(`💰 Init payment [${key}]: ${item.subcategoryName} - ${weight}kg × ₹${pricePerKg} = ₹${amount}`);
      });

      console.log('💰 Payment details initialized:', initialDetails);
      return initialDetails;
    });
  }, [orderItemsWithImages, orderData]);

  // Calculate total
  const totalAmount = useMemo(() => {
    let total = 0;
    Object.values(paymentDetails || {}).forEach(detail => {
      const amount = parseFloat(detail?.amount || '0');
      if (!isNaN(amount)) {
        total += amount;
      }
    });
    return total;
  }, [paymentDetails]);

  // Note: We do NOT stop tracking on component unmount
  // Location tracking should continue across all screens until order status is 5 (completed)
  // This allows tracking to work even when user navigates to other screens

  // Stop tracking only when order status is 5 (completed)
  useEffect(() => {
    const orderStatus = orderData ? parseInt(String(orderData.status || 0)) : 0;
    const currentOrderId = orderData?.order_id || orderData?.id;
    
    // Only stop tracking when order is completed (status 5)
    if (locationTrackingService.isTracking() && orderStatus === 5) {
      const trackingOrderId = locationTrackingService.getCurrentOrderId();
      if (trackingOrderId === currentOrderId) {
        locationTrackingService.stopTracking();
        console.log(`📍 Stopped location tracking - order ${currentOrderId} is completed (status 5)`);
      }
    }
  }, [orderData?.status, orderData?.order_id, orderData?.id]);

  // Update payment detail
  const updatePaymentDetail = (key: string, field: 'weight' | 'amount', value: string) => {
    setPaymentDetails(prev => ({
      ...prev,
      [key]: {
        ...(prev[key] || { weight: '', amount: '' }),
        [field]: value
      }
    }));
  };

  // Helper function to format address (handles string, object, or JSON string)
  const formatAddress = (address: any): string => {
    if (!address) return '';
    
    try {
      // If address is already a string
      if (typeof address === 'string') {
        // Check if it's a JSON string that needs parsing
        const trimmed = address.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            const parsed = JSON.parse(address);
            if (typeof parsed === 'object' && parsed !== null) {
              // Extract address from object
              return parsed.address || 
                     parsed.formattedAddress || 
                     parsed.fullAddress || 
                     parsed.customerdetails ||
                     (parsed.name && parsed.location ? `${parsed.name}, ${parsed.location}` : '') ||
                     JSON.stringify(parsed);
            }
          } catch {
            // If JSON parsing fails, return the string as is
            return address;
          }
        }
        return address;
      }
      
      // If address is an object
      if (typeof address === 'object' && address !== null) {
        return address.address || 
               address.formattedAddress || 
               address.fullAddress || 
               address.customerdetails ||
               (address.name && address.location ? `${address.name}, ${address.location}` : '') ||
               JSON.stringify(address);
      }
      
      return String(address);
    } catch (error) {
      console.error('Error formatting address:', error);
      return String(address);
    }
  };

  // Scroll to selected image when index changes
  useEffect(() => {
    if (imageViewerVisible && selectedImageIndex !== null && imageScrollViewRef.current) {
      imageScrollViewRef.current.scrollTo({
        x: selectedImageIndex * screenWidth,
        animated: true
      });
    }
  }, [selectedImageIndex, imageViewerVisible, screenWidth]);

  // Handle start pickup confirmation
  const handleStartPickupConfirm = () => {
    setShowStartPickupModal(true);
  };

  // Handle start pickup (actual API call)
  const handleStartPickup = async () => {
    setShowStartPickupModal(false);
    
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

      const orderIdentifier = orderData?.order_id || orderData?.order_number || orderId;
      console.log('🚀 Starting pickup:', orderIdentifier);

      await startPickup(
        orderIdentifier,
        userData.id,
        userType as 'R' | 'S' | 'SR' | 'D'
      );

      // Start location tracking when pickup is initiated (status 3)
      const orderIdNum = orderData?.order_id || orderData?.id || parseInt(String(orderIdentifier));
      if (orderIdNum) {
        locationTrackingService.startTracking(
          orderIdNum,
          userData.id,
          userType as 'R' | 'S' | 'SR' | 'D'
        );
        console.log(`📍 Started location tracking for order ${orderIdNum}`);
      }

      await queryClient.invalidateQueries({
        queryKey: queryKeys.orders.activePickup(userData.id, userType as 'R' | 'S' | 'SR' | 'D')
      });

      Alert.alert(
        t('orders.pickupStarted') || 'Pickup Started',
        t('orders.pickupStartedMessage') || 'Pickup has been started successfully',
        [{ text: t('common.ok') || 'OK', onPress: () => navigation.goBack() }]
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

  // Handle arrived location
  const handleArrivedLocation = async () => {
    if (!orderData || !userData) {
      Alert.alert(t('common.error') || 'Error', t('orders.missingData') || 'Order or user data is missing');
      return;
    }

    const userType = userData.user_type;
    if (!userType || !['R', 'S', 'SR', 'D'].includes(userType)) {
      Alert.alert(t('common.error') || 'Error', t('orders.invalidUserType') || 'Invalid user type');
      return;
    }

    try {
      setMarkingArrived(true);

      const orderIdentifier = orderData?.order_id || orderData?.order_number || orderId;
      await arrivedLocation(orderIdentifier, userData.id, userType as 'R' | 'S' | 'SR' | 'D');

      await queryClient.invalidateQueries({
        queryKey: queryKeys.orders.activePickup(userData.id, userType as 'R' | 'S' | 'SR' | 'D')
      });

      Alert.alert(
        t('orders.arrivedLocation') || 'Arrived at Location',
        t('orders.arrivedLocationMessage') || 'You have arrived at the pickup location',
        [{ text: t('common.ok') || 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error('Error marking arrived:', error);
      Alert.alert(t('common.error') || 'Error', error.message || 'Failed to mark arrived location');
    } finally {
      setMarkingArrived(false);
    }
  };

  // Handle complete pickup
  const handleCompletePickup = async () => {
    if (!orderData || !userData) {
      Alert.alert(t('common.error') || 'Error', t('orders.missingData') || 'Order or user data is missing');
      return;
    }

    const userType = userData.user_type;
    if (!userType || !['R', 'S', 'SR', 'D'].includes(userType)) {
      Alert.alert(t('common.error') || 'Error', t('orders.invalidUserType') || 'Invalid user type');
      return;
    }

    try {
      setCompletingPickup(true);

      const orderIdentifier = orderData?.order_id || orderData?.order_number || orderId;
      
      // Format payment details for API
      const formattedPaymentDetails: Array<{
        category_id?: number | string | null;
        subcategory_id?: number | string | null;
        weight: string | number;
        amount: string | number;
      }> = orderItemsWithImages
        .map((item: any) => {
          const key = item.itemKey || String(item.category_id || item.categoryId || '');
          const detail = paymentDetails[key];
          
          if (!detail) return null;
          
          return {
            category_id: item.category_id || item.categoryId || null,
            subcategory_id: item.subcategory_id || item.subcategoryId || null,
            weight: detail.weight || '0',
            amount: detail.amount || '0',
          };
        })
        .filter((detail): detail is {
          category_id?: number | string | null;
          subcategory_id?: number | string | null;
          weight: string | number;
          amount: string | number;
        } => detail !== null);

      console.log('💰 Sending payment details:', formattedPaymentDetails);
      console.log('💰 Total amount:', totalAmount);

      await completePickup(
        orderIdentifier, 
        userData.id, 
        userType as 'R' | 'S' | 'SR' | 'D',
        formattedPaymentDetails.length > 0 ? formattedPaymentDetails : undefined
      );

      // Invalidate queries to refresh data
      await queryClient.invalidateQueries({
        queryKey: queryKeys.orders.activePickup(userData.id, userType as 'R' | 'S' | 'SR' | 'D')
      });
      
      // Invalidate recycling stats to refresh even if cache exists (to show latest completed orders data)
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recycling.stats(userData.id, 'shop')
      });
      
      // Also invalidate completed pickups to refresh the list
      await queryClient.invalidateQueries({
        queryKey: queryKeys.orders.completedPickups(userData.id, userType as 'R' | 'S' | 'SR' | 'D')
      });

      Alert.alert(
        t('orders.pickupCompleted') || 'Pickup Completed',
        t('orders.pickupCompletedMessage') || 'Pickup has been completed successfully',
        [{ text: t('common.ok') || 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error: any) {
      console.error('Error completing pickup:', error);
      Alert.alert(t('common.error') || 'Error', error.message || 'Failed to complete pickup');
    } finally {
      setCompletingPickup(false);
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
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('deliveryTracking.orderTitle')}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.scrollContent} 
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled={false}
        removeClippedSubviews={true}
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        <View style={styles.mapContainer}>
          {bulkRequest && bulkVendorLocations.length > 0 ? (
            // B2B Buyer viewing bulk request: Show all vendor locations
            (() => {
              // Create markers for bulk request
              const markers: any[] = [];
              
              // Add bulk request location marker
              if (bulkRequest.latitude && bulkRequest.longitude) {
                markers.push({
                  id: 'bulk-request',
                  latitude: bulkRequest.latitude,
                  longitude: bulkRequest.longitude,
                  title: `Bulk Request #${bulkRequest.id}`,
                  description: bulkRequest.location || 'Bulk Request Location',
                  pinColor: '#FF6B6B' // Red for bulk request
                });
              }

              // Add vendor markers
              bulkVendorLocations.forEach((vendor) => {
                // Add shop location marker (if available)
                if (vendor.shopLatitude && vendor.shopLongitude) {
                  markers.push({
                    id: `vendor-shop-${vendor.user_id}`,
                    latitude: vendor.shopLatitude,
                    longitude: vendor.shopLongitude,
                    title: vendor.shopname || `Vendor ${vendor.user_id}`,
                    description: `Shop Location - ${vendor.status}`,
                    pinColor: '#4ECDC4' // Teal for shop location
                  });
                }

                // Add live tracking location marker (if pickup started)
                if (vendor.liveLocation) {
                  markers.push({
                    id: `vendor-live-${vendor.user_id}`,
                    latitude: vendor.liveLocation.latitude,
                    longitude: vendor.liveLocation.longitude,
                    title: `${vendor.shopname || `Vendor ${vendor.user_id}`} - Live`,
                    description: `Live Location - ${vendor.status}`,
                    pinColor: '#FFD93D' // Yellow for live tracking
                  });
                }
              });

              // Calculate initial region to fit all markers
              const allLatitudes = markers.map(m => m.latitude).filter(lat => lat !== undefined);
              const allLongitudes = markers.map(m => m.longitude).filter(lng => lng !== undefined);
              
              let initialRegion = {
                latitude: bulkRequest.latitude || 9.1530,
                longitude: bulkRequest.longitude || 76.7356,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1
              };

              if (allLatitudes.length > 0 && allLongitudes.length > 0) {
                const minLat = Math.min(...allLatitudes);
                const maxLat = Math.max(...allLatitudes);
                const minLng = Math.min(...allLongitudes);
                const maxLng = Math.max(...allLongitudes);
                
                const latDelta = (maxLat - minLat) * 1.5 || 0.1;
                const lngDelta = (maxLng - minLng) * 1.5 || 0.1;
                
                initialRegion = {
                  latitude: (minLat + maxLat) / 2,
                  longitude: (minLng + maxLng) / 2,
                  latitudeDelta: Math.max(latDelta, 0.01),
                  longitudeDelta: Math.max(lngDelta, 0.01)
                };
              }

              return (
                <>
                  <BulkRequestMapView
                    style={styles.map}
                    markers={markers}
                    initialRegion={initialRegion}
                  />
                  {loadingVendorLocations && (
                    <View style={styles.mapLoadingOverlay}>
                      <ActivityIndicator size="small" color={theme.primary} />
                    </View>
                  )}
                </>
              );
            })()
          ) : bulkRequestBuyerLocation ? (
            // Participating vendor viewing bulk request order: Show buyer location (destination) and vendor's live tracking
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
                console.log('📍 [DeliveryTracking] Current location updated (bulk request order):', newLocation);
                
                // Calculate distance immediately when location updates
                if (destination) {
                  const distance = calculateDistance(
                    newLocation.latitude,
                    newLocation.longitude,
                    destination.latitude,
                    destination.longitude
                  );
                  setCalculatedDistance(distance);
                  
                  const time = calculateEstimatedTime(distance, 'driving');
                  setEstimatedTime(time);
                  console.log('📍 [DeliveryTracking] Recalculated - Distance:', distance.toFixed(1), 'km, Time:', time, 'mins');
                }

                if (!addressFetchedRef.current && !addressFailedRef.current) {
                  try {
                    const address = await getAddressFromCoordinates(location.latitude, location.longitude);
                    addressFetchedRef.current = true;
                    console.log('📍 Address:', address.formattedAddress);
                  } catch (error) {
                    addressFailedRef.current = true;
                    console.warn('⚠️ Failed to get address');
                  }
                }
              }}
              onMapReady={() => console.log('🗺️ Map ready (bulk request order)')}
            />
          ) : (
            // Regular order map
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
                console.log('📍 [DeliveryTracking] Current location updated:', newLocation);
                
                // Calculate distance immediately when location updates
                if (destination) {
                  const distance = calculateDistance(
                    newLocation.latitude,
                    newLocation.longitude,
                    destination.latitude,
                    destination.longitude
                  );
                  setCalculatedDistance(distance);
                  
                  const time = calculateEstimatedTime(distance, 'driving');
                  setEstimatedTime(time);
                  console.log('📍 [DeliveryTracking] Recalculated - Distance:', distance.toFixed(1), 'km, Time:', time, 'mins');
                }

                if (!addressFetchedRef.current && !addressFailedRef.current) {
                  try {
                    const address = await getAddressFromCoordinates(location.latitude, location.longitude);
                    addressFetchedRef.current = true;
                    console.log('📍 Address:', address.formattedAddress);
                  } catch (error) {
                    addressFailedRef.current = true;
                    console.warn('⚠️ Failed to get address');
                  }
                }
              }}
              onMapReady={() => console.log('🗺️ Map ready')}
            />
          )}
          <View style={styles.mapFloatingButtons}>
            <TouchableOpacity
              style={styles.floatingButton}
              onPress={() => {
                // Get customer phone from order data
                const customerPhone = orderData?.customer_phone || 
                                    (orderData as any)?.customerPhone || 
                                    (orderData as any)?.customer?.contact ||
                                    (orderData as any)?.customer?.mob_num ||
                                    null;
                navigation.navigate('FullscreenMap', { 
                  destination, 
                  orderId,
                  customer_phone: customerPhone || undefined
                });
              }}
            >
              <MaterialCommunityIcons name="fullscreen" size={18} color={theme.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.floatingButton}
              onPress={() => {
                // Get customer phone from order data
                const customerPhone = orderData?.customer_phone || 
                                    (orderData as any)?.customerPhone || 
                                    (orderData as any)?.customer?.contact ||
                                    (orderData as any)?.customer?.mob_num ||
                                    null;
                if (customerPhone) {
                  const phoneNumber = customerPhone.replace(/[^0-9+]/g, ''); // Remove non-numeric characters except +
                  const phoneUrl = `tel:${phoneNumber}`;
                  Linking.openURL(phoneUrl).catch((err) => {
                    console.error('Error making phone call:', err);
                    Alert.alert(
                      t('common.error'),
                      t('common.cannotMakeCall')
                    );
                  });
                } else {
                  Alert.alert(
                    t('common.info'),
                    t('common.phoneNumberNotAvailable')
                  );
                }
              }}
            >
              <MaterialCommunityIcons name="phone" size={16} color={theme.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.floatingButton}
              onPress={() => {
                if (destination && destination.latitude && destination.longitude) {
                  // Open Google Maps with the destination location
                  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${destination.latitude},${destination.longitude}`;
                  Linking.openURL(googleMapsUrl).catch((err) => {
                    console.error('Error opening Google Maps:', err);
                    Alert.alert(
                      t('common.error'),
                      t('common.cannotOpenMaps')
                    );
                  });
                } else {
                  Alert.alert(
                    t('common.info'),
                    t('common.locationNotAvailable')
                  );
                }
              }}
            >
              <MaterialCommunityIcons name="map" size={16} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          {orderData && calculatedDistance !== null && (
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
                    : `${calculateEstimatedTime(calculatedDistance, 'driving')} ${t('common.minutes') || 'mins'}`}
                </AutoText>
              </View>
            </View>
          )}
        </View>

        <SectionCard style={styles.orderCard}>
          <AutoText style={styles.orderTitle}>
            {t('dashboard.orderNumber') || 'Order'}: #{orderData?.order_number || orderId}
          </AutoText>

          {(() => {
            // Try multiple possible field names for customer name
            const customerName = orderData?.customer_name || 
                                (orderData as any)?.customerName || 
                                (orderData as any)?.customer?.name ||
                                null;
            
            // Try multiple possible field names for customer phone
            const customerPhone = orderData?.customer_phone || 
                                 (orderData as any)?.customerPhone || 
                                 (orderData as any)?.customer?.contact ||
                                 (orderData as any)?.customer?.mob_num ||
                                 null;

            console.log('👤 [DeliveryTracking] Customer info check:', {
              customer_name: orderData?.customer_name,
              customerName: (orderData as any)?.customerName,
              customer: (orderData as any)?.customer,
              resolvedName: customerName,
              resolvedPhone: customerPhone,
            });

            return (
              <>
                {customerName && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons 
                      name="account" 
                      size={14} 
                      color={theme.primary}
                      style={!isSubscribed ? { opacity: 0 } : undefined}
                    />
                    <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                      {String(customerName)}
                    </AutoText>
                  </View>
                )}

                {customerPhone && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons 
                      name="phone" 
                      size={14} 
                      color={theme.primary}
                      style={!isSubscribed ? { opacity: 0 } : undefined}
                    />
                    <AutoText style={[styles.detailText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                      {String(customerPhone)}
                    </AutoText>
                  </View>
                )}
              </>
            );
          })()}

          {orderData?.address && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker" size={14} color={theme.primary} />
              <AutoText style={styles.addressText} numberOfLines={4}>
                {formatAddress(orderData.address)}
              </AutoText>
            </View>
          )}

          {orderItemsWithImages.length > 0 && (
            <View style={styles.itemsSection}>
              <AutoText style={styles.itemsTitle} numberOfLines={1}>
                {t('deliveryTracking.itemsForPickup') || 'Items for Pickup'}:
              </AutoText>

              {orderItemsWithImages.map((item: any, index: number) => {
                try {
                  return (
                    <View key={`item-${index}`} style={styles.itemRow}>
                      <View style={styles.itemImageContainer}>
                        {item?.subcategoryImage ? (
                          <Image
                            source={{ uri: item.subcategoryImage }}
                            style={styles.itemImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.itemImagePlaceholder}>
                            <MaterialCommunityIcons name="image-off" size={20} color={theme.textSecondary} />
                          </View>
                        )}
                      </View>

                      <View style={styles.itemDetails}>
                        <AutoText style={styles.itemName} numberOfLines={1}>
                          {item?.subcategoryName || 'Unknown'}
                        </AutoText>
                        {((item?.quantity || 0) > 0 || (item?.weight || 0) > 0) && (
                          <AutoText style={styles.itemQuantity} numberOfLines={1}>
                            {(item?.quantity || 0) > 0 && `${item.quantity} ${(item?.weight || 0) > 0 ? '× ' : ''}`}
                            {(item?.weight || 0) > 0 && `${item.weight} kg`}
                          </AutoText>
                        )}
                      </View>
                    </View>
                  );
                } catch (error) {
                  console.error('Error rendering item:', error);
                  return null;
                }
              })}
            </View>
          )}

          {orderData?.estimated_price && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="currency-inr" size={14} color={theme.primary} />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.estimatedPrice') || 'Estimated Price'}: ₹{orderData.estimated_price.toLocaleString('en-IN')}
              </AutoText>
            </View>
          )}

          {/* Bidding Details Section (for bulk request orders) */}
          {(() => {
            const orderDataAny = orderData as any;
            const bulkRequestId = orderDataAny?.bulk_request_id;
            const biddingPrice = orderDataAny?.bulk_request_bidding_price;
            const committedQuantity = orderDataAny?.bulk_request_committed_quantity;

            if (bulkRequestId && (biddingPrice !== null && biddingPrice !== undefined || committedQuantity)) {
              return (
                <View style={styles.biddingSection}>
                  <AutoText style={styles.biddingSectionTitle} numberOfLines={1}>
                    {t('dashboard.biddingDetails') || 'Bidding Details'}:
                  </AutoText>
                  
                  {committedQuantity && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="weight-kilogram" size={14} color={theme.primary} />
                      <AutoText style={styles.detailText} numberOfLines={1}>
                        {t('dashboard.committedQuantity') || 'Committed Quantity'}: {committedQuantity.toLocaleString('en-IN')} kg
                      </AutoText>
                    </View>
                  )}

                  {biddingPrice !== null && biddingPrice !== undefined && (
                    <View style={styles.detailRow}>
                      <MaterialCommunityIcons name="tag" size={14} color={theme.success || theme.primary} />
                      <AutoText style={[styles.detailText, { color: theme.success || theme.primary }]} numberOfLines={1}>
                        {t('dashboard.biddingPrice') || 'Bidding Price'}: ₹{biddingPrice.toLocaleString('en-IN')}/kg
                      </AutoText>
                    </View>
                  )}

                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="file-document-outline" size={14} color={theme.primary} />
                    <AutoText style={styles.detailText} numberOfLines={1}>
                      {t('dashboard.bulkRequestId') || 'Bulk Request'}: #{bulkRequestId}
                    </AutoText>
                  </View>
                </View>
              );
            }
            return null;
          })()}

          {/* Payment Details Section */}
          {(() => {
            try {
              if (!orderData || parseInt(String(orderData.status || 0)) < 4) return null;
              if (!Array.isArray(orderItemsWithImages) || orderItemsWithImages.length === 0) return null;

              const orderStatus = parseInt(String(orderData.status || 0));
              const isCompleted = orderStatus === 5; // Completed orders should be read-only

              // Get customer name, phone and address - check multiple possible field names
              const orderDataAny = orderData as any;
              const customerDetails = orderDataAny?.customerdetails;
              
              const customerName = orderData.customer_name || 
                                  orderDataAny?.customerName || 
                                  orderDataAny?.customer?.name ||
                                  (typeof customerDetails === 'object' && customerDetails?.name) ||
                                  null;
              
              const customerPhone = orderData.customer_phone || 
                                   orderDataAny?.customerPhone || 
                                   orderDataAny?.customer?.contact ||
                                   orderDataAny?.customer?.mob_num ||
                                   null;
              
              const addressRaw = orderData.address || 
                               (typeof customerDetails === 'string' ? customerDetails : null) ||
                               (typeof customerDetails === 'object' && customerDetails?.address ? customerDetails.address : null) ||
                               orderDataAny?.customer?.address ||
                               null;
              
              const formattedAddress = addressRaw ? formatAddress(addressRaw) : null;

              console.log('💰 [PaymentSection] Rendering payment section:', {
                orderStatus,
                isCompleted,
                customerName: customerName || 'NOT FOUND',
                customerPhone: customerPhone || 'NOT FOUND',
                addressRaw: addressRaw ? (typeof addressRaw === 'string' ? addressRaw.substring(0, 50) : 'object') : 'NOT FOUND',
                formattedAddress: formattedAddress ? formattedAddress.substring(0, 50) : 'NOT FOUND',
                orderDataKeys: Object.keys(orderData || {})
              });

              return (
                <View style={styles.paymentSection}>
                  <AutoText style={styles.paymentSectionTitle} numberOfLines={1}>
                    {t('deliveryTracking.paymentDetails') || 'Payment Details'}:
                  </AutoText>

                  {/* Customer Name, Phone and Address */}
                  {customerName && (
                    <View style={styles.paymentCustomerRow}>
                      <MaterialCommunityIcons 
                        name="account" 
                        size={14} 
                        color={theme.primary}
                        style={!isSubscribed ? { opacity: 0 } : undefined}
                      />
                      <AutoText style={[styles.paymentCustomerText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                        {String(customerName)}
                      </AutoText>
                    </View>
                  )}

                  {customerPhone && (
                    <View style={styles.paymentCustomerRow}>
                      <MaterialCommunityIcons 
                        name="phone" 
                        size={14} 
                        color={theme.primary}
                        style={!isSubscribed ? { opacity: 0 } : undefined}
                      />
                      <AutoText style={[styles.paymentCustomerText, !isSubscribed && { opacity: 0 }]} numberOfLines={1}>
                        {String(customerPhone)}
                      </AutoText>
                    </View>
                  )}

                  {formattedAddress && (
                    <View style={styles.paymentAddressRow}>
                      <MaterialCommunityIcons name="map-marker" size={14} color={theme.primary} />
                      <AutoText style={styles.paymentAddressText} numberOfLines={3}>
                        {formattedAddress}
                      </AutoText>
                    </View>
                  )}

                  {orderItemsWithImages.map((item: any, index: number) => {
                    try {
                      if (!item) return null;
                      const key = item.itemKey || String(index);
                      const detail = (paymentDetails && paymentDetails[key]) ? paymentDetails[key] : { weight: '', amount: '' };

                      return (
                        <View key={`payment-${key}-${index}`} style={styles.paymentItemRow}>
                          <View style={styles.paymentItemInfo}>
                            <AutoText style={styles.paymentItemName} numberOfLines={1}>
                              {item.subcategoryName || 'Unknown'}
                            </AutoText>
                          </View>

                          <View style={styles.paymentInputsRow}>
                            <View style={styles.paymentInputContainer}>
                              <AutoText style={styles.paymentInputLabel}>
                                {t('deliveryTracking.weight') || 'Weight (kg)'}
                              </AutoText>
                              <TextInput
                                style={[
                                  styles.paymentInput, 
                                  { borderColor: theme.border, color: theme.textPrimary },
                                  isCompleted && styles.paymentInputReadOnly
                                ]}
                                placeholder="0"
                                placeholderTextColor={theme.textSecondary}
                                value={String(detail?.weight || '')}
                                onChangeText={(v: string) => {
                                  if (!isCompleted) {
                                    try {
                                      updatePaymentDetail(key, 'weight', v);
                                    } catch (err) {
                                      console.error('Error updating weight:', err);
                                    }
                                  }
                                }}
                                keyboardType="decimal-pad"
                                returnKeyType="next"
                                blurOnSubmit={false}
                                editable={!isCompleted}
                              />
                            </View>

                            <View style={styles.paymentInputContainer}>
                              <AutoText style={styles.paymentInputLabel}>
                                {t('deliveryTracking.amount') || 'Amount (₹)'}
                              </AutoText>
                              <TextInput
                                style={[
                                  styles.paymentInput, 
                                  { borderColor: theme.border, color: theme.textPrimary },
                                  isCompleted && styles.paymentInputReadOnly
                                ]}
                                placeholder="0"
                                placeholderTextColor={theme.textSecondary}
                                value={String(detail?.amount || '')}
                                onChangeText={(v: string) => {
                                  if (!isCompleted) {
                                    try {
                                      updatePaymentDetail(key, 'amount', v);
                                    } catch (err) {
                                      console.error('Error updating amount:', err);
                                    }
                                  }
                                }}
                                keyboardType="decimal-pad"
                                returnKeyType="done"
                                editable={!isCompleted}
                              />
                            </View>
                          </View>
                        </View>
                      );
                    } catch (itemError) {
                      console.error('Error rendering payment item:', itemError);
                      return null;
                    }
                  })}

                  <View style={styles.paymentTotalRow}>
                    <AutoText style={styles.paymentTotalLabel}>
                      {t('deliveryTracking.totalAmount') || 'Total Amount'}:
                    </AutoText>
                    <AutoText style={styles.paymentTotalAmount}>
                      ₹{(() => {
                        try {
                          const amount = typeof totalAmount === 'number' ? totalAmount : 0;
                          return amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                        } catch (err) {
                          console.error('Error formatting total:', err);
                          return '0.00';
                        }
                      })()}
                    </AutoText>
                  </View>
                </View>
              );
            } catch (error) {
              console.error('Error rendering payment section:', error);
              return null;
            }
          })()}
        </SectionCard>
      </ScrollView>

      <View style={styles.bottomRow}>
        {orderData && (() => {
          const orderStatus = parseInt(String(orderData.status || 0));

          // Hide "Myself Pickup" option for status 6 (Accepted by others) and status 7 (Cancelled)
          if (orderStatus === 6 || orderStatus === 7) {
            return (
              <View style={styles.statusMessageContainer}>
                <AutoText style={styles.statusMessageText}>
                  {orderStatus === 6 
                    ? (t('orders.status.acceptedByOther') || 'Accepted by other Partner')
                    : (t('orders.status.cancelled') || 'Cancelled')}
                </AutoText>
              </View>
            );
          }

          if (orderStatus === 2) {
            return (
              <>
                <GreenButton
                  title={t('deliveryTracking.assignDeliveryPartner')}
                  onPress={() => navigation.navigate('AssignPartner', { orderId })}
                  style={styles.assignButton}
                />
                <TouchableOpacity
                  style={[styles.pickupButton, startingPickup && styles.pickupButtonDisabled]}
                  onPress={handleStartPickupConfirm}
                  disabled={startingPickup}
                >
                  {startingPickup ? (
                    <ActivityIndicator size="small" color={theme.primary} />
                  ) : (
                    <AutoText style={styles.pickupButtonText} numberOfLines={1}>
                      {t('deliveryTracking.myselfPickup')}
                    </AutoText>
                  )}
                </TouchableOpacity>
              </>
            );
          }

          if (orderStatus === 3) {
            return (
              <TouchableOpacity
                style={[styles.pickupButton, markingArrived && styles.pickupButtonDisabled]}
                onPress={handleArrivedLocation}
                disabled={markingArrived}
              >
                {markingArrived ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <AutoText style={styles.pickupButtonText} numberOfLines={1}>
                    {t('deliveryTracking.arrivedLocation') || 'Arrived Location'}
                  </AutoText>
                )}
              </TouchableOpacity>
            );
          }

          if (orderStatus === 4) {
            return (
              <TouchableOpacity
                style={[styles.pickupButton, completingPickup && styles.pickupButtonDisabled]}
                onPress={handleCompletePickup}
                disabled={completingPickup}
              >
                {completingPickup ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <AutoText style={styles.pickupButtonText} numberOfLines={1}>
                    {t('deliveryTracking.completePickup') || 'Pickup Completed'}
                  </AutoText>
                )}
              </TouchableOpacity>
            );
          }

          if (orderStatus === 5) {
            return (
              <View style={styles.completedContainer}>
                <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                <AutoText style={styles.completedText}>
                  {t('orders.status.completed') || t('deliveryTracking.pickupCompleted') || 'Completed'}
                </AutoText>
              </View>
            );
          }

          // Don't show "Myself Pickup" for status 6 or 7 (already handled above)
          if (orderStatus === 6 || orderStatus === 7) {
            return null;
          }

          return (
            <TouchableOpacity
              style={[styles.pickupButton, startingPickup && styles.pickupButtonDisabled]}
              onPress={handleStartPickupConfirm}
              disabled={startingPickup}
            >
              {startingPickup ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <AutoText style={styles.pickupButtonText} numberOfLines={1}>
                  {t('deliveryTracking.myselfPickup')}
                </AutoText>
              )}
            </TouchableOpacity>
          );
        })()}
      </View>

      {/* Start Pickup Confirmation Modal */}
      <Modal
        visible={showStartPickupModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowStartPickupModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModalContent}>
            <AutoText style={styles.confirmationModalTitle} numberOfLines={2}>
              {t('deliveryTracking.confirmStartPickup') || 'Confirm Start Pickup'}
            </AutoText>
            <AutoText style={styles.confirmationModalMessage} numberOfLines={3}>
              {t('deliveryTracking.startPickupMessage') || 'Your vehicle should start to collect the pickup'}
            </AutoText>
            <View style={styles.confirmationModalButtons}>
              <TouchableOpacity
                style={[styles.confirmationModalButton, styles.cancelButton]}
                onPress={() => setShowStartPickupModal(false)}
                activeOpacity={0.7}
              >
                <AutoText style={styles.cancelButtonText}>
                  {t('common.cancel') || 'Cancel'}
                </AutoText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmationModalButton, styles.confirmButton]}
                onPress={handleStartPickup}
                activeOpacity={0.7}
                disabled={startingPickup}
              >
                {startingPickup ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <AutoText style={styles.confirmButtonText}>
                    {t('common.confirm') || 'Confirm'}
                  </AutoText>
                )}
              </TouchableOpacity>
            </View>
          </View>
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
    pickupButtonDisabled: {
      opacity: 0.5,
    },
    pickupButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
      textAlign: 'center',
    },
    completedContainer: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '10@vs',
      gap: '8@s',
    },
    completedText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: '#4CAF50',
      textAlign: 'center',
    },
    statusMessageContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '12@vs',
    },
    statusMessageText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
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
    // Bidding Section Styles (for bulk request orders)
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
    mapLoadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Payment Section Styles
    paymentSection: {
      marginTop: '16@vs',
      paddingTop: '16@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    paymentSectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    paymentCustomerRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '6@s',
      marginBottom: '8@vs',
    },
    paymentCustomerText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
      flex: 1,
    },
    paymentAddressRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '6@s',
      marginBottom: '12@vs',
    },
    paymentAddressText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      flex: 1,
      lineHeight: '18@vs',
    },
    paymentItemRow: {
      marginBottom: '16@vs',
      paddingBottom: '12@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    paymentItemInfo: {
      marginBottom: '10@vs',
    },
    paymentItemName: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    paymentInputsRow: {
      flexDirection: 'row',
      gap: '10@s',
      marginBottom: '8@vs',
    },
    paymentInputContainer: {
      flex: 1,
    },
    paymentInputLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginBottom: '6@vs',
    },
    paymentInput: {
      borderWidth: 1,
      borderRadius: '8@ms',
      paddingHorizontal: '12@s',
      paddingVertical: '10@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      backgroundColor: theme.background,
    },
    paymentInputReadOnly: {
      backgroundColor: theme.card,
      opacity: 0.7,
    },
    paymentTotalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '12@vs',
      paddingTop: '12@vs',
      borderTopWidth: 2,
      borderTopColor: theme.primary,
    },
    paymentTotalLabel: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    paymentTotalAmount: {
      fontFamily: 'Poppins-Bold',
      fontSize: '18@s',
      color: theme.primary,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: '20@s',
    },
    confirmationModalContent: {
      backgroundColor: theme.card,
      borderRadius: '16@ms',
      padding: '24@s',
      width: '100%',
      maxWidth: '400@s',
      alignItems: 'center',
    },
    confirmationModalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      marginBottom: '16@vs',
      textAlign: 'center',
    },
    confirmationModalMessage: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginBottom: '24@vs',
      textAlign: 'center',
      lineHeight: '20@vs',
    },
    confirmationModalButtons: {
      flexDirection: 'row',
      gap: '12@s',
      width: '100%',
    },
    confirmationModalButton: {
      flex: 1,
      paddingVertical: '12@vs',
      paddingHorizontal: '20@s',
      borderRadius: '8@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      backgroundColor: theme.border,
      borderWidth: 1,
      borderColor: theme.border,
    },
    cancelButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    confirmButton: {
      backgroundColor: theme.primary,
    },
    confirmButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
  });
};

export default DeliveryTrackingScreen;
