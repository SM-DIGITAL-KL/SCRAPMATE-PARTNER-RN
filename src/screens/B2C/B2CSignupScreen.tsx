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
        Alert.alert('Error', 'Please upload a PDF file only');
        return;
      }

      if (!userData?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      if (type === 'aadhar') {
        setUploadingAadhar(true);
        uploadAadharMutation.mutate(fileUri, {
          onSuccess: (result) => {
            setAadharCard(result.image_url);
            setUploadingAadhar(false);
            Alert.alert('Success', 'Aadhar card uploaded successfully');
          },
          onError: (error: any) => {
            console.error('Error uploading Aadhar card:', error);
            setUploadingAadhar(false);
            Alert.alert('Error', error.message || 'Failed to upload Aadhar card');
          },
        });
      } else if (type === 'drivingLicense') {
        setUploadingDrivingLicense(true);
        uploadDrivingLicenseMutation.mutate(fileUri, {
          onSuccess: (result) => {
            setDrivingLicense(result.image_url);
            setUploadingDrivingLicense(false);
            Alert.alert('Success', 'Driving license uploaded successfully');
          },
          onError: (error: any) => {
            console.error('Error uploading driving license:', error);
            setUploadingDrivingLicense(false);
            Alert.alert('Error', error.message || 'Failed to upload driving license');
          },
        });
      }
    } catch (err: any) {
      if (DocumentPicker.isErrorWithCode?.(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.error('Error picking document:', err);
      Alert.alert('Error', err.message || 'Failed to pick document');
      if (type === 'aadhar') {
        setUploadingAadhar(false);
      } else if (type === 'drivingLicense') {
        setUploadingDrivingLicense(false);
      }
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate required fields
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    if (!address.trim()) {
      Alert.alert('Error', 'Please enter your address');
      return;
    }

    if (!contactNumber.trim()) {
      Alert.alert('Error', 'Please enter your contact number');
      return;
    }

    // Aadhar card is required
    if (!aadharCard) {
      Alert.alert('Error', 'Please upload your Aadhar card');
      return;
    }

    // Vehicle details are required if vehicle pickup is selected, but not for cycle
    if (vehiclePickup && vehicleType !== 'cycle') {
      if (!vehicleModel.trim()) {
        Alert.alert('Error', 'Please enter vehicle model');
        return;
      }
      if (!registrationNumber.trim()) {
        Alert.alert('Error', 'Please enter registration number');
        return;
      }
      // Driving license is required only if vehicle type is not cycle
      if (!drivingLicense) {
        Alert.alert('Error', 'Please upload your driving license for vehicle pickup');
        return;
      }
    }

    if (!userData?.id) {
      Alert.alert('Error', 'User not found');
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
      
      // Include vehicle details and driving license if vehicle pickup is selected
      if (vehiclePickup) {
        if (drivingLicense) {
          updateData.shop.driving_license = drivingLicense;
        }
        updateData.shop.vehicle_type = vehicleType;
        updateData.shop.vehicle_model = vehicleModel.trim();
        updateData.shop.vehicle_registration_number = registrationNumber.trim();
      }

      updateProfileMutation.mutate(updateData, {
        onSuccess: async (updatedProfile) => {
          console.log('✅ Profile updated successfully');

          // Invalidate profile cache to get updated user_type
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userData.id) });
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });

          // Refresh user data to get updated user_type
          const updatedUserData = await getUserData();
          console.log('✅ Updated user type after B2C signup:', updatedUserData?.user_type);

          // Only clear B2C signup needed flag if user_type is no longer 'N' (signup is complete)
          if (updatedUserData?.user_type && updatedUserData.user_type !== 'N') {
            await AsyncStorage.removeItem('@b2c_signup_needed');
            console.log('✅ B2C signup completed - flag cleared (user_type:', updatedUserData.user_type, ')');
          } else {
            console.log('⚠️ B2C signup not complete yet - user_type is still N');
          }

          // Navigate to dashboard after successful submission
          Alert.alert('Success', 'Profile updated successfully', [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to dashboard
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'Dashboard' }],
                });
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
            <TextInput
              style={[styles.input, styles.textArea, { color: theme.textPrimary }]}
              placeholder="Enter your address"
              placeholderTextColor={theme.textSecondary}
              value={address}
              onChangeText={setAddress}
              multiline
              numberOfLines={3}
              onFocus={hideUI}
            />
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
              <AutoText style={styles.sectionTitle}>Select Vehicle Type</AutoText>
              <View style={styles.vehicleTypeGrid}>
                {[
                  { key: 'car' as const, icon: 'car', label: 'Car' },
                  { key: 'motorcycle' as const, icon: 'motorbike', label: 'Motorcycle' },
                  { key: 'van' as const, icon: 'van-utility', label: 'Van' },
                  { key: 'truck' as const, icon: 'truck', label: 'Truck' },
                  { key: 'pickup_auto' as const, icon: 'car-estate', label: 'Pickup Auto' },
                  { key: 'cycle' as const, icon: 'bicycle', label: 'Cycle' },
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
                    name={aadharCard ? 'check-circle' : 'upload'}
                    size={20}
                    color={aadharCard ? theme.success : theme.primary}
                  />
                  <AutoText style={styles.documentButtonText}>
                    {aadharCard ? 'Aadhar Card Uploaded' : 'Upload Aadhar Card *'}
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
                      name={drivingLicense ? 'check-circle' : 'upload'}
                      size={20}
                      color={drivingLicense ? theme.success : theme.primary}
                    />
                    <AutoText style={styles.documentButtonText}>
                      {drivingLicense ? 'Driving License Uploaded' : 'Upload Driving License *'}
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
            title="Submit"
            onPress={handleSubmit}
            disabled={isSubmitting || !name.trim() || !email.trim() || !address.trim() || !contactNumber.trim() || !aadharCard || (vehiclePickup && vehicleType !== 'cycle' && (!drivingLicense || !vehicleModel.trim() || !registrationNumber.trim()))}
          />
        </Animated.View>
      </KeyboardAvoidingView>
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

