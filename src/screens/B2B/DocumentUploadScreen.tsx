import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Keyboard, Platform, Animated, Easing, Alert, ActivityIndicator } from 'react-native';
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
import { getUserData } from '../../services/auth/authService';
import { uploadB2BDocument } from '../../services/api/v2/b2bSignup';
import { submitB2BSignup } from '../../services/api/v2/b2bSignup';
import { useQueryClient } from '@tanstack/react-query';
import { profileQueryKeys } from '../../hooks/useProfile';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DocumentUploadScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const signupData = route?.params?.signupData || {};
  const [selectedFiles, setSelectedFiles] = useState<Record<string, string>>({});
  const [documentUrls, setDocumentUrls] = useState<Record<string, string>>({});
  const [uploadingDocs, setUploadingDocs] = useState<Record<string, boolean>>({});
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

      const pickedFiles = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        allowMultiSelection: false,
        mode: 'import'
      });

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

    // Validate required documents
    const requiredDocs = ['business-license', 'gst-certificate', 'address-proof', 'kyc-owner'];
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
        gstCertificateUrl: documentUrls['gst-certificate'],
        addressProofUrl: documentUrls['address-proof'],
        kycOwnerUrl: documentUrls['kyc-owner'],
      };

      await submitB2BSignup(userData.id, signupPayload);
      
      // Invalidate profile cache to force fresh fetch with updated shop data
      console.log('🗑️  Invalidating profile cache after B2B signup submission');
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.all });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.detail(userData.id) });
      await queryClient.invalidateQueries({ queryKey: profileQueryKeys.current() });
      
      // Refresh user data to get updated user_type
      const updatedUserData = await getUserData();
      console.log('✅ Updated user type after B2B signup:', updatedUserData?.user_type);
      
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
      
      // Navigate to dashboard after successful submission
      navigation.reset({
        index: 0,
        routes: [{ name: 'DealerDashboard' }],
      });
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
                  disabled={!!documentUrls[doc.id]}
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
  });

export default DocumentUploadScreen;

