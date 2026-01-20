import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  Easing,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, CommonActions } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { useTabBar } from '../../context/TabBarContext';
import { useUserMode } from '../../context/UserModeContext';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData, isLoggedIn } from '../../services/auth/authService';
import { submitB2BSignup, B2BSignupData } from '../../services/api/v2/b2bSignup';
import { Alert, DeviceEventEmitter } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useProfile } from '../../hooks/useProfile';
import { SignupAddressModal } from '../../components/SignupAddressModal';

const DealerSignupScreen = ({ navigation: routeNavigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { setTabBarVisible } = useTabBar();
  const { setMode } = useUserMode();
  const buttonTranslateY = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const navigation = useNavigation();

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState(''); // TODO: Remove default value for production
  const [panNumber, setPanNumber] = useState(''); // TODO: Remove default value for production
  const [businessAddress, setBusinessAddress] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [pincode, setPincode] = useState<string>('');
  const [placeId, setPlaceId] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [place, setPlace] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [houseName, setHouseName] = useState<string>('');
  const [nearbyLocation, setNearbyLocation] = useState<string>('');

  // Load user data and profile
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Fetch profile data for auto-filling v1 user details
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);

  // Auto-fill form fields from v1 user profile
  useEffect(() => {
    if (profileData && userData) {
      const isV1User = !userData.app_version || userData.app_version === 'v1' || userData.app_version === 'v1.0';

      if (isV1User) {
        console.log('📝 Auto-filling B2B signup form for v1 user');

        // Auto-fill from shop data if available
        if (profileData.shop) {
          if (profileData.shop.shopname && !companyName) {
            setCompanyName(profileData.shop.shopname);
          }
          if (profileData.shop.address && !businessAddress) {
            setBusinessAddress(profileData.shop.address);
          }
          if (profileData.shop.contact && !contactNumber) {
            setContactNumber(profileData.shop.contact);
          }
        }

        // Auto-fill from user data
        if (profileData.name && !companyName && !contactPersonName) {
          setCompanyName(profileData.name);
          setContactPersonName(profileData.name);
        }
        if (profileData.email && !contactEmail) {
          setContactEmail(profileData.email);
        }
        if (profileData.phone && !contactNumber) {
          setContactNumber(profileData.phone);
        }
        
        // Populate location fields from shop data (saved from address modal)
        if (profileData.shop?.lat_log) {
          const [lat, lng] = profileData.shop.lat_log.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            setLatitude(lat);
            setLongitude(lng);
          }
        }
        // Also check latitude/longitude directly if lat_log is not available
        if (profileData.shop?.latitude && !latitude) {
          setLatitude(profileData.shop.latitude);
        }
        if (profileData.shop?.longitude && !longitude) {
          setLongitude(profileData.shop.longitude);
        }
        if (profileData.shop?.pincode && !pincode) setPincode(profileData.shop.pincode);
        if (profileData.shop?.place_id && !placeId) setPlaceId(profileData.shop.place_id);
        if (profileData.shop?.state && !state) setState(profileData.shop.state);
        if (profileData.shop?.place && !place) setPlace(profileData.shop.place);
        if (profileData.shop?.location && !location) setLocation(profileData.shop.location);
      } else {
        // For non-v1 users (including new users with user_type 'N'), auto-fill address and location fields
        console.log('📝 Auto-filling B2B signup form for non-v1 user (including new users)');
        
        // Auto-fill from user data
        if (profileData.name && !companyName && !contactPersonName) {
          setCompanyName(profileData.name);
          setContactPersonName(profileData.name);
        }
        if (profileData.email && !contactEmail) {
          setContactEmail(profileData.email);
        }
        if (profileData.phone && !contactNumber) {
          setContactNumber(profileData.phone);
        }
        
        // Auto-fill from shop data (including address saved from address modal)
        if (profileData.shop) {
          if (profileData.shop.shopname && !companyName) {
            setCompanyName(profileData.shop.shopname);
          }
          if (profileData.shop.address && !businessAddress) {
            setBusinessAddress(profileData.shop.address);
          }
          if (profileData.shop.contact && !contactNumber) {
            setContactNumber(profileData.shop.contact);
          }
          
          // Populate location fields from shop data (saved from address modal)
          if (profileData.shop.lat_log) {
            const [lat, lng] = profileData.shop.lat_log.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              setLatitude(lat);
              setLongitude(lng);
            }
          }
          // Also check latitude/longitude directly if lat_log is not available
          if (profileData.shop.latitude && !latitude) {
            setLatitude(profileData.shop.latitude);
          }
          if (profileData.shop.longitude && !longitude) {
            setLongitude(profileData.shop.longitude);
          }
          if (profileData.shop.pincode && !pincode) setPincode(profileData.shop.pincode);
          if (profileData.shop.place_id && !placeId) setPlaceId(profileData.shop.place_id);
          if (profileData.shop.state && !state) setState(profileData.shop.state);
          if (profileData.shop.place && !place) setPlace(profileData.shop.place);
          if (profileData.shop.location && !location) setLocation(profileData.shop.location);
        }
      }
    }
  }, [profileData, userData]);

  // Function to hide UI (tab bar and button)
  const hideUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(false);
      Animated.parallel([
        Animated.timing(buttonTranslateY, {
          toValue: 100,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Function to show UI (tab bar and button)
  const showUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(true);
      Animated.parallel([
        Animated.timing(buttonTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(buttonOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Show UI when keyboard closes
  useEffect(() => {
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        showUI();
      }
    );

    return () => {
      hideSubscription.remove();
    };
  }, [showUI]);

  // Navigate back helper function
  const handleGoBack = useCallback(async () => {
    try {
      // Check user type to determine navigation
      // user_type 'N' = New user in signup flow → go to JoinAs
      // user_type 'R' or 'D' = Existing B2C user trying to add B2B → go to B2C Dashboard
      const userType = userData?.user_type;
      console.log('🔍 DealerSignupScreen: handleGoBack - user_type:', userType);

      if (userType && userType !== 'N') {
        // Existing B2C user (type 'R' or 'D') trying to become B2B, navigate back to B2C Dashboard
        console.log('✅ DealerSignupScreen: Navigating back to B2C Dashboard (existing B2C user)');

        // Get root navigator (AppNavigator level)
        const rootNavigation = navigation.getParent()?.getParent()?.getParent();

        if (rootNavigation) {
          // Reset navigation to B2C Dashboard
          rootNavigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                {
                  name: 'MainFlow',
                  state: {
                    routes: [{ name: 'Dashboard' }],
                    index: 0,
                  },
                },
              ]
            })
          );
        } else if (navigation.canGoBack()) {
          navigation.goBack();
        }
      } else {
        // New user (type 'N' or null) came from signup flow after OTP, navigate to JoinAs screen
        console.log('✅ DealerSignupScreen: Navigating to JoinAs screen (new user after OTP)');

        // Clear all signup flags
        await AsyncStorage.removeItem('@join_as_shown');
        await AsyncStorage.removeItem('@b2b_status');
        await AsyncStorage.removeItem('@b2c_signup_needed');
        await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
        await AsyncStorage.removeItem('@selected_join_type');

        // Emit event to navigate to JoinAs (this will be handled by AppNavigator)
        DeviceEventEmitter.emit('NAVIGATE_TO_JOIN_AS');

        // Also try direct navigation
        try {
          // Get root navigator (AppNavigator level)
          const rootNavigation = navigation.getParent()?.getParent()?.getParent();

          if (rootNavigation) {
            // Reset navigation to show AuthFlow with JoinAs screen
            rootNavigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [
                  {
                    name: 'AuthFlow',
                    state: {
                      routes: [{ name: 'JoinAs' }],
                      index: 0,
                    },
                  },
                ]
              })
            );
          }
        } catch (error) {
          console.log('Error navigating to JoinAs:', error);
        }
      }
    } catch (error) {
      console.error('Error in handleGoBack:', error);
      // Fallback: navigate to JoinAs
      DeviceEventEmitter.emit('NAVIGATE_TO_JOIN_AS');
      if (navigation.canGoBack()) {
        navigation.goBack();
      }
    }
  }, [navigation, userData]);

  // Handle hardware back button - always navigate to JoinAs screen after successful OTP
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        handleGoBack();
        return true; // Prevent default back behavior
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        backHandler.remove();
        // Restore tab bar when leaving screen
        setTabBarVisible(true);
      };
    }, [setTabBarVisible, handleGoBack])
  );

  // Validation functions
  const validatePhoneNumber = (phone: string): boolean => {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it's 10 digits (Indian phone number format)
    return cleaned.length === 10;
  };

  const validateEmail = (email: string): boolean => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return false;
    
    // Basic email regex validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    if (!emailRegex.test(trimmedEmail)) return false;
    
    // Additional validation: email should not start or end with special characters
    if (trimmedEmail.startsWith('.') || trimmedEmail.startsWith('@') || 
        trimmedEmail.endsWith('.') || trimmedEmail.endsWith('@')) {
      return false;
    }
    
    // Check for consecutive dots or @ symbols
    if (trimmedEmail.includes('..') || trimmedEmail.includes('@@')) {
      return false;
    }
    
    return true;
  };

  const validateGSTNumber = (gst: string): boolean => {
    if (!gst || !gst.trim()) return true; // GST is optional
    const trimmedGst = gst.trim().toUpperCase();
    // GSTIN format: 15 characters
    // Format: 22AAAAA0000A1Z5 (2 digits state code + 10 chars PAN + 1 digit entity + 1 letter 'Z' + 1 digit checksum)
    const gstRegex = /^\d{2}[A-Z]{5}\d{4}[A-Z]{1}\d{1}[A-Z]{1}\d{1}$/;
    return gstRegex.test(trimmedGst);
  };

  const validatePANNumber = (pan: string): boolean => {
    if (!pan || !pan.trim()) return true; // PAN is optional
    const trimmedPan = pan.trim().toUpperCase();
    // PAN format: 10 characters
    // Format: BAGPJ4703G (5 letters + 4 digits + 1 letter)
    const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
    return panRegex.test(trimmedPan);
  };


  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>{t('dealerSignup.title')}</AutoText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 } // Add padding at bottom for button
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Company Information */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('dealerSignup.companyInformation')}</AutoText>
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.companyNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={companyName}
              onChangeText={setCompanyName}
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.gstNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={gstNumber}
              onChangeText={(text: string) => {
                // Convert to uppercase, allow alphanumeric, and limit to 15 characters
                const upperText = text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 15);
                setGstNumber(upperText);
              }}
              maxLength={15}
              autoCapitalize="characters"
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.panNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={panNumber}
              onChangeText={(text: string) => {
                // Convert to uppercase and limit to 10 characters
                const upperText = text.toUpperCase().slice(0, 10);
                setPanNumber(upperText);
              }}
              maxLength={10}
              autoCapitalize="characters"
            />
            <View style={styles.addressContainer}>
              {businessAddress ? (
                <View style={styles.addressDisplayContainer}>
                  <AutoText style={[styles.addressDisplayText, { color: theme.textPrimary }]} numberOfLines={3}>
                    {businessAddress}
                  </AutoText>
                  <TouchableOpacity
                    style={styles.addressEditButton}
                    onPress={() => setShowAddressModal(true)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons name="pencil" size={18} color={theme.primary} />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addressButton}
                  onPress={() => setShowAddressModal(true)}
                  activeOpacity={0.7}
                >
                  <View style={styles.addressButtonContent}>
                    <MaterialCommunityIcons name="map-marker" size={20} color={theme.primary} />
                    <AutoText style={[styles.addressButtonText, { color: theme.textSecondary }]}>
                      {t('dealerSignup.businessAddressPlaceholder')}
                    </AutoText>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Contact Person Details */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('dealerSignup.contactPersonDetails')}</AutoText>
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.contactPersonNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={contactPersonName}
              onChangeText={setContactPersonName}
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.contactNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={contactNumber}
              onChangeText={(text: string) => {
                // Only allow digits and limit to 10 digits
                const digitsOnly = text.replace(/\D/g, '').slice(0, 10);
                setContactNumber(digitsOnly);
              }}
              keyboardType="phone-pad"
              maxLength={10}
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.emailPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>


          {/* Rejection Reason Display */}
          {profileData?.shop?.approval_status === 'rejected' && profileData?.shop?.rejection_reason && (
            <View style={styles.rejectionReasonCard}>
              <View style={styles.rejectionReasonHeader}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#F44336" />
                <AutoText style={styles.rejectionReasonTitle}>Rejection Reason</AutoText>
              </View>
              <AutoText style={styles.rejectionReasonText}>
                {profileData.shop.rejection_reason}
              </AutoText>
            </View>
          )}
        </ScrollView>

        {/* Next Button */}
        <Animated.View
          style={[
            styles.bottomButtonContainer,
            {
              transform: [{ translateY: buttonTranslateY }],
              opacity: buttonOpacity,
            },
          ]}
        >
          <GreenButton
            title={t('common.next')}
            onPress={async () => {
              // Validate required fields
              const trimmedCompanyName = companyName.trim();
              if (!trimmedCompanyName) {
                Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterCompanyName') || 'Please enter company name');
                return;
              }

              const trimmedContactName = contactPersonName.trim();
              if (!trimmedContactName) {
                Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterContactPersonName') || 'Please enter contact person name');
                return;
              }

              // Validate contact person name is not a default username
              const defaultNamePattern = /^[Uu]ser_\d+$/;
              if (defaultNamePattern.test(trimmedContactName)) {
                Alert.alert(
                  t('auth.defaultUsernameTitle') || 'Please Change Your Name / Change to Shop Name',
                  t('auth.defaultUsernameMessage') || 'You are using a default username. Please enter your actual name to continue.',
                  [{ text: t('common.ok') || 'OK' }]
                );
                return;
              }

              // Validate phone number
              if (!contactNumber.trim()) {
                Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterContactNumber') || 'Please enter contact number');
                return;
              }
              if (!validatePhoneNumber(contactNumber)) {
                Alert.alert(t('common.error') || 'Error', t('auth.invalidPhoneNumberMessage') || 'Please enter a valid 10-digit phone number');
                return;
              }

              // Validate email
              if (!contactEmail.trim()) {
                Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterEmailAddress') || 'Please enter email address');
                return;
              }
              if (!validateEmail(contactEmail)) {
                Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterValidEmail') || 'Please enter a valid email address');
                return;
              }

              // Validate business address
              if (!businessAddress.trim()) {
                Alert.alert(t('common.error') || 'Error', t('signup.pleaseSelectBusinessAddress') || 'Please select business address');
                return;
              }

              // GST number validation removed - GST is now completely optional

              // Validate PAN number (optional but must be valid format if provided)
              if (panNumber.trim() && !validatePANNumber(panNumber)) {
                Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterValidPan') || 'Please enter a valid PAN number (Format: BAGPJ4703G - 10 characters)');
                return;
              }

              // Pass form data and source to DocumentUpload screen
              const source = route?.params?.source || null;
              const fromB2CProfile = route?.params?.fromB2CProfile === true;
              (navigation as any).navigate('DocumentUpload', {
                signupData: {
                  companyName: trimmedCompanyName,
                  gstNumber: gstNumber.trim().toUpperCase(),
                  panNumber: panNumber.trim().toUpperCase(),
                  businessAddress,
                  contactPersonName: trimmedContactName,
                  contactNumber: contactNumber.replace(/\D/g, ''), // Store only digits
                  contactEmail: contactEmail.trim(),
                  latitude,
                  longitude,
                  pincode,
                  placeId,
                  state,
                  place,
                  location,
                  houseName,
                  nearbyLocation,
                },
                fromB2CProfile: fromB2CProfile, // Pass flag as route param
                source: source, // Pass source from route params
              });
            }}
            disabled={isSubmitting}
          />
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Address Map Modal */}
      <SignupAddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onAddressSelect={(addressData) => {
          // Build full address string with house name and nearby location
          let fullAddress = addressData.address;
          if (addressData.houseName) {
            fullAddress = `${addressData.houseName}, ${fullAddress}`;
          }
          if (addressData.nearbyLocation) {
            fullAddress = `${fullAddress}, ${addressData.nearbyLocation}`;
          }

          setBusinessAddress(fullAddress);
          setHouseName(addressData.houseName || '');
          setNearbyLocation(addressData.nearbyLocation || '');
          setLatitude(addressData.latitude);
          setLongitude(addressData.longitude);
          if (addressData.pincode) setPincode(addressData.pincode);
          if (addressData.state) setState(addressData.state);
          if (addressData.place) setPlace(addressData.place);
          if (addressData.location) setLocation(addressData.location);
          if (addressData.place_id) setPlaceId(addressData.place_id);
        }}
        initialAddress={businessAddress}
        initialLatitude={latitude || undefined}
        initialLongitude={longitude || undefined}
      />
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
    backButton: {
      width: 24,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      paddingHorizontal: '18@s',
      paddingTop: '18@vs',
      paddingBottom: '100@vs',
    },
    section: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '16@s',
      marginBottom: '18@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '14@vs',
    },
    input: {
      height: '52@vs',
      borderWidth: 1,
      borderRadius: '14@ms',
      borderColor: theme.border,
      paddingHorizontal: '14@s',
      marginBottom: '14@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    textArea: {
      height: '80@vs',
      textAlignVertical: 'top',
      paddingTop: '14@vs',
    },
    addressContainer: {
      marginBottom: '14@vs',
    },
    addressButton: {
      backgroundColor: theme.background,
      borderRadius: '14@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '14@s',
    },
    addressButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@s',
    },
    addressButtonText: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      lineHeight: '20@vs',
    },
    addressDisplayContainer: {
      backgroundColor: theme.background,
      borderRadius: '14@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '14@s',
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '12@s',
    },
    addressDisplayText: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      lineHeight: '20@vs',
    },
    addressEditButton: {
      padding: '4@s',
    },
    bottomButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: '18@vs',
      paddingHorizontal: '18@s',
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
    rejectionReasonCard: {
      marginHorizontal: '18@s',
      marginBottom: '18@vs',
      padding: '16@s',
      borderRadius: '12@ms',
      backgroundColor: '#F4433622',
      borderWidth: 1,
      borderColor: '#F44336',
    },
    rejectionReasonHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8@vs',
      gap: '8@s',
    },
    rejectionReasonTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#F44336',
    },
    rejectionReasonText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      lineHeight: '20@vs',
      color: '#721c24',
    },
  });

export default DealerSignupScreen;
