import React, { useEffect, useState, useCallback } from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { B2CStack } from './B2CStack';
import { B2BStack } from './B2BStack';
import { DeliveryStack } from './DeliveryStack';
import { AuthStack, AuthStackParamList } from './AuthStack';
import { isLoggedIn, getUserData } from '../services/auth/authService';
import { useUserMode } from '../context/UserModeContext';
import { View, DeviceEventEmitter } from 'react-native';

type RootStackParamList = {
  AuthFlow: undefined;
  MainApp: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();

const MainAppScreen = () => {
  const { mode, isModeReady, setMode } = useUserMode();
  const [userData, setUserData] = useState<any>(null);
  const [allowedDashboards, setAllowedDashboards] = useState<('b2b' | 'b2c' | 'delivery')[]>([]);
  const [selectedJoinType, setSelectedJoinType] = useState<string | null>(null);

  const updateAllowedDashboards = React.useCallback(async () => {
    // Load allowed dashboards from AsyncStorage (set during login)
    const storedDashboards = await AsyncStorage.getItem('@allowed_dashboards');
    let dashboards: ('b2b' | 'b2c' | 'delivery')[] = [];
    
    if (storedDashboards) {
      try {
        dashboards = JSON.parse(storedDashboards);
      } catch (e) {
        console.error('Error parsing allowed dashboards:', e);
      }
    }
    
    // IMPORTANT: Do NOT set allowedDashboards for new users (type 'N')
    // New users should NOT have access to dashboards until signup is complete
    const currentUserData = await getUserData();
    if (currentUserData?.user_type === 'N' && dashboards.length === 0) {
      dashboards = ['b2b', 'b2c', 'delivery'];
      await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(dashboards));
      console.log('✅ AppNavigator: New user with empty allowedDashboards - set to all three dashboards');
    }
    
    // Check B2B status - if approved, allow B2C access
    const b2bStatus = await AsyncStorage.getItem('@b2b_status');
    if (b2bStatus === 'approved' && dashboards.includes('b2b')) {
      // Add 'b2c' to allowed dashboards if B2B is approved
      if (!dashboards.includes('b2c')) {
        dashboards.push('b2c');
        console.log('✅ B2B approved - adding B2C to allowed dashboards');
        // Update AsyncStorage with new allowed dashboards
        await AsyncStorage.setItem('@allowed_dashboards', JSON.stringify(dashboards));
      }
    }
    
    setAllowedDashboards(dashboards);
  }, []);

  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
      await updateAllowedDashboards();
      
      // Load selected join type for new users
      const joinType = await AsyncStorage.getItem('@selected_join_type');
      setSelectedJoinType(joinType);
    };
    loadUserData();
  }, [updateAllowedDashboards]);

  // Listen for B2B status changes and update allowed dashboards
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('B2B_STATUS_UPDATED', async () => {
      console.log('📢 B2B status updated event received, refreshing allowed dashboards');
      await updateAllowedDashboards();
    });

    return () => subscription.remove();
  }, [updateAllowedDashboards]);

  useEffect(() => {
    // Validate mode access immediately using stored allowedDashboards
    // BUT: For user_type 'N' (new users), allow them to access their selected join type for signup
    const userType = userData?.user_type;
    
    // For new users (user_type 'N'), allow access to selected join type for signup
    // New users should have all dashboards allowed, so we don't restrict them
    if (userType === 'N') {
      if (selectedJoinType && selectedJoinType === mode) {
        console.log(`✅ AppNavigator: User type is N, allowing access to selected join type: ${mode} for signup`);
        return; // Allow access to selected join type for signup - don't redirect
      }
      // If no selectedJoinType but allowedDashboards has all three, allow current mode
      if (allowedDashboards.length >= 3 && ['b2b', 'b2c', 'delivery'].every(d => allowedDashboards.includes(d as any))) {
        console.log(`✅ AppNavigator: User type is N with all dashboards allowed, allowing access to: ${mode}`);
        return; // Allow access - new users can access any dashboard
      }
    }
    
    // For existing users, validate against allowedDashboards
    if (allowedDashboards.length > 0) {
      const isModeAllowed = allowedDashboards.includes(mode);
      
      if (!isModeAllowed) {
        // User doesn't have access to current mode - redirect immediately to first allowed dashboard
        const firstAllowed = allowedDashboards[0];
        if (firstAllowed) {
          console.log(`⚠️ Mode ${mode} not allowed. Redirecting to ${firstAllowed}`);
          setMode(firstAllowed);
        }
      }
    }
  }, [mode, allowedDashboards, setMode, userData?.user_type, selectedJoinType]);

  // Don't wait for isModeReady - render immediately with current mode
  // If mode changes, component will remount due to key prop
  if (mode === 'b2b') {
    return <B2BStack key="b2b" />;
  }

  if (mode === 'delivery') {
    // Check access using stored allowedDashboards
    // BUT: For user_type 'N', allow access if @selected_join_type is 'delivery'
    if (allowedDashboards.length > 0 && !allowedDashboards.includes('delivery')) {
      // Check if user is new (user_type 'N') and selected delivery
      if (userData?.user_type === 'N' && selectedJoinType === 'delivery') {
        console.log('✅ AppNavigator: Allowing delivery access for new user signup');
        return <DeliveryStack key="delivery" />;
      }
      // Don't render DeliveryStack if user doesn't have access and is not a new user
      // The useEffect above will handle redirect immediately
      // Show B2C temporarily while redirect happens
      return <B2CStack key="b2c-temp" />;
    }
    return <DeliveryStack key="delivery" />;
  }

  // For B2C mode, check if it's allowed
  // B2C is allowed if:
  // 1. It's in the allowedDashboards array (from API or added because B2B is approved)
  // 2. Or if allowedDashboards is empty (fallback for backward compatibility)
  // 3. OR if user_type is 'N' and @selected_join_type is 'b2c' (for signup)
  if (mode === 'b2c') {
    if (allowedDashboards.length > 0 && !allowedDashboards.includes('b2c')) {
      // Check if user is new (user_type 'N') and selected B2C
      if (userData?.user_type === 'N' && selectedJoinType === 'b2c') {
        console.log('✅ AppNavigator: Allowing B2C access for new user signup');
        return <B2CStack key="b2c" />;
      }
      // B2C not allowed - redirect to first allowed dashboard
      const firstAllowed = allowedDashboards[0];
      if (firstAllowed) {
        console.log(`⚠️ B2C mode not allowed. Redirecting to ${firstAllowed}`);
        // The useEffect above will handle the redirect
        return <B2BStack key="b2b-redirect" />;
      }
    }
    return <B2CStack key="b2c" />;
  }

  // Default fallback - render B2C
  return <B2CStack key="b2c" />;
};

