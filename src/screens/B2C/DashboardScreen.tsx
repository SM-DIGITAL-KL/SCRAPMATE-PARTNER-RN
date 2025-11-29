import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Vibration, Platform, Animated, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { CategoryBadge } from '../../components/CategoryBadge';
import { AutoText } from '../../components/AutoText';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useTabBar } from '../../context/TabBarContext';
import { useUserMode } from '../../context/UserModeContext';
import LinearGradient from 'react-native-linear-gradient';
import { getUserData } from '../../services/auth/authService';
import { useProfile } from '../../hooks/useProfile';

const DashboardScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const { setTabBarVisible } = useTabBar();
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

  // Fetch profile data
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);

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

  // Dynamic earnings data for last 6 months
  const monthlyEarnings = [16666, 29166, 37500, 45833, 50000, 48333];
  const maxEarning = Math.max(...monthlyEarnings);
  const totalEarnings = monthlyEarnings.reduce((sum, val) => sum + val, 0);
  
  // Get last 6 months dynamically
  const getLast6Months = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      last6Months.push(months[date.getMonth()]);
    }
    return last6Months;
  };
  
  const monthLabels = getLast6Months();
  
  // Calculate Y-axis values dynamically based on max earning
  const getYAxisValues = () => {
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
              Mixed Recyclables (Approx. 20kg)
            </AutoText>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="clock-outline"
              size={14}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              Today, 3:00 PM - 5:00 PM
            </AutoText>
          </View>
          <OutlineGreenButton
            title={t('dashboard.viewDetails')}
            onPress={() =>
              navigation.navigate('DeliveryTracking', { orderId: 'DEL12345' })
            }
            style={styles.viewButton}
          />
        </SectionCard>

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
                120 kg
              </AutoText>
              <AutoText style={styles.impactLabel} numberOfLines={2}>
                {t('dashboard.totalRecycled')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {t('dashboard.thisMonth')}
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
                500 kg
              </AutoText>
              <AutoText style={styles.impactLabel} numberOfLines={2}>
                {t('dashboard.carbonOffset')}
              </AutoText>
              <AutoText style={styles.impactSubLabel} numberOfLines={1}>
                {t('dashboard.equivalentCO2')}
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
                        { height: `${(earning / yAxisValues[0]) * 100}%` },
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
  });

export default DashboardScreen;

