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
  Alert,
  ActivityIndicator,
  Switch,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, CommonActions } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from '@react-native-documents/picker';
import { useTheme } from '../../components/ThemeProvider';
import { useTabBar } from '../../context/TabBarContext';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { SectionCard } from '../../components/SectionCard';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { updateProfile, uploadAadharCard } from '../../services/api/v2/profile';
import { useUpdateProfile, useUploadAadharCard, useUploadDrivingLicense, useProfile, profileQueryKeys } from '../../hooks/useProfile';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import { useLocationService, getAddressFromCoordinates } from '../../components/LocationView';
import { SignupAddressModal } from '../../components/SignupAddressModal';

const B2CSignupScreen = ({ navigation: routeNavigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName, isDark), [theme, themeName, isDark]);
  const { setTabBarVisible } = useTabBar();
  const buttonTranslateY = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [aadharCard, setAadharCard] = useState<string | null>(null);
  const [drivingLicense, setDrivingLicense] = useState<string | null>(null);
  const [vehiclePickup, setVehiclePickup] = useState(false);
  const [vehicleType, setVehicleType] = useState<'car' | 'motorcycle' | 'van' | 'truck' | 'cycle' | 'pickup_auto'>('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingAadhar, setUploadingAadhar] = useState(false);
  const [uploadingDrivingLicense, setUploadingDrivingLicense] = useState(false);
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [pincode, setPincode] = useState<string>('');
  const [placeId, setPlaceId] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [place, setPlace] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [houseName, setHouseName] = useState<string>('');
  const [nearbyLocation, setNearbyLocation] = useState<string>('');

  // Load user data
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
        console.log('📝 Auto-filling B2C signup form for v1 user');
        
        // Auto-fill from shop data if available
        if (profileData.shop) {
          if (profileData.shop.address && !address) {
            setAddress(profileData.shop.address);
          }
          if (profileData.shop.contact && !contactNumber) {
            setContactNumber(profileData.shop.contact);
          }
          // Populate location fields from shop data
          if (profileData.shop.lat_log) {
            const [lat, lng] = profileData.shop.lat_log.split(',').map(Number);
            if (!isNaN(lat) && !isNaN(lng)) {
              setLatitude(lat);
              setLongitude(lng);
            }
          }
          if (profileData.shop.pincode) setPincode(profileData.shop.pincode);
          if (profileData.shop.place_id) setPlaceId(profileData.shop.place_id);
          if (profileData.shop.state) setState(profileData.shop.state);
          if (profileData.shop.language) setLanguage(profileData.shop.language);
          if (profileData.shop.place) setPlace(profileData.shop.place);
          if (profileData.shop.location) setLocation(profileData.shop.location);
        }
        
        // Auto-fill from user data
        if (profileData.name && !name) {
          setName(profileData.name);
        }
        if (profileData.email && !email) {
          setEmail(profileData.email);
        }
        if (profileData.phone && !contactNumber) {
          setContactNumber(profileData.phone);
        }
        
        // Pre-fill Aadhar card if already uploaded
        if (profileData.shop?.aadhar_card && !aadharCard) {
          setAadharCard(profileData.shop.aadhar_card);
        }
        
        // Pre-fill driving license if already uploaded
        if (profileData.shop?.driving_license && !drivingLicense) {
          setDrivingLicense(profileData.shop.driving_license);
        }
      } else {
        // For non-v1 users, still pre-fill basic info
        if (profileData.name && !name) {
          setName(profileData.name);
        }
        if (profileData.email && !email) {
          setEmail(profileData.email);
        }
        if (profileData.phone && !contactNumber) {
          setContactNumber(profileData.phone);
        }
        if (profileData.shop?.address && !address) {
          setAddress(profileData.shop.address);
        }
        if (profileData.shop?.contact && !contactNumber) {
          setContactNumber(profileData.shop.contact);
        }
      }
    }
  }, [profileData, userData]);

  // Get mutations
  const updateProfileMutation = useUpdateProfile(userData?.id || 0);
  const uploadAadharMutation = useUploadAadharCard(userData?.id || 0);
  const uploadDrivingLicenseMutation = useUploadDrivingLicense(userData?.id || 0);

  // Function to hide UI (tab bar and button)
  const hideUI = useCallback(() => {
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

  // Navigate to JoinAs screen helper function
  const navigateToJoinAs = useCallback(async () => {
    // Check if user is new (type 'N') - always clear @selected_join_type for new users
    let isNewUser = false;
    try {
      const userData = await getUserData();
      if (userData?.user_type === 'N') {
        isNewUser = true;
        console.log('✅ B2CSignupScreen: User type is N - clearing @selected_join_type');
      }
    } catch (error) {
      console.log('B2CSignupScreen: Error checking user data:', error);
    }
    
    // Clear all signup flags to allow user to select a different signup type
    await AsyncStorage.removeItem('@join_as_shown');
    await AsyncStorage.removeItem('@b2b_status');
    await AsyncStorage.removeItem('@b2c_signup_needed');
    await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
    
    // Always clear @selected_join_type for new users, or if user is not logged in yet
    if (isNewUser) {
    await AsyncStorage.removeItem('@selected_join_type');
      console.log('✅ B2CSignupScreen: Cleared @selected_join_type for new user');
    } else {
      // For existing users, also clear it to allow type switching
      await AsyncStorage.removeItem('@selected_join_type');
      console.log('✅ B2CSignupScreen: Cleared @selected_join_type to allow type switching');
    }
    
    console.log('✅ B2CSignupScreen: Cleared all signup flags to allow type switching');
    
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
            ],
          })
        );
      }
    } catch (error) {
      console.log('Error navigating to JoinAs:', error);
    }
  }, [navigation]);

  // Handle hardware back button - navigate to JoinAs screen
  useFocusEffect(
    React.useCallback(() => {
      const onBackPress = () => {
        navigateToJoinAs();
        return true; // Prevent default back behavior
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);

      return () => {
        backHandler.remove();
        // Restore tab bar when leaving screen
        setTabBarVisible(true);
      };
    }, [setTabBarVisible, navigateToJoinAs])
  );

  // Handle document upload
  const handleDocumentUpload = async (type: 'aadhar' | 'drivingLicense') => {
    try {
      // Only allow PDF files for Aadhar card and driving license
      const pickedFiles = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        allowMultiSelection: false,
      });

      const file = pickedFiles[0];
      const fileUri = file.uri;
      
      // Validate file type - only PDF allowed
      if (file.type !== 'application/pdf' && !fileUri.toLowerCase().endsWith('.pdf')) {
        Alert.alert(t('common.error') || 'Error', t('signup.pleaseUploadPdfOnly') || 'Please upload a PDF file only');
        return;
      }

      if (!userData?.id) {
        Alert.alert(t('common.error') || 'Error', t('auth.userNotFound') || 'User not found');
        return;
      }

      if (type === 'aadhar') {
        setUploadingAadhar(true);
        uploadAadharMutation.mutate(fileUri, {
          onSuccess: (result) => {
            setAadharCard(result.image_url);
            setUploadingAadhar(false);
            Alert.alert(t('common.success') || 'Success', t('signup.aadharUploaded') || 'Aadhar card uploaded successfully');
          },
          onError: (error: any) => {
            console.error('Error uploading Aadhar card:', error);
            setUploadingAadhar(false);
            Alert.alert(t('common.error') || 'Error', error.message || t('signup.failedToUploadAadhar') || 'Failed to upload Aadhar card');
          },
        });
      } else if (type === 'drivingLicense') {
        setUploadingDrivingLicense(true);
        uploadDrivingLicenseMutation.mutate(fileUri, {
          onSuccess: (result) => {
            setDrivingLicense(result.image_url);
            setUploadingDrivingLicense(false);
            Alert.alert(t('common.success') || 'Success', t('signup.drivingLicenseUploaded') || 'Driving license uploaded successfully');
          },
          onError: (error: any) => {
            console.error('Error uploading driving license:', error);
            setUploadingDrivingLicense(false);
            Alert.alert(t('common.error') || 'Error', error.message || t('signup.failedToUploadDrivingLicense') || 'Failed to upload driving license');
          },
        });
      }
    } catch (err: any) {
      if (DocumentPicker.isErrorWithCode?.(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.error('Error picking document:', err);
      Alert.alert(t('common.error') || 'Error', err.message || t('signup.failedToPickDocument') || 'Failed to pick document');
      if (type === 'aadhar') {
        setUploadingAadhar(false);
      } else if (type === 'drivingLicense') {
        setUploadingDrivingLicense(false);
      }
    }
  };

  // Handle address selection from map modal
  const handleAddressSelect = (addressData: {
    address: string;
    latitude: number;
    longitude: number;
    lat_log: string;
    houseName?: string;
    nearbyLocation?: string;
    pincode?: string;
    state?: string;
    place?: string;
    location?: string;
    place_id?: string;
  }) => {
    // Build full address string with house name and nearby location
    let fullAddress = addressData.address;
    if (addressData.houseName) {
      fullAddress = `${addressData.houseName}, ${fullAddress}`;
    }
    if (addressData.nearbyLocation) {
      fullAddress = `${fullAddress}, ${addressData.nearbyLocation}`;
    }
    
    setAddress(fullAddress);
    setHouseName(addressData.houseName || '');
    setNearbyLocation(addressData.nearbyLocation || '');
    setLatitude(addressData.latitude);
    setLongitude(addressData.longitude);
    if (addressData.pincode) setPincode(addressData.pincode);
    if (addressData.state) setState(addressData.state);
    if (addressData.place) setPlace(addressData.place);
    if (addressData.location) setLocation(addressData.location);
    if (addressData.place_id) setPlaceId(addressData.place_id);
    
    // Set language based on state (2 for Kerala/Malayalam, 1 for others)
    if (addressData.state === 'Kerala') {
      setLanguage('2');
    } else {
      setLanguage('1');
    }
  };

  // Check if location is enabled
  const checkLocationEnabled = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
      try {
        const { NativeMapViewModule } = require('react-native').NativeModules;
        if (NativeMapViewModule) {
          const isEnabled = await NativeMapViewModule.isLocationEnabled();
          return isEnabled;
        }
      } catch (error) {
        console.warn('Failed to check location status:', error);
      }
    }
    return true; // Assume enabled for iOS or if check fails
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate required fields
    if (!name.trim()) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterYourName') || 'Please enter your name');
      return;
    }

    // Check if name is a default username pattern (User_xxx or user_xxx where xxx is phone number)
    const trimmedName = name.trim();
    const defaultNamePattern = /^[Uu]ser_\d+$/;
    if (defaultNamePattern.test(trimmedName)) {
      Alert.alert(
        t('auth.defaultUsernameTitle') || 'Please Change Your Name / Change to Shop Name',
        t('auth.defaultUsernameMessage') || 'You are using a default username. Please enter your actual name to continue.',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    if (!email.trim()) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterEmailAddress') || 'Please enter your email address');
      return;
    }

    // Validate email format - more comprehensive validation
    const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
    const trimmedEmail = email.trim();
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterValidEmail') || 'Please enter a valid email address');
      return;
    }
    
    // Additional validation: email should not start or end with special characters
    if (trimmedEmail.startsWith('.') || trimmedEmail.startsWith('@') || 
        trimmedEmail.endsWith('.') || trimmedEmail.endsWith('@')) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterValidEmail') || 'Please enter a valid email address');
      return;
    }
    
    // Check for consecutive dots or @ symbols
    if (trimmedEmail.includes('..') || trimmedEmail.includes('@@') || 
        trimmedEmail.split('@').length !== 2) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterValidEmail') || 'Please enter a valid email address');
      return;
    }

    if (!address.trim()) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterYourAddress') || 'Please enter your address');
      return;
    }

    // Validate address has latitude and longitude
    if (latitude === null || longitude === null) {
      Alert.alert(t('common.error') || 'Error', t('signup.addressNotProper') || 'Address is not proper. Please select address from map to get proper location.');
      return;
    }

    // Check if location services are enabled before saving
    const isLocationEnabled = await checkLocationEnabled();
    if (!isLocationEnabled) {
      Alert.alert(
        t('signup.locationDisabled') || 'Location Disabled',
        t('signup.locationDisabledMessage') || 'Location services are disabled on your device. Please enable location in your device settings to save address with proper coordinates.',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    if (!contactNumber.trim()) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterContactNumber') || 'Please enter your contact number');
      return;
    }

    // Aadhar card is required
    if (!aadharCard) {
      Alert.alert(t('common.error') || 'Error', t('signup.pleaseUploadAadhar') || 'Please upload your Aadhar card');
      return;
    }

    // Vehicle details are required if vehicle pickup is selected, but not for cycle
    if (vehiclePickup && vehicleType !== 'cycle') {
      // Validate vehicle model
      const trimmedVehicleModel = vehicleModel.trim();
      if (!trimmedVehicleModel) {
        Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterVehicleModel') || 'Please enter vehicle model');
        return;
      }
      if (trimmedVehicleModel.length < 2) {
        Alert.alert(t('common.error') || 'Error', t('signup.vehicleModelMinLength') || 'Vehicle model must be at least 2 characters long');
        return;
      }
      
      // Validate registration number
      const trimmedRegistrationNumber = registrationNumber.trim();
      if (!trimmedRegistrationNumber) {
        Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterRegistrationNumber') || 'Please enter registration number');
        return;
      }
      // Indian vehicle registration format: XX-XX-XX-XXXX (e.g., KL-01-AB-1234)
      // Allow flexible format but ensure it's not too short
      if (trimmedRegistrationNumber.length < 5) {
        Alert.alert(t('common.error') || 'Error', t('signup.pleaseEnterValidRegistrationNumber') || 'Please enter a valid registration number');
        return;
      }
      // Check for basic format (should contain alphanumeric characters and possibly hyphens)
      const registrationRegex = /^[A-Z0-9-]+$/i;
      if (!registrationRegex.test(trimmedRegistrationNumber)) {
        Alert.alert(t('common.error') || 'Error', t('signup.registrationNumberFormat') || 'Registration number can only contain letters, numbers, and hyphens');
        return;
      }
      
      // Driving license is required only if vehicle type is not cycle
      if (!drivingLicense) {
        Alert.alert(t('common.error') || 'Error', t('signup.pleaseUploadDrivingLicense') || 'Please upload your driving license for vehicle pickup');
        return;
      }
    }

    if (!userData?.id) {
      Alert.alert(t('common.error') || 'Error', t('auth.userNotFound') || 'User not found');
      return;
    }

    setIsSubmitting(true);
    try {
      // Update profile with name, email, address, contact, and documents
      const updateData: any = {
        name: name.trim(),
        email: email.trim(),
        shop: {
          address: address.trim(),
          contact: contactNumber.trim(),
          aadhar_card: aadharCard, // Include Aadhar card in shop data
        },
      };
      
      // Include location fields if available
      if (latitude !== null && longitude !== null) {
        updateData.shop.latitude = latitude;
        updateData.shop.longitude = longitude;
        updateData.shop.lat_log = `${latitude},${longitude}`;
      }
      if (pincode) updateData.shop.pincode = pincode.trim();
      if (placeId) updateData.shop.place_id = placeId.trim();
      if (state) updateData.shop.state = state.trim();
      if (language) updateData.shop.language = language.trim();
      if (place) updateData.shop.place = place.trim();
      if (location) updateData.shop.location = location.trim();
      
      // Include vehicle details and driving license if vehicle pickup is selected
      if (vehiclePickup) {
        if (drivingLicense) {
          updateData.shop.driving_license = drivingLicense;
        }
        updateData.shop.vehicle_type = vehicleType;
        updateData.shop.vehicle_model = vehicleModel.trim().toUpperCase(); // Store in uppercase for consistency
        updateData.shop.vehicle_registration_number = registrationNumber.trim().toUpperCase(); // Store in uppercase for consistency
      }
      
      console.log('📤 B2C Signup - Shop updateData:', JSON.stringify(updateData.shop, null, 2));

      updateProfileMutation.mutate(updateData, {
        onSuccess: async (updatedProfile) => {
          console.log('✅ Profile updated successfully');

          // Save FCM token after successful B2C registration
          try {
            const { fcmService } = await import('../../services/fcm/fcmService');
            await fcmService.getFCMToken();
            console.log('✅ FCM token saved after B2C registration');
          } catch (fcmError) {
            console.error('⚠️ Failed to save FCM token after B2C registration:', fcmError);
            // Don't block the flow if FCM token saving fails
          }

          // Invalidate profile cache to get updated user_type
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userData.id) });
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });

          // Get user_type from updatedProfile response (most up-to-date)
          // Also check if user has B2B shop to determine if both signups are complete
          const userTypeFromProfile = updatedProfile?.user_type || updatedProfile?.user?.user_type;
          const hasB2BShop = !!(updatedProfile?.b2bShop || (updatedProfile?.shop && (updatedProfile.shop as any)?.shop_type === 1 || (updatedProfile.shop as any)?.shop_type === 4));
          
          console.log('✅ User type from updated profile:', userTypeFromProfile);
          console.log('✅ Has B2B shop:', hasB2BShop);

          // Refresh user data to update AsyncStorage
          const updatedUserData = await getUserData();
          console.log('✅ Updated user type after B2C signup:', updatedUserData?.user_type);

          // Only clear B2C signup needed flag if user_type is no longer 'N' (signup is complete)
          if (updatedUserData?.user_type && updatedUserData.user_type !== 'N') {
            await AsyncStorage.removeItem('@b2c_signup_needed');
            console.log('✅ B2C signup completed - flag cleared (user_type:', updatedUserData.user_type, ')');
          } else {
            console.log('⚠️ B2C signup not complete yet - user_type is still N');
          }

          // Check if this is the first signup
          // If user_type is 'SR' OR has B2B shop, both signups are complete, go to dashboard
          // Otherwise, it's the first signup (B2C only) - go to JoinAs to complete B2B
          const bothSignupsComplete = userTypeFromProfile === 'SR' || hasB2BShop;
          
          console.log('🔍 Navigation decision:', {
            userTypeFromProfile,
            hasB2BShop,
            bothSignupsComplete,
            isFirstSignup: !bothSignupsComplete
          });

          // Navigate after successful submission
          Alert.alert('Success', 'Profile updated successfully', [
            {
              text: 'OK',
              onPress: () => {
                if (bothSignupsComplete) {
                  // Both signups complete - go to dashboard
                  console.log('✅ Both B2C and B2B signups complete - navigating to Dashboard');
                  navigation.reset({
                    index: 0,
                    routes: [{ name: 'Dashboard' }],
                  });
                } else {
                  // First signup (B2C only) - go to JoinAs to complete B2B
                  // This handles cases where user_type is 'N', 'R', or any other value
                  // as long as they don't have both signups complete
                  console.log('✅ B2C signup complete (first signup) - navigating to JoinAs to complete B2B signup');
                  navigateToJoinAs();
                }
              },
            },
          ]);
        },
        onError: (error: any) => {
          console.error('Error updating profile:', error);
          Alert.alert('Error', error.message || 'Failed to update profile');
        },
        onSettled: () => {
          setIsSubmitting(false);
        },
      });
    } catch (error: any) {
      console.error('Error submitting B2C signup:', error);
      Alert.alert('Error', error.message || 'Failed to submit signup');
      setIsSubmitting(false);
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
        <TouchableOpacity
          onPress={navigateToJoinAs}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>Complete Your Profile</AutoText>
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
          {/* Personal Information */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>Personal Information</AutoText>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Enter your name"
              placeholderTextColor={theme.textSecondary}
              value={name}
              onChangeText={setName}
              onFocus={hideUI}
            />
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Enter your email address *"
              placeholderTextColor={theme.textSecondary}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onFocus={hideUI}
            />
            <View style={styles.addressContainer}>
              {address ? (
                <View style={styles.addressDisplayContainer}>
                  <AutoText style={[styles.addressDisplayText, { color: theme.textPrimary }]} numberOfLines={3}>
                    {address}
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
                      Select Address
                    </AutoText>
                    <MaterialCommunityIcons name="chevron-right" size={20} color={theme.textSecondary} />
                  </View>
                </TouchableOpacity>
              )}
            </View>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder="Enter your contact number"
              placeholderTextColor={theme.textSecondary}
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
              onFocus={hideUI}
            />
          </View>

          {/* Vehicle Pickup Option */}
          <View style={styles.section}>
            <View style={styles.switchContainer}>
              <View style={styles.switchLabelContainer}>
                <MaterialCommunityIcons name="car" size={20} color={theme.textPrimary} />
                <AutoText style={styles.switchLabel}>Vehicle Pickup</AutoText>
              </View>
              <Switch
                value={vehiclePickup}
                onValueChange={setVehiclePickup}
                trackColor={{ false: theme.border, true: theme.primary }}
                thumbColor={vehiclePickup ? '#FFFFFF' : '#f4f3f4'}
                ios_backgroundColor={theme.border}
              />
            </View>
          </View>

          {/* Vehicle Type Selection - Show when vehicle pickup is enabled */}
          {vehiclePickup && (
            <SectionCard>
              <AutoText style={styles.sectionTitle}>{t('vehicle.selectVehicleType') || 'Select Vehicle Type'}</AutoText>
              <View style={styles.vehicleTypeGrid}>
                {[
                  { key: 'car' as const, icon: 'car', label: t('vehicle.car') || 'Car' },
                  { key: 'motorcycle' as const, icon: 'motorbike', label: t('vehicle.motorcycle') || 'Motorcycle' },
                  { key: 'van' as const, icon: 'van-utility', label: t('vehicle.van') || 'Van' },
                  { key: 'truck' as const, icon: 'truck', label: t('vehicle.truck') || 'Truck' },
                  { key: 'pickup_auto' as const, icon: 'car-estate', label: t('vehicle.pickupAuto') || 'Pickup Auto' },
                  { key: 'cycle' as const, icon: 'bicycle', label: t('vehicle.cycle') || 'Cycle' },
                ].map((type) => (
                  <TouchableOpacity
                    key={type.key}
                    style={[
                      styles.vehicleTypeCard,
                      vehicleType === type.key && styles.vehicleTypeCardActive,
                    ]}
                    onPress={() => setVehicleType(type.key)}
                    activeOpacity={0.7}
                  >
                    <MaterialCommunityIcons
                      name={type.icon as any}
                      size={36}
                      color={vehicleType === type.key ? theme.primary : theme.textSecondary}
                    />
                    <AutoText
                      style={[
                        styles.vehicleTypeLabel,
                        vehicleType === type.key && styles.vehicleTypeLabelActive,
                      ]}
                    >
                      {type.label}
                    </AutoText>
                  </TouchableOpacity>
                ))}
              </View>
            </SectionCard>
          )}

          {/* Vehicle Details - Show when vehicle pickup is enabled, but hide if cycle is selected */}
          {vehiclePickup && vehicleType !== 'cycle' && (
            <SectionCard>
              <AutoText style={styles.sectionTitle}>Vehicle Details</AutoText>
              
              <View style={styles.inputContainer}>
                <AutoText style={styles.inputLabel}>Vehicle Model</AutoText>
                <TextInput
                  style={[styles.inputVehicleDetails, { color: theme.textPrimary }]}
                  placeholder="e.g., Honda City"
                  placeholderTextColor={theme.textSecondary}
                  value={vehicleModel}
                  onChangeText={setVehicleModel}
                  onFocus={hideUI}
                />
              </View>

              <View style={styles.inputContainer}>
                <AutoText style={styles.inputLabel}>Registration Number</AutoText>
                <TextInput
                  style={[styles.inputVehicleDetails, { color: theme.textPrimary }]}
                  placeholder="e.g., KL-01-AB-1234"
                  placeholderTextColor={theme.textSecondary}
                  value={registrationNumber}
                  onChangeText={setRegistrationNumber}
                  onFocus={hideUI}
                />
              </View>
            </SectionCard>
          )}

          {/* Documents */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>Documents</AutoText>
            <TouchableOpacity
              style={[styles.documentButton, !aadharCard && styles.documentButtonRequired]}
              onPress={() => handleDocumentUpload('aadhar')}
              disabled={uploadingAadhar || isSubmitting}
            >
              {uploadingAadhar ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={aadharCard ? 'reload' : 'upload'}
                    size={20}
                    color={theme.primary}
                  />
                  <AutoText style={styles.documentButtonText}>
                    {aadharCard ? 'Reupload Aadhar Card *' : 'Upload Aadhar Card *'}
                  </AutoText>
                </>
              )}
            </TouchableOpacity>
            {vehiclePickup && vehicleType !== 'cycle' && (
              <TouchableOpacity
                style={[styles.documentButton, !drivingLicense && styles.documentButtonRequired]}
                onPress={() => handleDocumentUpload('drivingLicense')}
                disabled={uploadingDrivingLicense || isSubmitting}
              >
                {uploadingDrivingLicense ? (
                  <ActivityIndicator size="small" color={theme.primary} />
                ) : (
                  <>
                    <MaterialCommunityIcons
                      name={drivingLicense ? 'reload' : 'upload'}
                      size={20}
                      color={theme.primary}
                    />
                    <AutoText style={styles.documentButtonText}>
                      {drivingLicense ? 'Reupload Driving License *' : 'Upload Driving License *'}
                    </AutoText>
                  </>
                )}
              </TouchableOpacity>
            )}
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

        {/* Submit Button */}
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
            title={t('buttons.submit') || 'Submit'}
            onPress={handleSubmit}
            disabled={isSubmitting || !name.trim() || !email.trim() || !address.trim() || !contactNumber.trim() || !aadharCard || (vehiclePickup && vehicleType !== 'cycle' && (!drivingLicense || !vehicleModel.trim() || !registrationNumber.trim()))}
          />
        </Animated.View>
      </KeyboardAvoidingView>

      {/* Address Map Modal */}
      <SignupAddressModal
        visible={showAddressModal}
        onClose={() => setShowAddressModal(false)}
        onAddressSelect={handleAddressSelect}
        initialAddress={address}
        initialLatitude={latitude || undefined}
        initialLongitude={longitude || undefined}
      />
    </View>
  );
};

