import React, { useMemo, useEffect, useRef } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, Animated, Easing } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../components/ThemeProvider';
import { useTabBar } from '../context/TabBarContext';
import DashboardScreen from '../screens/B2C/DashboardScreen';
import PlaceholderScreen from '../screens/Placeholder/PlaceholderScreen';

export type MainTabParamList = {
  Home: undefined;
  Schedule: undefined;
  Center: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<MainTabParamList>();

const MainTabNavigator = () => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { isTabBarVisible } = useTabBar();
  const tabBarHeight = Platform.OS === 'ios' ? 72 + insets.bottom : 72;
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isTabBarVisible) {
      // Show animation - slide up and fade in
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Hide animation - slide down and fade out
      Animated.parallel([
        Animated.timing(translateY, {
          toValue: tabBarHeight,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0,
          duration: 500,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [isTabBarVisible, translateY, opacity, tabBarHeight]);

  const animatedTabBarStyle = useMemo(() => {
    // When hidden, match screen background to blend seamlessly
    const isHidden = !isTabBarVisible;
    // Use card background to match screen and prevent black flash
    // In light mode: card is white (matches tab bar)
    // In dark mode: card is dark gray (close to black tab bar)
    return {
      height: isHidden ? 0 : tabBarHeight,
      borderTopWidth: 0,
      paddingTop: isHidden ? 0 : 8,
      paddingBottom: isHidden ? 0 : (Platform.OS === 'ios' ? insets.bottom : 16),
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card, // Use white for Lavender Dream, otherwise card
      transform: [{ translateY }],
      opacity,
      pointerEvents: isTabBarVisible ? 'auto' : 'none' as 'auto' | 'none',
      elevation: isTabBarVisible ? 8 : 0,
      shadowOpacity: isHidden ? 0 : 0.1,
      overflow: 'hidden' as const,
    };
  }, [tabBarHeight, insets.bottom, theme.card, themeName, translateY, opacity, isTabBarVisible]);

  const tabBarStyle = animatedTabBarStyle as any;

  // Make screenOptions reactive to theme changes
  const screenOptions = useMemo(() => ({
    headerShown: false,
    tabBarActiveTintColor: isDark ? '#f0fef4' : theme.primary,
    tabBarInactiveTintColor: isDark ? '#feffff' : theme.textSecondary,
    tabBarStyle,
    tabBarLabelStyle: {
      fontFamily: 'Poppins-Medium',
      fontSize: 12,
    },
  }), [isDark, theme.primary, theme.textSecondary, tabBarStyle]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...screenOptions,
        tabBarIcon: ({ color, size }) => {
          const iconMap: Record<keyof MainTabParamList, string> = {
            Home: 'home-variant',
            Schedule: 'calendar',
            Center: 'trash-can-outline',
            Profile: 'account',
          };

          const iconName = iconMap[route.name as keyof MainTabParamList];

          return (
            <MaterialCommunityIcons name={iconName} size={size ?? 24} color={color} />
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={DashboardScreen} />
      <Tab.Screen name="Schedule" component={PlaceholderScreen} />
      <Tab.Screen name="Center" component={PlaceholderScreen} />
      <Tab.Screen name="Profile" component={PlaceholderScreen} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;

