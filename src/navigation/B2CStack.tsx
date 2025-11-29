import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import DashboardScreen from '../screens/B2C/DashboardScreen';
import DeliveryTrackingScreen from '../screens/B2C/DeliveryTrackingScreen';
import AssignPartnerScreen from '../screens/B2C/AssignPartnerScreen';
import UserProfileScreen from '../screens/B2C/UserProfileScreen';
import EditProfileScreen from '../screens/B2C/EditProfileScreen';
import AddCategoryScreen from '../screens/B2C/AddCategoryScreen';
import MyOrdersScreen from '../screens/B2C/MyOrdersScreen';
import SelectLanguageScreen from '../screens/B2C/SelectLanguageScreen';
import PrivacyPolicyScreen from '../screens/Common/PrivacyPolicyScreen';
import TermsScreen from '../screens/Common/TermsScreen';
import DealerSignupScreen from '../screens/B2B/DealerSignupScreen';
import DocumentUploadScreen from '../screens/B2B/DocumentUploadScreen';
import ApprovalWorkflowScreen from '../screens/B2B/ApprovalWorkflowScreen';
import { useTheme } from '../components/ThemeProvider';

export type B2CStackParamList = {
  Dashboard: undefined;
  DeliveryTracking: { orderId: string };
  AssignPartner: { orderId: string };
  UserProfile: undefined;
  EditProfile: undefined;
  AddCategory: undefined;
  MyOrders: undefined;
  SelectLanguage: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  DealerSignup: undefined;
  DocumentUpload: undefined;
  ApprovalWorkflow: undefined;
};

const Stack = createNativeStackNavigator<B2CStackParamList>();

// Force initial state to Dashboard
const getInitialState = () => ({
  routes: [{ name: 'Dashboard' as const }],
  index: 0,
});

export const B2CStack = forwardRef<any, {}>((props, ref) => {
  const { theme } = useTheme();
  const navigationRef = useRef<any>(null);
  
  // Reset to Dashboard immediately when component mounts/remounts
  React.useEffect(() => {
    console.log('B2CStack: Component mounted, setting up navigation reset');
    
    const resetNavigation = () => {
      if (navigationRef.current?.isReady()) {
        console.log('B2CStack: Resetting navigation to Dashboard');
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Dashboard' }],
          })
        );
        return true;
      }
      return false;
    };
    
    // Try immediate reset
    if (resetNavigation()) {
      return;
    }
    
    // If not ready, try multiple times with increasing delays
    const attempts = [100, 200, 300, 500];
    const timers = attempts.map(delay => 
      setTimeout(() => {
        if (resetNavigation()) {
          timers.forEach(t => clearTimeout(t));
        }
      }, delay)
    );
    
    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, []); // Empty deps - run on every mount/remount

  // Make screenOptions reactive to theme changes
  const screenOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: {
      backgroundColor: theme.background,
    },
  }), [theme.background]);

  // Expose navigation ref to parent
  useImperativeHandle(ref, () => navigationRef.current, []);

  return (
    <Stack.Navigator
      ref={navigationRef}
      screenOptions={screenOptions}
      initialRouteName="Dashboard"
      initialState={getInitialState()}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
      <Stack.Screen name="AssignPartner" component={AssignPartnerScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
      <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
      <Stack.Screen name="SelectLanguage" component={SelectLanguageScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="DealerSignup" component={DealerSignupScreen} />
      <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      <Stack.Screen name="ApprovalWorkflow" component={ApprovalWorkflowScreen} />
    </Stack.Navigator>
  );
});

