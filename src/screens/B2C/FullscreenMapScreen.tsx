import React, { useState, useMemo, useEffect, useRef } from 'react';
import { View, TouchableOpacity, StatusBar } from 'react-native';
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
    };
  };
  navigation: any;
}

const FullscreenMapScreen: React.FC<FullscreenMapScreenProps> = ({ route, navigation }) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { destination, orderId } = route.params || { 
    destination: { latitude: 9.1530, longitude: 76.7356 },
    orderId: undefined 
  };
  
  // Log destination to verify it matches small map
  useEffect(() => {
    console.log('🎯 FullscreenMapScreen - Destination:', destination);
    console.log('🎯 FullscreenMapScreen - Destination coordinates:', destination.latitude, destination.longitude);
  }, [destination]);
  
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Track address lookup to prevent repeated calls
  const addressFetchedRef = useRef(false);
  const addressFailedRef = useRef(false);

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
          onLocationUpdate={async (location) => {
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
          <TouchableOpacity style={styles.floatingButton}>
            <MaterialCommunityIcons
              name="phone"
              size={16}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.floatingButton}>
            <MaterialCommunityIcons
              name="message-text"
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
  });

export default FullscreenMapScreen;






