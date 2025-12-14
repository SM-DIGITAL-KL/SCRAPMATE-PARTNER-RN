import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DashboardScreen from '../screens/B2C/DashboardScreen';
import DeliveryTrackingScreen from '../screens/B2C/DeliveryTrackingScreen';
import FullscreenMapScreen from '../screens/B2C/FullscreenMapScreen';
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
import SubscriptionPlansScreen from '../screens/B2B/SubscriptionPlansScreen';
import B2CSignupScreen from '../screens/B2C/B2CSignupScreen';
import { useTheme } from '../components/ThemeProvider';
import { getUserData } from '../services/auth/authService';

export type B2CStackParamList = {
  Dashboard: undefined;
  DeliveryTracking: { orderId: string };
  FullscreenMap: { destination: { latitude: number; longitude: number }; orderId?: string };
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
  ApprovalWorkflow: { fromProfile?: boolean } | undefined;
  SubscriptionPlans: undefined;
  B2CSignup: undefined;
};

const Stack = createNativeStackNavigator<B2CStackParamList>();

export const B2CStack = forwardRef<any, {}>((props, ref) => {
  const { theme } = useTheme();
  const navigationRef = useRef<any>(null);
  const [initialRoute, setInitialRoute] = React.useState<keyof B2CStackParamList | null>(null);
  
  // Check if B2C signup is needed and set initial route
  React.useEffect(() => {
    const checkB2CSignupAndSetRoute = async (retryCount = 0) => {
      try {
        // Add increasing delays for retries to ensure AsyncStorage is updated after login
        const delay = retryCount === 0 ? 100 : retryCount * 200;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const b2cSignupNeeded = await AsyncStorage.getItem('@b2c_signup_needed');
        console.log(`🔍 B2CStack: B2C signup needed from storage (attempt ${retryCount + 1}):`, b2cSignupNeeded);
        
        // Also check user_type as fallback - if user_type is 'N', route to signup
        let userType: string | null = null;
        try {
          const userData = await getUserData();
          userType = userData?.user_type || null;
          console.log(`🔍 B2CStack: User type from userData:`, userType);
        } catch (error) {
          console.error('❌ B2CStack: Error getting user data:', error);
        }
        
        // If no status found and this is the first attempt, retry a few times
        if (!b2cSignupNeeded && !userType && retryCount < 3) {
          console.log(`⏳ B2CStack: Status not found, retrying in ${(retryCount + 1) * 200}ms...`);
          return checkB2CSignupAndSetRoute(retryCount + 1);
        }
        
        let route: keyof B2CStackParamList = 'Dashboard';
        
        // IMPORTANT: Check user_type first - if user_type is not 'N', signup is complete, go to dashboard
        // Only route to signup if user_type is 'N' (new_user) AND current mode is 'b2c'
        if (userType === 'N') {
          // For user_type 'N', check current mode from UserModeContext (not AsyncStorage)
          // User can change join type anytime by going back to JoinAs screen
          // Since we can't use hooks here, we'll route to signup if user_type is 'N'
          // The mode is set by AuthStack/LoginScreen based on joinType selection
          console.log('✅ B2CStack: User type is N - routing to B2CSignup (user can change join type anytime)');
          route = 'B2CSignup';
          // Don't set AsyncStorage flags until signup is complete
        } else {
          // User type is not 'N' - signup is complete, check approval status
          // Check for B2C approval status in AsyncStorage (will be synced from profile in dashboard)
          const b2cApprovalStatus = await AsyncStorage.getItem('@b2c_approval_status');
          
          if (b2cApprovalStatus === 'rejected') {
            // If rejected, route to signup screen to allow user to fix issues
            console.log('✅ B2CStack: Status is rejected - routing to B2CSignup to fix issues');
            route = 'B2CSignup';
            // Keep rejected status in AsyncStorage and set signup needed flag
            await AsyncStorage.setItem('@b2c_signup_needed', 'true');
          } else {
            // Clear any leftover flags to prevent future issues
            if (b2cSignupNeeded === 'true') {
              console.log('✅ B2CStack: User type is not N, clearing @b2c_signup_needed flag');
              await AsyncStorage.removeItem('@b2c_signup_needed');
            }
            console.log('✅ B2CStack: Setting initial route to Dashboard (signup complete, user_type: ' + userType + ')');
            route = 'Dashboard';
          }
        }
        
        console.log('🎯 B2CStack: Final initial route set to:', route);
        setInitialRoute(route);
      } catch (error) {
        console.error('❌ B2CStack: Error checking B2C signup status:', error);
        // On error, default to dashboard
        setInitialRoute('Dashboard');
      }
    };
    
    checkB2CSignupAndSetRoute();
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

  // Don't render navigator until we know the initial route
  if (!initialRoute) {
    return null; // Or a loading screen
  }

  return (
    <Stack.Navigator
      ref={navigationRef}
      screenOptions={screenOptions}
      initialRouteName={initialRoute}
    >
      <Stack.Screen name="Dashboard" component={DashboardScreen} />
      <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
      <Stack.Screen name="FullscreenMap" component={FullscreenMapScreen} />
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
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} />
      <Stack.Screen name="B2CSignup" component={B2CSignupScreen} />
    </Stack.Navigator>
  );
});

