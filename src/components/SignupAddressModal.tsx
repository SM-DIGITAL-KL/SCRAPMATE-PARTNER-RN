import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  Modal,
  NativeModules,
} from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from './ThemeProvider';
import { AutoText } from './AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { NativeMapView } from './NativeMapView';
import { getAddressFromCoordinates } from './NativeMapView';

const { NativeMapViewModule } = NativeModules;

interface SignupAddressModalProps {
  visible: boolean;
  onClose: () => void;
  onAddressSelect: (addressData: {
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
  }) => void;
  initialAddress?: string;
  initialLatitude?: number;
  initialLongitude?: number;
}

export const SignupAddressModal: React.FC<SignupAddressModalProps> = ({
  visible,
  onClose,
  onAddressSelect,
  initialAddress,
  initialLatitude,
  initialLongitude,
}) => {
  const { theme, themeName } = useTheme();
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>(initialAddress || 'Shop No 15, Katraj');
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(
    initialLatitude && initialLongitude ? { latitude: initialLatitude, longitude: initialLongitude } : null
  );
  const [addressDetails, setAddressDetails] = useState<{
    pincode?: string;
    state?: string;
    city?: string;
    place?: string;
    location?: string;
    place_id?: string;
  } | null>(null);
  const locationFetchedRef = useRef(false);
  const [houseName, setHouseName] = useState('');
  const [nearbyLocation, setNearbyLocation] = useState('');
  const locationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isLocationLoading, setIsLocationLoading] = useState(true);

  // Check if location is enabled when modal opens
  const checkLocationEnabled = async () => {
    if (Platform.OS === 'android' && NativeMapViewModule) {
      try {
        const isEnabled = await NativeMapViewModule.isLocationEnabled();
        if (!isEnabled) {
          Alert.alert(
            'Location Disabled',
            'Location services are disabled on your device. Please enable location in your device settings to select an address.',
            [
              {
                text: 'OK',
                onPress: () => {
                  // User can still proceed but won't get location
                }
              }
            ]
          );
        }
      } catch (error) {
        console.warn('Failed to check location status:', error);
      }
    }
  };

  // Reset state when modal opens
  useEffect(() => {
    if (visible) {
      setShowAddressForm(false);
      locationFetchedRef.current = false;
      setHouseName('');
      setNearbyLocation('');
      setCurrentAddress(initialAddress || 'Shop No 15, Katraj');
      setCurrentLocation(
        initialLatitude && initialLongitude ? { latitude: initialLatitude, longitude: initialLongitude } : null
      );
      setAddressDetails(null);
      setIsLocationLoading(true); // Start loading when modal opens
      if (locationTimeoutRef.current) {
        clearTimeout(locationTimeoutRef.current);
        locationTimeoutRef.current = null;
      }
      // Check if location is enabled
      checkLocationEnabled();
    }
  }, [visible, initialAddress, initialLatitude, initialLongitude]);

  const handleClose = () => {
    setShowAddressForm(false);
    locationFetchedRef.current = false;
    setHouseName('');
    setNearbyLocation('');
    setCurrentAddress(initialAddress || 'Shop No 15, Katraj');
    setCurrentLocation(
      initialLatitude && initialLongitude ? { latitude: initialLatitude, longitude: initialLongitude } : null
    );
    setAddressDetails(null);
    setIsLocationLoading(false);
    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current);
      locationTimeoutRef.current = null;
    }
    onClose();
  };

  const handleSkipToForm = async () => {
    if (locationTimeoutRef.current) {
      clearTimeout(locationTimeoutRef.current);
      locationTimeoutRef.current = null;
    }
    
    // If we don't have location yet, try to get it one more time
    if (!currentLocation && Platform.OS === 'android' && NativeMapViewModule) {
      try {
        console.log('📍 No location yet, fetching one more time...');
        const location = await NativeMapViewModule.getCurrentLocation();
        if (location) {
          setCurrentLocation({
            latitude: location.latitude,
            longitude: location.longitude
          });
          
          // Try to get address if we don't have it
          if (!currentAddress || currentAddress === 'Shop No 15, Katraj') {
            try {
              const address = await getAddressFromCoordinates(location.latitude, location.longitude);
              const addressText = address.address || address.formattedAddress || currentAddress;
              setCurrentAddress(addressText);
              
              // Capture location details
              const details: any = {};
              if (address.postcode) details.pincode = address.postcode;
              if (address.state) details.state = address.state;
              if (address.city) details.city = address.city;
              if (address.city) details.place = address.city;
              
              const locationParts = [];
              if (address.city) locationParts.push(address.city);
              if (address.state) locationParts.push(address.state);
              if (address.country) locationParts.push(address.country);
              if (locationParts.length > 0) {
                details.location = locationParts.join(', ');
              }
              
              setAddressDetails(details);
            } catch (error) {
              console.warn('Failed to get address:', error);
            }
          }
        }
      } catch (error) {
        console.warn('Failed to get location:', error);
      }
    }
    
    // Show form - user can still proceed even without location
    setShowAddressForm(true);
  };

  const handleSelectAddress = async () => {
    // Check if location is enabled before saving
    if (Platform.OS === 'android' && NativeMapViewModule) {
      try {
        const isEnabled = await NativeMapViewModule.isLocationEnabled();
        if (!isEnabled) {
          Alert.alert(
            'Location Disabled',
            'Location services are disabled on your device. Please enable location in your device settings to save address with proper coordinates.',
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (error) {
        console.warn('Failed to check location status:', error);
      }
    }

    if (!currentLocation) {
      Alert.alert('Error', 'Location not found. Please enable location services and try again.');
      return;
    }

    const addressData = {
      address: currentAddress,
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      lat_log: `${currentLocation.latitude},${currentLocation.longitude}`,
      houseName: houseName.trim() || undefined,
      nearbyLocation: nearbyLocation.trim() || undefined,
      pincode: addressDetails?.pincode,
      state: addressDetails?.state,
      place: addressDetails?.place,
      location: addressDetails?.location,
      place_id: addressDetails?.place_id,
    };

    onAddressSelect(addressData);
    handleClose();
  };

  const styles = getStyles(theme, themeName);

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.locationHistoryModal}>
        <TouchableOpacity
          style={styles.locationHistoryModalBackdrop}
          activeOpacity={1}
          onPress={handleClose}
        />
        <View style={styles.locationHistoryModalContent}>
          <View style={styles.locationHistoryModalHeader}>
            <TouchableOpacity onPress={handleClose}>
              <MaterialCommunityIcons
                name="arrow-left"
                size={24}
                color={theme.textPrimary}
              />
            </TouchableOpacity>
            <AutoText style={styles.locationHistoryModalTitle}>Select Address</AutoText>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.locationHistoryModalClose}
            >
              <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.body}>
            {!showAddressForm && (
              <View style={styles.mapWrapper}>
                <NativeMapView
                  key="map"
                  style={styles.locationHistoryMap}
                  onMapReady={async () => {
                    console.log('🗺️ Map ready in signup modal');
                
                    // Set a timeout fallback - if location not received after 15 seconds, 
                    // allow user to continue anyway (they can manually enter address)
                    locationTimeoutRef.current = setTimeout(() => {
                      if (!locationFetchedRef.current && !showAddressForm) {
                        console.log('⏰ Location fetch timeout - user can still click Continue to enter address manually');
                        setIsLocationLoading(false);
                      }
                    }, 15000);
                  }}
                  onLocationUpdate={async (location: {
                    latitude: number;
                    longitude: number;
                    accuracy: number;
                    timestamp: number;
                  }) => {
                    // First location update - fetch address but DON'T auto-show form
                    if (!locationFetchedRef.current) {
                      locationFetchedRef.current = true;
                      setIsLocationLoading(false); // Hide loader when location is received
                      
                      // Clear timeout since we got location
                      if (locationTimeoutRef.current) {
                        clearTimeout(locationTimeoutRef.current);
                        locationTimeoutRef.current = null;
                      }
                      
                      setCurrentLocation({
                        latitude: location.latitude,
                        longitude: location.longitude
                      });
                      
                      // Get address from coordinates
                      try {
                        const address = await getAddressFromCoordinates(location.latitude, location.longitude);
                        const addressText = address.address || address.formattedAddress || 'Shop No 15, Katraj';
                        setCurrentAddress(addressText);
                        
                        // Capture location details from geocoded address
                        const details: any = {};
                        if (address.postcode) details.pincode = address.postcode;
                        if (address.state) details.state = address.state;
                        if (address.city) details.city = address.city;
                        if (address.city) details.place = address.city;
                        
                        // Build location string
                        const locationParts = [];
                        if (address.city) locationParts.push(address.city);
                        if (address.state) locationParts.push(address.state);
                        if (address.country) locationParts.push(address.country);
                        if (locationParts.length > 0) {
                          details.location = locationParts.join(', ');
                        }
                        
                        setAddressDetails(details);
                        
                        // Clear timeout since we got location successfully
                        if (locationTimeoutRef.current) {
                          clearTimeout(locationTimeoutRef.current);
                          locationTimeoutRef.current = null;
                        }
                        
                        console.log('📍 Location received and address fetched. Map should be centered. User can click Continue.');
                        console.log('📍 Address details:', details);
                      } catch (error) {
                        console.warn('Failed to get address:', error);
                        // Clear timeout since we got location successfully
                        if (locationTimeoutRef.current) {
                          clearTimeout(locationTimeoutRef.current);
                          locationTimeoutRef.current = null;
                        }
                        console.log('📍 Location received but address lookup failed. User can click Continue.');
                      }
                      return; // Don't process further updates on first location
                    }
                    
                    // Subsequent location updates - only update if location changed significantly
                    if (currentLocation) {
                      const R = 6371e3; // Earth radius in meters
                      const φ1 = currentLocation.latitude * Math.PI / 180;
                      const φ2 = location.latitude * Math.PI / 180;
                      const Δφ = (location.latitude - currentLocation.latitude) * Math.PI / 180;
                      const Δλ = (location.longitude - currentLocation.longitude) * Math.PI / 180;
                      const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                                Math.cos(φ1) * Math.cos(φ2) *
                                Math.sin(Δλ/2) * Math.sin(Δλ/2);
                      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                      const distance = R * c;
                      
                      // Only update if moved more than 50 meters
                      if (distance < 50) {
                        return;
                      }
                    }
                    
                    setCurrentLocation({
                      latitude: location.latitude,
                      longitude: location.longitude
                    });
                    
                    // Update address when location updates significantly
                    if (!currentAddress || currentAddress === 'Shop No 15, Katraj') {
                      try {
                        const address = await getAddressFromCoordinates(location.latitude, location.longitude);
                        const addressText = address.address || address.formattedAddress || currentAddress;
                        setCurrentAddress(addressText);
                        
                        // Capture location details
                        const details: any = {};
                        if (address.postcode) details.pincode = address.postcode;
                        if (address.state) details.state = address.state;
                        if (address.city) details.city = address.city;
                        if (address.city) details.place = address.city;
                        
                        const locationParts = [];
                        if (address.city) locationParts.push(address.city);
                        if (address.state) locationParts.push(address.state);
                        if (address.country) locationParts.push(address.country);
                        if (locationParts.length > 0) {
                          details.location = locationParts.join(', ');
                        }
                        
                        setAddressDetails(details);
                      } catch (error) {
                        console.warn('Failed to get address:', error);
                      }
                    }
                  }}
                />
                {/* Loading Overlay */}
                {isLocationLoading && (
                  <View style={styles.loadingOverlay}>
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="large" color={theme.primary} />
                      <AutoText style={styles.loadingText}>Finding your location...</AutoText>
                    </View>
                  </View>
                )}
                <View style={styles.mapSkipButtonContainer}>
                  <TouchableOpacity
                    style={styles.mapSkipButton}
                    onPress={handleSkipToForm}
                    activeOpacity={0.8}
                  >
                    <AutoText style={styles.mapSkipButtonText}>Continue</AutoText>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {showAddressForm && (
              <ScrollView
                style={styles.addressFormContainer}
                contentContainerStyle={styles.addressFormContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.addressFormSection}>
                  <AutoText style={styles.addressFormLabel}>Address</AutoText>
                  <View style={styles.addressDisplayContainer}>
                    <AutoText style={styles.addressDisplayText} numberOfLines={3}>
                      {currentAddress}
                    </AutoText>
                  </View>
                </View>

                <View style={styles.addressFormSection}>
                  <AutoText style={styles.addressFormLabel}>House Name / Building No</AutoText>
                  <TextInput
                    style={styles.addressFormInput}
                    placeholder="Enter house name or building number"
                    placeholderTextColor={theme.textSecondary}
                    value={houseName}
                    onChangeText={setHouseName}
                    autoCapitalize="words"
                    editable={true}
                    underlineColorAndroid="transparent"
                  />
                </View>

                <View style={styles.addressFormSection}>
                  <AutoText style={styles.addressFormLabel}>Nearby Location / Landmark</AutoText>
                  <TextInput
                    style={styles.addressFormInput}
                    placeholder="Enter nearby location or landmark"
                    placeholderTextColor={theme.textSecondary}
                    value={nearbyLocation}
                    onChangeText={setNearbyLocation}
                    autoCapitalize="words"
                    editable={true}
                    underlineColorAndroid="transparent"
                  />
                </View>

                <View style={styles.addressFormActions}>
                  <TouchableOpacity
                    style={[styles.addressFormButton, styles.addressFormButtonCancel]}
                    onPress={handleClose}
                  >
                    <AutoText style={styles.addressFormButtonCancelText}>Cancel</AutoText>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.addressFormButton, styles.addressFormButtonSave]}
                    onPress={handleSelectAddress}
                  >
                    <AutoText style={styles.addressFormButtonSaveText}>Select Address</AutoText>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme: any, themeName?: string) =>
  ScaledSheet.create({
    locationHistoryModal: {
      flex: 1,
    },
    locationHistoryModalBackdrop: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
    },
    locationHistoryModalContent: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      top: 0,
      height: '100%',
      backgroundColor: theme.background,
      borderTopLeftRadius: '20@ms',
      borderTopRightRadius: '20@ms',
      overflow: 'hidden',
    },
    locationHistoryModalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '16@s',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    locationHistoryModalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    locationHistoryModalClose: {
      padding: '4@s',
    },
    body: {
      flex: 1,
      position: 'relative',
    },
    mapWrapper: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1,
    },
    locationHistoryMap: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    addressFormContainer: {
      flex: 1,
      zIndex: 10,
      backgroundColor: theme.background,
      position: 'relative',
    },
    addressFormContent: {
      padding: '16@s',
      paddingBottom: '32@vs',
    },
    addressFormSection: {
      marginBottom: '20@vs',
    },
    addressFormLabel: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    addressDisplayContainer: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
    },
    addressDisplayText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      lineHeight: '20@vs',
    },
    addressFormInput: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@s',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: '48@vs',
      height: '48@vs',
    },
    addressFormActions: {
      flexDirection: 'row',
      gap: '12@s',
      marginTop: '24@vs',
    },
    addressFormButton: {
      flex: 1,
      paddingVertical: '14@vs',
      borderRadius: '12@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    addressFormButtonCancel: {
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
    },
    addressFormButtonCancelText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    addressFormButtonSave: {
      backgroundColor: theme.primary,
    },
    addressFormButtonSaveText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    mapSkipButtonContainer: {
      position: 'absolute',
      bottom: '20@vs',
      left: '16@s',
      right: '16@s',
      alignItems: 'center',
      zIndex: 10,
    },
    mapSkipButton: {
      backgroundColor: theme.primary,
      paddingVertical: '12@vs',
      paddingHorizontal: '24@s',
      borderRadius: '12@ms',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    mapSkipButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    loadingOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000,
    },
    loadingContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      marginTop: '16@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
  });

