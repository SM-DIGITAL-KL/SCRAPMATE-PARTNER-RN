import React, { useMemo, useCallback, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform, NativeModules } from 'react-native';
import { useTheme } from '../components/ThemeProvider';
import SelectLanguageScreen from '../screens/B2C/SelectLanguageScreen';
import JoinAsScreen from '../screens/Auth/JoinAsScreen';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { setAuthToken, getUserData } from '../services/auth/authService';
import { useUserMode, UserMode } from '../context/UserModeContext';
import { SignupAddressModal } from '../components/SignupAddressModal';
import { updateProfile, UpdateProfileData } from '../services/api/v2/profile';

const { NativeMapViewModule } = NativeModules;

export type AuthStackParamList = {
  SelectLanguage: undefined;
  JoinAs: undefined;
  Login: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

interface AuthStackProps {
  initialRouteName: keyof AuthStackParamList;
  onAuthComplete: () => void;
}

export const AuthStack: React.FC<AuthStackProps> = ({
  initialRouteName,
  onAuthComplete,
}) => {
  const { theme } = useTheme();
  const { setMode } = useUserMode();
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [pendingDashboardType, setPendingDashboardType] = useState<'b2b' | 'b2c' | 'delivery' | null>(null);
  const [pendingAllowedDashboards, setPendingAllowedDashboards] = useState<('b2b' | 'b2c' | 'delivery')[] | undefined>(undefined);
  const [initialLocation, setInitialLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  const screenOptions = useMemo(
    () => ({
      headerShown: false,
      contentStyle: {
        backgroundColor: theme.background,
      },
    }),
    [theme.background],
  );

  const handleLoginSuccess = useCallback(
    async (
      phoneNumber: string,
      dashboardType: 'b2b' | 'b2c' | 'delivery',
      allowedDashboards?: ('b2b' | 'b2c' | 'delivery')[]
    ) => {
      // IMPORTANT: For SR users, read original join type selection BEFORE it gets overwritten
      // This is the selection from JoinAsScreen, which LoginScreen might have overwritten
      const storedJoinTypeBeforeProcessing = await AsyncStorage.getItem('@selected_join_type');
      const originalJoinTypeFromJoinAs = storedJoinTypeBeforeProcessing as 'b2b' | 'b2c' | 'delivery' | null;
      
      // IMPORTANT: Check user_type first to determine correct dashboard
      const { getUserData } = await import('../services/auth/authService');
      const userData = await getUserData();
      const userType = userData?.user_type;
      const appType = userData?.app_type || userData?.app_version;

      // IMPORTANT: If user_type is 'N', show address modal FIRST before navigating to signup
      // User can change join type anytime by going back to JoinAs screen
      // Only store allowedDashboards so they can access all dashboards
      if (userType === 'N') {
        console.log('✅ AuthStack: User type is N (new_user) - showing address modal first');
        console.log('🔍 AuthStack: Using dashboardType for routing only:', dashboardType);
        console.log('🔍 AuthStack: Allowed dashboards from API:', allowedDashboards);

        // Clear old AsyncStorage flags for new users
        await AsyncStorage.removeItem('@b2b_status');
        await AsyncStorage.removeItem('@b2c_signup_needed');
        await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
        await AsyncStorage.removeItem('@selected_join_type'); // Clear it - don't store permanently

        // Store allowed dashboards (should be all three for new users)
        if (allowedDashboards && allowedDashboards.length > 0) {
          await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(allowedDashboards));
          console.log('✅ AuthStack: Stored allowed dashboards for new user:', allowedDashboards);
        } else {
          // Fallback: if API didn't return allowedDashboards, set all three for new users
          const allDashboards = ['b2b', 'b2c', 'delivery'];
          await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(allDashboards));
          console.log('⚠️ AuthStack: API didn\'t return allowedDashboards, using fallback:', allDashboards);
        }

        // DO NOT store @selected_join_type - it will be set temporarily by setMode for routing
        // but UserModeContext.setMode already handles not storing it for new users
        console.log('✅ AuthStack: NOT storing @selected_join_type for new user - they can change join type anytime');

        // Store dashboard type and allowed dashboards for later use
        setPendingDashboardType(dashboardType);
        setPendingAllowedDashboards(allowedDashboards);
        setAddressSelected(false); // Reset address selected state

        // First, get current location and save lat/long to server immediately (without user permission)
        try {
          console.log('📍 AuthStack: Getting current location to save lat/long first...');
          let location: { latitude: number; longitude: number } | null = null;

          if (Platform.OS === 'android' && NativeMapViewModule) {
            try {
              const loc = await NativeMapViewModule.getCurrentLocation();
              if (loc && loc.latitude && loc.longitude) {
                location = {
                  latitude: loc.latitude,
                  longitude: loc.longitude,
                };
                console.log('✅ AuthStack: Got location from NativeMapViewModule:', location);
              }
            } catch (locError) {
              console.warn('⚠️ AuthStack: Failed to get location from NativeMapViewModule:', locError);
            }
          }

          // If location not available from native module on Android, try iOS geolocation (only if available)
          if (!location && Platform.OS === 'ios' && typeof navigator !== 'undefined' && navigator.geolocation) {
            try {
              const position = await new Promise<any>((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 10000,
                  maximumAge: 60000,
                });
              });
              
              if (position && position.coords) {
                location = {
                  latitude: position.coords.latitude,
                  longitude: position.coords.longitude,
                };
                console.log('✅ AuthStack: Got location from iOS geolocation API:', location);
              }
            } catch (geoError) {
              console.warn('⚠️ AuthStack: Failed to get location from geolocation API:', geoError);
            }
          }

          // Save latitude and longitude to server immediately if we have location
          if (location && userData?.id) {
            try {
              console.log('📤 AuthStack: Saving latitude and longitude to server immediately...');
              
              // Validate and ensure numbers are valid (not NaN, not Infinity)
              const lat = typeof location.latitude === 'number' && !isNaN(location.latitude) && isFinite(location.latitude)
                ? Number(location.latitude.toFixed(8)) // Limit precision to avoid issues
                : null;
              const lng = typeof location.longitude === 'number' && !isNaN(location.longitude) && isFinite(location.longitude)
                ? Number(location.longitude.toFixed(8)) // Limit precision to avoid issues
                : null;
              
              if (!lat || !lng) {
                console.warn('⚠️ AuthStack: Invalid location values - lat:', location.latitude, 'lng:', location.longitude);
                // Don't throw - just skip saving, user can provide location in modal
                console.log('⚠️ AuthStack: Skipping automatic location save - will show modal for user to provide location');
              } else {
                const updateData: UpdateProfileData = {};
                const latLog = `${lat},${lng}`;
                
                if (dashboardType === 'delivery') {
                  updateData.delivery = {
                    latitude: lat,
                    longitude: lng,
                    lat_log: latLog,
                  };
                } else {
                  // B2B or B2C
                  updateData.shop = {
                    latitude: lat,
                    longitude: lng,
                    lat_log: latLog,
                  };
                }

                await updateProfile(userData.id, updateData);
                console.log('✅ AuthStack: Latitude and longitude saved to server successfully');
                
                // Store initial location for modal
                setInitialLocation({ latitude: lat, longitude: lng });
              }
            } catch (saveError) {
              console.error('❌ AuthStack: Error saving lat/long to server:', saveError);
              // Continue anyway - user can provide location in modal
            }
          } else {
            console.log('⚠️ AuthStack: Location not available - will show modal for user to provide location');
          }
        } catch (error) {
          console.error('❌ AuthStack: Error getting location:', error);
          // Continue anyway - show modal for user to provide location
        }

        // Show address modal for user to confirm/refine address
        setShowAddressModal(true);
        return; // Don't call onAuthComplete yet - wait for address to be saved
      }

      // For registered users (not 'N'), store data normally
      // Store allowed dashboards in AsyncStorage for immediate access
      if (allowedDashboards && allowedDashboards.length > 0) {
        // For SR users, ensure they have both 'b2b' and 'b2c' in allowed dashboards
        if (userType === 'SR') {
          const srDashboards = [...new Set([...allowedDashboards, 'b2b', 'b2c'])];
          await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(srDashboards));
          console.log('✅ AuthStack: SR user - added both B2B and B2C to allowed dashboards:', srDashboards);
        } else {
          await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(allowedDashboards));
        }
      } else if (userType === 'SR') {
        // If no allowed dashboards from API, set both for SR users
        const srDashboards = ['b2b', 'b2c'];
        await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(srDashboards));
        console.log('✅ AuthStack: SR user with no API dashboards - set both B2B and B2C:', srDashboards);
      }

      // For SR users, use the original join type from JoinAsScreen (read before processing)
      const originalJoinType = userType === 'SR' ? originalJoinTypeFromJoinAs : null;
      if (userType === 'SR') {
        console.log(`🔍 AuthStack: SR user - original join type from JoinAsScreen: ${originalJoinType}`);
        console.log(`🔍 AuthStack: SR user - dashboardType from LoginScreen: ${dashboardType}`);
      }

      let finalDashboardType = dashboardType;

      // Determine dashboard type based on user_type (only if app_type is V2)
      const isV2 = appType === 'V2' || appType === 'v2' || appType === 'V2.0' || appType === 'v2.0';

      if (isV2) {
        if (userType === 'D') {
          finalDashboardType = 'delivery';
          await AsyncStorage.setItem('@selected_join_type', 'delivery');
          await AsyncStorage.removeItem('@b2b_status');
          await AsyncStorage.removeItem('@b2c_signup_needed');
          console.log(`✅ AuthStack: User type is D (Delivery) with app_type V2 - routing to delivery dashboard`);
        } else if (userType === 'R') {
          finalDashboardType = 'b2c';
          await AsyncStorage.setItem('@selected_join_type', 'b2c');
          await AsyncStorage.removeItem('@b2b_status');
          console.log(`✅ AuthStack: User type is R with app_type V2 - routing to B2C dashboard`);
        } else if (userType === 'S') {
          finalDashboardType = 'b2b';
          await AsyncStorage.setItem('@selected_join_type', 'b2b');
          await AsyncStorage.removeItem('@b2c_signup_needed');
          console.log(`✅ AuthStack: User type is S with app_type V2 - routing to B2B dashboard`);
        } else if (userType === 'SR') {
          // For SR users, ALWAYS check approval status before routing to B2B
          // If pending, null, undefined, or shop data is missing, route to B2C instead
          let shouldRouteToB2C = false;
          
          try {
            // Fetch profile to check approval status
            const { getProfile } = await import('../services/api/v2/profile');
            const profile = await getProfile(userData?.id);
            const approvalStatus = profile?.shop?.approval_status;
            
            console.log(`🔍 AuthStack: SR user - checking approval status:`, approvalStatus);
            console.log(`🔍 AuthStack: SR user - shop data exists:`, !!profile?.shop);
            
            // If approval status is 'pending' OR null/undefined OR shop data is missing, route to B2C instead
            // For SR users, if shop data is missing or approval is not 'approved', they should use B2C
            const isPendingOrMissing = approvalStatus === 'pending' || 
                                      approvalStatus === null || 
                                      approvalStatus === undefined || 
                                      !profile?.shop || 
                                      !profile?.shop?.id;
            
            if (isPendingOrMissing) {
              shouldRouteToB2C = true;
              if (!profile?.shop || !profile?.shop?.id) {
                console.log(`✅ AuthStack: SR user with no shop data - routing to B2C dashboard instead of B2B`);
              } else if (approvalStatus === null || approvalStatus === undefined) {
                console.log(`✅ AuthStack: SR user with no approval status set - routing to B2C dashboard instead of B2B`);
              } else {
                console.log(`✅ AuthStack: SR user with pending approval status - routing to B2C dashboard instead of B2B`);
              }
            } else {
              console.log(`✅ AuthStack: SR user with approved status (${approvalStatus}) - routing to B2B dashboard`);
            }
          } catch (error) {
            console.warn('⚠️ AuthStack: Failed to fetch profile for SR user, routing to B2C as safe default:', error);
            // If profile fetch fails, route to B2C as safe default (user can't access B2B without profile)
            shouldRouteToB2C = true;
          }
          
          if (shouldRouteToB2C) {
            finalDashboardType = 'b2c';
            await AsyncStorage.setItem('@selected_join_type', 'b2c');
            await AsyncStorage.removeItem('@b2b_status');
            console.log(`✅ AuthStack: User type is SR with app_type V2 and pending/missing approval - routing to B2C dashboard`);
          } else {
            finalDashboardType = 'b2b';
            await AsyncStorage.setItem('@selected_join_type', 'b2b');
            await AsyncStorage.removeItem('@b2c_signup_needed');
            console.log(`✅ AuthStack: User type is SR with app_type V2 and approved status - routing to B2B dashboard`);
          }
        } else {
          // For other user types (like 'N'), use stored join type or API dashboardType
          const storedJoinType = await AsyncStorage.getItem('@selected_join_type');
          if (storedJoinType === 'b2b' || storedJoinType === 'b2c' || storedJoinType === 'delivery') {
            finalDashboardType = storedJoinType as 'b2b' | 'b2c' | 'delivery';
            console.log(`📝 AuthStack: Using stored join type: ${finalDashboardType} (instead of API dashboardType: ${dashboardType})`);
          } else {
            console.log(`📝 AuthStack: No stored join type, using API dashboardType: ${dashboardType}`);
          }
        }
      } else {
        // app_type is not V2 - use stored join type or API dashboardType
        console.log(`⚠️ AuthStack: app_type is not V2 - using stored/API dashboardType`);
        const storedJoinType = await AsyncStorage.getItem('@selected_join_type');
        if (storedJoinType === 'b2b' || storedJoinType === 'b2c' || storedJoinType === 'delivery') {
          finalDashboardType = storedJoinType as 'b2b' | 'b2c' | 'delivery';
        }
      }

      // IMPORTANT: Final check - override everything if user_type matches and app_type is V2
      if (isV2 && (userType === 'D' || userType === 'R' || userType === 'S' || userType === 'SR')) {
        if (userType === 'D') {
          finalDashboardType = 'delivery';
          await AsyncStorage.setItem('@selected_join_type', 'delivery');
          await AsyncStorage.removeItem('@b2b_status');
          await AsyncStorage.removeItem('@b2c_signup_needed');
          console.log(`✅ AuthStack: Final check - User type is D with V2, forcing delivery mode`);
        } else if (userType === 'R') {
          finalDashboardType = 'b2c';
          await AsyncStorage.setItem('@selected_join_type', 'b2c');
          console.log(`✅ AuthStack: Final check - User type is R with V2, forcing B2C mode`);
        } else if (userType === 'S') {
          finalDashboardType = 'b2b';
          await AsyncStorage.setItem('@selected_join_type', 'b2b');
          console.log(`✅ AuthStack: Final check - User type is S with V2, forcing B2B mode`);
        } else if (userType === 'SR') {
          // Final check for SR users - ALWAYS check approval status before routing to B2B
          try {
            // Fetch profile to check approval status
            const { getProfile } = await import('../services/api/v2/profile');
            const profile = await getProfile(userData?.id);
            const approvalStatus = profile?.shop?.approval_status;
            
            console.log(`🔍 AuthStack: Final check - SR user, approval status:`, approvalStatus);
            console.log(`🔍 AuthStack: Final check - SR user - shop data exists:`, !!profile?.shop);
            
            // If approval status is 'pending' OR null/undefined OR shop data is missing, route to B2C instead
            // For SR users, if shop data is missing or approval is not 'approved', they should use B2C
            const isPendingOrMissing = approvalStatus === 'pending' || 
                                      approvalStatus === null || 
                                      approvalStatus === undefined || 
                                      !profile?.shop || 
                                      !profile?.shop?.id;
            
            if (isPendingOrMissing) {
              finalDashboardType = 'b2c';
              await AsyncStorage.setItem('@selected_join_type', 'b2c');
              await AsyncStorage.removeItem('@b2b_status');
              if (!profile?.shop || !profile?.shop?.id) {
                console.log(`✅ AuthStack: Final check - SR user with no shop data, forcing B2C mode`);
              } else if (approvalStatus === null || approvalStatus === undefined) {
                console.log(`✅ AuthStack: Final check - SR user with no approval status set, forcing B2C mode`);
              } else {
                console.log(`✅ AuthStack: Final check - SR user with pending approval, forcing B2C mode`);
              }
            } else {
              finalDashboardType = 'b2b';
              await AsyncStorage.setItem('@selected_join_type', 'b2b');
              console.log(`✅ AuthStack: Final check - User type is SR with V2 and approved status (${approvalStatus}), forcing B2B mode`);
            }
          } catch (error) {
            console.warn('⚠️ AuthStack: Final check - Failed to fetch profile for SR user, routing to B2C as safe default:', error);
            // If profile fetch fails, route to B2C as safe default (user can't access B2B without profile)
            finalDashboardType = 'b2c';
            await AsyncStorage.setItem('@selected_join_type', 'b2c');
            await AsyncStorage.removeItem('@b2b_status');
            console.log(`✅ AuthStack: Final check - User type is SR with V2, forcing B2C mode (fallback - no profile)`);
          }
        }
      }

      // For non-V2 or other user types, use fallback logic
      if (!isV2 || (userType !== 'D' && userType !== 'R' && userType !== 'S' && userType !== 'SR')) {
        // For user_type 'N' (new user), use dashboardType from API/joinType selection
        // DO NOT store @selected_join_type permanently - user can change join type anytime
        if (userType === 'N' || !userType) {
          // For new users, use the dashboardType passed from LoginScreen (which comes from joinType)
          // Don't check @selected_join_type since we're not storing it for new users
          console.log(`🔍 AuthStack: User type is N, using dashboardType from API/joinType:`, dashboardType);
          finalDashboardType = dashboardType;
          console.log(`✅ AuthStack: User type is N, using dashboardType: ${finalDashboardType} to route to signup screen`);
          // DO NOT store @selected_join_type - it's only used temporarily for routing
        }

        // Validate dashboard access from login API response (only for non-explicit user types)
        // If user doesn't have access to the requested dashboard, use the first allowed dashboard
        // BUT: For user_type 'N', don't override based on allowedDashboards - let them go to signup
        if (allowedDashboards && allowedDashboards.length > 0 && userType !== 'N') {
          // Check if requested dashboard is in allowed list
          if (!allowedDashboards.includes(finalDashboardType)) {
            // Use first allowed dashboard instead
            finalDashboardType = allowedDashboards[0];
            console.log(`⚠️ Dashboard ${finalDashboardType} not allowed. Using ${allowedDashboards[0]} instead.`);
          }
        }
      }

      // Set the mode based on validated dashboard type
      if (finalDashboardType === 'b2b' || finalDashboardType === 'b2c' || finalDashboardType === 'delivery') {
        await setMode(finalDashboardType as UserMode);
      }
      onAuthComplete();
    },
    [onAuthComplete, setMode],
  );

  // Track if address was selected to allow modal to close
  const [addressSelected, setAddressSelected] = useState(false);

  // Handle auto-save of address (saves without closing modal)
  const handleAutoSave = useCallback(async (addressData: {
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
  }) => {
    try {
      console.log('💾 AuthStack: Auto-saving address from map (background save, modal stays open)...');
      
      const userData = await getUserData();
      if (!userData?.id) {
        throw new Error('User data not found');
      }

      const dashboardType = pendingDashboardType || 'b2c';
      
      // Validate and format latitude/longitude to ensure they're valid numbers
      const lat = typeof addressData.latitude === 'number' && !isNaN(addressData.latitude) && isFinite(addressData.latitude)
        ? Number(addressData.latitude.toFixed(8))
        : null;
      const lng = typeof addressData.longitude === 'number' && !isNaN(addressData.longitude) && isFinite(addressData.longitude)
        ? Number(addressData.longitude.toFixed(8))
        : null;
      
      if (!lat || !lng) {
        throw new Error('Invalid location coordinates - latitude and longitude must be valid numbers');
      }
      
      // Prepare update data based on join type
      const updateData: UpdateProfileData = {};
      const latLog = `${lat},${lng}`;
      
      if (dashboardType === 'delivery') {
        // For delivery, update delivery profile
        updateData.delivery = {
          address: addressData.address || '',
          latitude: lat,
          longitude: lng,
          lat_log: latLog,
        };
        
        // Add location fields if available
        if (addressData.pincode) updateData.delivery.pincode = addressData.pincode;
        if (addressData.state) updateData.delivery.state = addressData.state;
        if (addressData.place) updateData.delivery.place = addressData.place;
        if (addressData.location) updateData.delivery.location = addressData.location;
        if (addressData.place_id) updateData.delivery.place_id = addressData.place_id;
        
        console.log('📤 AuthStack: Auto-updating delivery profile with address data');
      } else {
        // For B2B or B2C, update shop profile
        updateData.shop = {
          address: addressData.address || '',
          latitude: lat,
          longitude: lng,
          lat_log: latLog,
        };
        
        // Add location fields if available
        if (addressData.pincode) updateData.shop.pincode = addressData.pincode;
        if (addressData.state) updateData.shop.state = addressData.state;
        if (addressData.place) updateData.shop.place = addressData.place;
        if (addressData.location) updateData.shop.location = addressData.location;
        if (addressData.place_id) updateData.shop.place_id = addressData.place_id;
        
        // Set language based on state (2 for Kerala/Malayalam, 1 for others)
        if (addressData.state === 'Kerala') {
          updateData.shop.language = '2';
        } else {
          updateData.shop.language = '1';
        }
        
        console.log('📤 AuthStack: Auto-updating shop profile with address data');
      }

      // Save address to profile (background save - modal stays open)
      await updateProfile(userData.id, updateData);
      console.log('✅ AuthStack: Address auto-saved to profile successfully (modal remains open)');
    } catch (error: any) {
      console.error('❌ AuthStack: Error auto-saving address:', error);
      // Don't throw - user can still refine and save manually
    }
  }, [pendingDashboardType]);

  // Handle address selection from modal for new users
  const handleAddressSelect = useCallback(async (addressData: {
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
  }) => {
    try {
      console.log('📍 AuthStack: Address selected for new user, saving to profile...');
      
      // Mark address as selected to allow modal to close
      setAddressSelected(true);
      
      const userData = await getUserData();
      if (!userData?.id) {
        throw new Error('User data not found');
      }

      const dashboardType = pendingDashboardType || 'b2c';
      
      // Validate and format latitude/longitude to ensure they're valid numbers
      const lat = typeof addressData.latitude === 'number' && !isNaN(addressData.latitude) && isFinite(addressData.latitude)
        ? Number(addressData.latitude.toFixed(8))
        : null;
      const lng = typeof addressData.longitude === 'number' && !isNaN(addressData.longitude) && isFinite(addressData.longitude)
        ? Number(addressData.longitude.toFixed(8))
        : null;
      
      if (!lat || !lng) {
        throw new Error('Invalid location coordinates - latitude and longitude must be valid numbers');
      }
      
      // Prepare update data based on join type
      const updateData: UpdateProfileData = {};
      const latLog = `${lat},${lng}`;
      
      if (dashboardType === 'delivery') {
        // For delivery, update delivery profile
        updateData.delivery = {
          address: addressData.address,
          latitude: lat,
          longitude: lng,
          lat_log: latLog,
        };
        
        // Add location fields if available
        if (addressData.pincode) updateData.delivery.pincode = addressData.pincode;
        if (addressData.state) updateData.delivery.state = addressData.state;
        if (addressData.place) updateData.delivery.place = addressData.place;
        if (addressData.location) updateData.delivery.location = addressData.location;
        if (addressData.place_id) updateData.delivery.place_id = addressData.place_id;
        
        console.log('📤 AuthStack: Updating delivery profile with address data');
      } else {
        // For B2B or B2C, update shop profile
        updateData.shop = {
          address: addressData.address,
          latitude: lat,
          longitude: lng,
          lat_log: latLog,
        };
        
        // Add location fields if available
        if (addressData.pincode) updateData.shop.pincode = addressData.pincode;
        if (addressData.state) updateData.shop.state = addressData.state;
        if (addressData.place) updateData.shop.place = addressData.place;
        if (addressData.location) updateData.shop.location = addressData.location;
        if (addressData.place_id) updateData.shop.place_id = addressData.place_id;
        
        // Set language based on state (2 for Kerala/Malayalam, 1 for others)
        if (addressData.state === 'Kerala') {
          updateData.shop.language = '2';
        } else {
          updateData.shop.language = '1';
        }
        
        console.log('📤 AuthStack: Updating shop profile with address data');
      }

      // Save address to profile
      await updateProfile(userData.id, updateData);
      console.log('✅ AuthStack: Address saved to profile successfully');

      // Close modal
      setShowAddressModal(false);
      setAddressSelected(false);

      // Now proceed with navigation to signup screen
      console.log('🚀 AuthStack: Proceeding with navigation to signup screen');
      
      // Use dashboardType directly for routing (from joinType selection or API)
      // setMode will set it in memory only, not in AsyncStorage for new users
      await setMode(dashboardType as UserMode);
      onAuthComplete();
      
      // Clear pending data
      setPendingDashboardType(null);
      setPendingAllowedDashboards(undefined);
    } catch (error: any) {
      console.error('❌ AuthStack: Error saving address:', error);
      // Still proceed with navigation even if address save fails
      // User can add address later in signup screen
      setShowAddressModal(false);
      setAddressSelected(false);
      
      const dashboardType = pendingDashboardType || 'b2c';
      await setMode(dashboardType as UserMode);
      onAuthComplete();
      
      setPendingDashboardType(null);
      setPendingAllowedDashboards(undefined);
    }
  }, [pendingDashboardType, setMode, onAuthComplete]);

  return (
    <>
      <Stack.Navigator
        initialRouteName={initialRouteName}
        screenOptions={screenOptions}
      >
        <Stack.Screen name="SelectLanguage" component={SelectLanguageScreen} />
        <Stack.Screen name="JoinAs" component={JoinAsScreen} />
        <Stack.Screen name="Login">
          {(props) => (
            <LoginScreen
              {...props}
              onLoginSuccess={handleLoginSuccess}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
      
      {/* Address Modal for New Users */}
      <SignupAddressModal
        visible={showAddressModal}
        onClose={() => {
          // Only allow closing if address was already selected (from within the modal)
          // Prevent closing by clicking outside or back button before address is selected
          if (addressSelected) {
            setShowAddressModal(false);
            setAddressSelected(false);
          } else {
            console.log('⚠️ AuthStack: User tried to close address modal before selecting address - keeping it open');
          }
        }}
        onAddressSelect={handleAddressSelect}
        onAutoSave={handleAutoSave}
        initialLatitude={initialLocation?.latitude}
        initialLongitude={initialLocation?.longitude}
      />
    </>
  );
};

