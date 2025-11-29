import React, { createContext, useContext, useState, useMemo, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { lightTheme, darkTheme, darkGreenTheme, whitePurpleTheme } from '../theme';

type Theme = typeof lightTheme;
export type ThemeName = 'light' | 'dark' | 'darkGreen' | 'whitePurple';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  themeName: ThemeName;
  setTheme: (themeName: ThemeName) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_STORAGE_KEY = '@app_theme';

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const systemColorScheme = useColorScheme();
  const [themeName, setThemeName] = useState<ThemeName>('darkGreen'); // Default to forest night
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Load saved theme preference
    AsyncStorage.getItem(THEME_STORAGE_KEY).then(savedTheme => {
      if (savedTheme !== null && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'darkGreen' || savedTheme === 'whitePurple')) {
        setThemeName(savedTheme as ThemeName);
      } else {
        // If no saved theme, set default to darkGreen and save it
        setThemeName('darkGreen');
        AsyncStorage.setItem(THEME_STORAGE_KEY, 'darkGreen');
      }
      setIsLoading(false);
    });
  }, []);

  const theme = useMemo(() => {
    switch (themeName) {
      case 'light':
        return lightTheme;
      case 'dark':
        return darkTheme;
      case 'darkGreen':
        return darkGreenTheme;
      case 'whitePurple':
        return whitePurpleTheme;
      default:
        return darkGreenTheme; // Default to forest night
    }
  }, [themeName]);

  const isDark = themeName === 'dark' || themeName === 'darkGreen';

  const setTheme = async (newThemeName: ThemeName) => {
    setThemeName(newThemeName);
    await AsyncStorage.setItem(THEME_STORAGE_KEY, newThemeName);
  };

  const toggleTheme = () => {
    // Cycle through: light -> dark -> darkGreen -> whitePurple -> light
    const themeCycle: ThemeName[] = ['light', 'dark', 'darkGreen', 'whitePurple'];
    const currentIndex = themeCycle.indexOf(themeName);
    const nextIndex = (currentIndex + 1) % themeCycle.length;
    setTheme(themeCycle[nextIndex]);
  };

  if (isLoading) {
    // Return a minimal view with background to prevent black screen
    return (
      <ThemeContext.Provider
        value={{ theme, isDark, themeName, setTheme, toggleTheme }}
      >
        {children}
      </ThemeContext.Provider>
    );
  }

  return (
    <ThemeContext.Provider
      value={{ theme, isDark, themeName, setTheme, toggleTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