export const AppNavigator = () => {
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [showAuthFlow, setShowAuthFlow] = useState(true);
  const [initialAuthRoute, setInitialAuthRoute] =
    useState<keyof AuthStackParamList>('SelectLanguage');

  useEffect(() => {
    const bootstrap = async () => {
      try {
        // Read all AsyncStorage items in parallel for faster loading
        const [languageSet, storedLanguage, joinAsShown, userLoggedIn] = await Promise.all([
          AsyncStorage.getItem('@app_language_set'),
          AsyncStorage.getItem('@app_language'),
          AsyncStorage.getItem('@join_as_shown'),
          isLoggedIn()
        ]);

        if (userLoggedIn) {
          setShowAuthFlow(false);
        } else if (languageSet !== 'true' && storedLanguage === null) {
          setInitialAuthRoute('SelectLanguage');
          setShowAuthFlow(true);
        } else if (joinAsShown !== 'true') {
          setInitialAuthRoute('JoinAs');
          setShowAuthFlow(true);
        } else if (!userLoggedIn) {
          setInitialAuthRoute('Login');
          setShowAuthFlow(true);
        } else {
          setShowAuthFlow(false);
        }
      } catch (error) {
        setInitialAuthRoute('SelectLanguage');
        setShowAuthFlow(true);
      } finally {
        setIsBootstrapping(false);
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    const sub1 = DeviceEventEmitter.addListener('FORCE_LOGOUT', () => {
      setShowAuthFlow(true);
      setInitialAuthRoute('JoinAs');
    });
    
    // Listen for navigate to JoinAs event (without logging out)
    const sub2 = DeviceEventEmitter.addListener('NAVIGATE_TO_JOIN_AS', () => {
      setShowAuthFlow(true);
      setInitialAuthRoute('JoinAs');
    });
    
    // Listen for switch signup type event (for logged-in users with type 'N')
    const sub3 = DeviceEventEmitter.addListener('SWITCH_SIGNUP_TYPE', () => {
      // Close auth flow to show main app with new signup type
      setShowAuthFlow(false);
    });
    
    return () => {
      sub1.remove();
      sub2.remove();
      sub3.remove();
    };
  }, []);

  const handleAuthComplete = useCallback(() => {
    setShowAuthFlow(false);
  }, []);

  // Keep screen blank while bootstrapping to avoid flashing auth screens
  if (isBootstrapping) {
    return null;
  }

  if (showAuthFlow) {
  return (
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="AuthFlow">
          {() => (
            <AuthStack
              initialRouteName={initialAuthRoute}
              onAuthComplete={handleAuthComplete}
            />
          )}
        </RootStack.Screen>
      </RootStack.Navigator>
    );
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="MainApp" component={MainAppScreen} />
    </RootStack.Navigator>
  );
};
