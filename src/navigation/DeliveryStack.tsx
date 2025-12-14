import React, { useMemo, useRef, useEffect, useState } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DeliveryPlaceholderScreen from '../screens/Delivery/DeliveryPlaceholderScreen';
import PickupStatusScreen from '../screens/Delivery/PickupStatusScreen';
import DeliveryDashboardScreen from '../screens/Delivery/DeliveryDashboardScreen';
import VehicleInformationScreen from '../screens/Delivery/VehicleInformationScreen';
import DeliveryEarningsScreen from '../screens/Delivery/DeliveryEarningsScreen';
import DeliveryTrackingScreen from '../screens/B2C/DeliveryTrackingScreen';
import FullscreenMapScreen from '../screens/B2C/FullscreenMapScreen';
import AddCategoryScreen from '../screens/B2C/AddCategoryScreen';
import DeliveryUserProfileScreen from '../screens/Delivery/DeliveryUserProfileScreen';
import EditProfileScreen from '../screens/B2C/EditProfileScreen';
import SelectLanguageScreen from '../screens/B2C/SelectLanguageScreen';
import PrivacyPolicyScreen from '../screens/Common/PrivacyPolicyScreen';
import TermsScreen from '../screens/Common/TermsScreen';
import ApprovalWorkflowScreen from '../screens/B2B/ApprovalWorkflowScreen';
import SubscriptionPlansScreen from '../screens/B2B/SubscriptionPlansScreen';
import { useTheme } from '../components/ThemeProvider';

export type DeliveryStackParamList = {
  Placeholder: undefined;
  PickupStatus: undefined;
  Dashboard: undefined;
  VehicleInformation: undefined;
  Earnings: undefined;
  DeliveryTracking: { orderId: string };
  FullscreenMap: { destination: { latitude: number; longitude: number }; orderId?: string };
  AddCategory: undefined;
  UserProfile: undefined;
  EditProfile: undefined;
  SelectLanguage: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  ApprovalWorkflow: { fromProfile?: boolean } | undefined;
  SubscriptionPlans: undefined;
};

const Stack = createNativeStackNavigator<DeliveryStackParamList>();

// Force initial state to Dashboard
const getInitialState = () => ({
  routes: [{ name: 'Dashboard' as const }],
  index: 0,
});

export const DeliveryStack = () => {
  const { theme } = useTheme();
  const navigationRef = useRef<any>(null);
  const hasResetRef = useRef(false);
  const [needsVehicleInfo, setNeedsVehicleInfo] = useState<boolean | null>(null); // null = checking, true/false = result
  const [isChecking, setIsChecking] = useState(true);

  // Check if user needs to fill vehicle information BEFORE rendering navigator
  useEffect(() => {
    const checkVehicleInfoNeeded = async () => {
      try {
        // Check user_type - if user_type is 'N', route to vehicle info (user can change join type anytime)
        let userType: string | null = null;
        try {
          const userData = await import('../services/auth/authService').then(m => m.getUserData());
          userType = userData?.user_type || null;
          console.log(`🔍 DeliveryStack: User type from userData:`, userType);
        } catch (error) {
          console.error('❌ DeliveryStack: Error getting user data:', error);
        }

        // For user_type 'N', always route to vehicle info (signup screen)
        // User can change join type anytime by going back to JoinAs screen
        const needsInfo = userType === 'N';

        // Don't set AsyncStorage flags until signup is complete
        setNeedsVehicleInfo(needsInfo);
        console.log('🔍 DeliveryStack: Vehicle info needed:', needsInfo);
        console.log('🔍 DeliveryStack: User type:', userType);
        if (needsInfo) {
          console.log('✅ DeliveryStack: User type is N - will route to VehicleInformation (signup screen)');
        } else {
          console.log('✅ DeliveryStack: User type is not N - will route to Dashboard');
        }
      } catch (error) {
        console.error('Error checking vehicle info needed:', error);
        setNeedsVehicleInfo(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkVehicleInfoNeeded();
  }, []);

  // Navigate to VehicleInformation if needed after navigator is ready
  useEffect(() => {
    if (needsVehicleInfo === true && navigationRef.current?.isReady() && !hasResetRef.current) {
      console.log('✅ DeliveryStack: Navigating to VehicleInformation screen for new user (type N)');
      hasResetRef.current = true;
      // Small delay to ensure navigator is fully ready
      setTimeout(() => {
        if (navigationRef.current?.isReady() && needsVehicleInfo === true) {
          console.log('✅ DeliveryStack: Resetting navigation to VehicleInformation');
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'VehicleInformation' }],
            })
          );
        }
      }, 200);
    } else if (needsVehicleInfo === false) {
      console.log('✅ DeliveryStack: Vehicle info not needed - staying on Dashboard');
    }
  }, [needsVehicleInfo]);

  // Reset to Dashboard when navigator state changes (happens on remount)
  // But only if vehicle info is not needed
  const handleStateChange = () => {
    // IMPORTANT: Don't reset if vehicle info is needed (user_type 'N')
    // This prevents overriding the VehicleInformation route for new users
    if (!hasResetRef.current && navigationRef.current?.isReady() && needsVehicleInfo === false) {
      console.log('DeliveryStack: State changed, resetting to Dashboard (vehicle info not needed)');
      hasResetRef.current = true;
      // Small delay to ensure state is stable
      setTimeout(() => {
        if (navigationRef.current?.isReady() && needsVehicleInfo === false) {
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            })
          );
        }
      }, 100);
    } else if (needsVehicleInfo === true) {
      console.log('✅ DeliveryStack: State changed but vehicle info needed - NOT resetting to Dashboard');
    }
  };

  // Make screenOptions reactive to theme changes
  const screenOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: {
      backgroundColor: theme.background,
    },
  }), [theme.background]);

  // Wait for check to complete before rendering navigator
  // This ensures we use the correct initial route
  if (isChecking || needsVehicleInfo === null) {
    // Return null or a loading indicator while checking
    return null;
  }

  // Determine initial route based on whether vehicle info is needed
  const initialRouteName = needsVehicleInfo ? 'VehicleInformation' : 'Dashboard';
  console.log('🔍 DeliveryStack: Initial route name:', initialRouteName);
  console.log('🔍 DeliveryStack: needsVehicleInfo:', needsVehicleInfo);

  return (
    <Stack.Navigator
      ref={navigationRef}
      screenOptions={screenOptions}
      initialRouteName={initialRouteName}
      initialState={needsVehicleInfo ? {
        routes: [{ name: 'VehicleInformation' as const }],
        index: 0,
      } : getInitialState()}
      onStateChange={handleStateChange}
    >
      <Stack.Screen name="Dashboard" component={DeliveryDashboardScreen} />
      <Stack.Screen name="VehicleInformation" component={VehicleInformationScreen} />
      <Stack.Screen name="Earnings" component={DeliveryEarningsScreen} />
      <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
      <Stack.Screen name="FullscreenMap" component={FullscreenMapScreen} />
      <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
      <Stack.Screen name="UserProfile" component={DeliveryUserProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SelectLanguage" component={SelectLanguageScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="ApprovalWorkflow" component={ApprovalWorkflowScreen} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} />
      <Stack.Screen name="Placeholder" component={DeliveryPlaceholderScreen} />
      <Stack.Screen name="PickupStatus" component={PickupStatusScreen} />
    </Stack.Navigator>
  );
};

