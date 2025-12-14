import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Vibration, Platform, Animated, Image, ActivityIndicator, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { CategoryBadge } from '../../components/CategoryBadge';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useTabBar } from '../../context/TabBarContext';
import { useUserMode } from '../../context/UserModeContext';
import LinearGradient from 'react-native-linear-gradient';
import { getUserData } from '../../services/auth/authService';
import { useProfile } from '../../hooks/useProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '../../services/api/v2/categories';
import { useCategories, useUserCategories, useUserSubcategories } from '../../hooks/useCategories';
import { useRecyclingStats } from '../../hooks/useRecycling';
import { useMonthlyBreakdown } from '../../hooks/useEarnings';
import { useActivePickup, useAvailablePickupRequests, useAcceptPickupRequest } from '../../hooks/useOrders';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

const DashboardScreen = () => {
  const { theme, isDark, themeName } = useTheme();
  const { setTabBarVisible } = useTabBar();
  const { mode, setMode } = useUserMode();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

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
  const { data: allCategoriesData, refetch: refetchAllCategories } = useCategories('b2c', true);

  // Get recycling statistics
  const { data: recyclingStats, isLoading: loadingRecyclingStats } = useRecyclingStats(
    userData?.id,
    'customer',
    !!userData?.id
  );

  // Get monthly earnings breakdown
  const { data: monthlyBreakdownData, isLoading: loadingMonthlyBreakdown } = useMonthlyBreakdown(
    userData?.id,
    'customer',
    6,
    !!userData?.id
  );

  // Get active pickup order (for R type users in B2C dashboard)
  const { data: activePickup, isLoading: loadingActivePickup } = useActivePickup(
    userData?.id,
    'R', // B2C dashboard is for R (Retailer) type users
    !!userData?.id
  );

  // Get available pickup requests (for accepting new orders)
  const { data: availablePickupRequests, isLoading: loadingAvailableRequests, refetch: refetchAvailableRequests } = useAvailablePickupRequests(
    userData?.id,
    'R', // B2C dashboard is for R (Retailer) type users
    undefined, // No location filtering for now
    undefined,
    10,
    !!userData?.id
  );

  // Accept pickup request mutation
  const acceptPickupMutation = useAcceptPickupRequest();

  // Get first available request to show in "Accept Waste Collection" section
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
        userType: 'R'
      });
      // Refetch available requests after accepting
      refetchAvailableRequests();
    } catch (error) {
      console.error('Error accepting order:', error);
    }
  };

  // Refetch all category data when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          console.log('🔄 Dashboard focused - refetching category data...');
          // Just refetch, no need to invalidate on focus
          refetchUserCategories();
          refetchUserSubcategories();
          refetchAllCategories();
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, refetchUserCategories, refetchUserSubcategories, refetchAllCategories, queryClient])
  );

  // Listen for navigation events to refetch when returning from AddCategoryScreen
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (userData?.id) {
        console.log('🔄 Navigation focus - refetching category data...');
        // Refetch all category-related data
        refetchUserCategories();
        refetchUserSubcategories();
        refetchAllCategories();
      }
    });

    return unsubscribe;
  }, [navigation, userData?.id, refetchUserCategories, refetchUserSubcategories, refetchAllCategories, queryClient]);
  
  // Refetch when modal opens to ensure we have latest subcategories
  React.useEffect(() => {
    if (modalVisible && userData?.id && selectedCategory?.id) {
      // Force refetch to get latest data
      refetchUserSubcategories();
      refetchUserCategories();
    }
  }, [modalVisible, userData?.id, selectedCategory?.id, refetchUserSubcategories, refetchUserCategories]);

  // Process user categories
  const userCategories = React.useMemo(() => {
    if (!userCategoriesData?.data?.category_ids || !allCategoriesData?.data) {
      return [];
    }
    const userCategoryIds = userCategoriesData.data.category_ids.map(id => Number(id));
    return allCategoriesData.data.filter(cat => {
      const catId = Number(cat.id);
      const matches = userCategoryIds.includes(catId);
      
      // Debug logging
      if (!matches && userCategoryIds.length > 0) {
        console.log(`🔍 Category "${cat.name}" (ID: ${catId}) not in user categories:`, {
          userCategoryIds,
          catIdType: typeof cat.id,
          userCategoryIdsTypes: userCategoryIds.map(id => typeof id)
        });
      }
      
      return matches;
    });
  }, [userCategoriesData, allCategoriesData]);

  // Process category subcategories - only show user's selected subcategories for the selected category
  const categorySubcategories = React.useMemo(() => {
    console.log(`🔄 [categorySubcategories] Recomputing...`, {
      hasSelectedCategory: !!selectedCategory,
      selectedCategoryId: selectedCategory?.id,
      selectedCategoryName: selectedCategory?.name,
      hasUserSubcategoriesData: !!userSubcategoriesData,
      hasSubcategoriesArray: !!userSubcategoriesData?.data?.subcategories,
      subcategoriesCount: userSubcategoriesData?.data?.subcategories?.length || 0
    });
    
    if (!selectedCategory?.id) {
      console.log(`⚠️ [categorySubcategories] No selected category`);
      return [];
    }
    
    if (!userSubcategoriesData?.data?.subcategories) {
      console.log(`⚠️ [categorySubcategories] No user subcategories data`);
      return [];
    }
    
    // Convert category ID to number for comparison
    const categoryId = Number(selectedCategory.id);
    
    // Filter user's subcategories by the selected category
    // Use Number() conversion to handle type mismatches (string vs number)
    console.log(`🔍 [categorySubcategories] Filtering subcategories for category "${selectedCategory.name}" (ID: ${categoryId}, type: ${typeof selectedCategory.id})`);
    console.log(`📊 [categorySubcategories] Total user subcategories: ${userSubcategoriesData.data.subcategories.length}`);
    
    const userSubcatsForCategory = userSubcategoriesData.data.subcategories.filter(
      (us: any) => {
        const subcatCategoryId = Number(us.main_category_id);
        const matches = subcatCategoryId === categoryId;
        
        if (!matches) {
          console.log(`  ❌ Mismatch: subcategory "${us.name}" has main_category_id ${us.main_category_id} (${typeof us.main_category_id}) = ${subcatCategoryId}, category ID is ${categoryId}`);
        }
        
        return matches;
      }
    );
    
    console.log(`✅ [categorySubcategories] Found ${userSubcatsForCategory.length} subcategories for category "${selectedCategory.name}"`);
    
    if (userSubcatsForCategory.length === 0) {
      // Debug logging when no subcategories found
      console.log(`⚠️ [categorySubcategories] No subcategories found for category "${selectedCategory.name}" (ID: ${categoryId})`);
      console.log(`📋 [categorySubcategories] Sample subcategories:`, userSubcategoriesData.data.subcategories.slice(0, 3).map((us: any) => ({
        name: us.name,
        subcategory_id: us.subcategory_id,
        main_category_id: us.main_category_id,
        main_category_id_type: typeof us.main_category_id,
        main_category_id_number: Number(us.main_category_id)
      })));
      return [];
    }
    
    // Get full subcategory details from API if needed, or use what we have
    // Since we already have the data from userSubcategories, we can use it directly
    const mapped = userSubcatsForCategory.map((userSubcat: any) => ({
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
    
    console.log(`✅ [categorySubcategories] Mapped ${mapped.length} subcategories:`, mapped.map(s => s.name));
    
    return mapped;
  }, [selectedCategory?.id, selectedCategory?.name, userSubcategoriesData]);

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

  // Handle category press - open modal only if subcategories exist
  const handleCategoryPress = (category: Category) => {
    console.log(`🎯 [handleCategoryPress] Category clicked:`, {
      name: category.name,
      id: category.id,
      idType: typeof category.id,
      idNumber: Number(category.id)
    });
    
    // Check if there are subcategories for this category
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

  // Sync AsyncStorage with latest approval status when profile is fetched
  React.useEffect(() => {
    const syncB2CStatus = async () => {
      if (profileData?.shop?.approval_status && userData?.id) {
        try {
          const approvalStatus = profileData.shop.approval_status;
          await AsyncStorage.setItem('@b2c_approval_status', approvalStatus);
          console.log('✅ DashboardScreen: Synced @b2c_approval_status to AsyncStorage:', approvalStatus);
          
          // If rejected, navigate to signup screen
          if (approvalStatus === 'rejected') {
            console.log('✅ B2C approval status is rejected - navigating to B2CSignup');
            // Small delay to ensure navigation is ready
            setTimeout(() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'B2CSignup' }],
              });
            }, 500);
          }
        } catch (error) {
          console.error('❌ Error syncing B2C status:', error);
        }
      }
    };
    
    syncB2CStatus();
  }, [profileData?.shop?.approval_status, userData?.id, navigation]);

  const handleSwitchMode = async () => {
    if (isSwitchingMode) return;
    setIsSwitchingMode(true);
    try {
      await setMode('b2b');
    } catch (error) {
      console.error('Error switching mode:', error);
    } finally {
      setIsSwitchingMode(false);
    }
  };

  // Show tab bar when Dashboard is focused
  useFocusEffect(
    React.useCallback(() => {
      setTabBarVisible(true);
    }, [setTabBarVisible])
  );

  // Use API data for earnings breakdown, fallback to empty if loading
  const monthlyEarnings = monthlyBreakdownData?.monthlyBreakdown?.map(month => month.earnings) || [];
  const monthLabels = monthlyBreakdownData?.monthlyBreakdown?.map(month => month.monthName) || [];
  const totalEarnings = monthlyBreakdownData?.totalEarnings || 0;
  const maxEarning = monthlyEarnings.length > 0 ? Math.max(...monthlyEarnings) : 0;
  
  // Calculate Y-axis values dynamically based on max earning
  const getYAxisValues = () => {
    if (maxEarning === 0) return [100, 75, 50, 25, 0];
    const roundedMax = Math.ceil(maxEarning / 10000) * 10000;
    return [
      roundedMax,
      Math.round(roundedMax * 0.75),
      Math.round(roundedMax * 0.5),
      Math.round(roundedMax * 0.25),
      0,
    ];
  };
  
  const yAxisValues = getYAxisValues();
  
  // Format Y-axis labels to be shorter (e.g., 50K instead of 50,000)
  const formatYAxisLabel = (value: number) => {
    if (value >= 100000) {
      return `₹${(value / 100000).toFixed(1)}L`;
    } else if (value >= 1000) {
      return `₹${(value / 1000).toFixed(0)}K`;
    }
    return `₹${value}`;
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

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('../../assets/images/logoDark.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <AutoText style={styles.headerTitle} numberOfLines={1}>
            B2C
          </AutoText>
        </View>
        <View style={styles.iconRow}>
          <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
            <MaterialCommunityIcons name="bell-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.switchButton}
            activeOpacity={0.8}
            onPress={handleSwitchMode}
            disabled={isSwitchingMode}
          >
            <LinearGradient
              colors={themeName === 'dark' ? ['#4A90E2', '#357ABD'] : [theme.primary, theme.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.switchButtonGradient}
            >
              <MaterialCommunityIcons name="office-building" size={16} color="#FFFFFF" />
              <Text style={styles.switchButtonText}>
                {isSwitchingMode ? '...' : 'B2B'}
              </Text>
            </LinearGradient>
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
        <SectionCard>
          <AutoText style={styles.sectionTitle} numberOfLines={2}>
            {t('dashboard.acceptWasteCollection')}
          </AutoText>
          <AutoText style={styles.detailText} numberOfLines={1}>
            {t('dashboard.client')}: EcoSolutions Inc.
          </AutoText>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={14}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={2}>
              House No. 45, Sector 12, Noida, Uttar Pradesh - 201301
            </AutoText>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="calendar"
              size={14}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              Today, 10:00 AM - 12:00 PM
            </AutoText>
          </View>
          <View style={styles.priceRow}>
            <AutoText style={styles.price} numberOfLines={1}>
              ₹2,100
            </AutoText>
            <TouchableOpacity
              style={styles.acceptButton}
              onPress={() => {
                // Haptic feedback
                if (Platform.OS === 'ios') {
                  Vibration.vibrate(10);
                } else {
                  Vibration.vibrate(50);
                }
              }}
              activeOpacity={0.7}
            >
              <AutoText style={styles.acceptButtonText} numberOfLines={1}>
                {t('dashboard.acceptOrder')}
              </AutoText>
              <MaterialCommunityIcons
                name="arrow-right"
                size={14}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
          </View>
        </SectionCard>

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
                {t('dashboard.activePickup')}
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
                {activePickup.pickup_time_display || t('dashboard.today') || 'Today'}
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
                  {t('dashboard.viewOnMap') || 'View on Map'}
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

        <View style={styles.impactSection}>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('dashboard.yourImpact')}
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
                {t('dashboard.totalRecycled')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {recyclingStats?.total_orders_completed || 0} {t('dashboard.ordersCompleted') || 'orders'}
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
                {t('dashboard.carbonOffset')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {recyclingStats?.trees_equivalent 
                  ? `≈${recyclingStats.trees_equivalent.toFixed(0)} ${t('dashboard.trees') || 'trees'}`
                  : t('dashboard.equivalentCO2')
                }
              </AutoText>
            </View>
          </View>
        </View>

        <SectionCard>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('dashboard.yourEarnings')}
          </AutoText>
          <AutoText style={styles.subtitle} numberOfLines={1}>
            {t('dashboard.monthlyBreakdown')}
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
                {t('dashboard.noEarningsData') || 'No earnings data available'}
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
                Total earnings last 6 months: ₹{totalEarnings.toLocaleString('en-IN')}
              </Text>
            </>
          )}
        </SectionCard>

        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <AutoText style={styles.categoriesTitle} numberOfLines={3}>
              {t('dashboard.categoriesOperating')}
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
              ) : !userSubcategoriesData?.data?.subcategories ? (
                <View style={styles.modalEmptyContainer}>
                  <MaterialCommunityIcons
                    name="package-variant-closed"
                    size={48}
                    color={theme.textSecondary}
                  />
                  <AutoText style={styles.modalEmptyText}>
                    {t('dashboard.noSubcategories') || 'No subcategories data available'}
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
                  <AutoText style={[styles.modalEmptyText, { fontSize: 12, marginTop: 8 }]}>
                    Category ID: {selectedCategory?.id}, Found: {categorySubcategories.length}
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
    headerTitleContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '10@s',
      flexShrink: 1,
      marginRight: '12@s',
    },
    headerLogo: {
      width: '32@s',
      height: '32@s',
      marginTop: '2@vs',
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      marginTop: '4@vs',
    },
    iconRow: {
      flexDirection: 'row',
      gap: '12@s',
      alignItems: 'center',
      flexShrink: 0,
    },
    iconButton: {
      padding: '4@s',
    },
    switchButton: {
      borderRadius: '8@ms',
      overflow: 'hidden',
    },
    switchButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      gap: '4@s',
    },
    switchButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: '#FFFFFF',
    },
    scrollContent: {
      paddingHorizontal: '14@s',
      paddingTop: '12@vs',
      paddingBottom: '24@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '10@vs',
      flex: 1,
      flexShrink: 1,
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
      paddingHorizontal: '16@s',
      paddingVertical: '10@vs',
      borderRadius: '12@ms',
      gap: '4@s',
    },
    acceptButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
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
      paddingHorizontal: '10@s',
      paddingVertical: '3@vs',
      borderRadius: '10@ms',
      flexShrink: 0,
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: '#C2185B',
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
      fontSize: '10@s',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: '2@vs',
    },
    impactSubLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '8@s',
      color: theme.textSecondary,
      textAlign: 'center',
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
    subcategoriesContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      gap: '8@s',
    },
    subcategoryBadge: {
      width: '48%',
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '10@vs',
    },
    subcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    subcategoryPrice: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
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
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    modalBody: {
      flex: 1,
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
      paddingVertical: '40@vs',
      alignItems: 'center',
    },
    modalLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
    },
    modalEmptyContainer: {
      paddingVertical: '40@vs',
      alignItems: 'center',
    },
    modalEmptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    modalScrollView: {
      flex: 1,
    },
    modalScrollContent: {
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
      paddingBottom: '20@vs',
    },
    modalSubcategoryItem: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '16@s',
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
      backgroundColor: theme.card,
    },
    modalSubcategoryNoImage: {
      width: '60@s',
      height: '60@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '4@vs',
    },
    modalSubcategoryNoImageText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '9@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    modalSubcategoryInfo: {
      flex: 1,
    },
    modalSubcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    modalSubcategoryPrice: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
      marginBottom: '4@vs',
    },
    modalSubcategoryDefaultPrice: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
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

export default DashboardScreen;

