import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Image, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigationState } from '@react-navigation/native';
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

const DealerDashboardScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const { mode, setMode } = useUserMode();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

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

  // Sync AsyncStorage with latest approval status when profile is fetched
  React.useEffect(() => {
    const syncB2BStatus = async () => {
      if (profileData?.shop?.approval_status && userData?.id) {
        try {
          const approvalStatus = profileData.shop.approval_status;
          await AsyncStorage.setItem('@b2b_status', approvalStatus);
          console.log('✅ DealerDashboardScreen: Synced @b2b_status to AsyncStorage:', approvalStatus);
          
          // If B2B is approved, add B2C to allowed dashboards
          if (approvalStatus === 'approved') {
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
  });

export default DealerDashboardScreen;

