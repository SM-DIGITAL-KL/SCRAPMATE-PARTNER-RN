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
        
        // IMPORTANT: If user_type is 'N', DO NOT load from AsyncStorage
        // User can change join type anytime - mode is set by JoinAs/Login screens
        if (userType === 'N') {
          console.log('✅ UserModeContext: User type is N (new_user) - NOT loading from AsyncStorage');
          // Default to 'b2c' if no mode is set yet (will be set by JoinAs/Login)
          setModeState('b2c');
        } else if (userType === 'D') {
          // If user_type is 'D' (Delivery), always set mode to delivery
          console.log('✅ UserModeContext: User type is D (Delivery) - setting mode to delivery');
          setModeState('delivery');
          await AsyncStorage.setItem(STORAGE_KEY, 'delivery');
        } else {
          // Otherwise, use stored mode (for registered users)
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
      // Check if user is logged in first
      const { isLoggedIn, getUserData } = await import('../services/auth/authService');
      const loggedIn = await isLoggedIn();
      
      // If user is not logged in, don't store in AsyncStorage
      // This prevents saving join type for users who haven't logged in yet
      if (!loggedIn) {
        console.log('✅ UserModeContext.setMode: User not logged in - NOT storing in AsyncStorage');
        console.log(`   Setting mode to: ${newMode} (in memory only)`);
        setModeState(newMode);
        return;
      }
      
      // User is logged in - check user_type
      const userData = await getUserData();
      const userType = userData?.user_type;
      
      // IMPORTANT: If user_type is 'N', DO NOT store in AsyncStorage
      // User can change join type anytime - only update state
      if (userType === 'N') {
        console.log('✅ UserModeContext.setMode: User type is N (new_user) - NOT storing in AsyncStorage');
        console.log(`   Setting mode to: ${newMode} (in memory only)`);
        setModeState(newMode);
      } else if (userType === 'D') {
        // If user_type is 'D' (Delivery), always set mode to delivery regardless of requested mode
        console.log('✅ UserModeContext.setMode: User type is D (Delivery) - forcing delivery mode');
        console.log(`   Requested mode was: ${newMode}, but forcing to: delivery`);
        setModeState('delivery');
        await AsyncStorage.setItem(STORAGE_KEY, 'delivery');
      } else {
        // For registered users (not 'N' and not 'D'), allow mode change and store it
        setModeState(newMode);
        await AsyncStorage.setItem(STORAGE_KEY, newMode);
      }
    } catch (error) {
      console.error('Error in setMode:', error);
      // Fallback: set mode anyway if we can't check user_type
      setModeState(newMode);
      // Only store if we can verify user is logged in and user_type is not 'N'
      try {
        const { isLoggedIn, getUserData } = await import('../services/auth/authService');
        const loggedIn = await isLoggedIn();
        if (loggedIn) {
        const userData = await getUserData();
        if (userData?.user_type !== 'N') {
          await AsyncStorage.setItem(STORAGE_KEY, newMode);
          } else {
            console.log('⚠️ UserModeContext.setMode: User type is N, not storing in AsyncStorage');
          }
        } else {
          console.log('⚠️ UserModeContext.setMode: User not logged in, not storing in AsyncStorage');
        }
      } catch (e) {
        // If we can't check, don't store (safer for new users)
        console.log('⚠️ UserModeContext.setMode: Could not verify user status, not storing in AsyncStorage');
      }
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

