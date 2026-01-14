import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StatusBar, Linking, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { ScaledSheet } from 'react-native-size-matters';
import { MapWebView } from '../../components/MapWebView';
import { getAddressFromCoordinates } from '../../components/NativeMapView';

interface FullscreenMapScreenProps {
  route: {
    params: {
      destination: { latitude: number; longitude: number };
      orderId?: string;
      requestId?: string;
      customer_phone?: string;
      isCompleted?: boolean; // If true, disable location tracking
    };
  };
  navigation: any;
}

const FullscreenMapScreen: React.FC<FullscreenMapScreenProps> = ({ route, navigation }) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { destination, orderId, customer_phone, isCompleted = false } = route.params || { 
    destination: null,
    orderId: undefined,
    customer_phone: undefined,
    isCompleted: false
  };
  
  // Validate destination - if not provided or invalid, show error
  if (!destination || !destination.latitude || !destination.longitude) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar
          barStyle={isDark ? 'light-content' : 'dark-content'}
          backgroundColor={isDark ? theme.background : '#FFFFFF'}
        />
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
          <AutoText style={styles.headerTitle}>
            {t('dashboard.map') || 'Map'}
          </AutoText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.errorContainer}>
          <MaterialCommunityIcons
            name="map-marker-off"
            size={64}
            color={theme.textSecondary}
          />
          <AutoText style={styles.errorText}>
            {t('dashboard.noLocationAvailable') || 'Location not available'}
          </AutoText>
          <AutoText style={styles.errorSubtext}>
            {t('dashboard.locationNotAvailableForOrder') || 'Location data is not available for this order'}
          </AutoText>
        </View>
      </View>
    );
  }
  
  // Log destination to verify it matches small map
  useEffect(() => {
    console.log('🎯 FullscreenMapScreen - Destination:', destination);
    console.log('🎯 FullscreenMapScreen - Destination coordinates:', destination.latitude, destination.longitude);
  }, [destination]);
  
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [calculatedDistance, setCalculatedDistance] = useState<number | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  
  // Track address lookup to prevent repeated calls
  const addressFetchedRef = useRef(false);
  const addressFailedRef = useRef(false);
  
  // Calculate distance between two coordinates using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };
  
  // Calculate estimated travel time based on distance and route profile
  const calculateEstimatedTime = (distanceKm: number, routeProfile: 'driving' | 'cycling' | 'walking' = 'driving'): number => {
    // Average speeds in km/h
    const averageSpeeds = {
      driving: 40, // Average city driving speed (can vary from 30-60 km/h)
      cycling: 15,
      walking: 5
    };
    
    const speed = averageSpeeds[routeProfile];
    const timeInHours = distanceKm / speed;
    return Math.round(timeInHours * 60); // Convert to minutes
  };
  
  // Update distance and time when current location or destination changes
  useEffect(() => {
    if (currentLocation && destination) {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        destination.latitude,
        destination.longitude
      );
      setCalculatedDistance(distance);
      
      const time = calculateEstimatedTime(distance, 'driving');
      setEstimatedTime(time);
    }
  }, [currentLocation, destination]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.closeButton}
        >
          <MaterialCommunityIcons
            name="close"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.title} numberOfLines={1}>
          {t('deliveryTracking.orderTitle')}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>
      
      <View 
        style={styles.mapContainer}
        onLayout={() => {
          // Force WebView to refresh when layout is complete
          console.log('📐 Fullscreen map container layout complete');
        }}
      >
        <MapWebView
          style={styles.map}
          destination={destination}
          routeProfile="driving"
          disableLocationTracking={isCompleted}
          onLocationUpdate={isCompleted ? undefined : async (location) => {
            try {
              setCurrentLocation({
                latitude: location.latitude,
                longitude: location.longitude
              });
              console.log('📍 Current location (fullscreen):', location);
              
              // Get and log address for debugging - only once (success or failure)
              if (!addressFetchedRef.current && !addressFailedRef.current) {
                try {
                  const address = await getAddressFromCoordinates(location.latitude, location.longitude);
                  addressFetchedRef.current = true;
                  console.log('📍 Address (fullscreen):', address.address || address.formattedAddress);
                } catch (error) {
                  addressFailedRef.current = true;
                  console.warn('⚠️ Failed to get address:', error);
                }
              }
            } catch (error) {
              console.error('Error in fullscreen location update:', error);
            }
          }}
          onMapReady={() => {
            console.log('🗺️ Fullscreen map is ready');
          }}
        />
        <View style={styles.mapButtons}>
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={() => navigation.goBack()}
          >
            <MaterialCommunityIcons
              name="fullscreen-exit"
              size={18}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={() => {
              if (customer_phone) {
                const phoneNumber = customer_phone.replace(/[^0-9+]/g, ''); // Remove non-numeric characters except +
                const phoneUrl = `tel:${phoneNumber}`;
                Linking.openURL(phoneUrl).catch((err) => {
                  console.error('Error making phone call:', err);
                  Alert.alert(
                    t('common.error'),
                    t('common.cannotMakeCall')
                  );
                });
              } else {
                Alert.alert(
                  t('common.info'),
                  t('common.phoneNumberNotAvailable')
                );
              }
            }}
          >
            <MaterialCommunityIcons
              name="phone"
              size={16}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.floatingButton}
            onPress={() => {
              if (destination && destination.latitude && destination.longitude) {
                // Open Google Maps with the destination location
                const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${destination.latitude},${destination.longitude}`;
                Linking.openURL(googleMapsUrl).catch((err) => {
                  console.error('Error opening Google Maps:', err);
                  Alert.alert(
                    t('common.error'),
                    t('common.cannotOpenMaps')
                  );
                });
              } else {
                Alert.alert(
                  t('common.info'),
                  t('common.locationNotAvailable')
                );
              }
            }}
          >
            <MaterialCommunityIcons
              name="map"
              size={16}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>
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
    closeButton: {
      width: '40@s',
      height: '40@s',
      alignItems: 'center',
      justifyContent: 'center',
    },
    title: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    mapContainer: {
      flex: 1,
      position: 'relative',
      backgroundColor: theme.background,
    },
    map: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    mapButtons: {
      position: 'absolute',
      right: '16@s',
      top: '16@vs',
      gap: '12@vs',
    },
    floatingButton: {
      width: '44@s',
      height: '44@s',
      borderRadius: '22@s',
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    distanceBar: {
      position: 'absolute',
      left: '16@s',
      right: '16@s',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '16@s',
      paddingVertical: '14@vs',
      backgroundColor: theme.card,
      borderRadius: '12@s',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    distanceInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
    },
    timeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20@s',
    },
    errorText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      marginTop: '16@vs',
      textAlign: 'center',
    },
    errorSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
      textAlign: 'center',
    },
    backButton: {
      width: '40@s',
      height: '40@s',
      alignItems: 'center',
      justifyContent: 'center',
    },
    distanceText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    timeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
  });

export default FullscreenMapScreen;




