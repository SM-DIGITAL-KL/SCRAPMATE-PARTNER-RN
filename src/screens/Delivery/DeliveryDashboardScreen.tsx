import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, Text, Vibration, Platform, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
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

const DeliveryDashboardScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setMode } = useUserMode();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [allowedDashboards, setAllowedDashboards] = useState<('b2b' | 'b2c' | 'delivery')[]>([]);
  const [userData, setUserData] = useState<any>(null);
  
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
  
  const categories = [
    { label: t('categories.plastic'), icon: 'bottle-soda' },
    { label: t('categories.metal'), icon: 'aluminum' },
    { label: t('categories.paper'), icon: 'file-document' },
    { label: t('categories.wood'), icon: 'tree' },
    { label: t('categories.mixed'), icon: 'package-variant' },
    { label: t('categories.organic'), icon: 'sprout' },
  ];

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

        {/* Categories Operating */}
        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <AutoText style={styles.categoriesTitle} numberOfLines={3}>
              {t('delivery.dashboard.categoriesOperating')}
            </AutoText>
            <TouchableOpacity 
              style={styles.addButton} 
              activeOpacity={0.7}
              onPress={() => navigation.navigate('AddCategory')}
            >
              <AutoText style={styles.addButtonText} numberOfLines={1}>
                {t('dashboard.add')} +
              </AutoText>
            </TouchableOpacity>
          </View>
          <View style={styles.categoriesGrid}>
            {categories.map(category => (
              <CategoryBadge
                key={category.label}
                label={category.label}
                icon={category.icon}
              />
            ))}
          </View>
        </View>
      </ScrollView>
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

