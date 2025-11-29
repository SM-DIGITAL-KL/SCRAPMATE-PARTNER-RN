import React, { useMemo, useRef } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import DeliveryPlaceholderScreen from '../screens/Delivery/DeliveryPlaceholderScreen';
import PickupStatusScreen from '../screens/Delivery/PickupStatusScreen';
import DeliveryDashboardScreen from '../screens/Delivery/DeliveryDashboardScreen';
import VehicleInformationScreen from '../screens/Delivery/VehicleInformationScreen';
import DeliveryEarningsScreen from '../screens/Delivery/DeliveryEarningsScreen';
import DeliveryTrackingScreen from '../screens/B2C/DeliveryTrackingScreen';
import AddCategoryScreen from '../screens/B2C/AddCategoryScreen';
import DeliveryUserProfileScreen from '../screens/Delivery/DeliveryUserProfileScreen';
import EditProfileScreen from '../screens/B2C/EditProfileScreen';
import SelectLanguageScreen from '../screens/B2C/SelectLanguageScreen';
import PrivacyPolicyScreen from '../screens/Common/PrivacyPolicyScreen';
import TermsScreen from '../screens/Common/TermsScreen';
import { useTheme } from '../components/ThemeProvider';

export type DeliveryStackParamList = {
  Placeholder: undefined;
  PickupStatus: undefined;
  Dashboard: undefined;
  VehicleInformation: undefined;
  Earnings: undefined;
  DeliveryTracking: { orderId: string };
  AddCategory: undefined;
  UserProfile: undefined;
  EditProfile: undefined;
  SelectLanguage: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
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

  // Reset to Dashboard when navigator state changes (happens on remount)
  const handleStateChange = () => {
    if (!hasResetRef.current && navigationRef.current?.isReady()) {
      console.log('DeliveryStack: State changed, resetting to Dashboard');
      hasResetRef.current = true;
      // Small delay to ensure state is stable
      setTimeout(() => {
        if (navigationRef.current?.isReady()) {
          navigationRef.current.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [{ name: 'Dashboard' }],
            })
          );
        }
      }, 100);
    }
  };

  // Make screenOptions reactive to theme changes
  const screenOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: {
      backgroundColor: theme.background,
    },
  }), [theme.background]);

  return (
    <Stack.Navigator
      ref={navigationRef}
      screenOptions={screenOptions}
      initialRouteName="Dashboard"
      initialState={getInitialState()}
      onStateChange={handleStateChange}
    >
      <Stack.Screen name="Dashboard" component={DeliveryDashboardScreen} />
      <Stack.Screen name="VehicleInformation" component={VehicleInformationScreen} />
      <Stack.Screen name="Earnings" component={DeliveryEarningsScreen} />
      <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
      <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
      <Stack.Screen name="UserProfile" component={DeliveryUserProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SelectLanguage" component={SelectLanguageScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Placeholder" component={DeliveryPlaceholderScreen} />
      <Stack.Screen name="PickupStatus" component={PickupStatusScreen} />
    </Stack.Navigator>
  );
};

