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
import AddCategoryScreen from '../screens/B2C/AddCategoryScreen';
import PrivacyPolicyScreen from '../screens/Common/PrivacyPolicyScreen';
import TermsScreen from '../screens/Common/TermsScreen';
import { useTheme } from '../components/ThemeProvider';
import { getUserData } from '../services/auth/authService';

export type B2BStackParamList = {
  Placeholder: undefined;
  DealerDashboard: undefined;
  DealerSignup: undefined;
  DocumentUpload: undefined;
  ApprovalWorkflow: { fromProfile?: boolean } | undefined;
  BulkScrapRequest: undefined;
  UserProfile: undefined;
  SubscriptionPlans: undefined;
  EditProfile: undefined;
  SelectLanguage: undefined;
  AddCategory: undefined;
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
        
        // Also check user_type as fallback - if user_type is 'N', route to signup
        let userType: string | null = null;
        let userData: any = null;
        try {
          userData = await getUserData();
          userType = userData?.user_type || null;
          console.log(`🔍 B2BStack: User type from userData:`, userType);
          console.log(`🔍 B2BStack: Full userData:`, JSON.stringify(userData, null, 2));
        } catch (error) {
          console.error('❌ B2BStack: Error getting user data:', error);
        }
        
        // If no status found and this is the first attempt, retry a few times
        if (!b2bStatus && !userType && retryCount < 3) {
          console.log(`⏳ B2BStack: Status not found, retrying in ${(retryCount + 1) * 200}ms...`);
          return checkB2BStatusAndSetRoute(retryCount + 1);
        }
        
        let route: keyof B2BStackParamList = 'DealerDashboard';
        
        // CRITICAL: Check user_type FIRST - if user_type is 'N' (new user), ALWAYS route to signup
        // This applies even if shop data exists (for re-registering users with del_status = 2)
        // New users (type 'N') must complete signup before accessing dashboard
        if (userType === 'N' || userType === null || userType === undefined) {
          // If userType is null/undefined, treat as new user for safety
          if (!userType) {
            console.log('⚠️ B2BStack: User type is null/undefined - treating as new user (N) for safety');
          }
          console.log('✅ B2BStack: User type is N (or null) - routing to DealerSignup (user must complete signup)');
          console.log('   Note: This applies even if shop data exists (for re-registering users with del_status = 2)');
          route = 'DealerSignup';
          // Don't set AsyncStorage flags until signup is complete
        } else {
          // User type is not 'N' - signup is complete, check approval status
          if (b2bStatus === 'rejected') {
            // If rejected, route to signup screen to allow user to fix issues
            console.log('✅ B2BStack: Status is rejected - routing to DealerSignup to fix issues');
            route = 'DealerSignup';
            // Keep rejected status in AsyncStorage
          } else if (b2bStatus === 'pending') {
            console.log('✅ B2BStack: Setting initial route to ApprovalWorkflow (pending)');
            route = 'ApprovalWorkflow';
          } else if (b2bStatus === 'approved') {
            console.log('✅ B2BStack: Setting initial route to DealerDashboard (approved)');
            route = 'DealerDashboard';
            // Clear B2B status after setting route
            await AsyncStorage.removeItem('@b2b_status');
          } else {
            // No status or unknown - default to dashboard (signup complete)
            // Clear any leftover 'new_user' flag to prevent future issues
            if (b2bStatus === 'new_user') {
              console.log('✅ B2BStack: User type is not N, clearing @b2b_status flag');
              await AsyncStorage.removeItem('@b2b_status');
            }
            console.log('✅ B2BStack: Setting initial route to DealerDashboard (signup complete, user_type: ' + userType + ')');
            route = 'DealerDashboard';
          }
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
      <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="Placeholder" component={B2BPlaceholderScreen} />
    </Stack.Navigator>
  );
});

