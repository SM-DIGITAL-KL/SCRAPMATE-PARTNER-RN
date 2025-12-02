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
      // Store allowed dashboards in AsyncStorage for immediate access
      if (allowedDashboards && allowedDashboards.length > 0) {
        await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(allowedDashboards));
      }
      
      // IMPORTANT: Check user_type first to determine correct dashboard
      const { getUserData } = await import('../services/auth/authService');
      const userData = await getUserData();
      const userType = userData?.user_type;
      const appType = userData?.app_type || userData?.app_version;
      
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
        // For user types that don't have explicit routing (like 'N'), use flags as fallback
        if (userType === 'N' || !userType) {
          const b2bStatus = await AsyncStorage.getItem('@b2b_status');
          const b2cSignupNeeded = await AsyncStorage.getItem('@b2c_signup_needed');
          
          if (b2bStatus === 'new_user' && finalDashboardType !== 'b2b') {
            console.log(`⚠️  AuthStack: b2b_status is 'new_user' but finalDashboardType is ${finalDashboardType}`);
            console.log(`   Overriding to 'b2b' to ensure correct routing`);
            finalDashboardType = 'b2b';
          } else if (b2cSignupNeeded === 'true' && finalDashboardType !== 'b2c') {
            console.log(`⚠️  AuthStack: b2c_signup_needed is 'true' but finalDashboardType is ${finalDashboardType}`);
            console.log(`   Overriding to 'b2c' to ensure correct routing`);
            finalDashboardType = 'b2c';
          }
        }
        
        // Validate dashboard access from login API response (only for non-explicit user types)
        // If user doesn't have access to the requested dashboard, use the first allowed dashboard
        if (allowedDashboards && allowedDashboards.length > 0 && (userType === 'N' || !userType)) {
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

