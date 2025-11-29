import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import * as DocumentPicker from '@react-native-documents/picker';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { ProfileData, UpdateProfileData } from '../../services/api/v2/profile';
import { useProfile, useUpdateProfile, useUploadProfileImage, useUploadAadharCard, useUploadDrivingLicense } from '../../hooks/useProfile';

const EditProfileScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, isDark, themeName), [theme, isDark, themeName]);

  const [userData, setUserData] = useState<any>(null);
  
  // Get user data first
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Use React Query hooks
  const { data: profile, isLoading: loading, refetch: refetchProfile } = useProfile(
    userData?.id,
    !!userData?.id
  );
  const updateProfileMutation = useUpdateProfile(userData?.id || 0);
  const uploadImageMutation = useUploadProfileImage(userData?.id || 0);
  const uploadAadharMutation = useUploadAadharCard(userData?.id || 0);
  const uploadDrivingLicenseMutation = useUploadDrivingLicense(userData?.id || 0);
  
  const saving = updateProfileMutation.isPending;

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aadharCard, setAadharCard] = useState<string | null>(null);
  const [drivingLicense, setDrivingLicense] = useState<string | null>(null);
  const [uploadingAadhar, setUploadingAadhar] = useState(false);
  const [uploadingDrivingLicense, setUploadingDrivingLicense] = useState(false);

  // Update form fields when profile data changes
  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setEmail(profile.email || '');
      setPhone(profile.phone || '');
      setProfileImage(profile.profile_image || null);
      setAadharCard(profile.shop?.aadhar_card || profile.delivery?.aadhar_card || null);
      setDrivingLicense(profile.shop?.driving_license || profile.delivery?.driving_license || null);

      // Set address from shop or delivery or user data
      if (profile.shop?.address) {
        setAddress(profile.shop.address);
      } else if (profile.delivery?.address) {
        setAddress(profile.delivery.address);
      } else {
        setAddress('');
      }
    }
  }, [profile]);

  const handleImagePicker = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8,
      maxWidth: 1920,
      maxHeight: 1920,
    };

    launchImageLibrary(options, async (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorMessage) {
        Alert.alert('Error', response.errorMessage);
        return;
      }

      const asset = response.assets?.[0];
      if (!asset?.uri) {
        return;
      }

      if (!userData?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      setUploadingImage(true);
      uploadImageMutation.mutate(asset.uri, {
        onSuccess: (result) => {
          setProfileImage(result.image_url);
          // Update local state with new profile data
          if (result.profile) {
            // The cache is already updated by the hook
          }
          setUploadingImage(false);
          Alert.alert('Success', 'Profile image uploaded successfully');
        },
        onError: (error: any) => {
          console.error('Error uploading image:', error);
          setUploadingImage(false);
          Alert.alert('Error', error.message || 'Failed to upload profile image');
        },
      });
    });
  };

  const handleDocumentUpload = async (type: 'aadhar' | 'drivingLicense') => {
    try {
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

      const fileUri = pickedFile.uri;
      if (!fileUri) {
        Alert.alert('Error', 'Unable to access selected file');
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
            // Update local state with new profile data
            if (result.profile) {
              // The cache is already updated by the hook
            }
            setUploadingAadhar(false);
            Alert.alert('Success', 'Aadhar card uploaded successfully');
          },
          onError: (error: any) => {
            console.error('Error uploading Aadhar card:', error);
            setUploadingAadhar(false);
            Alert.alert('Error', error.message || 'Failed to upload Aadhar card');
          },
        });
      } else {
        setUploadingDrivingLicense(true);
        uploadDrivingLicenseMutation.mutate(fileUri, {
          onSuccess: (result) => {
            setDrivingLicense(result.image_url);
            // Update local state with new profile data
            if (result.profile) {
              // The cache is already updated by the hook
            }
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
    }
  };

  const handleSave = async () => {
    if (!userData?.id || !profile) {
      Alert.alert('Error', 'User not found');
      return;
    }

    const updateData: UpdateProfileData = {
      name: name.trim() || undefined,
      email: email.trim() || undefined,
    };

    // Add address to shop data if user is B2B/B2C
    // Always send address (even if empty) so we can create/update shop record
    if (profile.user_type === 'S' || profile.user_type === 'R' || profile.user_type === 'SR') {
      const trimmedAddress = address.trim();
      updateData.shop = {
        address: trimmedAddress,
      };
      console.log('📤 Updating shop address:', trimmedAddress);
      console.log('📤 Shop updateData:', JSON.stringify(updateData.shop, null, 2));
    }

    // Add address to delivery data if user is Delivery
    // Always send address (even if empty) so we can create/update delivery boy record
    if (profile.user_type === 'D') {
      const trimmedAddress = address.trim();
      updateData.delivery = {
        address: trimmedAddress,
      };
      console.log('📤 Updating delivery address:', trimmedAddress);
      console.log('📤 Delivery updateData:', JSON.stringify(updateData.delivery, null, 2));
    }

    console.log('📤 Update data being sent:', JSON.stringify(updateData, null, 2));

    // Use React Query mutation
    updateProfileMutation.mutate(updateData, {
      onSuccess: (updatedProfile) => {
        console.log('📥 Updated profile received:', JSON.stringify(updatedProfile, null, 2));
        console.log('📥 Address in response:', {
          shop_address: updatedProfile.shop?.address,
          delivery_address: updatedProfile.delivery?.address,
        });
        console.log('✅ Profile cache invalidated and updated');
        
        // Force refetch profile to ensure fresh data
        if (userData?.id) {
          refetchProfile();
        }
        
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      },
      onError: (error: any) => {
        console.error('Error updating profile:', error);
        Alert.alert('Error', error.message || 'Failed to update profile');
      },
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={isDark ? theme.background : '#FFFFFF'}
        />
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>Edit Profile</AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Image Section */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>Profile Picture</AutoText>
          <View style={styles.imageContainer}>
            <TouchableOpacity
              style={styles.imagePicker}
              onPress={handleImagePicker}
              disabled={uploadingImage || saving}
              activeOpacity={0.7}
            >
              {uploadingImage ? (
                <ActivityIndicator size="large" color={theme.primary} />
              ) : profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={styles.placeholderImage}>
                  <MaterialCommunityIcons name="camera" size={40} color={theme.textSecondary} />
                </View>
              )}
              <View style={styles.imageOverlay}>
                <MaterialCommunityIcons name="camera-plus" size={14} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
            <AutoText style={styles.imageHint}>Tap to change profile picture</AutoText>
          </View>
        </View>

        {/* Personal Information Section */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>Personal Information</AutoText>

          <View style={styles.inputWrapper}>
            <AutoText style={styles.label}>Name</AutoText>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor={theme.textSecondary}
              editable={!saving}
            />
          </View>

          <View style={styles.inputWrapper}>
            <AutoText style={styles.label}>Email</AutoText>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor={theme.textSecondary}
              keyboardType="email-address"
              autoCapitalize="none"
              editable={!saving}
            />
          </View>

          <View style={styles.inputWrapper}>
            <AutoText style={styles.label}>Phone</AutoText>
            <TextInput
              style={[styles.input, styles.disabledInput]}
              value={phone}
              placeholder="Phone number"
              placeholderTextColor={theme.textSecondary}
              editable={false}
            />
            <AutoText style={styles.disabledNote}>Phone number cannot be changed</AutoText>
          </View>

          <View style={styles.inputWrapper}>
            <AutoText style={styles.label}>Address</AutoText>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={address}
              onChangeText={setAddress}
              placeholder="Enter your address"
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              editable={!saving}
            />
          </View>
        </View>

        {/* Documents Section - Aadhar Card (All Users) */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>Aadhar Card</AutoText>
          <TouchableOpacity
            style={styles.documentUploadButton}
            onPress={() => handleDocumentUpload('aadhar')}
            disabled={uploadingAadhar || saving}
            activeOpacity={0.7}
          >
            {uploadingAadhar ? (
              <View style={styles.documentPlaceholder}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : aadharCard ? (
              <View style={styles.documentPreview}>
                <View style={styles.documentIconContainer}>
                  <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                  <AutoText style={styles.documentFileName}>Aadhar Card.pdf</AutoText>
                </View>
                <View style={styles.documentOverlay}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                </View>
              </View>
            ) : (
              <View style={styles.documentPlaceholder}>
                <MaterialCommunityIcons name="file-pdf-box" size={32} color={theme.textSecondary} />
                <AutoText style={styles.documentPlaceholderText}>Upload Aadhar Card (PDF)</AutoText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Documents Section - Driving License (All Users) */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>Driving License</AutoText>
          <TouchableOpacity
            style={styles.documentUploadButton}
            onPress={() => handleDocumentUpload('drivingLicense')}
            disabled={uploadingDrivingLicense || saving}
            activeOpacity={0.7}
          >
            {uploadingDrivingLicense ? (
              <View style={styles.documentPlaceholder}>
                <ActivityIndicator size="large" color={theme.primary} />
              </View>
            ) : drivingLicense ? (
              <View style={styles.documentPreview}>
                <View style={styles.documentIconContainer}>
                  <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                  <AutoText style={styles.documentFileName}>Driving License.pdf</AutoText>
                </View>
                <View style={styles.documentOverlay}>
                  <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                </View>
              </View>
            ) : (
              <View style={styles.documentPlaceholder}>
                <MaterialCommunityIcons name="file-pdf-box" size={32} color={theme.textSecondary} />
                <AutoText style={styles.documentPlaceholderText}>Upload Driving License (PDF)</AutoText>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
          activeOpacity={0.7}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <AutoText style={styles.saveButtonText}>Save Changes</AutoText>
          )}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, isDark: boolean, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      justifyContent: 'center',
      alignItems: 'center',
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
    section: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '18@s',
      marginBottom: '18@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '18@vs',
    },
    inputWrapper: {
      marginBottom: '18@vs',
    },
    label: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    input: {
      height: '52@vs',
      borderWidth: 1,
      borderRadius: '12@ms',
      borderColor: theme.border,
      paddingHorizontal: '16@s',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    textArea: {
      height: '100@vs',
      paddingTop: '14@vs',
      textAlignVertical: 'top',
    },
    disabledInput: {
      backgroundColor: theme.disabled,
      opacity: 0.6,
    },
    disabledNote: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
      fontStyle: 'italic',
    },
    saveButton: {
      backgroundColor: theme.primary,
      borderRadius: '12@ms',
      paddingVertical: '16@vs',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '8@vs',
      marginBottom: '18@vs',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: '#FFFFFF',
    },
    imageContainer: {
      alignItems: 'center',
      marginBottom: '18@vs',
    },
    imagePicker: {
      width: '120@s',
      height: '120@s',
      borderRadius: '60@s',
      backgroundColor: theme.background,
      borderWidth: 2,
      borderColor: theme.border,
      overflow: 'visible',
      justifyContent: 'center',
      alignItems: 'center',
    },
    profileImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
      borderRadius: '60@s',
    },
    placeholderImage: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.disabled,
      borderRadius: '60@s',
    },
    imageOverlay: {
      position: 'absolute',
      bottom: '-2@s',
      right: '-2@s',
      width: '30@s',
      height: '30@s',
      borderRadius: '20@s',
      backgroundColor: theme.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 3,
      borderColor: theme.card || theme.background,
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 5,
    },
    imageHint: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
      textAlign: 'center',
    },
    documentUploadButton: {
      width: '100%',
      minHeight: '120@vs',
      borderRadius: '12@ms',
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
      backgroundColor: theme.background,
      overflow: 'hidden',
    },
    documentPreview: {
      width: '100%',
      height: '120@vs',
      position: 'relative',
    },
    documentImage: {
      width: '100%',
      height: '100%',
      resizeMode: 'cover',
    },
    documentOverlay: {
      position: 'absolute',
      top: '8@vs',
      right: '8@s',
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      borderRadius: '12@ms',
      padding: '4@s',
    },
    documentPlaceholder: {
      width: '100%',
      height: '120@vs',
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '20@vs',
    },
    documentPlaceholderText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
    },
    documentIconContainer: {
      width: '100%',
      height: '100%',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    documentFileName: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
      marginTop: '8@vs',
    },
  });

export default EditProfileScreen;

