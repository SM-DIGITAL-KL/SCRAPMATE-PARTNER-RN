import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Keyboard, Platform, Animated, Easing, Alert, ActivityIndicator, DeviceEventEmitter } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { useTabBar } from '../../context/TabBarContext';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import * as DocumentPicker from '@react-native-documents/picker';
import { getUserData, logout, setUserData } from '../../services/auth/authService';
import { uploadB2BDocument } from '../../services/api/v2/b2bSignup';
import { submitB2BSignup } from '../../services/api/v2/b2bSignup';
import { useQueryClient } from '@tanstack/react-query';
import { profileQueryKeys, useProfile } from '../../hooks/useProfile';
import { getProfile } from '../../services/api/v2/profile';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';

const DocumentUploadScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const routeSignupData = route?.params?.signupData || {};
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({});
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({});
  const [pickingDoc, setPickingDoc] = useState<string | null>(null); // Track which document is currently being picked
  const [userData, setUserData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { setTabBarVisible } = useTabBar();

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Fetch profile data to get approval status and rejection reason
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);

  // Load signup data from route params or profile data
  // If navigating from dashboard after rejection, load from profile
  const signupData = React.useMemo(() => {
    // If signupData is provided in route params, use it
    if (routeSignupData && Object.keys(routeSignupData).length > 0) {
      return routeSignupData;
    }
    
    // Otherwise, try to load from profile data
    if (profileData?.shop) {
      const shop = profileData.shop;
      return {
        companyName: shop.company_name || '',
        gstNumber: shop.gst_number || '',
        panNumber: shop.pan_number || '',
        businessAddress: shop.address || '',
        contactPersonName: shop.contact_person_name || '',
        contactNumber: shop.contact || '',
        contactEmail: shop.contact_email || '',
        latitude: shop.latitude || null,
        longitude: shop.longitude || null,
        pincode: shop.pincode || '',
        placeId: shop.place_id || '',
        state: shop.state || '',
        place: shop.place || '',
        location: shop.location || '',
        houseName: shop.house_name || '',
        nearbyLocation: shop.nearby_location || '',
      };
    }
    
    return {};
  }, [routeSignupData, profileData]);

  // Load existing document URLs from profile when screen loads
  React.useEffect(() => {
    if (profileData?.shop && !routeSignupData || Object.keys(routeSignupData).length === 0) {
      const shop = profileData.shop;
      const existingUrls: Record<string, string> = {};
      
      if (shop.business_license_url) {
        existingUrls['business-license'] = shop.business_license_url;
      }
      if (shop.gst_certificate_url) {
        existingUrls['gst-certificate'] = shop.gst_certificate_url;
      }
      if (shop.address_proof_url) {
        existingUrls['address-proof'] = shop.address_proof_url;
      }
      if (shop.kyc_owner_url) {
        existingUrls['kyc-owner'] = shop.kyc_owner_url;
      }
      
      if (Object.keys(existingUrls).length > 0) {
        setDocumentUrls(existingUrls);
        console.log('✅ DocumentUploadScreen: Loaded existing document URLs from profile');
      }
    }
  }, [profileData?.shop, routeSignupData]);

  const documents = [
    {
      id: 'business-license',
      title: t('documentUpload.businessLicense'),
      description: t('documentUpload.businessLicenseDesc'),
      formats: 'PDF, JPG, PNG (Max 5MB)',
      icon: 'file-document-outline',
    },
    {
      id: 'gst-certificate',
      title: t('documentUpload.gstCertificate'),
      description: t('documentUpload.gstCertificateDesc'),
      formats: 'PDF (Max 2MB)',
      icon: 'certificate-outline',
    },
    {
      id: 'address-proof',
      title: t('documentUpload.addressProof'),
      description: t('documentUpload.addressProofDesc'),
      formats: 'PDF, JPG (Max 5MB)',
      icon: 'home-outline',
    },
    {
      id: 'kyc-owner',
      title: t('documentUpload.kycOwner'),
      description: t('documentUpload.kycOwnerDesc'),
      formats: 'JPG, PNG (Max 5MB)',
      icon: 'account-card-details-outline',
    },
  ];
  const buttonTranslateY = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  // Navigate to JoinAs screen helper function
  const navigateToJoinAs = useCallback(async () => {
    // Clear all signup flags to allow user to select a different signup type
    await AsyncStorage.removeItem('@join_as_shown');
    await AsyncStorage.removeItem('@b2b_status');
    await AsyncStorage.removeItem('@b2c_signup_needed');
    await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
    await AsyncStorage.removeItem('@selected_join_type');
    
    console.log('✅ DocumentUploadScreen: Cleared all signup flags to allow type switching');
    
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

  // Function to hide UI (tab bar and button)
  const hideUI = useCallback(() => {
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
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Function to show UI (tab bar and button)
  const showUI = useCallback(() => {
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
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Show UI when keyboard closes (if keyboard was opened from another screen)
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

  // Handle back button - clear @selected_join_type for new users
  const handleGoBack = useCallback(async () => {
    try {
      // Check if user is new (type 'N') - always clear @selected_join_type for new users
      if (userData?.user_type === 'N') {
        await AsyncStorage.removeItem('@selected_join_type');
        console.log('✅ DocumentUploadScreen: User type is N - cleared @selected_join_type');
      }
    } catch (error) {
      console.log('DocumentUploadScreen: Error clearing @selected_join_type:', error);
    }
    navigation.goBack();
  }, [navigation, userData?.user_type]);

  // Restore tab bar visibility when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Restore tab bar when leaving screen
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  const handleBrowse = async (docId: string) => {
    try {
      if (!userData?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      // Prevent multiple simultaneous DocumentPicker calls
      if (pickingDoc !== null) {
        console.log('⚠️ DocumentPicker already in progress, ignoring duplicate call');
        return;
      }

      // Prevent picking if already uploading
      if (uploadingDocs[docId]) {
        console.log('⚠️ Document already uploading, ignoring pick call');
        return;
      }

      // Prevent picking if document already uploaded
      if (documentUrls[docId]) {
        console.log('⚠️ Document already uploaded, ignoring pick call');
        return;
      }

      // Set picking state to prevent multiple calls
      setPickingDoc(docId);

      const pickedFiles = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        allowMultiSelection: false,
        mode: 'import'
      });

      // Reset picking state after picker completes (even if cancelled)
      setPickingDoc(null);

      if (!pickedFiles || pickedFiles.length === 0) {
        return;
      }

      const pickedFile = pickedFiles[0];
      const isPdf =
        pickedFile.type === 'application/pdf' ||
        pickedFile.name?.toLowerCase().endsWith('.pdf');

      if (!isPdf) {
        Alert.alert('Error', 'Please select a PDF file');
        return;
      }

      // Use fileCopyUri for Android, uri for iOS
      const fileUri = pickedFile.fileCopyUri || pickedFile.uri;
      if (!fileUri) {
        Alert.alert('Error', 'Unable to access selected file');
        return;
      }

      // Set uploading state
      setUploadingDocs(prev => ({ ...prev, [docId]: true }));
      setSelectedFiles(prev => ({
        ...prev,
        [docId]: pickedFile.name || 'document.pdf',
      }));

      // Upload document
      const result = await uploadB2BDocument(
        userData.id,
        fileUri,
        docId as 'business-license' | 'gst-certificate' | 'address-proof' | 'kyc-owner'
      );

      // Store document URL
      setDocumentUrls(prev => ({
        ...prev,
        [docId]: result.document_url,
      }));

      Alert.alert('Success', 'Document uploaded successfully');
    } catch (err: any) {
      // Reset picking state on error
      setPickingDoc(null);
      
      if (DocumentPicker.isErrorWithCode?.(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        return;
      }
      console.error('Error uploading document:', err);
      Alert.alert('Error', err.message || 'Failed to upload document');
      setSelectedFiles(prev => {
        const newFiles = { ...prev };
        delete newFiles[docId];
        return newFiles;
      });
    } finally {
      setUploadingDocs(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handleSubmit = async () => {
    if (!userData?.id) {
      Alert.alert('Error', 'User not found');
      return;
    }

    // Validate contact person name is not a default username
    if (signupData?.contactPersonName) {
      const trimmedContactName = signupData.contactPersonName.trim();
      const defaultNamePattern = /^[Uu]ser_\d+$/;
      if (defaultNamePattern.test(trimmedContactName)) {
        Alert.alert(
           'Please Change Your Name / Change to Shop Name',
          'You are using a default username. Please enter your actual name to continue.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    // Validate required documents
    // GST certificate is now optional (removed GST validation requirement)
    const requiredDocs = ['business-license', 'address-proof', 'kyc-owner'];
    const missingDocs = requiredDocs.filter(doc => !documentUrls[doc]);

    if (missingDocs.length > 0) {
      Alert.alert('Error', 'Please upload all required documents');
      return;
    }

    setIsSubmitting(true);
    try {
      const signupPayload = {
        ...signupData,
        businessLicenseUrl: documentUrls['business-license'],
        gstCertificateUrl: documentUrls['gst-certificate'] || '', // GST certificate is optional
        addressProofUrl: documentUrls['address-proof'],
        kycOwnerUrl: documentUrls['kyc-owner'],
      };

      await submitB2BSignup(userData.id, signupPayload);

      // Save FCM token after successful B2B registration
      try {
        const { fcmService } = await import('../../services/fcm/fcmService');
        await fcmService.getFCMToken();
        console.log('✅ FCM token saved after B2B registration');
      } catch (fcmError) {
        console.error('⚠️ Failed to save FCM token after B2B registration:', fcmError);
        // Don't block the flow if FCM token saving fails
      }

      // Invalidate profile cache to force fresh fetch with updated shop data
      console.log('🗑️  Invalidating profile cache after B2B signup submission');
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userData.id) });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });

      // Fetch fresh profile data from API to get updated user_type
      console.log('🔄 Fetching fresh profile data from API...');
      let updatedUserData = await getUserData(); // Get current data as fallback
      const originalUserType = updatedUserData?.user_type;
      
      // Retry fetching profile up to 3 times with delay to handle eventual consistency
      let profileData = null;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries && !profileData) {
        try {
          profileData = await getProfile(userData.id);
          if (profileData) {
            // Update AsyncStorage with fresh user data including updated user_type
            const freshUserData = {
              ...updatedUserData,
              id: profileData.id,
              name: profileData.name,
              email: profileData.email,
              phone_number: profileData.phone,
              user_type: profileData.user_type,
              app_type: profileData.app_type,
              profile_image: profileData.profile_image,
            };
            await setUserData(freshUserData);
            updatedUserData = freshUserData;
            console.log('✅ Updated user data in AsyncStorage with user_type:', updatedUserData?.user_type);
            break; // Success, exit retry loop
          }
        } catch (profileError) {
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`⚠️ Failed to fetch profile (attempt ${retryCount}/${maxRetries}), retrying...`);
            // Wait 1 second before retry
            await new Promise(resolve => setTimeout(resolve, 1000));
          } else {
            console.error('⚠️ Failed to fetch fresh profile after all retries:', profileError);
          }
        }
      }
      
      // Verify user_type was updated from 'N' to 'S' (or 'SR' if converting from 'R')
      console.log('🔍 Verifying user_type update after B2B signup...');
      console.log('   Original user_type:', originalUserType);
      console.log('   Updated user_type:', updatedUserData?.user_type);
      
      // Check if signup was created properly - if user_type was 'N' and is still 'N', show error
      if (originalUserType === 'N' && updatedUserData?.user_type === 'N') {
        // User_type is still 'N' after signup - signup was not created properly
        console.error('❌ CRITICAL: user_type is still "N" after B2B signup submission');
        Alert.alert(
          t('documentUpload.error') || 'Error',
          t('documentUpload.signupNotCreated') || 'B2B signup was not created properly. The user type was not updated. Please try again or contact support.',
          [
            {
              text: t('common.ok') || 'OK',
              onPress: () => {
                // Don't navigate - let user retry
              },
            },
          ],
          { cancelable: false }
        );
        return; // Stop execution - don't proceed with navigation
      }
      
      // If user was 'R' and is now 'SR', that's also valid
      if (originalUserType === 'R' && updatedUserData?.user_type === 'SR') {
        console.log('✅ User converted from R to SR successfully');
      }
      
      // If user was 'N' and is now 'S', that's the expected outcome
      if (originalUserType === 'N' && updatedUserData?.user_type === 'S') {
        console.log('✅ User converted from N to S successfully');
      }
      
      console.log('✅ User type verification passed:', updatedUserData?.user_type);
      
      // Verify user_type was updated from 'N' to 'S' (or 'SR' if converting from 'R')
      console.log('🔍 Verifying user_type update after B2B signup...');
      console.log('   Original user_type:', originalUserType);
      console.log('   Updated user_type:', updatedUserData?.user_type);
      
      // Check if signup was created properly - if user_type was 'N' and is still 'N', show error
      if (originalUserType === 'N' && updatedUserData?.user_type === 'N') {
        // User_type is still 'N' after signup - signup was not created properly
        console.error('❌ CRITICAL: user_type is still "N" after B2B signup submission');
        Alert.alert(
          t('documentUpload.error') || 'Error',
          t('documentUpload.signupNotCreated') || 'B2B signup was not created properly. The user type was not updated from "N" to "S". Please try again or contact support.',
          [
            {
              text: t('common.ok') || 'OK',
              onPress: () => {
                // Don't navigate - let user retry
              },
            },
          ],
          { cancelable: false }
        );
        return; // Stop execution - don't proceed with navigation
      }
      
      // If user was 'R' and is now 'SR', that's also valid
      if (originalUserType === 'R' && updatedUserData?.user_type === 'SR') {
        console.log('✅ User converted from R to SR successfully');
      }
      
      // If user was 'N' and is now 'S', that's the expected outcome
      if (originalUserType === 'N' && updatedUserData?.user_type === 'S') {
        console.log('✅ User converted from N to S successfully');
      }
      
      console.log('✅ User type verification passed:', updatedUserData?.user_type);
      
      // If user was 'R' and is now 'SR', that's also valid
      if (originalUserType === 'R' && updatedUserData?.user_type === 'SR') {
        console.log('✅ User converted from R to SR successfully');
      }
      
      // If user was 'N' and is now 'S', that's the expected outcome
      if (originalUserType === 'N' && updatedUserData?.user_type === 'S') {
        console.log('✅ User converted from N to S successfully');
      }
      
      console.log('✅ User type verification passed:', updatedUserData?.user_type);

      // If user_type is no longer 'N', clear the 'new_user' flag
      if (updatedUserData?.user_type && updatedUserData.user_type !== 'N') {
        const currentB2bStatus = await AsyncStorage.getItem('@b2b_status');
        if (currentB2bStatus === 'new_user') {
          console.log('✅ B2B signup complete - clearing new_user flag');
          await AsyncStorage.removeItem('@b2b_status');
        }
      }

      // Update B2B status to 'pending' in AsyncStorage (for approval workflow)
      await AsyncStorage.setItem('@b2b_status', 'pending');
      console.log('✅ B2B status updated to pending after document submission');

      // Check if this is the first signup (user_type is 'S' - only B2B completed)
      // If user_type is 'SR', both signups are complete, go to dashboard
      // If user_type is 'S', only B2B is complete, go to JoinAs to complete B2C
      const isFirstSignup = updatedUserData?.user_type === 'S';
      const bothSignupsComplete = updatedUserData?.user_type === 'SR';
      
      // Check if user came from B2C profile settings (JoinB2BNetwork flow)
      const fromB2CProfile = route?.params?.fromB2CProfile === true || signupData?.fromB2CProfile === true;

      // Show success message and navigate
      Alert.alert(
        t('documentUpload.success') || 'Success',
        t('documentUpload.successMessage') || 'B2B signup completed successfully',
        [
          {
            text: t('common.ok') || 'OK',
            onPress: async () => {
              // If user came from B2C profile settings, logout and navigate to JoinAs
              if (fromB2CProfile) {
                console.log('✅ B2B signup from B2C profile - logging out and navigating to JoinAs');
                try {
                  // Logout user
                  await logout();
                  console.log('✅ User logged out successfully');
                  
                  // Navigate to JoinAs screen
                  await navigateToJoinAs();
                } catch (error) {
                  console.error('❌ Error during logout/navigation:', error);
                  // Still try to navigate even if logout fails
                  await navigateToJoinAs();
                }
              } else if (bothSignupsComplete) {
                // Both signups complete - navigate to dashboard
                console.log('✅ Both B2B and B2C signups complete - navigating to Dashboard');
                // Navigate to B2B dashboard
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DealerDashboard' }],
                });
              } else if (isFirstSignup) {
                // First signup (B2B only) - go to JoinAs to complete B2C
                console.log('✅ B2B signup complete - navigating to JoinAs to complete B2C signup');
                navigateToJoinAs();
              } else {
                // Fallback - navigate to dashboard
                console.log('⚠️ Unknown user_type - navigating to Dashboard');
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DealerDashboard' }],
                });
              }
            },
          },
        ],
        { cancelable: false }
      );
    } catch (error: any) {
      console.error('Error submitting B2B signup:', error);
      Alert.alert('Error', error.message || 'Failed to submit B2B signup');
    } finally {
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
        <TouchableOpacity onPress={handleGoBack} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>{t('documentUpload.title')}</AutoText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
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

        {documents.map((doc) => (
          <View key={doc.id} style={styles.docCard}>
            <View style={styles.docHeader}>
              <MaterialCommunityIcons name={doc.icon as any} size={24} color={theme.primary} />
              <View style={styles.docTitleContainer}>
                <AutoText style={styles.docTitle}>{doc.title}</AutoText>
              </View>
            </View>
            <AutoText style={styles.docDescription} numberOfLines={3}>
              {doc.description}
            </AutoText>
            <View style={styles.fileInputArea}>
              <AutoText style={styles.fileText} numberOfLines={1}>
                {uploadingDocs[doc.id] ? 'Uploading...' : (selectedFiles[doc.id] || t('documentUpload.noFileChosen'))}
              </AutoText>
              {uploadingDocs[doc.id] ? (
                <ActivityIndicator size="small" color={theme.primary} />
              ) : (
                <TouchableOpacity
                  style={styles.browseBtn}
                  onPress={() => handleBrowse(doc.id)}
                  activeOpacity={0.7}
                  disabled={!!documentUrls[doc.id] || uploadingDocs[doc.id] || pickingDoc !== null}
                >
                  <AutoText style={styles.browseBtnText}>
                    {documentUrls[doc.id] ? 'Uploaded' : t('documentUpload.browse')}
                  </AutoText>
                </TouchableOpacity>
              )}
            </View>
            <AutoText style={styles.formatsText}>{t('documentUpload.acceptedFormats')}: {doc.formats}</AutoText>
          </View>
        ))}
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
          title={t('documentUpload.submitForVerification')}
          onPress={handleSubmit}
          disabled={isSubmitting}
        />
      </Animated.View>
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
    docCard: {
      backgroundColor: theme.card,
      padding: '16@s',
      borderRadius: '18@ms',
      borderWidth: 1,
      borderColor: theme.border,
      gap: '14@vs',
      marginBottom: '18@vs',
    },
    docHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@s',
    },
    docTitleContainer: {
      flex: 1,
    },
    docTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    docDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      lineHeight: '20@vs',
      flexShrink: 1,
    },
    fileInputArea: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: '12@ms',
      paddingVertical: '12@vs',
      paddingHorizontal: '14@s',
      backgroundColor: theme.background,
    },
    fileText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      flex: 1,
    },
    browseBtn: {
      backgroundColor: theme.background,
      borderWidth: 1,
      borderRadius: '12@ms',
      borderColor: theme.primary,
      paddingVertical: '10@vs',
      paddingHorizontal: '18@s',
      alignSelf: 'flex-end',
    },
    browseBtnText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    formatsText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
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

export default DocumentUploadScreen;

