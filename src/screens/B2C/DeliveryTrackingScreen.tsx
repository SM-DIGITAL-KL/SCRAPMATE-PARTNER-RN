import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';
import { NativeMapView, getAddressFromCoordinates } from '../../components/NativeMapView';

const DeliveryTrackingScreen = ({ route, navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { orderId } = route.params || { orderId: 'DEL12345' };
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  
  // Track address lookup to prevent repeated calls
  const addressFetchedRef = useRef(false);
  const addressFailedRef = useRef(false);
  
  // Destination coordinates: 9.1530° N, 76.7356° E
  const destination = { latitude: 9.1530, longitude: 76.7356 };
  
  // Log destination to verify it's passed correctly
  useEffect(() => {
    console.log('🎯 DeliveryTrackingScreen - Destination:', destination);
    console.log('🎯 DeliveryTrackingScreen - Destination coordinates:', destination.latitude, destination.longitude);
  }, [destination]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('deliveryTracking.orderTitle')}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.mapContainer}>
          <NativeMapView
            style={styles.map}
            destination={destination}
            routeProfile="driving"
            onLocationUpdate={async (location) => {
              setCurrentLocation({
                latitude: location.latitude,
                longitude: location.longitude
              });
              console.log('📍 Current location:', location);
              
              // Get and log address for debugging - only once (success or failure)
              if (!addressFetchedRef.current && !addressFailedRef.current) {
                try {
                  const address = await getAddressFromCoordinates(location.latitude, location.longitude);
                  addressFetchedRef.current = true;
                  console.log('📍 Address:', address.address || address.formattedAddress);
                  console.log('📍 Address Details:', {
                    houseNumber: address.houseNumber,
                    road: address.road,
                    neighborhood: address.neighborhood,
                    suburb: address.suburb,
                    city: address.city,
                    state: address.state,
                    postcode: address.postcode,
                    country: address.country,
                    formattedAddress: address.formattedAddress
                  });
                } catch (error) {
                  addressFailedRef.current = true;
                  console.warn('⚠️ Failed to get address:', error);
                }
              }
              
              // Log destination and route info
              console.log('🎯 Destination:', destination);
              console.log('🗺️ Route will be drawn from current location to destination');
            }}
            onMapReady={() => {
              console.log('🗺️ Map is ready');
            }}
          />
          <View style={styles.mapFloatingButtons}>
            <TouchableOpacity 
              style={styles.floatingButton}
              onPress={() => navigation.navigate('FullscreenMap', { destination, orderId })}
            >
              <MaterialCommunityIcons
                name="fullscreen"
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

        <View style={styles.distanceBar}>
          <Text style={styles.distanceText}>3.5 km</Text>
          <Text style={styles.timeText}>15 mins</Text>
        </View>

        <SectionCard style={styles.orderCard}>
          <Text style={styles.orderTitle}>Order #{orderId}</Text>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="account"
              size={14}
              color={theme.primary}
            />
            <Text style={styles.detailText}>Client: Jane Doe</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="map-marker"
              size={14}
              color={theme.primary}
            />
            <Text style={styles.addressText}>
              123 Main St, Anytown, CA 90210{'\n'}Suite 4B, Apt 201
            </Text>
          </View>
          <View style={styles.itemsSection}>
            <AutoText style={styles.itemsTitle} numberOfLines={1}>
              {t('deliveryTracking.itemsForPickup')}:
            </AutoText>
            <AutoText style={styles.itemText} numberOfLines={1}>
              • {t('categories.plastic')} 5kg
            </AutoText>
            <AutoText style={styles.itemText} numberOfLines={1}>
              • {t('categories.metal')} 5kg
            </AutoText>
            <AutoText style={styles.itemText} numberOfLines={1}>
              • {t('categories.electronics')} 2kg
            </AutoText>
          </View>
        </SectionCard>
      </ScrollView>

      <View style={styles.bottomRow}>
        <GreenButton
          title={t('deliveryTracking.assignDeliveryPartner')}
          onPress={() =>
            navigation.navigate('AssignPartner', { orderId })
          }
          style={styles.assignButton}
        />
        <TouchableOpacity
          style={styles.pickupButton}
          onPress={() => {}}
          activeOpacity={0.7}
        >
          <AutoText style={styles.pickupButtonText} numberOfLines={1}>
            {t('deliveryTracking.myselfPickup')}
          </AutoText>
        </TouchableOpacity>
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
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    scrollContent: {
      paddingBottom: '12@vs',
      paddingHorizontal: 0,
    },
    mapContainer: {
      height: '240@vs',
      position: 'relative',
      backgroundColor: theme.background,
      marginTop: 0,
      borderRadius: '12@s',
      overflow: 'hidden',
    },
    map: {
      flex: 1,
      width: '100%',
      height: '100%',
    },
    mapPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.background,
    },
    mapPinContainer: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    mapFloatingButtons: {
      position: 'absolute',
      right: '12@s',
      top: '12@vs',
      gap: '10@vs',
    },
    floatingButton: {
      width: '36@s',
      height: '36@s',
      borderRadius: '18@s',
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 3,
      elevation: 3,
    },
    distanceBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: '14@s',
      paddingVertical: '10@vs',
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    orderCard: {
      marginHorizontal: '14@s',
      marginTop: '14@vs',
      marginBottom: '14@vs',
    },
    distanceText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    timeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    orderTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '6@s',
      marginBottom: '10@vs',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      flex: 1,
    },
    addressText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      flex: 1,
      lineHeight: '18@vs',
    },
    itemsSection: {
      marginTop: '10@vs',
    },
    itemsTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    itemText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '3@vs',
    },
    bottomRow: {
      flexDirection: 'row',
      gap: '8@s',
      paddingHorizontal: '14@s',
      paddingVertical: '8@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
      alignItems: 'center',
    },
    assignButton: {
      flex: 1,
    },
    pickupButton: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '10@vs',
      borderRadius: '10@ms',
      borderColor: theme.primary,
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    pickupButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
      textAlign: 'center',
    },
  });

export default DeliveryTrackingScreen;

