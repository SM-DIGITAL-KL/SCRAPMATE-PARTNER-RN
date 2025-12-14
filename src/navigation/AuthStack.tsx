import React, { useMemo, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../components/ThemeProvider';
import SelectLanguageScreen from '../screens/B2C/SelectLanguageScreen';
import JoinAsScreen from '../screens/Auth/JoinAsScreen';
import { LoginScreen } from '../screens/Auth/LoginScreen';
import { setAuthToken } from '../services/auth/authService';
import { useUserMode, UserMode } from '../context/UserModeContext';

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
      // IMPORTANT: Check user_type first to determine correct dashboard
      const { getUserData } = await import('../services/auth/authService');
      const userData = await getUserData();
      const userType = userData?.user_type;
      const appType = userData?.app_type || userData?.app_version;
      
      // IMPORTANT: If user_type is 'N', DO NOT store @selected_join_type permanently
      // User can change join type anytime by going back to JoinAs screen
      // Only store allowedDashboards so they can access all dashboards
      if (userType === 'N') {
        console.log('✅ AuthStack: User type is N (new_user) - NOT storing @selected_join_type permanently');
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
        
        // Use dashboardType directly for routing (from joinType selection or API)
        // setMode will set it in memory only, not in AsyncStorage for new users
        await setMode(dashboardType as UserMode);
        onAuthComplete();
        return;
      }
      
      // For registered users (not 'N'), store data normally
      // Store allowed dashboards in AsyncStorage for immediate access
      if (allowedDashboards && allowedDashboards.length > 0) {
        await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(allowedDashboards));
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
          finalDashboardType = 'b2b';
          await AsyncStorage.setItem('@selected_join_type', 'b2b');
          await AsyncStorage.removeItem('@b2c_signup_needed');
          console.log(`✅ AuthStack: User type is SR with app_type V2 - routing to B2B dashboard`);
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
          finalDashboardType = 'b2b';
          await AsyncStorage.setItem('@selected_join_type', 'b2b');
          console.log(`✅ AuthStack: Final check - User type is SR with V2, forcing B2B mode`);
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

  return (
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
  );
};

