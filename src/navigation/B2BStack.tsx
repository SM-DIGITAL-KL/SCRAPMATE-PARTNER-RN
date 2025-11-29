import React, { useMemo, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import B2BPlaceholderScreen from '../screens/B2B/B2BPlaceholderScreen';
import DealerDashboardScreen from '../screens/B2B/DealerDashboardScreen';
import DealerSignupScreen from '../screens/B2B/DealerSignupScreen';
import DocumentUploadScreen from '../screens/B2B/DocumentUploadScreen';
import ApprovalWorkflowScreen from '../screens/B2B/ApprovalWorkflowScreen';
import BulkScrapRequestScreen from '../screens/B2B/BulkScrapRequestScreen';
import UserProfileScreen from '../screens/B2B/UserProfileScreen';
import SubscriptionPlansScreen from '../screens/B2B/SubscriptionPlansScreen';
import EditProfileScreen from '../screens/B2C/EditProfileScreen';
import SelectLanguageScreen from '../screens/B2C/SelectLanguageScreen';
import PrivacyPolicyScreen from '../screens/Common/PrivacyPolicyScreen';
import TermsScreen from '../screens/Common/TermsScreen';
import { useTheme } from '../components/ThemeProvider';

export type B2BStackParamList = {
  Placeholder: undefined;
  DealerDashboard: undefined;
  DealerSignup: undefined;
  DocumentUpload: undefined;
  ApprovalWorkflow: undefined;
  BulkScrapRequest: undefined;
  UserProfile: undefined;
  SubscriptionPlans: undefined;
  EditProfile: undefined;
  SelectLanguage: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
};

const Stack = createNativeStackNavigator<B2BStackParamList>();

export const B2BStack = forwardRef<any, {}>((props, ref) => {
  const { theme } = useTheme();
  const navigationRef = useRef<any>(null);
  const [initialRoute, setInitialRoute] = React.useState<keyof B2BStackParamList | null>(null);
  
  // Check B2B status and set initial route before rendering navigator
  React.useEffect(() => {
    const checkB2BStatusAndSetRoute = async (retryCount = 0) => {
      try {
        // Add increasing delays for retries to ensure AsyncStorage is updated after login
        const delay = retryCount === 0 ? 100 : retryCount * 200;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        const b2bStatus = await AsyncStorage.getItem('@b2b_status');
        console.log(`🔍 B2BStack: B2B status from storage (attempt ${retryCount + 1}):`, b2bStatus);
        
        // If no status found and this is the first attempt, retry a few times
        if (!b2bStatus && retryCount < 3) {
          console.log(`⏳ B2BStack: Status not found, retrying in ${(retryCount + 1) * 200}ms...`);
          return checkB2BStatusAndSetRoute(retryCount + 1);
        }
        
        let route: keyof B2BStackParamList = 'DealerDashboard';
        
        if (b2bStatus === 'new_user') {
          console.log('✅ B2BStack: Setting initial route to DealerSignup (new_user)');
          route = 'DealerSignup';
        } else if (b2bStatus === 'pending') {
          console.log('✅ B2BStack: Setting initial route to ApprovalWorkflow (pending)');
          route = 'ApprovalWorkflow';
        } else if (b2bStatus === 'approved') {
          console.log('✅ B2BStack: Setting initial route to DealerDashboard (approved)');
          route = 'DealerDashboard';
          // Clear B2B status after setting route
          await AsyncStorage.removeItem('@b2b_status');
        } else {
          // No status or unknown - default to dashboard
          console.log('⚠️  B2BStack: No B2B status found or status is null/empty, defaulting to DealerDashboard');
          console.log('   This might mean the user is not a new B2B user or status was not stored during login');
          route = 'DealerDashboard';
        }
        
        console.log('🎯 B2BStack: Final initial route set to:', route);
        setInitialRoute(route);
      } catch (error) {
        console.error('❌ B2BStack: Error checking B2B status:', error);
        // On error, default to dashboard
        setInitialRoute('DealerDashboard');
      }
    };
    
    checkB2BStatusAndSetRoute();
  }, []); // Empty deps - run on every mount/remount

  // Expose navigation ref to parent
  useImperativeHandle(ref, () => navigationRef.current, []);

  // Make screenOptions reactive to theme changes
  const screenOptions = useMemo(() => ({
    headerShown: false,
    contentStyle: {
      backgroundColor: theme.background,
    },
  }), [theme.background]);

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
      <Stack.Screen name="DealerDashboard" component={DealerDashboardScreen} />
      <Stack.Screen name="DealerSignup" component={DealerSignupScreen} />
      <Stack.Screen name="DocumentUpload" component={DocumentUploadScreen} />
      <Stack.Screen name="ApprovalWorkflow" component={ApprovalWorkflowScreen} />
      <Stack.Screen name="BulkScrapRequest" component={BulkScrapRequestScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SelectLanguage" component={SelectLanguageScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Placeholder" component={B2BPlaceholderScreen} />
    </Stack.Navigator>
  );
});

