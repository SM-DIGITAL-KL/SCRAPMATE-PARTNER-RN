import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type UserMode = 'b2c' | 'b2b' | 'delivery';

interface UserModeContextValue {
  mode: UserMode;
  isModeReady: boolean;
  setMode: (mode: UserMode) => Promise<void>;
}

const STORAGE_KEY = '@selected_join_type';

const UserModeContext = createContext<UserModeContextValue | undefined>(
  undefined,
);

export const UserModeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [mode, setModeState] = useState<UserMode>('b2c');
  const [isModeReady, setIsModeReady] = useState(false);

  useEffect(() => {
    const loadMode = async () => {
      try {
        // Check user_type first - if 'D' (Delivery), force delivery mode
        const { getUserData } = await import('../services/auth/authService');
        const userData = await getUserData();
        const userType = userData?.user_type;
        
        // If user_type is 'D' (Delivery), always set mode to delivery
        if (userType === 'D') {
          console.log('✅ UserModeContext: User type is D (Delivery) - setting mode to delivery');
          setModeState('delivery');
          await AsyncStorage.setItem(STORAGE_KEY, 'delivery');
        } else {
          // Otherwise, use stored mode
          const storedMode = await AsyncStorage.getItem(STORAGE_KEY);
          if (
            storedMode === 'b2c' ||
            storedMode === 'b2b' ||
            storedMode === 'delivery'
          ) {
            setModeState(storedMode as UserMode);
          }
        }
      } catch (error) {
        console.error('Error loading mode:', error);
      } finally {
        // Set ready immediately to prevent black screen
        setIsModeReady(true);
      }
    };

    loadMode();
  }, []);

  const setMode = useCallback(async (newMode: UserMode) => {
    try {
      // Check user_type before setting mode - if 'D' (Delivery), always force delivery
      const { getUserData } = await import('../services/auth/authService');
      const userData = await getUserData();
      const userType = userData?.user_type;
      
      // If user_type is 'D' (Delivery), always set mode to delivery regardless of requested mode
      if (userType === 'D') {
        console.log('✅ UserModeContext.setMode: User type is D (Delivery) - forcing delivery mode');
        console.log(`   Requested mode was: ${newMode}, but forcing to: delivery`);
        setModeState('delivery');
        await AsyncStorage.setItem(STORAGE_KEY, 'delivery');
      } else {
        // For non-delivery users, allow mode change
        setModeState(newMode);
        await AsyncStorage.setItem(STORAGE_KEY, newMode);
      }
    } catch (error) {
      console.error('Error in setMode:', error);
      // Fallback: set mode anyway if we can't check user_type
      setModeState(newMode);
      await AsyncStorage.setItem(STORAGE_KEY, newMode);
    }
  }, []);

  return (
    <UserModeContext.Provider value={{ mode, isModeReady, setMode }}>
      {children}
    </UserModeContext.Provider>
  );
};

export const useUserMode = () => {
  const context = useContext(UserModeContext);
  if (!context) {
    throw new Error('useUserMode must be used within UserModeProvider');
  }
  return context;
};

