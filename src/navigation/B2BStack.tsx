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
import BulkSellRequestScreen from '../screens/B2B/BulkSellRequestScreen';
import UserProfileScreen from '../screens/B2B/UserProfileScreen';
import PendingBulkBuyOrdersScreen from '../screens/B2B/PendingBulkBuyOrdersScreen';
import PendingBulkBuyOrderDetailScreen from '../screens/B2B/PendingBulkBuyOrderDetailScreen';
import SubscriptionPlansScreen from '../screens/B2B/SubscriptionPlansScreen';
import EditProfileScreen from '../screens/B2C/EditProfileScreen';
import SelectLanguageScreen from '../screens/B2C/SelectLanguageScreen';
import AddCategoryScreen from '../screens/B2C/AddCategoryScreen';
import PrivacyPolicyScreen from '../screens/Common/PrivacyPolicyScreen';
import TermsScreen from '../screens/Common/TermsScreen';
import FullscreenMapScreen from '../screens/B2C/FullscreenMapScreen';
import ActiveBuyRequestsListScreen from '../screens/B2C/ActiveBuyRequestsListScreen';
import MyBulkBuyRequestsScreen from '../screens/B2B/MyBulkBuyRequestsScreen';
import BulkRequestDetailsScreen from '../screens/B2B/BulkRequestDetailsScreen';
import AvailableBulkSellRequestsScreen from '../screens/B2B/AvailableBulkSellRequestsScreen';
import BulkSellRequestDetailsScreen from '../screens/B2B/BulkSellRequestDetailsScreen';
import ParticipateBulkSellRequestScreen from '../screens/B2B/ParticipateBulkSellRequestScreen';
import DeliveryTrackingScreen from '../screens/B2C/DeliveryTrackingScreen';
import ParticipateBulkRequestScreen from '../screens/B2C/ParticipateBulkRequestScreen';
import BulkRequestTrackingScreen from '../screens/B2C/BulkRequestTrackingScreen';
import B2BMyOrdersScreen from '../screens/B2B/B2BMyOrdersScreen';
import LivePricesScreen from '../screens/B2B/LivePricesScreen';
import { useTheme } from '../components/ThemeProvider';
import { getUserData } from '../services/auth/authService';
import { getProfile } from '../services/api/v2/profile';

