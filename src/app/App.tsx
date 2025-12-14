import React, { useEffect, useMemo } from 'react';
import { StatusBar, Platform, NativeModules, View, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { QueryClientProvider, focusManager } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import { TabBarProvider } from '../context/TabBarContext';
import { UserModeProvider } from '../context/UserModeContext';
import { AppNavigator } from '../navigation/AppNavigator';
import { getStoredLanguage } from '../i18n/config';
import { queryClient } from '../services/api/queryClient';
import { KeyboardProvider } from '../components/KeyboardProvider';
import '../i18n/config';

// Optional: Use PersistQueryClientProvider if persistence is needed
// Install: npm install @tanstack/react-query-persist-client @tanstack/query-async-storage-persister
let PersistQueryClientProvider: any = null;
let asyncStoragePersister: any = null;

try {
  const persistClient = require('@tanstack/react-query-persist-client');
  PersistQueryClientProvider = persistClient.PersistQueryClientProvider;
  const { queryClient: qc, asyncStoragePersister: persister } = require('../services/api/queryClient');
  asyncStoragePersister = persister;
} catch (e) {
  // Persistence not available, will use regular QueryClientProvider
  console.warn('React Query persistence not available. Using standard QueryClientProvider.');
}

const { NavigationBarModule } = NativeModules;

const AppContent = () => {
  const { isDark, theme } = useTheme();

  useEffect(() => {
    if (Platform.OS === 'android' && NavigationBarModule?.setNavigationBarColor) {
      const navBarColor = isDark ? theme.background : '#FFFFFF';
      NavigationBarModule.setNavigationBarColor(navBarColor);
    }
  }, [isDark, theme.background]);

  // Make NavigationContainer theme reactive to theme changes
  const navigationTheme = useMemo(() => ({
    dark: isDark,
    colors: {
      primary: theme.primary,
      background: theme.background,
      card: theme.card,
      text: theme.textPrimary,
      border: theme.border,
      notification: theme.primary,
    },
    fonts: {
      regular: {
        fontFamily: 'Poppins-Regular',
        fontWeight: '400' as any,
      },
      medium: {
        fontFamily: 'Poppins-Medium',
        fontWeight: '500' as any,
      },
      bold: {
        fontFamily: 'Poppins-SemiBold',
        fontWeight: '600' as any,
      },
      heavy: {
        fontFamily: 'Poppins-Bold',
        fontWeight: '700' as any,
      },
    },
  }), [isDark, theme.primary, theme.background, theme.card, theme.textPrimary, theme.border]);

  const statusBarBackground = isDark ? theme.background : '#FFFFFF';
  const statusBarStyle = isDark ? 'light-content' : 'dark-content';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <SafeAreaProvider>
        <StatusBar 
          barStyle={statusBarStyle}
          backgroundColor={statusBarBackground}
          translucent={false}
        />
        <NavigationContainer 
          theme={navigationTheme}
          style={{ backgroundColor: theme.background }}
        >
          <AppNavigator />
        </NavigationContainer>
      </SafeAreaProvider>
    </View>
  );
};

const App = () => {
  useEffect(() => {
    // Initialize language from storage
    getStoredLanguage().then(language => {
      // Language is already set in i18n config
    });
  }, []);

  // KeyboardProvider is always available from our custom module
  const AppWrapper = KeyboardProvider;

  // Use PersistQueryClientProvider if available, otherwise fallback to QueryClientProvider
  const QueryProvider = PersistQueryClientProvider && asyncStoragePersister
    ? PersistQueryClientProvider
    : QueryClientProvider;

  const [isCacheHydrated, setIsCacheHydrated] = React.useState(!PersistQueryClientProvider || !asyncStoragePersister);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryProvider
        client={queryClient}
        {...(PersistQueryClientProvider && asyncStoragePersister
          ? {
              persistOptions: {
                persister: asyncStoragePersister,
                maxAge: 1000 * 60 * 60 * 24,
                buster: '',
              },
              onSuccess: () => {
                setIsCacheHydrated(true);
              },
            }
          : {})}
      >
        {isCacheHydrated ? (
          <AppWrapper>
            <ThemeProvider>
              <UserModeProvider>
                <TabBarProvider>
                  <AppContent />
                </TabBarProvider>
              </UserModeProvider>
            </ThemeProvider>
          </AppWrapper>
        ) : null}
      </QueryProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;