const getStyles = (theme: any, themeName?: string, isDark?: boolean) =>
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
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.background,
      borderRadius: '10@ms',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '14@vs', // Keep margin for personal info section
    },
    addressContainer: {
      marginBottom: '14@vs',
    },
    addressButton: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
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
      backgroundColor: theme.card,
      borderRadius: '12@ms',
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
    addressInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '10@s',
      marginBottom: '14@vs',
    },
    locationButton: {
      width: '44@s',
      height: '44@s',
      borderRadius: '10@ms',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '2@vs',
    },
    // Input style for vehicle details (matches VehicleInformationScreen)
    inputVehicleDetails: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.background,
      borderRadius: '10@ms',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '16@vs',
    },
    textArea: {
      height: '80@vs',
      textAlignVertical: 'top',
      paddingTop: '14@vs',
    },
    documentButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      height: '52@vs',
      borderWidth: 1,
      borderRadius: '14@ms',
      borderColor: theme.border,
      paddingHorizontal: '14@s',
      marginBottom: '14@vs',
      backgroundColor: theme.background,
      gap: '8@s',
    },
    documentButtonText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    documentButtonRequired: {
      borderColor: theme.error || '#FF4444',
      borderWidth: 1.5,
    },
    switchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '10@vs',
    },
    switchLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '10@s',
    },
    switchLabel: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    switchSubtextContainer: {
      marginTop: '8@vs',
      width: '100%',
    },
    switchSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      fontStyle: 'italic',
      flexWrap: 'wrap',
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
    vehicleTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
    },
    vehicleTypeCard: {
      width: '32%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '16@vs',
      paddingHorizontal: '12@s',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1.5,
      borderColor: theme.border,
      marginBottom: '8@vs',
    },
    vehicleTypeCardActive: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: themeName === 'whitePurple' ? theme.card : (isDark ? theme.card : `${theme.primary}15`),
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    vehicleTypeLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textSecondary,
      marginTop: '10@vs',
      textAlign: 'center',
      lineHeight: '16@vs',
    },
    vehicleTypeLabelActive: {
      color: theme.primary,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
    },
    inputContainer: {
      marginBottom: '16@vs',
    },
    inputLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
  });

export default B2CSignupScreen;

