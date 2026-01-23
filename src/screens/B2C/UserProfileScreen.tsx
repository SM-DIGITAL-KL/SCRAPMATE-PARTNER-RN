import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Modal, StatusBar, Platform, Alert, DeviceEventEmitter, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { GreenButton } from '../../components/GreenButton';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n/config';
import { useUserMode } from '../../context/UserModeContext';
import { getUserData, logout } from '../../services/auth/authService';
import { useProfile } from '../../hooks/useProfile';
import { deleteAccount } from '../../services/api/v2/profile';
import { useUserSubcategoryRequests } from '../../hooks/useCategories';
import { APP_VERSION, APP_NAME } from '../../constants/version';

const UserProfileScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName, setTheme } = useTheme();

  // Get button text color based on theme
  const getButtonTextColor = () => {
    if (themeName === 'darkGreen') {
      return '#FF6B6B'; // Lighter red for better contrast on black
    }
    return '#FF4C4C'; // Standard red for other themes
  };

  const buttonTextColor = getButtonTextColor();

  // Get premium button text color based on theme for better contrast
  const getPremiumButtonTextColor = () => {
    if (themeName === 'dark') {
      // Dark theme has white primary, so use dark text
      return '#000000';
    } else if (themeName === 'darkGreen') {
      // Dark green theme - use light text
      return theme.textPrimary;
    } else {
      // Light themes - use white text
      return '#FFFFFF';
    }
  };

  const premiumButtonTextColor = getPremiumButtonTextColor();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { mode } = useUserMode();
  const currentLanguage = i18n.language;
  const isEnglish = currentLanguage === 'en';
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showDeleteAccountModal, setShowDeleteAccountModal] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  
  // Check if user is B2B - hide premium button for B2B users
  const isB2BUser = userData?.user_type === 'S' || mode === 'b2b';
  const styles = useMemo(() => getStyles(theme, isEnglish, isDark, themeName), [theme, isEnglish, isDark, themeName]);

  // Get profile data from route params (passed from dashboard)
  const profileDataFromParams = route?.params?.profileData;

  // Load user data
  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
      };
      loadUserData();
    }, [])
  );

  // Use React Query hook for profile - always enabled to get fresh data
  const { data: profileFromQuery, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);

  // Fetch user's subcategory requests to check for pending ones
  const { data: subcategoryRequestsData } = useUserSubcategoryRequests(userData?.id, !!userData?.id);

  // Check if user has any pending subcategory requests
  const hasPendingSubcategoryRequests = React.useMemo(() => {
    if (!subcategoryRequestsData?.data) return false;
    return subcategoryRequestsData.data.some(
      (request: any) => request.approval_status === 'pending'
    );
  }, [subcategoryRequestsData]);

  // Refetch profile when screen comes into focus to get latest updates
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        refetchProfile();
      }
    }, [userData?.id, refetchProfile])
  );

  // Prioritize query result over params to ensure fresh data (especially invoices)
  // Always prefer query result as it has the latest data including invoices
  // Route params might not have invoices, so we need the query result
  const profile = profileFromQuery || profileDataFromParams;
  
  // If we only have params but no query result, log a warning
  if (profileDataFromParams && !profileFromQuery) {
    console.warn('⚠️ [UserProfile] Using profile from params - invoices may be missing. Waiting for query result...');
  }
  const completionPercentage = profile?.completion_percentage || 32;
  
  // Debug: Log profile data to check for invoices
  useEffect(() => {
    if (profile) {
      console.log('🔍 [UserProfile] Profile data:', {
        hasInvoices: !!(profile as any)?.invoices,
        invoicesCount: ((profile as any)?.invoices || []).length,
        source: profileFromQuery ? 'query' : 'params',
        hasProfileFromQuery: !!profileFromQuery,
        hasProfileFromParams: !!profileDataFromParams,
        invoices: ((profile as any)?.invoices || []).map((inv: any) => ({
          id: inv.id,
          approval_status: inv.approval_status,
          approval_notes: inv.approval_notes,
          type: inv.type
        }))
      });
    } else {
      console.log('⚠️ [UserProfile] No profile data available');
    }
  }, [profile, profileFromQuery, profileDataFromParams]);

  // Get user's name from profile or userData
  const userName = profile?.name || userData?.name || 'User';
  const userInitial = userName.charAt(0).toUpperCase();
  const profileImage = profile?.profile_image || null;

  const getThemeSubtitle = () => {
    switch (themeName) {
      case 'light':
        return t('userProfile.light');
      case 'dark':
        return t('userProfile.dark');
      case 'darkGreen':
        return t('userProfile.darkGreen') || 'Forest Night';
      case 'whitePurple':
        return t('userProfile.whitePurple') || 'Lavender Dream';
      default:
        return t('userProfile.light');
    }
  };

  // Check if user has completed business signup (for SR conversion)
  const hasCompletedBusinessSignup = React.useMemo(() => {
    if (!profile || !userData) return false;
    const shop = profile.shop;
    if (!shop || !shop.id) return false;

    // Check if user has business signup fields (indicating they've submitted SR conversion request)
    const hasCompanyName = shop.company_name && String(shop.company_name).trim() !== '';
    const hasGstNumber = shop.gst_number && String(shop.gst_number).trim() !== '';
    const hasPanNumber = shop.pan_number && String(shop.pan_number).trim() !== '';
    
    // If user type is 'R' and has business fields, they've completed business signup for SR conversion
    return userData.user_type === 'R' && (hasCompanyName || hasGstNumber || hasPanNumber);
  }, [profile, userData]);

  // Sync AsyncStorage with latest approval status when profile is fetched
  React.useEffect(() => {
    const syncApprovalStatus = async () => {
      if (profile?.shop?.approval_status && userData?.id) {
        try {
          const approvalStatus = profile.shop.approval_status;
          
          // If user has completed business signup (for SR conversion), sync to both B2C and B2B status
          // Otherwise, just sync to B2C status
          if (hasCompletedBusinessSignup) {
            // User has submitted SR conversion request - sync to both statuses
            await AsyncStorage.setItem('@b2c_approval_status', approvalStatus);
            await AsyncStorage.setItem('@b2b_status', approvalStatus);
            console.log('✅ UserProfileScreen: Synced SR approval status to AsyncStorage (both B2C and B2B):', approvalStatus);
          } else {
            // Regular B2C approval status
            await AsyncStorage.setItem('@b2c_approval_status', approvalStatus);
            console.log('✅ UserProfileScreen: Synced @b2c_approval_status to AsyncStorage:', approvalStatus);
          }
        } catch (error) {
          console.error('❌ Error syncing approval status:', error);
        }
      }
    };

    syncApprovalStatus();
  }, [profile?.shop?.approval_status, userData?.id, hasCompletedBusinessSignup]);

  // Check if B2C signup is complete (has all required fields)
  const hasCompletedSignup = React.useMemo(() => {
    if (!profile) return false;
    const shop = profile.shop;
    if (!shop || !shop.id) return false;

    // Check if all required B2C signup fields are present
    const hasName = profile.name && String(profile.name).trim() !== '';
    const hasEmail = profile.email && String(profile.email).trim() !== '';
    const hasAddress = shop.address && String(shop.address).trim() !== '';
    const hasContact = shop.contact && String(shop.contact).trim() !== '';
    const hasAadhar = shop.aadhar_card && String(shop.aadhar_card).trim() !== '';

    return hasName && hasEmail && hasAddress && hasContact && hasAadhar;
  }, [profile]);

  // Check if user has approval status (even if signup is not fully complete)
  // This allows showing approval status for users who have submitted signup but may have incomplete data
  const hasApprovalStatus = React.useMemo(() => {
    if (!profile) {
      console.log('❌ UserProfileScreen: hasApprovalStatus = false (no profile)');
      return false;
    }
    
    const shop = profile.shop;
    
    // For SR or S users, show approval status option even if shop data is missing
    // (they should have approval status, so show the option to check it)
    if (userData?.user_type === 'SR' || userData?.user_type === 'S') {
      if (!shop || !shop.id) {
        // For SR/S users without shop data, still show approval status option (treat as pending)
        console.log('✅ UserProfileScreen: hasApprovalStatus = true (user_type is SR or S, no shop data - showing as pending)');
        return true;
      }
      const hasStatus = shop.approval_status !== undefined && shop.approval_status !== null;
      console.log('✅ UserProfileScreen: hasApprovalStatus =', hasStatus, '(user_type is SR or S, shop.approval_status:', shop.approval_status, ')');
      return hasStatus;
    }
    
    if (!shop || !shop.id) {
      console.log('❌ UserProfileScreen: hasApprovalStatus = false (no shop or shop.id)');
      return false;
    }
    
    // For user_type 'R' who has completed business signup, show approval status
    // This covers users who have submitted business signup but haven't been upgraded to SR yet
    // Show approval status option even if approval_status is not yet set (it will be pending)
    if (hasCompletedBusinessSignup) {
      // Always show approval status option if user has completed business signup
      // The approval_status might be pending, approved, rejected, or not yet set
      console.log('✅ UserProfileScreen: hasApprovalStatus = true (user_type R with completed business signup, shop.approval_status:', shop.approval_status, ')');
      return true;
    }
    
    // If shop has approval_status, show the approval status menu item
    // This covers cases where user has submitted signup but some fields might be missing
    const hasStatus = shop.approval_status !== undefined && shop.approval_status !== null;
    console.log('✅ UserProfileScreen: hasApprovalStatus =', hasStatus, '(shop.approval_status:', shop.approval_status, ')');
    return hasStatus;
  }, [profile, userData?.user_type, hasCompletedBusinessSignup]);

  // Check if JoinB2BNetwork option should be shown - for approved 'R' users and pending 'SR' users
  const shouldShowJoinB2BNetwork = React.useMemo(() => {
    // Only show for 'R' and 'SR' user types
    if (userData?.user_type !== 'R' && userData?.user_type !== 'SR') {
      return false;
    }

    const shop = profile?.shop as any;
    if (!shop || !shop.id) {
      return false;
    }

    const approvalStatus = shop?.approval_status;

    // For 'R' users: show if approved (no business signup required)
    if (userData?.user_type === 'R') {
      // Show only if approved
      return approvalStatus === 'approved';
    }

    // For 'SR' users: show only if pending (not approved)
    if (userData?.user_type === 'SR') {
      return approvalStatus === 'pending';
    }

    return false;
  }, [userData?.user_type, profile?.shop]);

  // Get approval status label - prioritize SR approval status if user has completed business signup
  const getApprovalStatusLabel = () => {
    // For users with type 'R' who have completed business signup, show SR approval status
    // For SR or S users, show their approval status
    // Otherwise, show B2C approval status
    const approvalStatus = profile?.shop?.approval_status;
    
    // If shop data is not available but user is SR or S, default to pending
    if ((userData?.user_type === 'SR' || userData?.user_type === 'S') && !approvalStatus) {
      return t('userProfile.pending') || 'Pending';
    }
    
    if (approvalStatus === 'approved') {
      return t('userProfile.approved') || 'Approved';
    } else if (approvalStatus === 'pending') {
      return t('userProfile.pending') || 'Pending';
    } else if (approvalStatus === 'rejected') {
      return t('userProfile.rejected') || 'Rejected';
    }
    return t('userProfile.pending') || 'Pending';
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    try {
      await logout();
      setShowLogoutModal(false);
      DeviceEventEmitter.emit('FORCE_LOGOUT');
    } catch (error: any) {
      console.error('Error logging out:', error);
      setShowLogoutModal(false);
      Alert.alert(t('common.error') || 'Error', error.message || t('profile.failedToLogout') || 'Failed to logout');
    }
  };

  const handleDeleteAccount = () => {
    setShowDeleteAccountModal(true);
  };

  const confirmDeleteAccount = async () => {
    if (!userData?.id) {
      Alert.alert(t('common.error') || 'Error', t('profile.userIdNotFound') || 'User ID not found');
      return;
    }

    setIsDeletingAccount(true);
    try {
      await deleteAccount(userData.id);
      // Clear all data and logout
      await logout();
      setShowDeleteAccountModal(false);
      DeviceEventEmitter.emit('FORCE_LOGOUT');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setIsDeletingAccount(false);
      Alert.alert(t('common.error') || 'Error', error.message || t('profile.failedToDeleteAccount') || 'Failed to delete account');
    }
  };

  const handleMenuItemPress = async (item: {
    icon: string;
    label: string;
    subtitle?: string;
    action: string | null;
  }) => {
    if (item.action === 'MyOrders') {
      navigation.navigate('MyOrders');
    } else if (item.action === 'EditProfile') {
      navigation.navigate('EditProfile');
    } else if (item.action === 'Appearance') {
      setShowThemeModal(true);
    } else if (item.action === 'ChangeLanguage') {
      navigation.navigate('SelectLanguage');
    } else if (item.action === 'PrivacyPolicy') {
      navigation.navigate('PrivacyPolicy');
    } else if (item.action === 'Terms') {
      navigation.navigate('Terms');
    } else if (item.action === 'JoinB2BNetwork') {
      // Handle navigation based on user type
      if (userData?.user_type === 'SR') {
        // For SR users, navigate to ApprovalWorkflow to see their status
        // If approved, they can switch to B2B mode from there
        console.log('✅ UserProfileScreen: User type SR - navigating to ApprovalWorkflow');
        navigation.navigate('ApprovalWorkflow', { fromProfile: true });
      } else if (userData?.user_type === 'R') {
        const shop = profile?.shop;
        const approvalStatus = shop?.approval_status;
        
        // Check if user has completed business signup
        const hasCompanyName = shop?.company_name && String(shop.company_name).trim() !== '';
        const hasGstNumber = shop?.gst_number && String(shop.gst_number).trim() !== '';
        const hasPanNumber = shop?.pan_number && String(shop.pan_number).trim() !== '';
        const hasCompletedBusinessSignup = hasCompanyName || hasGstNumber || hasPanNumber;
        
        if (hasCompletedBusinessSignup) {
          // User has completed business signup - navigate to ApprovalWorkflow to see status
          console.log('✅ UserProfileScreen: User type R with completed business signup - navigating to ApprovalWorkflow');
          navigation.navigate('ApprovalWorkflow', { fromProfile: true });
        } else {
          // User hasn't completed business signup - navigate to business signup screen
          console.log('✅ UserProfileScreen: User type R without completed business signup - navigating to Business signup screen');
          navigation.navigate('DealerSignup', { fromB2CProfile: true });
        }
      } else {
        // For other user types, navigate to Business signup screen
        console.log('✅ UserProfileScreen: Navigating to Business signup screen');
        navigation.navigate('DealerSignup', { fromB2CProfile: true });
      }
    } else if (item.action === 'ApprovalStatus') {
      navigation.navigate('ApprovalWorkflow', { fromProfile: true });
    } else if (item.action === 'PickupStatus') {
      navigation.navigate('PickupStatus');
    } else if (item.action === 'SubcategoryRequests') {
      navigation.navigate('SubcategoryRequests');
    } else if (item.action === 'LiveScrapRates') {
      navigation.navigate('LivePrices');
    } else if (item.action === 'BulkSell') {
      navigation.navigate('BulkSellRequest');
    }
  };

  // Get today's date formatted for Live Scrap Rates subtitle
  const getTodayDate = () => {
    return new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const menuItems = [
    { icon: 'account', label: t('userProfile.yourProfile') || 'Your Profile', subtitle: `${completionPercentage}% completed`, action: 'EditProfile' },
    ...(hasCompletedSignup || hasApprovalStatus ? [{ icon: 'check-circle', label: t('userProfile.approvalStatus') || 'Approval Status', subtitle: getApprovalStatusLabel(), action: 'ApprovalStatus' }] : []),
    ...(hasPendingSubcategoryRequests ? [{ icon: 'file-document-outline', label: t('userProfile.subcategoryRequests') || 'Subcategory Requests', action: 'SubcategoryRequests' }] : []),
    { icon: 'package-variant', label: t('userProfile.myOrders'), action: 'MyOrders' },
    { icon: 'truck-delivery-outline', label: t('userProfile.pickupStatus'), action: 'PickupStatus' },
    { icon: 'chart-line', label: t('userProfile.liveScrapRates') || 'Live Scrap Rates', subtitle: `${t('dealerDashboard.asOfToday') || 'As of'} ${getTodayDate()}`, action: 'LiveScrapRates' },
    { icon: 'cart-arrow-down', label: t('userProfile.bulkSell') || 'Bulk Sell', action: 'BulkSell' },
    { icon: 'weather-sunny', label: t('userProfile.appearance'), subtitle: getThemeSubtitle(), action: 'Appearance' },
    { icon: 'truck', label: t('userProfile.addDeliveryPartner'), action: null },
    { icon: 'star', label: t('userProfile.changeLanguage'), action: 'ChangeLanguage' },
    ...(shouldShowJoinB2BNetwork ? [{ icon: 'office-building', label: t('userProfile.joinB2BNetwork'), action: 'JoinB2BNetwork' }] : []),
    { icon: 'shield', label: t('userProfile.privacyPolicy'), action: 'PrivacyPolicy' },
    { icon: 'file-document', label: t('userProfile.terms'), action: 'Terms' },
  ];


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
        <AutoText style={styles.headerTitle} numberOfLines={2}>
          {t('userProfile.title')}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.headerCard}
          activeOpacity={0.8}
          onPress={() => navigation.navigate('SubscriptionPlans')}
        >
          {Platform.OS === 'ios' ? (
            <>
              <View style={styles.iosGradientWrapper}>
                <LinearGradient
                  colors={isDark ? ['#1B3E1F', '#2D5A32', '#1B3E1F'] : ['#E8F5E9', '#C8E6C9', '#A5D6A7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.gradientIOS}
                />
              </View>
              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                  ) : (
                    <AutoText style={styles.avatarText} numberOfLines={1}>
                      {userInitial}
                    </AutoText>
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <AutoText style={styles.name} numberOfLines={2}>
                    {userName}
                  </AutoText>
                  {!isB2BUser && (() => {
                    // For SR users, check b2cShop; for R users, check shop or b2cShop
                    const shop = (userData?.user_type === 'SR' ? profile?.b2cShop : profile?.b2cShop || profile?.shop) as any;
                    const invoices = (profile as any)?.invoices || [];
                    const approvedInvoice = invoices.find((inv: any) => inv?.approval_status === 'approved' && inv?.type === 'Paid');
                    // For subscription check: if shop.is_subscribed is true, user is subscribed (invoice check is optional)
                    // The admin panel sets is_subscribed=true when approving, so we trust that
                    const isSubscribed = shop?.is_subscribed === true;
                    const subscriptionEndsAt = shop?.subscription_ends_at;
                    const currentPlanName = approvedInvoice?.name || approvedInvoice?.package_id || 'B2C Monthly';
                    
                    if (isSubscribed && subscriptionEndsAt) {
                      const endDate = new Date(subscriptionEndsAt);
                      const formattedDate = endDate.toLocaleDateString('en-IN', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      });
                      return (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => navigation.navigate('SubscriptionPlans')}
                          style={styles.upgradeButton}
                        >
                          <LinearGradient
                            colors={isDark 
                              ? [theme.primary, theme.secondary, theme.accent]
                              : [theme.primary, theme.secondary, theme.accent]
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.upgradeGradient}
                          >
                            <AutoText style={[styles.upgradeText, { color: premiumButtonTextColor }]} numberOfLines={2}>
                              Current Plan: {currentPlanName}{'\n'}Valid until: {formattedDate}
                            </AutoText>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      Platform.OS === 'ios' ? (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => navigation.navigate('SubscriptionPlans')}
                          style={styles.upgradeButtonIOS}
                        >
                          <AutoText style={styles.upgradeTextIOS} numberOfLines={2}>
                            {t('dashboard.activatePremiumToAcceptOrders') || 'Activate Premium\nto Accept Orders'}
                          </AutoText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => navigation.navigate('SubscriptionPlans')}
                          style={styles.upgradeButton}
                        >
                          <LinearGradient
                            colors={isDark 
                              ? [theme.primary, theme.secondary, theme.accent]
                              : [theme.primary, theme.secondary, theme.accent]
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.upgradeGradient}
                          >
                            <AutoText style={[styles.upgradeText, { color: premiumButtonTextColor }]} numberOfLines={2}>
                              {t('dashboard.activatePremiumToAcceptOrders') || 'Activate Premium\nto Accept Orders'}
                            </AutoText>
                          </LinearGradient>
                        </TouchableOpacity>
                      )
                    );
                  })()}
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={theme.textPrimary}
                />
              </View>
            </>
          ) : (
            <LinearGradient
              colors={isDark ? ['#1B3E1F', '#2D5A32', '#1B3E1F'] : ['#E8F5E9', '#C8E6C9', '#A5D6A7']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.gradient}
            >
              <View style={styles.profileHeader}>
                <View style={styles.avatar}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={styles.avatarImage} />
                  ) : (
                    <AutoText style={styles.avatarText} numberOfLines={1}>
                      {userInitial}
                    </AutoText>
                  )}
                </View>
                <View style={styles.profileInfo}>
                  <AutoText style={styles.name} numberOfLines={2}>
                    {userName}
                  </AutoText>
                  {!isB2BUser && (() => {
                    // For SR users, check b2cShop; for R users, check shop or b2cShop
                    const shop = (userData?.user_type === 'SR' ? profile?.b2cShop : profile?.b2cShop || profile?.shop) as any;
                    const invoices = (profile as any)?.invoices || [];
                    const approvedInvoice = invoices.find((inv: any) => inv?.approval_status === 'approved' && inv?.type === 'Paid');
                    // For subscription check: if shop.is_subscribed is true, user is subscribed (invoice check is optional)
                    // The admin panel sets is_subscribed=true when approving, so we trust that
                    const isSubscribed = shop?.is_subscribed === true;
                    const subscriptionEndsAt = shop?.subscription_ends_at;
                    const currentPlanName = approvedInvoice?.name || approvedInvoice?.package_id || 'B2C Monthly';
                    
                    if (isSubscribed && subscriptionEndsAt) {
                      const endDate = new Date(subscriptionEndsAt);
                      const formattedDate = endDate.toLocaleDateString('en-IN', { 
                        day: 'numeric', 
                        month: 'short', 
                        year: 'numeric' 
                      });
                      return (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => navigation.navigate('SubscriptionPlans')}
                          style={styles.upgradeButton}
                        >
                          <LinearGradient
                            colors={isDark 
                              ? [theme.primary, theme.secondary, theme.accent]
                              : [theme.primary, theme.secondary, theme.accent]
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.upgradeGradient}
                          >
                            <AutoText style={[styles.upgradeText, { color: premiumButtonTextColor }]} numberOfLines={2}>
                              Current Plan: {currentPlanName}{'\n'}Valid until: {formattedDate}
                            </AutoText>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    }
                    return (
                      Platform.OS === 'ios' ? (
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => navigation.navigate('SubscriptionPlans')}
                          style={styles.upgradeButtonIOS}
                        >
                          <AutoText style={styles.upgradeTextIOS} numberOfLines={2}>
                            {t('dashboard.activatePremiumToAcceptOrders') || 'Activate Premium\nto Accept Orders'}
                          </AutoText>
                        </TouchableOpacity>
                      ) : (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() => navigation.navigate('SubscriptionPlans')}
                          style={styles.upgradeButton}
                        >
                          <LinearGradient
                            colors={isDark 
                              ? [theme.primary, theme.secondary, theme.accent]
                              : [theme.primary, theme.secondary, theme.accent]
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.upgradeGradient}
                          >
                            <AutoText style={[styles.upgradeText, { color: premiumButtonTextColor }]} numberOfLines={2}>
                              {t('dashboard.activatePremiumToAcceptOrders') || 'Activate Premium\nto Accept Orders'}
                            </AutoText>
                          </LinearGradient>
                        </TouchableOpacity>
                      )
                    );
                  })()}
                </View>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={24}
                  color={theme.textPrimary}
                />
              </View>
            </LinearGradient>
          )}
        </TouchableOpacity>

        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuRow}
            activeOpacity={0.7}
            onPress={() => handleMenuItemPress(item)}
          >
            <MaterialCommunityIcons
              name={item.icon as any}
              size={20}
              color={theme.primary}
            />
            <View style={styles.menuItemContent}>
              <AutoText style={styles.menuLabel} numberOfLines={2}>
                {item.label}
              </AutoText>
              {item.subtitle && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: item.action === 'EditProfile' ? `${completionPercentage}%` : '0%' },
                      ]}
                    />
                  </View>
                  <AutoText style={styles.progressText} numberOfLines={1}>
                    {item.subtitle}
                  </AutoText>
                </View>
              )}
            </View>
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={theme.textSecondary}
            />
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.menuRow} activeOpacity={0.7} onPress={handleDeleteAccount}>
          <MaterialCommunityIcons
            name="delete-outline"
            size={20}
            color={buttonTextColor}
          />
          <View style={styles.menuItemContent}>
            <AutoText style={[styles.menuLabel, { color: buttonTextColor }]} numberOfLines={2}>
              {t('userProfile.deleteAccount') !== 'userProfile.deleteAccount' ? t('userProfile.deleteAccount') : 'Delete Account'}
            </AutoText>
          </View>
          <MaterialCommunityIcons
            name="chevron-right"
            size={20}
            color={theme.textSecondary}
          />
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutRow} activeOpacity={0.7} onPress={handleLogout}>
          <MaterialCommunityIcons
            name="logout"
            size={20}
            color={buttonTextColor}
          />
          <AutoText style={[styles.logoutText, { color: buttonTextColor, opacity: 1 }]} numberOfLines={1}>
            {t('common.logout')}
          </AutoText>
        </TouchableOpacity>

        <View style={styles.appInfoContainer}>
          <AutoText style={styles.appInfoText}>
            {APP_NAME} v{APP_VERSION}
          </AutoText>
        </View>
      </ScrollView>

      <Modal
        visible={showThemeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowThemeModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {t('userProfile.appearance')}
              </AutoText>
              <TouchableOpacity
                onPress={() => setShowThemeModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeName === 'light' && styles.themeOptionSelected,
              ]}
              onPress={() => {
                setTheme('light');
                setShowThemeModal(false);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="weather-sunny"
                size={24}
                color={themeName === 'light' ? theme.primary : theme.textSecondary}
              />
              <View style={styles.themeOptionContent}>
                <AutoText
                  style={[
                    styles.themeOptionLabel,
                    themeName === 'light' && styles.themeOptionLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {t('userProfile.light')}
                </AutoText>
              </View>
              {themeName === 'light' && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color={theme.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeName === 'dark' && styles.themeOptionSelected,
              ]}
              onPress={() => {
                setTheme('dark');
                setShowThemeModal(false);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="weather-night"
                size={24}
                color={themeName === 'dark' ? theme.primary : theme.textSecondary}
              />
              <View style={styles.themeOptionContent}>
                <AutoText
                  style={[
                    styles.themeOptionLabel,
                    themeName === 'dark' && styles.themeOptionLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {t('userProfile.dark')}
                </AutoText>
              </View>
              {themeName === 'dark' && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color={theme.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeName === 'darkGreen' && styles.themeOptionSelected,
              ]}
              onPress={() => {
                setTheme('darkGreen');
                setShowThemeModal(false);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="leaf"
                size={24}
                color={themeName === 'darkGreen' ? theme.primary : theme.textSecondary}
              />
              <View style={styles.themeOptionContent}>
                <AutoText
                  style={[
                    styles.themeOptionLabel,
                    themeName === 'darkGreen' && styles.themeOptionLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {t('userProfile.darkGreen') || 'Forest Night'}
                </AutoText>
              </View>
              {themeName === 'darkGreen' && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color={theme.primary}
                />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.themeOption,
                themeName === 'whitePurple' && styles.themeOptionSelected,
              ]}
              onPress={() => {
                setTheme('whitePurple');
                setShowThemeModal(false);
              }}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons
                name="palette"
                size={24}
                color={themeName === 'whitePurple' ? theme.primary : theme.textSecondary}
              />
              <View style={styles.themeOptionContent}>
                <AutoText
                  style={[
                    styles.themeOptionLabel,
                    themeName === 'whitePurple' && styles.themeOptionLabelSelected,
                  ]}
                  numberOfLines={1}
                >
                  {t('userProfile.whitePurple') || 'Lavender Dream'}
                </AutoText>
              </View>
              {themeName === 'whitePurple' && (
                <MaterialCommunityIcons
                  name="check-circle"
                  size={24}
                  color={theme.primary}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={showLogoutModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {t('userProfile.logoutTitle') !== 'userProfile.logoutTitle' ? t('userProfile.logoutTitle') : 'Confirm Logout'}
              </AutoText>
              <TouchableOpacity
                onPress={() => setShowLogoutModal(false)}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>

            <AutoText style={styles.logoutModalMessage} numberOfLines={2}>
              {t('userProfile.logoutMessage') !== 'userProfile.logoutMessage' ? t('userProfile.logoutMessage') : 'Are you sure you want to logout?'}
            </AutoText>

            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonCancel]}
                onPress={() => setShowLogoutModal(false)}
                activeOpacity={0.7}
              >
                <AutoText style={styles.logoutModalButtonTextCancel} numberOfLines={1}>
                  {t('common.cancel') || 'Cancel'}
                </AutoText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonConfirm]}
                onPress={confirmLogout}
                activeOpacity={0.7}
              >
                <AutoText style={styles.logoutModalButtonTextConfirm} numberOfLines={1}>
                  {t('common.logout') || 'Logout'}
                </AutoText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete Account Modal */}
      <Modal
        visible={showDeleteAccountModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => !isDeletingAccount && setShowDeleteAccountModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle} numberOfLines={1}>
                {t('userProfile.deleteAccountTitle') !== 'userProfile.deleteAccountTitle' ? t('userProfile.deleteAccountTitle') : 'Delete Account'}
              </AutoText>
              <TouchableOpacity
                onPress={() => !isDeletingAccount && setShowDeleteAccountModal(false)}
                style={styles.closeButton}
                disabled={isDeletingAccount}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textSecondary} />
              </TouchableOpacity>
            </View>
            <AutoText style={styles.logoutModalMessage} numberOfLines={4}>
              {t('userProfile.deleteAccountMessage') !== 'userProfile.deleteAccountMessage' ? t('userProfile.deleteAccountMessage') : 'Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.'}
            </AutoText>
            <View style={styles.logoutModalButtons}>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonCancel]}
                onPress={() => setShowDeleteAccountModal(false)}
                disabled={isDeletingAccount}
                activeOpacity={0.7}
              >
                <AutoText style={styles.logoutModalButtonTextCancel} numberOfLines={1}>
                  {t('common.cancel') || 'Cancel'}
                </AutoText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.logoutModalButton, styles.logoutModalButtonConfirm]}
                onPress={confirmDeleteAccount}
                disabled={isDeletingAccount}
                activeOpacity={0.7}
              >
                <AutoText style={styles.logoutModalButtonTextConfirm} numberOfLines={1}>
                  {isDeletingAccount ? (t('common.deleting') || 'Deleting...') : (t('userProfile.deleteAccount') !== 'userProfile.deleteAccount' ? t('userProfile.deleteAccount') : 'Delete Account')}
                </AutoText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme: any, isEnglish: boolean, isDark: boolean, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.card,
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
      paddingHorizontal: '18@s',
      paddingTop: '18@vs',
      paddingBottom: '32@vs',
    },
    headerCard: {
      height: '120@vs',
      borderRadius: '18@ms',
      marginBottom: '18@vs',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      overflow: 'hidden',
      borderWidth: Platform.OS === 'ios' ? '1@ms' : 0,
      borderColor: Platform.OS === 'ios' ? theme.border : 'transparent',
      padding: Platform.OS === 'ios' ? '18@s' : 0,
    },
    iosGradientWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: '17@ms',
      overflow: 'hidden',
    },
    gradientIOS: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    gradient: {
      flex: 1,
      width: '100%',
      height: '100%',
      padding: '18@s',
      justifyContent: 'center',
    },
    profileHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '14@s',
    },
    avatar: {
      width: '64@s',
      height: '64@s',
      borderRadius: '32@s',
      backgroundColor: '#FFD700',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: theme.textSecondary,
    },
    avatarImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    avatarText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '28@s',
      color: theme.textPrimary,
    },
    profileInfo: {
      flex: 1,
      minWidth: 0,
    },
    name: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    upgradeButton: {
      marginTop: '8@vs',
      borderRadius: '8@ms',
      overflow: 'hidden',
    },
    upgradeButtonIOS: {
      marginTop: '8@vs',
      paddingVertical: '10@vs',
      paddingHorizontal: '16@s',
      borderRadius: '10@ms',
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: '2@vs' },
      shadowOpacity: 0.2,
      shadowRadius: '4@ms',
      elevation: 3,
    },
    upgradeGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '8@vs',
      paddingHorizontal: '16@s',
      borderRadius: '8@ms',
      flexWrap: 'wrap',
    },
    upgradeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14.5@s',
      flexShrink: 1,
      textAlign: 'center',
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 8,
      lineHeight: '16@s',
    },
    upgradeTextIOS: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: (isDark ? theme.background : theme.card) as any,
      textAlign: 'center',
      flexShrink: 1,
    },
    menuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: '16@vs',
      paddingHorizontal: '18@s',
      borderBottomWidth: 1,
      borderColor: theme.border,
      gap: '14@s',
    },
    menuItemContent: {
      flex: 1,
    },
    menuLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    progressContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
      marginTop: '4@vs',
    },
    progressBar: {
      flex: 1,
      height: '6@vs',
      backgroundColor: theme.border,
      borderRadius: '3@vs',
      overflow: 'hidden',
    },
    progressFill: {
      height: '100%',
      backgroundColor: theme.primary,
      borderRadius: '3@vs',
    },
    progressText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
    },
    logoutRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: '16@vs',
      paddingHorizontal: '18@s',
      gap: '14@s',
      marginTop: '8@vs',
    },
    logoutText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      opacity: 0.3,
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
      paddingTop: '20@vs',
      paddingBottom: '32@vs',
      paddingHorizontal: '18@s',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '24@vs',
    },
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    closeButton: {
      padding: '4@s',
    },
    themeOption: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: '16@vs',
      paddingHorizontal: '16@s',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '12@vs',
      backgroundColor: theme.background,
    },
    themeOptionSelected: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: theme.accent + '33',
    },
    themeOptionContent: {
      flex: 1,
      marginLeft: '14@s',
    },
    themeOptionLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '16@s',
      color: theme.textSecondary,
    },
    themeOptionLabelSelected: {
      color: theme.primary,
      fontFamily: 'Poppins-SemiBold',
    },
    logoutModalMessage: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: '24@vs',
    },
    logoutModalButtons: {
      flexDirection: 'row',
      gap: '12@s',
    },
    logoutModalButton: {
      flex: 1,
      paddingVertical: '16@vs',
      paddingHorizontal: '16@s',
      borderRadius: '12@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    logoutModalButtonCancel: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.border,
    },
    logoutModalButtonConfirm: {
      backgroundColor: themeName === 'darkGreen' ? '#FF6B6B' : '#FF4C4C',
    },
    logoutModalButtonTextCancel: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
    logoutModalButtonTextConfirm: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: '#FFFFFF',
    },
    appInfoContainer: {
      alignItems: 'center',
      paddingVertical: '24@vs',
      paddingBottom: '32@vs',
    },
    appInfoText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      opacity: 0.6,
      fontWeight: '300',
    },
  });

export default UserProfileScreen;

