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
      
      // Validate dashboard access from login API response
      // If user doesn't have access to the requested dashboard, use the first allowed dashboard
      let finalDashboardType = dashboardType;
      
      if (allowedDashboards && allowedDashboards.length > 0) {
        // Check if requested dashboard is in allowed list
        if (!allowedDashboards.includes(dashboardType)) {
          // Use first allowed dashboard instead
          finalDashboardType = allowedDashboards[0];
          console.log(`⚠️ Dashboard ${dashboardType} not allowed. Using ${finalDashboardType} instead.`);
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

