import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, DeviceEventEmitter, ActivityIndicator, Modal, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigationState, useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { SectionCard } from '../../components/SectionCard';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useUserMode } from '../../context/UserModeContext';
import LinearGradient from 'react-native-linear-gradient';
import { getUserData } from '../../services/auth/authService';
import { useProfile } from '../../hooks/useProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Category } from '../../services/api/v2/categories';
import { useCategories, useUserCategories, useUserSubcategories } from '../../hooks/useCategories';
import { CategoryBadge } from '../../components/CategoryBadge';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

const DealerDashboardScreen = () => {
  const { theme, isDark, themeName } = useTheme();
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
  const { data: allCategoriesData, refetch: refetchAllCategories } = useCategories('b2b', true);

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
    if (!selectedCategory?.id || !userSubcategoriesData?.data?.subcategories) {
      return [];
    }
    
    // Convert category ID to number for comparison
    const categoryId = Number(selectedCategory.id);
    
    // Filter user's subcategories by the selected category
    // Use Number() conversion to handle type mismatches (string vs number)
    console.log(`🔍 Filtering subcategories for category "${selectedCategory.name}" (ID: ${categoryId})`);
    console.log(`📊 Total user subcategories: ${userSubcategoriesData.data.subcategories.length}`);
    
    const userSubcatsForCategory = userSubcategoriesData.data.subcategories.filter(
      (us: any) => {
        const subcatCategoryId = Number(us.main_category_id);
        const matches = subcatCategoryId === categoryId;
        
        return matches;
      }
    );
    
    console.log(`✅ Found ${userSubcatsForCategory.length} subcategories for category "${selectedCategory.name}"`);
    
    if (userSubcatsForCategory.length === 0) {
      // Debug logging when no subcategories found
      console.log(`⚠️ No subcategories found for category "${selectedCategory.name}" (ID: ${categoryId})`);
      console.log(`📋 All user subcategories:`, userSubcategoriesData.data.subcategories.map((us: any) => ({
        name: us.name,
        subcategory_id: us.subcategory_id,
        main_category_id: us.main_category_id,
        main_category_id_type: typeof us.main_category_id,
        main_category_id_number: Number(us.main_category_id)
      })));
      return [];
    }
    
    // Return user's subcategories with their custom prices
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
      // Force refetch to get latest data
      refetchUserSubcategories();
      refetchUserCategories();
    }
  }, [modalVisible, userData?.id, selectedCategory?.id, refetchUserSubcategories, refetchUserCategories]);

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

  // Fetch profile data with refetch capability
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);
  
  // Refetch profile when screen comes into focus to get latest data
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          refetchProfile();
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, refetchProfile])
  );

  // Handle category press - open modal only if subcategories exist
  const handleCategoryPress = (category: Category) => {
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
    const syncB2BStatus = async () => {
      if (profileData?.shop?.approval_status && userData?.id) {
        try {
          const approvalStatus = profileData.shop.approval_status;
          await AsyncStorage.setItem('@b2b_status', approvalStatus);
          console.log('✅ DealerDashboardScreen: Synced @b2b_status to AsyncStorage:', approvalStatus);
          
          // If rejected, navigate to signup screen
          if (approvalStatus === 'rejected') {
            console.log('✅ B2B approval status is rejected - navigating to DealerSignup');
            // Small delay to ensure navigation is ready
            setTimeout(() => {
              navigation.reset({
                index: 0,
                routes: [{ name: 'DealerSignup' }],
              });
            }, 500);
          }
          // If B2B is approved, add B2C to allowed dashboards
          else if (approvalStatus === 'approved') {
            const storedDashboards = await AsyncStorage.getItem('@allowed_dashboards');
            let dashboards: ('b2b' | 'b2c' | 'delivery')[] = [];
            
            if (storedDashboards) {
              try {
                dashboards = JSON.parse(storedDashboards);
              } catch (e) {
                console.error('Error parsing allowed dashboards:', e);
              }
            }
            
            // Ensure B2B is in the list
            if (!dashboards.includes('b2b')) {
              dashboards.push('b2b');
            }
            
            // Add B2C if not already present
            if (!dashboards.includes('b2c')) {
              dashboards.push('b2c');
              console.log('✅ DealerDashboardScreen: B2B approved - added B2C to allowed dashboards');
              await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(dashboards));
              
              // Emit event to notify AppNavigator to refresh allowed dashboards
              DeviceEventEmitter.emit('B2B_STATUS_UPDATED');
            }
          }
        } catch (error) {
          console.error('❌ Error syncing B2B status:', error);
        }
      }
    };
    
    syncB2BStatus();
  }, [profileData?.shop?.approval_status, userData?.id]);

  // If signup is complete (has all documents), allow dashboard access
  // Even if approval status is pending, user can access dashboard

  const handleSwitchMode = async () => {
    if (isSwitchingMode) return;
    setIsSwitchingMode(true);
    try {
      await setMode('b2c');
    } catch (error) {
      console.error('Error switching mode:', error);
    } finally {
      setIsSwitchingMode(false);
    }
  };

  const purchaseOrders = [
    { id: 'PO-2024-001', status: 'Invoiced', quantity: 2.5, amount: 150000, date: '2024-07-28' },
    { id: 'PO-2024-002', status: 'Pending', quantity: 1.0, amount: 60000, date: '2024-07-27' },
  ];

  const salesOrders = [
    { id: 'SO-2024-005', status: 'Completed', quantity: 5.0, amount: 300000, date: '2024-07-29' },
    { id: 'SO-2024-006', status: 'Shipped', quantity: 3.0, amount: 180000, date: '2024-07-26' },
  ];

  const formatQuantity = (qty: number) => `${qty} ${t('dealerDashboard.metricTons')}`;
  const formatAmount = (amt: number) => `₹${amt.toLocaleString('en-IN')}`;
  
  const getStatusTranslation = (status: string) => {
    switch (status) {
      case 'Invoiced':
        return t('dealerDashboard.invoiced');
      case 'Pending':
        return t('common.pending');
      case 'Completed':
        return t('common.completed');
      case 'Shipped':
        return t('dealerDashboard.shipped');
      default:
        return status;
    }
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
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleContainer}>
          <Image
            source={require('../../assets/images/logoDark.png')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <AutoText style={styles.headerTitle} numberOfLines={1}>
            B2B
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
              <MaterialCommunityIcons name="account" size={16} color="#FFFFFF" />
              <Text style={styles.switchButtonText}>
                {isSwitchingMode ? '...' : 'B2C'}
              </Text>
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconButton}
            activeOpacity={0.7}
            onPress={() => {
              navigation.navigate('UserProfile', { profileData });
            }}
          >
            <MaterialCommunityIcons name="account-circle-outline" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Scrap rates card */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('dealerDashboard.liveScrapPrices')}</AutoText>
          <View style={styles.priceRow}>
            <View style={styles.priceColumn}>
              <AutoText style={styles.priceLabel}>{t('dealerDashboard.aluminium')}</AutoText>
              <View style={styles.priceValueRow}>
                <AutoText style={styles.priceValue}>₹185</AutoText>
                <View style={styles.changePositive}>
                  <MaterialCommunityIcons name="arrow-up" size={14} color={theme.primary} />
                  <AutoText style={styles.changeText}>1.50%</AutoText>
                </View>
              </View>
              <AutoText style={styles.dailyLabel}>{t('dealerDashboard.daily')}</AutoText>
            </View>
            <View style={styles.priceColumn}>
              <AutoText style={styles.priceLabel}>{t('dealerDashboard.copper')}</AutoText>
              <View style={styles.priceValueRow}>
                <AutoText style={styles.priceValue}>₹650</AutoText>
                <View style={styles.changePositive}>
                  <MaterialCommunityIcons name="arrow-up" size={14} color={theme.primary} />
                  <AutoText style={styles.changeText}>0.80%</AutoText>
                </View>
              </View>
              <AutoText style={styles.dailyLabel}>{t('dealerDashboard.daily')}</AutoText>
            </View>
          </View>
        </SectionCard>

        {/* Action buttons */}
        <View style={styles.buttonRow}>
          <View style={styles.buttonContainer}>
            <GreenButton
              title={t('dealerDashboard.initiateNewRequest')}
              onPress={() => navigation.navigate('BulkScrapRequest')}
            />
          </View>
          <View style={styles.buttonContainer}>
            <OutlineGreenButton
              title={t('dealerDashboard.bulkSell')}
              onPress={() => {}}
            />
          </View>
        </View>

        {/* Purchase Orders */}
        <View style={styles.sectionHeader}>
          <AutoText style={styles.sectionTitle}>{t('dealerDashboard.purchaseOrders')}</AutoText>
          <TouchableOpacity activeOpacity={0.7}>
            <AutoText style={styles.viewAllLink}>{t('dealerDashboard.viewAll')}</AutoText>
          </TouchableOpacity>
        </View>

        {purchaseOrders.map((order) => (
          <SectionCard key={order.id} style={styles.orderCard}>
            <TouchableOpacity
              style={styles.orderRow}
              activeOpacity={0.7}
              onPress={() => {}}
            >
              <View style={styles.orderInfo}>
                <AutoText style={styles.orderId}>{order.id}</AutoText>
                <View style={styles.orderDetails}>
                  <AutoText style={styles.orderDetail}>{formatQuantity(order.quantity)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{formatAmount(order.amount)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{order.date}</AutoText>
                </View>
                <View style={[styles.statusBadge, order.status === 'Invoiced' && styles.statusBadgeSuccess]}>
                  <AutoText style={styles.statusText}>
                    {getStatusTranslation(order.status)}
                  </AutoText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </SectionCard>
        ))}

        {/* Sales Orders */}
        <View style={styles.sectionHeader}>
          <AutoText style={styles.sectionTitle}>{t('dealerDashboard.salesOrders')}</AutoText>
          <TouchableOpacity activeOpacity={0.7}>
            <AutoText style={styles.viewAllLink}>{t('dealerDashboard.viewAll')}</AutoText>
          </TouchableOpacity>
        </View>

        {salesOrders.map((order) => (
          <SectionCard key={order.id} style={styles.orderCard}>
            <TouchableOpacity
              style={styles.orderRow}
              activeOpacity={0.7}
              onPress={() => {}}
            >
              <View style={styles.orderInfo}>
                <AutoText style={styles.orderId}>{order.id}</AutoText>
                <View style={styles.orderDetails}>
                  <AutoText style={styles.orderDetail}>{formatQuantity(order.quantity)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{formatAmount(order.amount)}</AutoText>
                  <AutoText style={styles.orderDetail}> • </AutoText>
                  <AutoText style={styles.orderDetail}>{order.date}</AutoText>
                </View>
                <View style={[styles.statusBadge, order.status === 'Completed' && styles.statusBadgeSuccess]}>
                  <AutoText style={styles.statusText}>
                    {getStatusTranslation(order.status)}
                  </AutoText>
                </View>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </SectionCard>
        ))}

        {/* Categories Operating Section */}
        <View style={styles.categoriesSection}>
          <View style={styles.categoriesHeader}>
            <AutoText style={styles.categoriesTitle} numberOfLines={3}>
              {t('dashboard.categoriesOperating') || 'Categories Operating'}
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
      paddingHorizontal: '18@s',
      paddingTop: '18@vs',
      paddingBottom: '24@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '14@vs',
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      gap: '14@s',
    },
    priceColumn: {
      flex: 1,
    },
    priceLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginBottom: '8@vs',
    },
    priceValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
      marginBottom: '4@vs',
    },
    priceValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '20@s',
      color: theme.textPrimary,
    },
    changePositive: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '4@s',
      backgroundColor: theme.accent + '40',
      paddingVertical: '4@vs',
      paddingHorizontal: '8@s',
      borderRadius: '8@ms',
    },
    changeText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
    },
    dailyLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: '12@s',
      marginBottom: '18@vs',
    },
    buttonContainer: {
      flex: 1,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@vs',
      marginTop: '4@vs',
    },
    viewAllLink: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    orderCard: {
      marginBottom: '12@vs',
    },
    orderRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    orderInfo: {
      flex: 1,
    },
    orderId: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    orderDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8@vs',
    },
    orderDetail: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    statusBadge: {
      alignSelf: 'flex-start',
      paddingVertical: '4@vs',
      paddingHorizontal: '10@s',
      borderRadius: '8@ms',
      backgroundColor: theme.border,
      marginTop: '8@vs',
    },
    statusBadgeSuccess: {
      backgroundColor: theme.accent + '40',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.primary,
    },
    categoriesSection: {
      marginTop: '18@vs',
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
  });

export default DealerDashboardScreen;

