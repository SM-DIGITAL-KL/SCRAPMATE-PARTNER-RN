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
import { uploadB2BDocument } from '../../services/api/v2/b2bSignup';
import { useLocationService } from '../../components/LocationView';
import { AddAddressModal } from '../../components/AddAddressModal';
import { getCustomerAddresses, Address, deleteAddress } from '../../services/api/v2/address';
import { useFocusEffect } from '@react-navigation/native';
import { DeviceEventEmitter, Modal } from 'react-native';
import { WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';

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
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [pincode, setPincode] = useState<string>('');
  const [placeId, setPlaceId] = useState<string>('');
  const [state, setState] = useState<string>('');
  const [language, setLanguage] = useState<string>('');
  const [place, setPlace] = useState<string>('');
  const [location, setLocation] = useState<string>('');
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [aadharCard, setAadharCard] = useState<string | null>(null);
  const [drivingLicense, setDrivingLicense] = useState<string | null>(null);
  const [uploadingAadhar, setUploadingAadhar] = useState(false);
  const [uploadingDrivingLicense, setUploadingDrivingLicense] = useState(false);
  
  // B2B document states
  const [businessLicense, setBusinessLicense] = useState<string | null>(null);
  const [gstCertificate, setGstCertificate] = useState<string | null>(null);
  const [addressProof, setAddressProof] = useState<string | null>(null);
  const [kycOwner, setKycOwner] = useState<string | null>(null);
  const [uploadingB2BDoc, setUploadingB2BDoc] = useState<Record<string, boolean>>({});
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfTitle, setPdfTitle] = useState<string>('');
  const [useFallbackViewer, setUseFallbackViewer] = useState(false);
  
  // Check if user is B2B (use userData as fallback if profile not loaded yet)
  const isB2BUser = React.useMemo(() => {
    return profile?.user_type === 'S' || profile?.user_type === 'SR' || 
           userData?.user_type === 'S' || userData?.user_type === 'SR';
  }, [profile?.user_type, userData?.user_type]);
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showAddAddressModal, setShowAddAddressModal] = useState(false);

  // Location service hook
  const { getCurrentLocationWithAddress } = useLocationService();

  // Function to load addresses
  const loadAddresses = React.useCallback(async () => {
    if (!userData?.id) return;
    
    setLoadingAddresses(true);
    try {
      const addresses = await getCustomerAddresses(userData.id);
      setSavedAddresses(addresses);
    } catch (error: any) {
      console.error('Error loading addresses:', error);
      // Don't show error alert - just log it, addresses might not exist yet
    } finally {
      setLoadingAddresses(false);
    }
  }, [userData?.id]);

  // Fetch saved addresses on screen focus
  useFocusEffect(
    React.useCallback(() => {
      loadAddresses();
    }, [loadAddresses])
  );

  // Listen for address updates from other screens
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('addressesUpdated', () => {
      console.log('📍 Addresses updated event received, refreshing addresses list');
      loadAddresses();
    });

    return () => {
      subscription.remove();
    };
  }, [loadAddresses]);

  // Update address state when saved addresses are loaded
  useEffect(() => {
    if (savedAddresses.length > 0 && !loadingAddresses) {
      const addr = savedAddresses[0];
      if (addr.address && addr.address !== address) {
        setAddress(addr.address);
        if (addr.latitude && addr.longitude) {
          setLatitude(addr.latitude);
          setLongitude(addr.longitude);
        }
        if (addr.pincode) setPincode(addr.pincode);
        if (addr.state) setState(addr.state);
        if (addr.place) setPlace(addr.place);
        if (addr.location) setLocation(addr.location);
        if (addr.place_id) setPlaceId(addr.place_id);
      }
    }
  }, [savedAddresses, loadingAddresses]);

  const handleDeleteAddress = async (addressId: number) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteAddress(addressId);
              // Refresh addresses list from server to ensure consistency
              if (userData?.id) {
                const addresses = await getCustomerAddresses(userData.id);
                setSavedAddresses(addresses);
              } else {
                // Fallback: filter locally if userData is not available
                setSavedAddresses(prev => prev.filter(addr => addr.id !== addressId));
              }
              Alert.alert('Success', 'Address deleted successfully');
            } catch (error: any) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', error.message || 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  // Update form fields when profile data changes
  useEffect(() => {
    if (profile) {
      // For B2B users, use contact person name and email from shop
      if (isB2BUser && profile.shop) {
        setName(profile.shop.contact_person_name || profile.name || '');
        setEmail(profile.shop.contact_person_email || profile.shop.email || profile.email || '');
      } else {
        setName(profile.name || '');
        setEmail(profile.email || '');
      }
      setPhone(profile.phone || '');
      setProfileImage(profile.profile_image || null);
      
      // Set B2B documents if user is B2B
      if (isB2BUser && profile.shop) {
        setBusinessLicense(profile.shop.business_license_url || null);
        setGstCertificate(profile.shop.gst_certificate_url || null);
        setAddressProof(profile.shop.address_proof_url || null);
        setKycOwner(profile.shop.kyc_owner_url || null);
      } else {
        // Set B2C/Delivery documents
        setAadharCard(profile.shop?.aadhar_card || profile.delivery?.aadhar_card || null);
        setDrivingLicense(profile.shop?.driving_license || profile.delivery?.driving_license || null);
      }

      // Set address from shop or delivery or user data
      if (profile.shop?.address) {
        setAddress(profile.shop.address);
        // Set latitude and longitude if available
        if (profile.shop.lat_log) {
          const [lat, lng] = profile.shop.lat_log.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            setLatitude(lat);
            setLongitude(lng);
          }
        }
        // Set other location fields
        setPincode(profile.shop.pincode || '');
        setPlaceId(profile.shop.place_id || '');
        setState(profile.shop.state || '');
        setLanguage(profile.shop.language || '');
        setPlace(profile.shop.place || '');
        setLocation(profile.shop.location || '');
      } else if (profile.delivery?.address) {
        setAddress(profile.delivery.address);
        // Set latitude and longitude if available
        if (profile.delivery.lat_log) {
          const [lat, lng] = profile.delivery.lat_log.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            setLatitude(lat);
            setLongitude(lng);
          }
        }
        // Set other location fields
        setPincode(profile.delivery.pincode || '');
        setPlaceId(profile.delivery.place_id || '');
        setState(profile.delivery.state || '');
        setLanguage(profile.delivery.language || '');
        setPlace(profile.delivery.place || '');
        setLocation(profile.delivery.location || '');
      } else {
        setAddress('');
        setLatitude(null);
        setLongitude(null);
        setPincode('');
        setPlaceId('');
        setState('');
        setLanguage('');
        setPlace('');
        setLocation('');
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

  // Function to get current location and fill address
  const handleGetCurrentLocation = async () => {
    try {
      setLoadingLocation(true);
      const locationData = await getCurrentLocationWithAddress();
      
      if (locationData) {
        // Set latitude and longitude
        if (locationData.latitude && locationData.longitude) {
          setLatitude(locationData.latitude);
          setLongitude(locationData.longitude);
        }
        
        // Set address and location fields if available
        if (locationData.address) {
          const addressText = locationData.address.address || locationData.address.formattedAddress || '';
          if (addressText) {
            setAddress(addressText);
            
            // Set location fields from address data
            if (locationData.address.postcode) {
              setPincode(locationData.address.postcode);
            }
            if (locationData.address.state) {
              setState(locationData.address.state);
            }
            if (locationData.address.city) {
              setPlace(locationData.address.city);
            }
            // Build location string from available components
            const locationParts = [];
            if (locationData.address.city) locationParts.push(locationData.address.city);
            if (locationData.address.state) locationParts.push(locationData.address.state);
            if (locationData.address.country) locationParts.push(locationData.address.country);
            if (locationParts.length > 0) {
              setLocation(locationParts.join(', '));
            }
            
            Alert.alert('Success', 'Address filled from your current location');
          } else {
            Alert.alert('Info', 'Could not determine address from location');
          }
        } else {
          Alert.alert('Error', 'Could not get your location. Please enter address manually.');
        }
      } else {
        Alert.alert('Error', 'Could not get your location. Please enter address manually.');
      }
    } catch (error: any) {
      console.error('Error getting location:', error);
      Alert.alert('Error', error.message || 'Failed to get location. Please enter address manually.');
    } finally {
      setLoadingLocation(false);
    }
  };

  // Helper function to get file extension from URI
  const getFileExtension = (uri: string): string => {
    const uriLower = uri.toLowerCase();
    const lastDot = uriLower.lastIndexOf('.');
    if (lastDot === -1) return '';
    // Remove query parameters if present
    const uriWithoutQuery = uriLower.substring(0, uriLower.indexOf('?'));
    const lastDotNoQuery = uriWithoutQuery.lastIndexOf('.');
    if (lastDotNoQuery === -1) return '';
    return uriWithoutQuery.substring(lastDotNoQuery + 1);
  };

  // Helper function to check if URL is an image
  const isImageFile = (url: string): boolean => {
    if (!url) return false;
    const extension = getFileExtension(url);
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
    return imageExtensions.includes(extension.toLowerCase());
  };

  // Helper function to check if URL is a PDF
  const isPdfFile = (url: string): boolean => {
    if (!url) return false;
    const extension = getFileExtension(url);
    return extension.toLowerCase() === 'pdf';
  };

  // Helper function to get MIME type from file extension
  const getMimeTypeFromUri = (uri: string, fileType?: string): string => {
    // If fileType is provided and valid, use it
    if (fileType && fileType !== 'application/octet-stream') {
      return fileType;
    }
    
    // Otherwise, determine from file extension
    const uriLower = uri.toLowerCase();
    if (uriLower.endsWith('.pdf')) {
      return 'application/pdf';
    } else if (uriLower.endsWith('.jpg') || uriLower.endsWith('.jpeg')) {
      return 'image/jpeg';
    } else if (uriLower.endsWith('.png')) {
      return 'image/png';
    } else if (uriLower.endsWith('.gif')) {
      return 'image/gif';
    } else if (uriLower.endsWith('.webp')) {
      return 'image/webp';
    } else if (uriLower.endsWith('.bmp')) {
      return 'image/bmp';
    } else if (uriLower.endsWith('.tiff') || uriLower.endsWith('.tif')) {
      return 'image/tiff';
    }
    
    // Default to application/octet-stream if unknown
    return 'application/octet-stream';
  };

  const handleDocumentUpload = async (type: 'aadhar' | 'drivingLicense') => {
    try {
      // Allow images and PDF files
      const pickedFiles = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf, DocumentPicker.types.images],
        allowMultiSelection: false,
        mode: 'import',
      });

      if (!pickedFiles || pickedFiles.length === 0) {
        return;
      }

      const file = pickedFiles[0];
      const fileUri = file.uri;
      
      if (!fileUri) {
        Alert.alert('Error', 'Failed to access selected file');
        return;
      }

      // Get file size
      let fileSize = 0;
      try {
        // Try to get size from file object first
        if (file.size) {
          fileSize = file.size;
        } else {
          // Fallback: use react-native-fs to get file size
          const fileInfo = await RNFS.stat(fileUri);
          fileSize = fileInfo.size;
        }
      } catch (sizeError) {
        console.warn('Could not get file size:', sizeError);
        // Continue without size check if we can't get it
      }

      // Validate file size (5MB = 5 * 1024 * 1024 bytes)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (fileSize > 0 && fileSize > maxSize) {
        Alert.alert(
          'Error',
          `File size is too large. Maximum size is 5MB. Your file is ${(fileSize / (1024 * 1024)).toFixed(2)}MB`
        );
        return;
      }

      // Validate file type - allow images and PDFs
      const fileExtension = getFileExtension(fileUri);
      const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
      const isValidFileType = allowedExtensions.includes(fileExtension.toLowerCase()) || 
                              file.type?.startsWith('image/') || 
                              file.type === 'application/pdf';

      if (!isValidFileType) {
        Alert.alert(
          'Error',
          'Please upload an image (JPG, PNG, GIF, etc.) or PDF file'
        );
        return;
      }

      if (!userData?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      // Get MIME type for upload
      const mimeType = getMimeTypeFromUri(fileUri, file.type);
      const fileExtensionForName = fileExtension || (mimeType.includes('pdf') ? 'pdf' : 'jpg');
      const fileName = type === 'aadhar' ? `aadhar.${fileExtensionForName}` : `driving-license.${fileExtensionForName}`;

      if (type === 'aadhar') {
        setUploadingAadhar(true);
        uploadAadharMutation.mutate({ fileUri, fileType: mimeType }, {
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
        uploadDrivingLicenseMutation.mutate({ fileUri, fileType: mimeType }, {
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
      if (type === 'aadhar') {
        setUploadingAadhar(false);
      } else if (type === 'drivingLicense') {
        setUploadingDrivingLicense(false);
      }
    }
  };

  // Handle viewing B2B document in WebView
  const handleViewB2BDocument = (docUrl: string, docName: string) => {
    setPdfUrl(docUrl);
    setPdfTitle(docName);
    setUseFallbackViewer(false); // Reset to Google Docs Viewer first
    setShowPdfViewer(true);
  };

  // Handle B2B document upload
  const handleB2BDocumentUpload = async (docType: 'business-license' | 'gst-certificate' | 'address-proof' | 'kyc-owner') => {
    try {
      if (!userData?.id) {
        Alert.alert('Error', 'User not found');
        return;
      }

      // Prevent multiple simultaneous DocumentPicker calls
      if (uploadingB2BDoc[docType]) {
        return;
      }

      const pickedFiles = await DocumentPicker.pick({
        type: [DocumentPicker.types.pdf],
        allowMultiSelection: false,
        mode: 'import',
      });

      if (!pickedFiles || pickedFiles.length === 0) {
        return;
      }

      const file = pickedFiles[0];
      const fileUri = file.uri || file.fileCopyUri;
      
      if (!fileUri) {
        Alert.alert('Error', 'Failed to access selected file');
        return;
      }

      // Validate file type
      const isPdf = file.type === 'application/pdf' || file.name?.toLowerCase().endsWith('.pdf');
      if (!isPdf) {
        Alert.alert('Error', 'Please select a PDF file');
        return;
      }

      setUploadingB2BDoc(prev => ({ ...prev, [docType]: true }));

      const result = await uploadB2BDocument(userData.id, fileUri, docType);

      // Update the appropriate state
      switch (docType) {
        case 'business-license':
          setBusinessLicense(result.document_url);
          break;
        case 'gst-certificate':
          setGstCertificate(result.document_url);
          break;
        case 'address-proof':
          setAddressProof(result.document_url);
          break;
        case 'kyc-owner':
          setKycOwner(result.document_url);
          break;
      }

      // Invalidate profile cache to refresh data
      if (userData?.id) {
        refetchProfile();
      }

      Alert.alert('Success', 'Document uploaded successfully');
      setUploadingB2BDoc(prev => ({ ...prev, [docType]: false }));
    } catch (err: any) {
      if (DocumentPicker.isErrorWithCode?.(err) && err.code === DocumentPicker.errorCodes.OPERATION_CANCELED) {
        setUploadingB2BDoc(prev => ({ ...prev, [docType]: false }));
        return;
      }
      console.error('Error uploading B2B document:', err);
      Alert.alert('Error', err.message || 'Failed to upload document');
      setUploadingB2BDoc(prev => ({ ...prev, [docType]: false }));
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
      
      // For B2B users, also update contact person name and email
      if (isB2BUser) {
        if (name.trim()) {
          updateData.shop.contact_person_name = name.trim();
        }
        if (email.trim()) {
          updateData.shop.contact_person_email = email.trim();
        }
      }
      // Include latitude and longitude if available
      if (latitude !== null && longitude !== null) {
        updateData.shop.latitude = latitude;
        updateData.shop.longitude = longitude;
        updateData.shop.lat_log = `${latitude},${longitude}`;
      }
      // Include all location-related fields
      if (pincode) updateData.shop.pincode = pincode.trim();
      if (placeId) updateData.shop.place_id = placeId.trim();
      if (state) updateData.shop.state = state.trim();
      if (language) updateData.shop.language = language.trim();
      if (place) updateData.shop.place = place.trim();
      if (location) updateData.shop.location = location.trim();
      
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
      // Include latitude and longitude if available
      if (latitude !== null && longitude !== null) {
        updateData.delivery.latitude = latitude;
        updateData.delivery.longitude = longitude;
        updateData.delivery.lat_log = `${latitude},${longitude}`;
      }
      // Include all location-related fields
      if (pincode) updateData.delivery.pincode = pincode.trim();
      if (placeId) updateData.delivery.place_id = placeId.trim();
      if (state) updateData.delivery.state = state.trim();
      if (language) updateData.delivery.language = language.trim();
      if (place) updateData.delivery.place = place.trim();
      if (location) updateData.delivery.location = location.trim();
      
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
            <View style={styles.addressHeader}>
              <AutoText style={styles.label}>Address</AutoText>
              <TouchableOpacity
                onPress={() => {
                  setShowAddAddressModal(true);
                }}
                style={styles.addAddressButton}
              >
                <MaterialCommunityIcons 
                  name={savedAddresses.length > 0 ? "pencil" : "plus-circle"} 
                  size={20} 
                  color={theme.primary} 
                />
                <AutoText style={styles.addAddressText}>
                  {savedAddresses.length > 0 ? 'Update Address' : 'Add Address'}
                </AutoText>
              </TouchableOpacity>
            </View>
            
            {loadingAddresses ? (
              <View style={styles.addressLoadingContainer}>
                <ActivityIndicator size="small" color={theme.primary} />
                <AutoText style={styles.addressLoadingText}>Loading address...</AutoText>
              </View>
            ) : savedAddresses.length > 0 ? (
              // Show the registered address in a display format
              (() => {
                const addr = savedAddresses[0];
                // Build full address string with house name and nearby location
                let fullAddress = addr.address || '';
                if (addr.building_no) {
                  fullAddress = `${addr.building_no}, ${fullAddress}`;
                }
                if (addr.landmark) {
                  fullAddress = `${fullAddress}, ${addr.landmark}`;
                }
                return (
                  <View style={styles.addressDisplayField}>
                    <AutoText style={styles.addressDisplayText} numberOfLines={6}>
                      {fullAddress}
                    </AutoText>
                  </View>
                );
              })()
            ) : (profile?.shop?.address || profile?.delivery?.address) ? (
              // Show address from profile (shop or delivery) if no saved addresses
              <View style={styles.addressDisplayField}>
                <AutoText style={styles.addressDisplayText} numberOfLines={6}>
                  {profile.shop?.address || profile.delivery?.address || ''}
                </AutoText>
              </View>
            ) : (
              <View style={styles.noAddressContainer}>
                <MaterialCommunityIcons name="map-marker-off" size={32} color={theme.textSecondary} />
                <AutoText style={styles.noAddressText}>No address saved</AutoText>
                <AutoText style={styles.noAddressSubtext}>Add an address to get started</AutoText>
              </View>
            )}
          </View>
        </View>

        {/* Documents Section - Show B2B documents for B2B users, Aadhar/Driving License for others */}
        {isB2BUser ? (
          <>
            {/* Business License */}
            <View style={styles.section}>
              <AutoText style={styles.sectionTitle}>Business License</AutoText>
              {businessLicense ? (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleViewB2BDocument(businessLicense, 'Business License')}
                  activeOpacity={0.7}
                >
                  <View style={styles.documentPreview}>
                    <View style={styles.documentIconContainer}>
                      <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                      <AutoText style={styles.documentFileName}>
                        Business License.{getFileExtension(businessLicense) || 'pdf'}
                      </AutoText>
                    </View>
                    <View style={styles.documentOverlay}>
                      <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleB2BDocumentUpload('business-license')}
                  disabled={uploadingB2BDoc['business-license'] || saving}
                  activeOpacity={0.7}
                >
                  {uploadingB2BDoc['business-license'] ? (
                    <View style={styles.documentPlaceholder}>
                      <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                  ) : (
                    <View style={styles.documentPlaceholder}>
                      <MaterialCommunityIcons name="file-upload" size={32} color={theme.textSecondary} />
                      <AutoText style={styles.documentPlaceholderText}>Upload Business License (PDF)</AutoText>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* GST Certificate */}
            <View style={styles.section}>
              <AutoText style={styles.sectionTitle}>GST Certificate</AutoText>
              {gstCertificate ? (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleViewB2BDocument(gstCertificate, 'GST Certificate')}
                  activeOpacity={0.7}
                >
                  <View style={styles.documentPreview}>
                    <View style={styles.documentIconContainer}>
                      <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                      <AutoText style={styles.documentFileName}>
                        GST Certificate.{getFileExtension(gstCertificate) || 'pdf'}
                      </AutoText>
                    </View>
                    <View style={styles.documentOverlay}>
                      <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleB2BDocumentUpload('gst-certificate')}
                  disabled={uploadingB2BDoc['gst-certificate'] || saving}
                  activeOpacity={0.7}
                >
                  {uploadingB2BDoc['gst-certificate'] ? (
                    <View style={styles.documentPlaceholder}>
                      <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                  ) : (
                    <View style={styles.documentPlaceholder}>
                      <MaterialCommunityIcons name="file-upload" size={32} color={theme.textSecondary} />
                      <AutoText style={styles.documentPlaceholderText}>Upload GST Certificate (PDF)</AutoText>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* Address Proof */}
            <View style={styles.section}>
              <AutoText style={styles.sectionTitle}>Address Proof</AutoText>
              {addressProof ? (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleViewB2BDocument(addressProof, 'Address Proof')}
                  activeOpacity={0.7}
                >
                  <View style={styles.documentPreview}>
                    <View style={styles.documentIconContainer}>
                      <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                      <AutoText style={styles.documentFileName}>
                        Address Proof.{getFileExtension(addressProof) || 'pdf'}
                      </AutoText>
                    </View>
                    <View style={styles.documentOverlay}>
                      <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleB2BDocumentUpload('address-proof')}
                  disabled={uploadingB2BDoc['address-proof'] || saving}
                  activeOpacity={0.7}
                >
                  {uploadingB2BDoc['address-proof'] ? (
                    <View style={styles.documentPlaceholder}>
                      <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                  ) : (
                    <View style={styles.documentPlaceholder}>
                      <MaterialCommunityIcons name="file-upload" size={32} color={theme.textSecondary} />
                      <AutoText style={styles.documentPlaceholderText}>Upload Address Proof (PDF)</AutoText>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* KYC Owner */}
            <View style={styles.section}>
              <AutoText style={styles.sectionTitle}>KYC Owner</AutoText>
              {kycOwner ? (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleViewB2BDocument(kycOwner, 'KYC Owner')}
                  activeOpacity={0.7}
                >
                  <View style={styles.documentPreview}>
                    <View style={styles.documentIconContainer}>
                      <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                      <AutoText style={styles.documentFileName}>
                        KYC Owner.{getFileExtension(kycOwner) || 'pdf'}
                      </AutoText>
                    </View>
                    <View style={styles.documentOverlay}>
                      <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                    </View>
                  </View>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.documentUploadButton}
                  onPress={() => handleB2BDocumentUpload('kyc-owner')}
                  disabled={uploadingB2BDoc['kyc-owner'] || saving}
                  activeOpacity={0.7}
                >
                  {uploadingB2BDoc['kyc-owner'] ? (
                    <View style={styles.documentPlaceholder}>
                      <ActivityIndicator size="large" color={theme.primary} />
                    </View>
                  ) : (
                    <View style={styles.documentPlaceholder}>
                      <MaterialCommunityIcons name="file-upload" size={32} color={theme.textSecondary} />
                      <AutoText style={styles.documentPlaceholderText}>Upload KYC Owner (PDF)</AutoText>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </>
        ) : (
          <>
            {/* Documents Section - Aadhar Card (B2C/Delivery Users) */}
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
              isImageFile(aadharCard) ? (
                <View style={styles.documentPreview}>
                  <Image source={{ uri: aadharCard }} style={styles.documentImage} resizeMode="cover" />
                  <View style={styles.documentOverlay}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                  </View>
                </View>
              ) : (
                <View style={styles.documentPreview}>
                  <View style={styles.documentIconContainer}>
                    <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                    <AutoText style={styles.documentFileName}>
                      Aadhar Card.{getFileExtension(aadharCard) || 'pdf'}
                    </AutoText>
                  </View>
                  <View style={styles.documentOverlay}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                  </View>
                </View>
              )
            ) : (
              <View style={styles.documentPlaceholder}>
                <MaterialCommunityIcons name="file-upload" size={32} color={theme.textSecondary} />
                <AutoText style={styles.documentPlaceholderText}>Upload Aadhar Card (Image or PDF)</AutoText>
              </View>
            )}
          </TouchableOpacity>
        </View>

            {/* Documents Section - Driving License (B2C/Delivery Users) */}
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
              isImageFile(drivingLicense) ? (
                <View style={styles.documentPreview}>
                  <Image source={{ uri: drivingLicense }} style={styles.documentImage} resizeMode="cover" />
                  <View style={styles.documentOverlay}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                  </View>
                </View>
              ) : (
                <View style={styles.documentPreview}>
                  <View style={styles.documentIconContainer}>
                    <MaterialCommunityIcons name="file-pdf-box" size={48} color="#DC143C" />
                    <AutoText style={styles.documentFileName}>
                      Driving License.{getFileExtension(drivingLicense) || 'pdf'}
                    </AutoText>
                  </View>
                  <View style={styles.documentOverlay}>
                    <MaterialCommunityIcons name="check-circle" size={24} color="#4CAF50" />
                  </View>
                </View>
              )
            ) : (
              <View style={styles.documentPlaceholder}>
                <MaterialCommunityIcons name="file-upload" size={32} color={theme.textSecondary} />
                <AutoText style={styles.documentPlaceholderText}>Upload Driving License (Image or PDF)</AutoText>
              </View>
            )}
          </TouchableOpacity>
        </View>
          </>
        )}

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

      {/* Add Address Modal */}
      <AddAddressModal
        visible={showAddAddressModal}
        onClose={() => setShowAddAddressModal(false)}
        onSaveSuccess={async () => {
          // Refresh addresses list after successful save
          if (userData?.id) {
            try {
              const addresses = await getCustomerAddresses(userData.id);
              setSavedAddresses(addresses);
            } catch (error: any) {
              console.error('Error refreshing addresses:', error);
            }
          }
          // Emit event to notify other screens that addresses have been updated
          DeviceEventEmitter.emit('addressesUpdated');
        }}
        userData={userData}
        themeName={themeName}
        profile={profile}
      />

      {/* PDF Viewer Modal */}
      <Modal
        visible={showPdfViewer}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowPdfViewer(false)}
      >
        <View style={[styles.pdfViewerContainer, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.pdfViewerHeader}>
            <TouchableOpacity
              onPress={() => setShowPdfViewer(false)}
              style={styles.pdfViewerCloseButton}
            >
              <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
            <AutoText style={styles.pdfViewerTitle} numberOfLines={1}>
              {pdfTitle}
            </AutoText>
            <View style={{ width: 40 }} />
          </View>
          {pdfUrl && (
            <WebView
              source={{
                html: `
                  <!DOCTYPE html>
                  <html>
                    <head>
                      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                      <style>
                        * {
                          margin: 0;
                          padding: 0;
                          box-sizing: border-box;
                        }
                        html, body {
                          width: 100%;
                          height: 100%;
                          overflow: hidden;
                          background: #525252;
                        }
                        #pdf-container {
                          width: 100%;
                          height: 100vh;
                          display: flex;
                          justify-content: center;
                          align-items: center;
                        }
                        iframe {
                          width: 100%;
                          height: 100vh;
                          border: none;
                        }
                        .error {
                          color: white;
                          text-align: center;
                          padding: 20px;
                        }
                      </style>
                    </head>
                    <body>
                      <div id="pdf-container">
                        <iframe 
                          src="https://docs.google.com/viewer?url=${encodeURIComponent(pdfUrl)}&embedded=true" 
                          type="application/pdf"
                          onerror="this.onerror=null; this.src='${pdfUrl}';"
                        ></iframe>
                      </div>
                      <script>
                        // Fallback: if Google Docs Viewer fails, try direct PDF
                        setTimeout(function() {
                          var iframe = document.querySelector('iframe');
                          if (iframe) {
                            iframe.onerror = function() {
                              this.src = '${pdfUrl}';
                            };
                            // Check if iframe loaded successfully
                            iframe.onload = function() {
                              console.log('PDF loaded successfully');
                            };
                          }
                        }, 1000);
                      </script>
                    </body>
                  </html>
                `
              }}
              style={styles.pdfWebView}
              startInLoadingState={true}
              javaScriptEnabled={true}
              domStorageEnabled={true}
              scalesPageToFit={true}
              allowsInlineMediaPlayback={true}
              mediaPlaybackRequiresUserAction={false}
              renderLoading={() => (
                <View style={styles.pdfLoadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <AutoText style={styles.pdfLoadingText}>Loading document...</AutoText>
                </View>
              )}
              onError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('PDF WebView error:', nativeEvent);
                // If fallback hasn't been tried, try direct PDF URL
                if (!useFallbackViewer) {
                  console.log('Switching to direct PDF URL');
                  setUseFallbackViewer(true);
                } else {
                  Alert.alert('Error', 'Failed to load document. Please try again.');
                }
              }}
              onHttpError={(syntheticEvent) => {
                const { nativeEvent } = syntheticEvent;
                console.error('PDF WebView HTTP error:', nativeEvent);
                // Try direct PDF URL if Google Docs Viewer fails
                if (!useFallbackViewer && nativeEvent.statusCode >= 400) {
                  console.log('Switching to direct PDF URL due to HTTP error');
                  setUseFallbackViewer(true);
                }
              }}
              onShouldStartLoadWithRequest={(request) => {
                // Allow Google Docs Viewer, the PDF URL, and data/blob URLs
                const url = request.url;
                if (url.includes('docs.google.com') || url === pdfUrl || url.includes('viewer') || url.startsWith('data:') || url.startsWith('blob:') || url.includes('googleusercontent.com')) {
                  return true;
                }
                // Block other external navigation
                return false;
              }}
            />
          )}
        </View>
      </Modal>
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
    addressInputContainer: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '10@s',
    },
    locationButton: {
      width: '44@s',
      height: '44@s',
      borderRadius: '12@ms',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: '2@vs',
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
    addressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@vs',
    },
    addAddressButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      borderRadius: '8@ms',
      backgroundColor: theme.background,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    addAddressText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
      marginLeft: '4@s',
    },
    addressLoadingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '20@vs',
    },
    addressLoadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginLeft: '8@s',
    },
    noAddressContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '32@vs',
      paddingHorizontal: '16@s',
    },
    noAddressText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginTop: '12@vs',
    },
    noAddressSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
    },
    addressCard: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '14@s',
      marginBottom: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    addressCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8@vs',
    },
    addressTypeBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '10@s',
      paddingVertical: '4@vs',
      borderRadius: '6@ms',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.primary,
    },
    addressTypeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: theme.primary,
      marginLeft: '4@s',
    },
    deleteAddressButton: {
      padding: '4@s',
    },
    addressCardText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
      lineHeight: '20@vs',
    },
    addressCardSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '2@vs',
    },
    addressDisplayField: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '14@s',
      marginTop: '8@vs',
    },
    addressDisplayText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      lineHeight: '20@vs',
      marginBottom: '8@vs',
    },
    addressDisplaySubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
    },
    pdfViewerContainer: {
      flex: 1,
      backgroundColor: theme.background,
    },
    pdfViewerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    pdfViewerCloseButton: {
      padding: '8@s',
    },
    pdfViewerTitle: {
      flex: 1,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      textAlign: 'center',
      marginHorizontal: '8@s',
    },
    pdfWebView: {
      flex: 1,
      backgroundColor: theme.background,
    },
    pdfLoadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    pdfLoadingText: {
      marginTop: '12@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
  });

export default EditProfileScreen;