export type B2BStackParamList = {
  Placeholder: undefined;
  DealerDashboard: undefined;
  DealerSignup: undefined;
  DocumentUpload: undefined;
  ApprovalWorkflow: { fromProfile?: boolean } | undefined;
  BulkScrapRequest: undefined;
  BulkSellRequest: undefined;
  UserProfile: undefined;
  SubscriptionPlans: undefined;
  EditProfile: undefined;
  SelectLanguage: undefined;
  AddCategory: undefined;
  PrivacyPolicy: undefined;
  Terms: undefined;
  FullscreenMap: { destination: { latitude: number; longitude: number }; orderId?: string; requestId?: string };
  ActiveBuyRequestsList: undefined;
  MyBulkBuyRequests: undefined;
  BulkRequestDetails: { request: any };
  AvailableBulkSellRequests: undefined;
  BulkSellRequestDetails: { request: any };
  ParticipateBulkSellRequest: { request: any };
  DeliveryTracking: { orderId: string; order?: any };
  ParticipateBulkRequest: { request: any };
  BulkRequestTracking: { bulkRequest: any; orderId?: string | number };
  PendingBulkBuyOrders: { fromPayment?: boolean } | undefined;
  PendingBulkBuyOrderDetail: { order: any };
  MyOrders: undefined;
  LivePrices: undefined;
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

        // CRITICAL: Check user_type FIRST
        if (userType === 'S') {
          // S users always go to dashboard (they're pure B2B users)
          console.log(`✅ B2BStack: User type is S (B2B user) - routing to DealerDashboard`);
          route = 'DealerDashboard';
          // Clear any old B2B status flags
          if (b2bStatus) {
            await AsyncStorage.removeItem('@b2b_status');
          }
        } else if (userType === 'SR') {
          // For SR users, check B2B shop's approval status specifically (not merged status)
          try {
            // Fetch profile to check B2B shop approval status
            const profile = await getProfile(userData?.id);
            const b2bShop = (profile as any)?.b2bShop;
            const shop = profile?.shop as any;
            
            console.log(`🔍 B2BStack: SR user - checking B2B shop approval status`);
            console.log(`🔍 B2BStack: SR user - b2bShop exists:`, !!b2bShop);
            console.log(`🔍 B2BStack: SR user - shop data exists:`, !!shop);
            
            let b2bApprovalStatus = null;
            
            // If we have separate b2bShop object, use it directly
            if (b2bShop && b2bShop.id) {
              b2bApprovalStatus = b2bShop.approval_status;
              console.log(`✅ B2BStack: Using b2bShop.approval_status: ${b2bApprovalStatus}`);
            } else if (shop && shop.id) {
              // Fallback: Use merged shop data
              const shopType = shop?.shop_type;
              const isB2BShop = shopType === 1 || shopType === 4; // B2B shop types
              const hasB2BFields = shop?.company_name || shop?.gst_number || shop?.business_license_url;
              const approvalStatus = shop?.approval_status;
              
              if (isB2BShop) {
                // This is the B2B shop itself, use its approval_status directly
                b2bApprovalStatus = approvalStatus;
                console.log(`✅ B2BStack: Shop is B2B shop (type ${shopType}), approval_status: ${b2bApprovalStatus}`);
              } else if (hasB2BFields && approvalStatus === 'approved') {
                // Shop has B2B fields and is approved
                // Since merged shop prioritizes B2B approval_status, if it's approved and has B2B fields, B2B is approved
                b2bApprovalStatus = 'approved';
                console.log(`✅ B2BStack: Shop has B2B fields and is approved, B2B shop is approved`);
              } else if (hasB2BFields) {
                // Shop has B2B fields but approval_status is not approved (pending/rejected/null)
                // Since merged shop prioritizes B2B status, this means B2B is not approved
                b2bApprovalStatus = approvalStatus || 'pending';
                console.log(`✅ B2BStack: Shop has B2B fields but approval_status is ${approvalStatus}, B2B shop is ${b2bApprovalStatus}`);
              } else {
                // No B2B fields - B2B shop might not exist
                b2bApprovalStatus = 'pending';
                console.log(`✅ B2BStack: No B2B fields found, B2B shop might not exist`);
              }
            } else {
              // No shop data at all
              console.log(`✅ B2BStack: SR user with no shop data - routing to ApprovalWorkflow`);
              route = 'ApprovalWorkflow';
              await AsyncStorage.setItem('@b2b_status', 'pending');
            }
            
            if (b2bApprovalStatus === 'approved') {
              console.log(`✅ B2BStack: SR user with B2B shop approved - routing to DealerDashboard`);
              route = 'DealerDashboard';
              // Clear any old B2B status flags
              if (b2bStatus) {
                await AsyncStorage.removeItem('@b2b_status');
              }
            } else if (b2bApprovalStatus === 'rejected') {
              console.log(`✅ B2BStack: SR user with B2B shop rejected - routing to DealerSignup`);
              route = 'DealerSignup';
              await AsyncStorage.setItem('@b2b_status', 'rejected');
            } else if (b2bApprovalStatus !== null) {
              // B2B shop is pending or missing
              console.log(`✅ B2BStack: SR user with B2B shop status '${b2bApprovalStatus}' - routing to ApprovalWorkflow`);
              route = 'ApprovalWorkflow';
              await AsyncStorage.setItem('@b2b_status', b2bApprovalStatus || 'pending');
            } else {
              // b2bApprovalStatus is null - no shop data
              console.log(`✅ B2BStack: SR user with no B2B shop data - routing to ApprovalWorkflow`);
              route = 'ApprovalWorkflow';
              await AsyncStorage.setItem('@b2b_status', 'pending');
            }
          } catch (error) {
            console.warn('⚠️ B2BStack: Failed to fetch profile for SR user, routing to ApprovalWorkflow as safe default:', error);
            // If profile fetch fails, route to ApprovalWorkflow as safe default
            route = 'ApprovalWorkflow';
            await AsyncStorage.setItem('@b2b_status', 'pending');
          }
        } else if (userType === 'N' || userType === null || userType === undefined) {
          // If userType is null/undefined, treat as new user for safety
          if (!userType) {
            console.log('⚠️ B2BStack: User type is null/undefined - treating as new user (N) for safety');
          }
          console.log('✅ B2BStack: User type is N (or null) - routing to DealerSignup (user must complete signup)');
          console.log('   Note: This applies even if shop data exists (for re-registering users with del_status = 2)');
          route = 'DealerSignup';
          // Don't set AsyncStorage flags until signup is complete
        } else {
          // User type is not 'N', 'S', or 'SR' - check approval status
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
      <Stack.Screen name="BulkSellRequest" component={BulkSellRequestScreen} />
      <Stack.Screen name="UserProfile" component={UserProfileScreen} />
      <Stack.Screen name="PendingBulkBuyOrders" component={PendingBulkBuyOrdersScreen} />
      <Stack.Screen name="PendingBulkBuyOrderDetail" component={PendingBulkBuyOrderDetailScreen} />
      <Stack.Screen name="SubscriptionPlans" component={SubscriptionPlansScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
      <Stack.Screen name="SelectLanguage" component={SelectLanguageScreen} />
      <Stack.Screen name="AddCategory" component={AddCategoryScreen} />
      <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
      <Stack.Screen name="Terms" component={TermsScreen} />
      <Stack.Screen name="FullscreenMap" component={FullscreenMapScreen} />
      <Stack.Screen name="ActiveBuyRequestsList" component={ActiveBuyRequestsListScreen} />
      <Stack.Screen name="MyBulkBuyRequests" component={MyBulkBuyRequestsScreen} />
      <Stack.Screen name="BulkRequestDetails" component={BulkRequestDetailsScreen} />
      <Stack.Screen name="AvailableBulkSellRequests" component={AvailableBulkSellRequestsScreen} />
      <Stack.Screen name="BulkSellRequestDetails" component={BulkSellRequestDetailsScreen} />
      <Stack.Screen name="ParticipateBulkSellRequest" component={ParticipateBulkSellRequestScreen} />
      <Stack.Screen name="DeliveryTracking" component={DeliveryTrackingScreen} />
      <Stack.Screen name="ParticipateBulkRequest" component={ParticipateBulkRequestScreen} />
      <Stack.Screen name="BulkRequestTracking" component={BulkRequestTrackingScreen} />
      <Stack.Screen name="MyOrders" component={B2BMyOrdersScreen} />
      <Stack.Screen name="LivePrices" component={LivePricesScreen} />
      <Stack.Screen name="Placeholder" component={B2BPlaceholderScreen} />
    </Stack.Navigator>
  );
});

