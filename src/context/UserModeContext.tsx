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
        const storedMode = await AsyncStorage.getItem(STORAGE_KEY);
        if (
          storedMode === 'b2c' ||
          storedMode === 'b2b' ||
          storedMode === 'delivery'
        ) {
          setModeState(storedMode as UserMode);
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
    setModeState(newMode);
    await AsyncStorage.setItem(STORAGE_KEY, newMode);
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

