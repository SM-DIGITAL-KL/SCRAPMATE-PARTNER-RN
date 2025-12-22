import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, Text, Vibration, Platform, Image, ActivityIndicator, Modal, Alert, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { CategoryBadge } from '../../components/CategoryBadge';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { useUserMode } from '../../context/UserModeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile, useUpdateDeliveryMode, useUpdateOnlineStatus } from '../../hooks/useProfile';
import { useRecyclingStats } from '../../hooks/useRecycling';
import { useMonthlyBreakdown } from '../../hooks/useEarnings';
import { useActivePickup, useAvailablePickupRequests, useAcceptPickupRequest } from '../../hooks/useOrders';
import { Switch } from 'react-native';
import { Category } from '../../services/api/v2/categories';
import { useCategories, useUserCategories, useUserSubcategories } from '../../hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

const DeliveryDashboardScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setMode } = useUserMode();
  const queryClient = useQueryClient();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [allowedDashboards, setAllowedDashboards] = useState<('b2b' | 'b2c' | 'delivery')[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  // React Query hooks for categories
  const { data: userCategoriesData, isLoading: loadingCategories, refetch: refetchUserCategories } = useUserCategories(
    userData?.id,
    !!userData?.id
  );
  const { data: userSubcategoriesData, isLoading: loadingSubcategories, refetch: refetchUserSubcategories } = useUserSubcategories(
    userData?.id,
    !!userData?.id
  );
  
  // Get all categories to match with user's category IDs
  const { data: allCategoriesData, refetch: refetchAllCategories } = useCategories('delivery', true);
  
  // Load user data and fetch profile
  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
      };
      loadUserData();
    }, [])
  );

  // Refetch all category data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          console.log('🔄 Delivery Dashboard focused - refetching category data...');
          refetchUserCategories();
          refetchUserSubcategories();
          refetchAllCategories();
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, refetchUserCategories, refetchUserSubcategories, refetchAllCategories])
  );

  // Listen for navigation events to refetch when returning from AddCategoryScreen
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userData?.id) {
        console.log('🔄 Navigation focus - refetching category data...');
        refetchUserCategories();
        refetchUserSubcategories();
        refetchAllCategories();
      }
    });

    return unsubscribe;
  }, [navigation, userData?.id, refetchUserCategories, refetchUserSubcategories, refetchAllCategories]);

  // Process user categories
  const userCategories = React.useMemo(() => {
    if (!userCategoriesData?.data?.category_ids || !allCategoriesData?.data) {
      return [];
    }
    const userCategoryIds = userCategoriesData.data.category_ids.map(id => Number(id));
    return allCategoriesData.data.filter(cat => {
      const catId = Number(cat.id);
      return userCategoryIds.includes(catId);
    });
  }, [userCategoriesData, allCategoriesData]);

  // Process category subcategories - only show user's selected subcategories for the selected category
  const categorySubcategories = React.useMemo(() => {
    if (!selectedCategory?.id || !userSubcategoriesData?.data?.subcategories) {
      return [];
    }
    
    const categoryId = Number(selectedCategory.id);
    
    const userSubcatsForCategory = userSubcategoriesData.data.subcategories.filter(
      (us: any) => Number(us.main_category_id) === categoryId
    );
    
    return userSubcatsForCategory.map((userSubcat: any) => ({
      id: userSubcat.subcategory_id,
      name: userSubcat.name,
      main_category_id: userSubcat.main_category_id,
      default_price: userSubcat.default_price || '',
      price_unit: userSubcat.price_unit || 'kg',
      custom_price: userSubcat.custom_price || '',
      display_price: userSubcat.display_price || userSubcat.custom_price || userSubcat.default_price || '0',
      display_price_unit: userSubcat.display_price_unit || userSubcat.price_unit || 'kg',
      image: userSubcat.image || ''
    }));
  }, [selectedCategory?.id, selectedCategory?.name, userSubcategoriesData]);

  // Refetch when modal opens to ensure we have latest subcategories
  React.useEffect(() => {
    if (modalVisible && userData?.id && selectedCategory?.id) {
      refetchUserSubcategories();
      refetchUserCategories();
    }
  }, [modalVisible, userData?.id, selectedCategory?.id, refetchUserSubcategories, refetchUserCategories]);

  // Handle category press - open modal only if subcategories exist
  const handleCategoryPress = (category: Category) => {
    if (!userSubcategoriesData?.data?.subcategories) {
      Alert.alert(
        t('common.warning') || 'Warning',
        t('dashboard.noSubcategories') || 'No subcategories available for this category'
      );
      return;
    }
    
    const categoryId = Number(category.id);
    const subcatsForCategory = userSubcategoriesData.data.subcategories.filter(
      (us: any) => Number(us.main_category_id) === categoryId
    );
    
    if (subcatsForCategory.length === 0) {
      Alert.alert(
        t('common.warning') || 'Warning',
        t('dashboard.noSubcategories') || 'No subcategories available for this category'
      );
      return;
    }
    
    setSelectedCategory(category);
    setModalVisible(true);
  };

  // Get icon name for category (fallback if no image)
  const getCategoryIcon = (categoryName: string): string => {
    const name = categoryName.toLowerCase();
    if (name.includes('metal') || name.includes('aluminum')) return 'aluminum';
    if (name.includes('plastic')) return 'bottle-soda';
    if (name.includes('paper')) return 'file-document';
    if (name.includes('electronic') || name.includes('e-waste')) return 'lightbulb';
    if (name.includes('glass')) return 'glass-wine';
    if (name.includes('wood')) return 'tree';
    if (name.includes('rubber')) return 'circle';
    if (name.includes('organic')) return 'sprout';
    return 'package-variant';
  };

  // Fetch profile data
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);
  const updateDeliveryModeMutation = useUpdateDeliveryMode(userData?.id || 0);
  const updateOnlineStatusMutation = useUpdateOnlineStatus(userData?.id || 0);

  // Get recycling statistics
  const { data: recyclingStats, isLoading: loadingRecyclingStats } = useRecyclingStats(
    userData?.id,
    'delivery',
    !!userData?.id
  );

  // Get monthly earnings breakdown
  const { data: monthlyBreakdownData, isLoading: loadingMonthlyBreakdown } = useMonthlyBreakdown(
    userData?.id,
    'delivery',
    6,
    !!userData?.id
  );

  // Get active pickup order (for D type users in Delivery dashboard)
  const { data: activePickup, isLoading: loadingActivePickup } = useActivePickup(
    userData?.id,
    'D', // Delivery dashboard is for D (Delivery) type users
    !!userData?.id
  );

  // Get available pickup requests (for accepting new orders)
  const { data: availablePickupRequests, isLoading: loadingAvailableRequests, refetch: refetchAvailableRequests } = useAvailablePickupRequests(
    userData?.id,
    'D', // Delivery dashboard is for D (Delivery) type users
    undefined, // No location filtering for now
    undefined,
    10,
    !!userData?.id
  );

  // Accept pickup request mutation
  const acceptPickupMutation = useAcceptPickupRequest();

  // Get first available request to show in "General Waste Collection" section
  const firstAvailableRequest = availablePickupRequests && availablePickupRequests.length > 0 
    ? availablePickupRequests[0] 
    : null;

  // Handle accept order
  const handleAcceptOrder = async () => {
    if (!firstAvailableRequest || !userData?.id) return;
    
    try {
      await acceptPickupMutation.mutateAsync({
        orderId: firstAvailableRequest.order_number,
        userId: userData.id,
        userType: 'D'
      });
      // Refetch available requests after accepting
      refetchAvailableRequests();
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };
  
  // Initialize delivery mode from profile, default to 'deliver' if not set
  const [deliveryMode, setDeliveryMode] = useState<'deliver' | 'deliverPicking' | 'picker'>('deliver');
  
  // Initialize online status from profile, default to false if not set
  const [isOnline, setIsOnline] = useState<boolean>(false);
  
  // Update delivery mode and online status when profile data loads
  useEffect(() => {
    if (profileData?.delivery?.delivery_mode) {
      setDeliveryMode(profileData.delivery.delivery_mode);
    }
    if (profileData?.delivery?.is_online !== undefined) {
      setIsOnline(profileData.delivery.is_online);
    }
  }, [profileData]);

  // Listen for new order notifications and refresh orders list
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('NEW_ORDER_RECEIVED', (data) => {
      console.log('📦 Delivery Dashboard: New order notification received:', data);
      
      if (userData?.id) {
        // Invalidate and refetch orders queries
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.orders.availablePickupRequests(userData.id, 'D') 
        });
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.orders.activePickup(userData.id, 'D') 
        });
        
        // Also manually refetch for immediate update
        refetchAvailableRequests();
        
        console.log('✅ Delivery Dashboard: Orders list refreshed after new order notification');
      }
    });

    return () => {
      subscription.remove();
    };
  }, [userData?.id, queryClient, refetchAvailableRequests]);

  // Check approval status and redirect to VehicleInformation if rejected
  useEffect(() => {
    const checkApprovalStatus = async () => {
      if (profileData?.delivery?.approval_status || profileData?.delivery_boy?.approval_status) {
        try {
          const approvalStatus = profileData?.delivery?.approval_status || profileData?.delivery_boy?.approval_status;
          await AsyncStorage.setItem('@delivery_approval_status', approvalStatus);
          console.log('✅ DeliveryDashboardScreen: Synced @delivery_approval_status to AsyncStorage:', approvalStatus);
          
          // If rejected, navigate to VehicleInformation screen to fill documents
          if (approvalStatus === 'rejected') {
            console.log('✅ Delivery approval status is rejected - navigating to VehicleInformation');
            // Small delay to ensure navigation is ready
            setTimeout(() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'VehicleInformation' }],
              });
            }, 500);
          }
        } catch (error) {
          console.error('❌ Error syncing delivery approval status:', error);
        }
      }
    };
    
    checkApprovalStatus();
  }, [profileData?.delivery?.approval_status, profileData?.delivery_boy?.approval_status, navigation]);
  
  // Handle delivery mode change and save to database
  const handleDeliveryModeChange = async (newMode: 'deliver' | 'deliverPicking' | 'picker') => {
    if (!userData?.id || newMode === deliveryMode) {
      return; // Don't update if same mode or no user data
    }
    
    try {
      // Update local state immediately for better UX
      setDeliveryMode(newMode);
      
      console.log(`📝 Updating delivery mode to: ${newMode}`);
      updateDeliveryModeMutation.mutate(newMode, {
        onSuccess: (updatedProfile) => {
          console.log(`✅ Delivery mode updated successfully:`, updatedProfile.delivery?.delivery_mode);
        },
        onError: (error: any) => {
          console.error('❌ Error updating delivery mode:', error);
          // Revert to previous mode on error
          if (profileData?.delivery?.delivery_mode) {
            setDeliveryMode(profileData.delivery.delivery_mode);
          }
        },
      });
    } catch (error) {
      console.error('❌ Error updating delivery mode:', error);
      // Revert to previous mode on error
      if (profileData?.delivery?.delivery_mode) {
        setDeliveryMode(profileData.delivery.delivery_mode);
      }
    }
  };

  // Handle online/offline status change
  const handleOnlineStatusChange = async (newStatus: boolean) => {
    if (!userData?.id || newStatus === isOnline) {
      return; // Don't update if same status or no user data
    }
    
    try {
      // Update local state immediately for better UX
      setIsOnline(newStatus);
      
      console.log(`📝 Updating online status to: ${newStatus}`);
      updateOnlineStatusMutation.mutate(newStatus, {
        onSuccess: (updatedProfile) => {
          console.log(`✅ Online status updated successfully:`, updatedProfile.delivery?.is_online);
        },
        onError: (error: any) => {
          console.error('❌ Error updating online status:', error);
          // Revert to previous status on error
          if (profileData?.delivery?.is_online !== undefined) {
            setIsOnline(profileData.delivery.is_online);
          }
        },
      });
    } catch (error) {
      console.error('❌ Error updating online status:', error);
      // Revert to previous status on error
      if (profileData?.delivery?.is_online !== undefined) {
        setIsOnline(profileData.delivery.is_online);
      }
    }
  };
  
  // Load allowed dashboards from AsyncStorage (set during login)
  useEffect(() => {
    const loadAllowedDashboards = async () => {
      const storedDashboards = await AsyncStorage.getItem('@allowed_dashboards');
      if (storedDashboards) {
        try {
          const dashboards = JSON.parse(storedDashboards);
          setAllowedDashboards(dashboards);
          
          // Check if user has access to delivery dashboard
          if (!dashboards.includes('delivery')) {
            // User doesn't have access - redirect immediately to appropriate dashboard
            const userData = await getUserData();
            const userType = userData?.user_type;
            let redirectMode: 'b2b' | 'b2c' = 'b2c';
            
            if (userType === 'S' || userType === 'SR') {
              redirectMode = 'b2b';
            } else if (userType === 'R') {
              redirectMode = 'b2c';
            }
            
            // Redirect immediately without alert
            setMode(redirectMode);
          }
        } catch (e) {
          console.error('Error parsing allowed dashboards:', e);
        }
      }
    };
    loadAllowedDashboards();
  }, [setMode]);
  
  // Don't render if user doesn't have access (will be redirected by AppNavigator)
  // Return empty view to avoid black screen during redirect
  if (allowedDashboards.length > 0 && !allowedDashboards.includes('delivery')) {
    return <View style={{ flex: 1, backgroundColor: theme.background }} />;
  }
  
  // Use API data for earnings breakdown, fallback to empty if loading
  const monthlyEarnings = monthlyBreakdownData?.monthlyBreakdown?.map(month => month.earnings) || [];
  const monthLabels = monthlyBreakdownData?.monthlyBreakdown?.map(month => month.monthName) || [];
  const totalEarnings = monthlyBreakdownData?.totalEarnings || 0;
  const currency = monthlyBreakdownData?.currency || 'USD';
  const maxEarning = monthlyEarnings.length > 0 ? Math.max(...monthlyEarnings) : 0;
  
  // Calculate Y-axis values dynamically based on max earning
  const getYAxisValues = () => {
    if (maxEarning === 0) return [100, 75, 50, 25, 0];
    const roundedMax = Math.ceil(maxEarning / 100) * 100;
    return [
      roundedMax,
      Math.round(roundedMax * 0.75),
      Math.round(roundedMax * 0.5),
      Math.round(roundedMax * 0.25),
      0,
    ];
  };
  
  const yAxisValues = getYAxisValues();
  
  // Format Y-axis labels to be shorter
  const formatYAxisLabel = (value: number) => {
    const symbol = currency === 'USD' ? '$' : '₹';
    if (value >= 1000) {
      return `${symbol}${(value / 1000).toFixed(0)}K`;
    }
    return `${symbol}${value}`;
  };
  

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('../../assets/images/logoDark.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <AutoText style={styles.headerTitle} numberOfLines={1}>
            Delivery
          </AutoText>
        </View>
        <View style={styles.iconRow}>
          {/* Online/Offline Switch */}
          <View style={styles.onlineStatusContainer}>
            <AutoText style={styles.onlineStatusText} numberOfLines={1}>
              {isOnline ? 'Online' : 'Offline'}
            </AutoText>
            <Switch
              value={isOnline}
              onValueChange={handleOnlineStatusChange}
              trackColor={{ false: theme.border, true: theme.primary }}
              thumbColor={isOnline ? '#FFFFFF' : theme.textSecondary}
              ios_backgroundColor={theme.border}
            />
          </View>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={() => navigation.navigate('UserProfile', { profileData })}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Delivery Mode Section */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.dashboard.deliveryMode')}</AutoText>
          <AutoText style={styles.sectionSubtitle}>{t('delivery.dashboard.chooseMode')}</AutoText>
          <View style={styles.modeButtons}>
            <TouchableOpacity
              style={[styles.modeButton, deliveryMode === 'deliver' && styles.modeButtonActive]}
              onPress={() => handleDeliveryModeChange('deliver')}
              activeOpacity={0.7}
            >
              <AutoText 
                style={[styles.modeButtonText, deliveryMode === 'deliver' && styles.modeButtonTextActive]}
                numberOfLines={2}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {t('delivery.dashboard.deliver')}
              </AutoText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, deliveryMode === 'deliverPicking' && styles.modeButtonActive]}
              onPress={() => handleDeliveryModeChange('deliverPicking')}
              activeOpacity={0.7}
            >
              <AutoText 
                style={[styles.modeButtonText, styles.modeButtonTextSmall, deliveryMode === 'deliverPicking' && styles.modeButtonTextActive]}
                numberOfLines={3}
                textAlign="center"
                adjustsFontSizeToFit={true}
                minimumFontScale={0.75}
              >
                {t('delivery.dashboard.deliver')}{'\n'}+{'\n'}{t('delivery.dashboard.picker')}
              </AutoText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, deliveryMode === 'picker' && styles.modeButtonActive]}
              onPress={() => handleDeliveryModeChange('picker')}
              activeOpacity={0.7}
            >
              <AutoText 
                style={[styles.modeButtonText, deliveryMode === 'picker' && styles.modeButtonTextActive]}
                numberOfLines={2}
                adjustsFontSizeToFit={true}
                minimumFontScale={0.8}
              >
                {t('delivery.dashboard.picker')}
              </AutoText>
            </TouchableOpacity>
          </View>
        </SectionCard>

        {/* General Waste Collection - Available Pickup Requests */}
        {loadingAvailableRequests ? (
          <SectionCard>
            <View style={styles.acceptOrderLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.acceptOrderLoadingText}>
                {t('common.loading') || 'Loading available requests...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : firstAvailableRequest ? (
          <SectionCard>
            <AutoText style={styles.sectionTitle} numberOfLines={2}>
              {t('delivery.dashboard.generalWaste')}
            </AutoText>
            {firstAvailableRequest.latitude && firstAvailableRequest.longitude && (
              <TouchableOpacity
                style={styles.addressRow}
                onPress={() => navigation.navigate('FullscreenMap', {
                  destination: {
                    latitude: firstAvailableRequest.latitude!,
                    longitude: firstAvailableRequest.longitude!
                  },
                  orderId: firstAvailableRequest.order_number?.toString()
                })}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={2}>
                  {firstAvailableRequest.address}
                </AutoText>
                <MaterialCommunityIcons
                  name="map"
                  size={16}
                  color={theme.primary}
                  style={styles.mapIcon}
                />
              </TouchableOpacity>
            )}
            {!firstAvailableRequest.latitude && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={2}>
                  {firstAvailableRequest.address}
                </AutoText>
              </View>
            )}
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="package-variant"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {firstAvailableRequest.scrap_description}
                {firstAvailableRequest.estimated_weight_kg > 0 && ` (Approx. ${firstAvailableRequest.estimated_weight_kg}kg)`}
              </AutoText>
            </View>
            {firstAvailableRequest.preferred_pickup_time && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="calendar"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={1}>
                  {t('delivery.dashboard.today')}, {firstAvailableRequest.preferred_pickup_time}
                </AutoText>
              </View>
            )}
            <View style={styles.priceRow}>
              <AutoText style={styles.price} numberOfLines={1}>
                ${firstAvailableRequest.estimated_price?.toLocaleString('en-US') || '0'}
              </AutoText>
              <TouchableOpacity
                style={[styles.acceptButton, acceptPickupMutation.isPending && styles.acceptButtonDisabled]}
                onPress={() => {
                  // Haptic feedback
                  if (Platform.OS === 'ios') {
                    Vibration.vibrate(10);
                  } else {
                    Vibration.vibrate(50);
                  }
                  handleAcceptOrder();
                }}
                disabled={acceptPickupMutation.isPending}
                activeOpacity={0.7}
              >
                <AutoText style={styles.acceptButtonText} numberOfLines={1}>
                  {acceptPickupMutation.isPending 
                    ? (t('common.loading') || 'Loading...') 
                    : t('delivery.dashboard.acceptOrder')}
                </AutoText>
                <MaterialCommunityIcons
                  name="arrow-right"
                  size={14}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>
          </SectionCard>
        ) : null}

        {/* Active Pickup */}
        {loadingActivePickup ? (
          <SectionCard>
            <View style={styles.activePickupLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.activePickupLoadingText}>
                {t('common.loading') || 'Loading active pickup...'}
              </AutoText>
            </View>
          </SectionCard>
        ) : activePickup ? (
          <SectionCard>
            <View style={styles.activeHeader}>
              <AutoText style={styles.sectionTitle} numberOfLines={2}>
                {t('delivery.dashboard.activePickup')}
              </AutoText>
              <View style={styles.statusTag}>
                <AutoText style={styles.statusText} numberOfLines={1}>
                  {t('common.scheduled')}
                </AutoText>
              </View>
            </View>
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="package-variant"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={2}>
                {activePickup.scrap_description} (Approx. {activePickup.estimated_weight_kg}kg)
              </AutoText>
            </View>
            {activePickup.address && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons
                  name="map-marker"
                  size={14}
                  color={theme.primary}
                />
                <AutoText style={styles.detailText} numberOfLines={2}>
                  {activePickup.address}
                </AutoText>
              </View>
            )}
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="clock-outline"
                size={14}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {activePickup.pickup_time_display || t('delivery.dashboard.today') || 'Today'}
              </AutoText>
            </View>
            {activePickup.latitude && activePickup.longitude && (
              <TouchableOpacity
                style={styles.mapButton}
                onPress={() => navigation.navigate('FullscreenMap', {
                  destination: {
                    latitude: activePickup.latitude!,
                    longitude: activePickup.longitude!
                  },
                  orderId: activePickup.order_number?.toString()
                })}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name="map"
                  size={16}
                  color={theme.primary}
                />
                <AutoText style={styles.mapButtonText}>
                  {t('delivery.dashboard.viewOnMap') || 'View on Map'}
                </AutoText>
              </TouchableOpacity>
            )}
            <OutlineGreenButton
              title={t('dashboard.viewDetails')}
              onPress={() =>
                navigation.navigate('DeliveryTracking', { orderId: activePickup.order_number })
              }
              style={styles.viewButton}
            />
          </SectionCard>
        ) : null}

        {/* Your Impact */}
        <View style={styles.impactSection}>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('delivery.dashboard.yourImpact')}
          </AutoText>
          <View style={styles.impactRow}>
            <View style={styles.impactCard}>
              <MaterialCommunityIcons
                name="recycle"
                size={16}
                color={theme.primary}
                style={styles.impactIcon}
              />
              <AutoText style={styles.impactValue} numberOfLines={1}>
                {loadingRecyclingStats 
                  ? '...' 
                  : `${recyclingStats?.total_recycled_weight_kg?.toFixed(1) || 0} kg`
                }
              </AutoText>
              <AutoText style={styles.impactLabel} numberOfLines={2}>
                {t('delivery.dashboard.totalRecycled')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {recyclingStats?.total_orders_completed || 0} {t('delivery.dashboard.ordersCompleted') || 'orders'}
              </AutoText>
            </View>
            <View style={styles.impactCard}>
              <MaterialCommunityIcons
                name="leaf"
                size={16}
                color={theme.primary}
                style={styles.impactIcon}
              />
              <AutoText style={styles.impactValue} numberOfLines={1}>
                {loadingRecyclingStats 
                  ? '...' 
                  : `${recyclingStats?.total_carbon_offset_kg?.toFixed(1) || 0} kg`
                }
              </AutoText>
              <AutoText style={styles.impactLabel} numberOfLines={2}>
                {t('delivery.dashboard.carbonOffset')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {recyclingStats?.trees_equivalent 
                  ? `≈${recyclingStats.trees_equivalent.toFixed(0)} ${t('delivery.dashboard.trees') || 'trees'}`
                  : t('delivery.dashboard.equivalentCO2')
                }
              </AutoText>
            </View>
          </View>
        </View>

        {/* Your Earnings */}
        <SectionCard>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('delivery.dashboard.yourEarnings')}
          </AutoText>
          <AutoText style={styles.subtitle} numberOfLines={1}>
            {t('delivery.dashboard.monthlyBreakdown')}
          </AutoText>
          {loadingMonthlyBreakdown ? (
            <View style={styles.chartLoadingContainer}>
              <ActivityIndicator size="small" color={theme.primary} />
              <AutoText style={styles.chartLoadingText}>
                {t('common.loading') || 'Loading earnings...'}
              </AutoText>
            </View>
          ) : monthlyEarnings.length === 0 ? (
            <View style={styles.chartEmptyContainer}>
              <MaterialCommunityIcons
                name="chart-line"
                size={32}
                color={theme.textSecondary}
              />
              <AutoText style={styles.chartEmptyText}>
                {t('delivery.dashboard.noEarningsData') || 'No earnings data available'}
              </AutoText>
            </View>
          ) : (
            <>
              <View style={styles.earningsChart}>
                <View style={styles.chartContainer}>
                  <View style={styles.yAxis}>
                    {yAxisValues.map(value => (
                      <Text key={value} style={styles.yAxisLabel} numberOfLines={1}>
                        {formatYAxisLabel(value)}
                      </Text>
                    ))}
                  </View>
                  <View style={styles.chartBars}>
                    {monthlyEarnings.map((earning, index) => (
                      <View key={index} style={styles.barContainer}>
                        <View
                          style={[
                            styles.bar,
                            { height: `${yAxisValues[0] > 0 ? (earning / yAxisValues[0]) * 100 : 0}%` },
                          ]}
                        />
                      </View>
                    ))}
                  </View>
                </View>
                <View style={styles.chartLabelsContainer}>
                  <View style={styles.yAxisSpacer} />
                  <View style={styles.chartLabels}>
                    {monthLabels.map((month, index) => (
                      <View key={`${month}-${index}`} style={styles.monthLabelContainer}>
                        <Text style={styles.monthLabel} numberOfLines={1}>
                          {month}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
              <Text style={styles.totalEarnings}>
                Total earnings last 6 months: {currency === 'USD' ? '$' : '₹'}{totalEarnings.toLocaleString(currency === 'USD' ? 'en-US' : 'en-IN')}
              </Text>
            </>
          )}
        </SectionCard>

        {/* Categories Operating Section */}
        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <AutoText style={styles.categoriesTitle} numberOfLines={3}>
              {t('delivery.dashboard.categoriesOperating') || 'Categories Operating'}
            </AutoText>
            <TouchableOpacity 
              style={styles.addButton} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AddCategory')}
            >
              <AutoText style={styles.addButtonText} numberOfLines={1}>
                {t('dashboard.add') || 'Add'} +
              </AutoText>
            </TouchableOpacity>
          </View>
          {loadingCategories ? (
            <View style={styles.categoriesLoading}>
              <ActivityIndicator size="small" color={theme.primary} />
            </View>
          ) : userCategories.length === 0 ? (
            <View style={styles.noCategoriesContainer}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={32}
                color={theme.textSecondary}
              />
              <AutoText style={styles.noCategoriesText}>
                {t('dashboard.noCategoriesOperating') || 'No categories operating'}
              </AutoText>
              <AutoText style={styles.noCategoriesSubtext}>
                {t('dashboard.tapAddToSelect') || 'Tap the + button to add categories'}
              </AutoText>
            </View>
          ) : (
          <View style={styles.categoriesGrid}>
              {userCategories.map(category => (
              <CategoryBadge
                  key={category.id}
                  label={category.name}
                  icon={getCategoryIcon(category.name)}
                  image={category.image}
                  onPress={() => handleCategoryPress(category)}
              />
            ))}
          </View>
          )}
        </View>
      </ScrollView>

      {/* Subcategories Modal */}
      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {selectedCategory?.name || t('dashboard.subcategories') || 'Subcategories'}
              </AutoText>
              <TouchableOpacity
                onPress={() => setModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalBody}>
              {loadingSubcategories ? (
                <View style={styles.modalLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <AutoText style={styles.modalLoadingText}>
                    {t('common.loading') || 'Loading subcategories...'}
                  </AutoText>
                </View>
              ) : categorySubcategories.length === 0 ? (
                <View style={styles.modalEmptyContainer}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <AutoText style={styles.modalEmptyText}>
                    {t('dashboard.noSubcategories') || 'No subcategories available'}
                  </AutoText>
                </View>
              ) : (
                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  showsVerticalScrollIndicator={false}
                >
                  {categorySubcategories.map((subcat: any) => (
                    <View key={subcat.id} style={styles.modalSubcategoryItem}>
                      <View style={styles.modalSubcategoryRow}>
                        {/* Subcategory Image */}
                        {subcat.image ? (
                          <Image
                            source={{ uri: subcat.image }}
                            style={styles.modalSubcategoryImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.modalSubcategoryNoImage}>
                            <MaterialCommunityIcons
                              name="image-off"
                              size={24}
                              color={theme.textSecondary}
                            />
                            <AutoText style={styles.modalSubcategoryNoImageText}>
                              {t('dashboard.noImage') || 'No Image'}
                            </AutoText>
                          </View>
                        )}
                        
                        {/* Subcategory Info */}
                        <View style={styles.modalSubcategoryInfo}>
                          <AutoText style={styles.modalSubcategoryName}>
                            {subcat.name}
                          </AutoText>
                          <AutoText style={styles.modalSubcategoryPrice}>
                            {t('dashboard.price') || 'Price'}: ₹{subcat.display_price || '0'}/{subcat.display_price_unit || 'kg'}
                          </AutoText>
                          {subcat.custom_price && (
                            <AutoText style={styles.modalSubcategoryDefaultPrice}>
                              {t('dashboard.defaultPrice') || 'Default'}: ₹{subcat.default_price || '0'}/{subcat.price_unit || 'kg'}
                            </AutoText>
                          )}
                        </View>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme: any, themeName: string) =>
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
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '10@s',
      flexShrink: 1,
      marginRight: '12@s',
    },
    headerLogo: {
      width: '32@s',
      height: '32@s',
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    iconRow: {
      flexDirection: 'row',
      gap: '12@s',
      alignItems: 'center',
      flexShrink: 0,
    },
    onlineStatusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
      paddingHorizontal: '6@s',
      paddingVertical: '2@vs',
      borderRadius: '16@ms',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    onlineStatusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '10@s',
      color: theme.textPrimary,
      minWidth: '35@s',
      maxWidth: '60@s',
      flexShrink: 1,
    },
    iconButton: {
      padding: '4@s',
    },
    scrollContent: {
      paddingHorizontal: '14@s',
      paddingTop: '12@vs',
      paddingBottom: '24@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
    },
    sectionSubtitle: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '4@vs',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
      marginBottom: '6@vs',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      flex: 1,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '12@vs',
    },
    price: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '20@s',
      color: theme.textPrimary,
    },
    acceptButton: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.accent,
      paddingHorizontal: '12@s',
      paddingVertical: '10@vs',
      borderRadius: '12@ms',
      gap: '4@s',
      flexShrink: 1,
      minWidth: 0,
    },
    acceptButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: theme.textPrimary,
      flexShrink: 1,
      minWidth: 0,
    },
    activeHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '10@vs',
      gap: '8@s',
    },
    statusTag: {
      backgroundColor: '#FFB3BA',
      paddingHorizontal: '8@s',
      paddingVertical: '3@vs',
      borderRadius: '10@ms',
      flexShrink: 0,
      maxWidth: '100@s',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '10@s',
      color: '#C2185B',
      flexShrink: 1,
    },
    viewButton: {
      marginTop: '8@vs',
    },
    impactSection: {
      marginBottom: '12@vs',
    },
    impactRow: {
      flexDirection: 'row',
      gap: '8@s',
      marginTop: '8@vs',
    },
    impactCard: {
      flex: 1,
      backgroundColor: theme.card,
      borderRadius: '10@ms',
      padding: '10@s',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
    },
    impactIcon: {
      marginBottom: '4@vs',
    },
    impactValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '2@vs',
    },
    impactLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '9@s',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: '2@vs',
      flexShrink: 1,
      minWidth: 0,
    },
    impactSubLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '8@s',
      color: theme.textSecondary,
      textAlign: 'center',
      flexShrink: 1,
      minWidth: 0,
    },
    subtitle: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '10@vs',
    },
    earningsChart: {
      height: '130@vs',
      marginTop: '8@vs',
      marginBottom: '10@vs',
    },
    chartContainer: {
      flexDirection: 'row',
      height: '100@vs',
      marginBottom: '5@vs',
    },
    yAxis: {
      width: '40@s',
      justifyContent: 'space-between',
      paddingRight: '5@s',
    },
    yAxisLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '8@s',
      color: theme.textSecondary,
      textAlign: 'right',
      numberOfLines: 1,
    },
    chartBars: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'space-between',
      height: '100@vs',
      gap: '2@s',
    },
    barContainer: {
      flex: 1,
      height: '100%',
      justifyContent: 'flex-end',
    },
    bar: {
      width: '100%',
      backgroundColor: theme.primary,
      borderRadius: '2@ms',
      minHeight: '2@vs',
    },
    chartLabelsContainer: {
      flexDirection: 'row',
    },
    yAxisSpacer: {
      width: '40@s',
    },
    chartLabels: {
      flex: 1,
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: '2@s',
    },
    monthLabelContainer: {
      flex: 1,
      alignItems: 'center',
    },
    monthLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    totalEarnings: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    categoriesSection: {
      marginBottom: '10@vs',
    },
    categoriesHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '10@vs',
      gap: '10@s',
    },
    categoriesTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      flex: 1,
      flexShrink: 1,
      minWidth: 0,
      marginRight: '10@s',
    },
    addButton: {
      backgroundColor: theme.accent,
      paddingHorizontal: '16@s',
      paddingVertical: '8@vs',
      borderRadius: '12@ms',
    },
    addButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    categoriesGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    categoriesLoading: {
      paddingVertical: '20@vs',
      alignItems: 'center',
    },
    noCategoriesContainer: {
      paddingVertical: '30@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    noCategoriesText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    noCategoriesSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
      textAlign: 'center',
      opacity: 0.7,
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.card,
      borderTopLeftRadius: '20@ms',
      borderTopRightRadius: '20@ms',
      maxHeight: '80%',
      height: '80%',
    },
    modalBody: {
      flex: 1,
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
    },
    modalCloseButton: {
      padding: '4@s',
    },
    modalLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '40@vs',
    },
    modalLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
    },
    modalEmptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '40@vs',
    },
    modalEmptyText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      padding: '16@s',
    },
    modalSubcategoryItem: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '12@s',
      marginBottom: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    modalSubcategoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@s',
    },
    modalSubcategoryImage: {
      width: '60@s',
      height: '60@s',
      borderRadius: '8@ms',
    },
    modalSubcategoryNoImage: {
      width: '60@s',
      height: '60@s',
      borderRadius: '8@ms',
      backgroundColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalSubcategoryNoImageText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
    },
    modalSubcategoryInfo: {
      flex: 1,
    },
    modalSubcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    modalSubcategoryPrice: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
      marginBottom: '2@vs',
    },
    modalSubcategoryDefaultPrice: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
    },
    modeButtons: {
      flexDirection: 'row',
      gap: '8@s',
      marginTop: '4@vs',
    },
    modeButton: {
      flex: 1,
      minWidth: 0,
      paddingVertical: '12@vs',
      paddingHorizontal: '6@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    modeButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    modeButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textSecondary,
      textAlign: 'center',
      flexShrink: 1,
      width: '100%',
    },
    modeButtonTextSmall: {
      fontSize: '11@s',
      lineHeight: '14@s',
    },
    modeButtonTextActive: {
      color: theme.card,
    },
    chartLoadingContainer: {
      paddingVertical: '40@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    chartEmptyContainer: {
      paddingVertical: '40@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    chartEmptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    activePickupLoading: {
      paddingVertical: '30@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    activePickupLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    mapButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '6@s',
      marginTop: '8@vs',
      paddingVertical: '8@vs',
      paddingHorizontal: '12@s',
      backgroundColor: theme.card,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    mapButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
    },
    acceptOrderLoading: {
      paddingVertical: '30@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptOrderLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    addressRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@s',
      marginBottom: '6@vs',
    },
    mapIcon: {
      marginLeft: 'auto',
    },
    acceptButtonDisabled: {
      opacity: 0.6,
    },
  });

export default DeliveryDashboardScreen;

