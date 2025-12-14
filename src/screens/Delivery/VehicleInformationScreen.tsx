import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, TextInput, Alert, ActivityIndicator, BackHandler, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as DocumentPicker from '@react-native-documents/picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useFocusEffect, CommonActions } from '@react-navigation/native';
import { getUserData } from '../../services/auth/authService';
import { useUpdateProfile, useUploadAadharCard, useUploadDrivingLicense, useProfile, profileQueryKeys } from '../../hooks/useProfile';
import { completeDeliverySignup } from '../../services/api/v2/profile';
import { useQueryClient } from '@tanstack/react-query';

type VehicleType = 'car' | 'motorcycle' | 'van' | 'truck' | 'cycle' | 'pickup_auto';

const VehicleInformationScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName, isDark), [theme, themeName, isDark]);
  
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [aadharCard, setAadharCard] = useState<string | null>(null);
  const [uploadingAadhar, setUploadingAadhar] = useState(false);
  const [drivingLicense, setDrivingLicense] = useState<string | null>(null);
  const [uploadingDrivingLicense, setUploadingDrivingLicense] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  // Load user data
  React.useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
      // Pre-populate personal information if available
      if (data) {
        if (data.name) setName(data.name);
        if (data.email) setEmail(data.email);
        if (data.address) setAddress(data.address);
        if (data.phone || data.mob_num) setContactNumber(data.phone || data.mob_num || '');
      }
    };
    loadUserData();
  }, []);

  // Fetch profile data for auto-filling
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);

  // Auto-fill form fields from profile
  React.useEffect(() => {
    if (profileData && userData) {
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
      
      // Auto-fill from delivery data if available (backend returns as 'delivery' or 'delivery_boy')
      const deliveryData = profileData.delivery_boy || profileData.delivery;
      if (deliveryData) {
        if (deliveryData.address && !address) {
          setAddress(deliveryData.address);
        }
        if (deliveryData.contact && !contactNumber) {
          setContactNumber(deliveryData.contact);
        }
        if (deliveryData.vehicle_type && !vehicleType) {
          setVehicleType(deliveryData.vehicle_type as VehicleType);
        }
        if (deliveryData.vehicle_model && !vehicleModel) {
          setVehicleModel(deliveryData.vehicle_model);
        }
        if (deliveryData.vehicle_registration_number && !registrationNumber) {
          setRegistrationNumber(deliveryData.vehicle_registration_number);
        }
        if (deliveryData.aadhar_card && !aadharCard) {
          setAadharCard(deliveryData.aadhar_card);
        }
        if (deliveryData.driving_license && !drivingLicense) {
          setDrivingLicense(deliveryData.driving_license);
        }
      }
    }
  }, [profileData, userData]);

  // Get mutations
  const updateProfileMutation = useUpdateProfile(userData?.id || 0);
  const uploadAadharMutation = useUploadAadharCard(userData?.id || 0);
  const uploadDrivingLicenseMutation = useUploadDrivingLicense(userData?.id || 0);

  // Format contact number to only allow digits
  const formatContactNumber = (text: string | undefined | null) => {
    // Handle undefined/null/empty input
    if (!text) return '';
    
    // Remove all non-digits
    let cleaned = String(text).replace(/\D/g, '');
    
    // Remove leading 91 or +91 (India country code) if present
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    
    // Limit to 10 digits
    const limited = cleaned.slice(0, 10);
    return limited;
  };

  // Navigate to JoinAs screen using DeviceEventEmitter
  const navigateToJoinAs = React.useCallback(async () => {
    try {
      // Check if user is new (type 'N') - always clear @selected_join_type for new users
      let isNewUser = false;
      try {
        const currentUserData = await getUserData();
        if (currentUserData?.user_type === 'N') {
          isNewUser = true;
          console.log('✅ VehicleInformationScreen: User type is N - clearing @selected_join_type');
        }
      } catch (error) {
        console.log('VehicleInformationScreen: Error checking user data:', error);
      }
      
      // Clear signup flags
      await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
      
      // Always clear @selected_join_type for new users
      if (isNewUser) {
        await AsyncStorage.removeItem('@selected_join_type');
        console.log('✅ VehicleInformationScreen: Cleared @selected_join_type for new user');
      } else {
        // For existing users, also clear it to allow type switching
        await AsyncStorage.removeItem('@selected_join_type');
        console.log('✅ VehicleInformationScreen: Cleared @selected_join_type to allow type switching');
      }
      
      // Emit event to trigger navigation to JoinAs screen
      // AppNavigator listens for this event and shows AuthFlow with JoinAs
      DeviceEventEmitter.emit('NAVIGATE_TO_JOIN_AS');
      console.log('✅ VehicleInformationScreen: Emitted NAVIGATE_TO_JOIN_AS event');
    } catch (error) {
      console.log('Error navigating to JoinAs:', error);
    }
  }, []);

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
      };
    }, [navigateToJoinAs])
  );

  // Calculate disabled state safely
  const isSubmitDisabled = useMemo(() => {
    try {
      const nameValid = name && name.trim().length > 0;
      const emailValid = email && email.trim().length > 0;
      const addressValid = address && address.trim().length > 0;
      const contactValid = contactNumber && contactNumber.trim().length > 0;
      const aadharValid = !!aadharCard;
      
      let vehicleValid = true;
      if (vehicleType !== 'cycle') {
        const vehicleModelValid = !!(vehicleModel && vehicleModel.trim().length > 0);
        const registrationValid = !!(registrationNumber && registrationNumber.trim().length > 0);
        const drivingLicenseValid = !!drivingLicense;
        vehicleValid = vehicleModelValid && registrationValid && drivingLicenseValid;
      }
      
      return isSubmitting || !nameValid || !emailValid || !addressValid || !contactValid || !aadharValid || !vehicleValid;
    } catch (error) {
      // If any error occurs, disable the button
      return true;
    }
  }, [isSubmitting, name, email, address, contactNumber, aadharCard, vehicleType, vehicleModel, registrationNumber, drivingLicense]);

  const vehicleTypes = [
    { key: 'car' as VehicleType, icon: 'car', label: 'Car' },
    { key: 'motorcycle' as VehicleType, icon: 'motorbike', label: 'Motorcycle' },
    { key: 'van' as VehicleType, icon: 'van-utility', label: 'Van' },
    { key: 'truck' as VehicleType, icon: 'truck', label: 'Truck' },
    { key: 'pickup_auto' as VehicleType, icon: 'car-estate', label: 'Pickup Auto' },
    { key: 'cycle' as VehicleType, icon: 'bicycle', label: 'Cycle' },
  ];

  // Handle document upload - PDF only
  const handleDocumentUpload = async (type: 'aadhar' | 'drivingLicense') => {
    try {
      // Only allow PDF files
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

  const handleSubmitVehicleInfo = async () => {
    // Validate required fields
    if (!name || !name.trim()) {
      Alert.alert('Validation Error', 'Please enter your name');
      return;
    }

    if (!email || !email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return;
    }

    if (!address || !address.trim()) {
      Alert.alert('Validation Error', 'Please enter your address');
      return;
    }

    if (!contactNumber || !contactNumber.trim()) {
      Alert.alert('Validation Error', 'Please enter your contact number');
      return;
    }

    // Validate contact number is exactly 10 digits
    const cleanedContact = contactNumber.replace(/\D/g, '');
    if (cleanedContact.length !== 10) {
      Alert.alert('Validation Error', 'Please enter a valid 10-digit contact number');
      return;
    }

    // Vehicle details are required only if vehicle type is not cycle
    if (vehicleType !== 'cycle') {
      if (!vehicleModel || !vehicleModel.trim()) {
        Alert.alert('Validation Error', 'Please enter vehicle model');
        return;
      }

      if (!registrationNumber || !registrationNumber.trim()) {
        Alert.alert('Validation Error', 'Please enter registration number');
        return;
      }
    }

    // Validate documents - Aadhar card is required, driving license required if not cycle
    if (!aadharCard) {
      Alert.alert('Validation Error', 'Please upload Aadhar card');
      return;
    }

    if (vehicleType !== 'cycle' && !drivingLicense) {
      Alert.alert('Validation Error', 'Please upload driving license');
      return;
    }

    if (!userData?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    setIsSubmitting(true);
    try {
      // Prepare update data
      const updateData: any = {
        name: name.trim(),
        email: email.trim(),
        delivery: {
          address: address.trim(),
          contact: contactNumber.trim(),
          vehicle_type: vehicleType,
          aadhar_card: aadharCard,
        },
      };

      // Add vehicle details if not cycle
      if (vehicleType !== 'cycle') {
        updateData.delivery.vehicle_model = vehicleModel.trim();
        updateData.delivery.vehicle_registration_number = registrationNumber.trim();
        if (drivingLicense) {
          updateData.delivery.driving_license = drivingLicense;
        }
      }

      // Log the exact payload being sent
      console.log('📤 VehicleInformationScreen: Sending updateProfile payload:');
      console.log(JSON.stringify(updateData, null, 2));
      console.log('📤 Payload details:');
      console.log('  - Name:', updateData.name);
      console.log('  - Email:', updateData.email);
      console.log('  - Delivery address:', updateData.delivery.address);
      console.log('  - Delivery contact:', updateData.delivery.contact);
      console.log('  - Vehicle type:', updateData.delivery.vehicle_type);
      console.log('  - Vehicle model:', updateData.delivery.vehicle_model || 'N/A');
      console.log('  - Registration:', updateData.delivery.vehicle_registration_number || 'N/A');
      console.log('  - Aadhar card:', updateData.delivery.aadhar_card ? 'Present' : 'Missing');
      console.log('  - Driving license:', updateData.delivery.driving_license ? 'Present' : 'Missing');

      updateProfileMutation.mutate(updateData, {
        onSuccess: async (updatedProfile) => {
          console.log('✅ Profile updated successfully');

          // Invalidate profile cache to get updated data
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userData.id) });
          await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });

          // Refresh user data to get updated user_type
          const updatedUserData = await getUserData();
          console.log('✅ Updated user type after Delivery signup:', updatedUserData?.user_type);

          // Check if user_type was updated to 'D'
          if (updatedUserData?.user_type && updatedUserData.user_type !== 'N') {
            await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
            console.log('✅ Delivery signup completed - flag cleared (user_type:', updatedUserData.user_type, ')');
          } else {
            console.log('⚠️ Delivery signup not complete yet - user_type is still N');
            console.log('🔄 Attempting to use fallback API to complete delivery signup...');
            
            // Use fallback API to manually complete delivery signup
            try {
              const fallbackProfile = await completeDeliverySignup(userData.id);
              console.log('✅ Fallback API completed delivery signup');
              console.log('✅ Updated user type:', fallbackProfile.user_type);
              
              // Invalidate cache again to get updated data
              await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
              await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userData.id) });
              await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });
              
              // Refresh user data again
              const finalUserData = await getUserData();
              if (finalUserData?.user_type && finalUserData.user_type !== 'N') {
                await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
                console.log('✅ Delivery signup completed via fallback API (user_type:', finalUserData.user_type, ')');
              }
            } catch (fallbackError: any) {
              console.error('❌ Fallback API failed:', fallbackError);
              console.error('   Error message:', fallbackError.message);
              // Don't show error to user, just log it
            }
          }

          // Navigate to dashboard after successful submission
          Alert.alert('Success', 'Profile updated successfully', [
            {
              text: 'OK',
              onPress: () => {
                navigation.dispatch(
                  CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'Dashboard' }],
                  })
                );
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
      console.error('Error submitting vehicle info:', error);
      Alert.alert('Error', error.message || 'Failed to submit vehicle information');
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
          style={styles.backButton}
          onPress={navigateToJoinAs}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>Fill profile details</AutoText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Personal Information */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>Personal Information</AutoText>
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Enter your name"
            placeholderTextColor={theme.textSecondary}
            value={name || ''}
            onChangeText={(text: string) => setName(text || '')}
          />
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Enter your email address *"
            placeholderTextColor={theme.textSecondary}
            value={email || ''}
            onChangeText={(text: string) => setEmail(text || '')}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TextInput
            style={[styles.input, styles.textArea, { color: theme.textPrimary }]}
            placeholder="Enter your address"
            placeholderTextColor={theme.textSecondary}
            value={address || ''}
            onChangeText={(text: string) => setAddress(text || '')}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          <TextInput
            style={[styles.input, { color: theme.textPrimary }]}
            placeholder="Enter your contact number"
            placeholderTextColor={theme.textSecondary}
            value={contactNumber || ''}
            onChangeText={(text) => setContactNumber(formatContactNumber(text))}
            keyboardType="phone-pad"
            maxLength={10}
          />
        </SectionCard>

        {/* Select Vehicle Type */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.vehicle.selectVehicleType')}</AutoText>
          <View style={styles.vehicleTypeGrid}>
            {vehicleTypes.map((type) => (
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

        {/* Vehicle Details - Hide if cycle is selected */}
        {vehicleType !== 'cycle' && (
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.vehicle.vehicleDetails')}</AutoText>
          
          <View style={styles.inputContainer}>
            <AutoText style={styles.inputLabel}>{t('delivery.vehicle.vehicleModel')}</AutoText>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder={t('delivery.vehicle.vehicleModelPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={vehicleModel || ''}
              onChangeText={(text: string) => setVehicleModel(text || '')}
            />
          </View>

          <View style={styles.inputContainer}>
            <AutoText style={styles.inputLabel}>{t('delivery.vehicle.registrationNumber')}</AutoText>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder={t('delivery.vehicle.registrationNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={registrationNumber || ''}
              onChangeText={(text: string) => setRegistrationNumber(text || '')}
            />
          </View>
        </SectionCard>
        )}

        {/* Document Uploads */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.vehicle.documentUploads')}</AutoText>
          
          {/* Aadhar card upload - always visible */}
          <TouchableOpacity
            style={[styles.documentButton, !aadharCard && styles.documentButtonRequired]}
            onPress={() => handleDocumentUpload('aadhar')}
            disabled={uploadingAadhar}
          >
            {uploadingAadhar ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={aadharCard ? 'check-circle' : 'upload'}
                  size={20}
                  color={aadharCard ? '#4CAF50' : theme.primary}
                />
                <AutoText style={styles.documentButtonText}>
                  {aadharCard ? 'Aadhar Card Uploaded' : 'Upload Aadhar Card *'}
                </AutoText>
              </>
            )}
          </TouchableOpacity>

          {/* Driving license upload - hidden for cycle */}
          {vehicleType !== 'cycle' && (
            <TouchableOpacity
              style={[styles.documentButton, !drivingLicense && styles.documentButtonRequired]}
              onPress={() => handleDocumentUpload('drivingLicense')}
              disabled={uploadingDrivingLicense}
            >
              {uploadingDrivingLicense ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <>
                  <MaterialCommunityIcons
                    name={drivingLicense ? 'check-circle' : 'upload'}
                    size={20}
                    color={drivingLicense ? '#4CAF50' : theme.primary}
                  />
                  <AutoText style={styles.documentButtonText}>
                    {drivingLicense ? 'Driving License Uploaded' : 'Upload Driving License *'}
                    </AutoText>
                </>
              )}
                  </TouchableOpacity>
          )}
        </SectionCard>

        {/* Submit Button */}
        <GreenButton
          title={t('delivery.vehicle.submitVehicleInfo') || 'Submit'}
          onPress={handleSubmitVehicleInfo}
          style={styles.submitButton}
          disabled={isSubmitDisabled}
        />
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, themeName: string, isDark?: boolean) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: '4@s',
      marginRight: '12@s',
    },
    headerTitle: {
      flex: 1,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    placeholder: {
      width: '25@s',
    },
    scrollContent: {
      padding: '18@s',
      paddingBottom: '24@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '16@vs',
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
    input: {
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
      minHeight: '80@vs',
      paddingTop: '12@vs',
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
    submitButton: {
      marginTop: '8@vs',
    },
  });

export default VehicleInformationScreen;

