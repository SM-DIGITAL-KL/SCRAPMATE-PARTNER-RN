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
        } else if (userType === 'SR') {
          // For SR users, check approval status - if pending/missing, default to B2C
          try {
            const { getProfile } = await import('../services/api/v2/profile');
            const profile = await getProfile(userData?.id);
            const approvalStatus = profile?.shop?.approval_status;
            
            console.log(`🔍 UserModeContext: SR user - checking approval status:`, approvalStatus);
            console.log(`🔍 UserModeContext: SR user - shop data exists:`, !!profile?.shop);
            
            // If approval status is 'pending' OR null/undefined OR shop data is missing, use B2C mode
            const isPendingOrMissing = approvalStatus === 'pending' || 
                                      approvalStatus === null || 
                                      approvalStatus === undefined || 
                                      !profile?.shop || 
                                      !profile?.shop?.id;
            
            if (isPendingOrMissing) {
              console.log(`✅ UserModeContext: SR user with pending/missing approval - setting mode to B2C`);
              setModeState('b2c');
              await AsyncStorage.setItem(STORAGE_KEY, 'b2c');
            } else if (approvalStatus === 'approved') {
              // Approved SR users can use stored mode (likely B2B)
              const storedMode = await AsyncStorage.getItem(STORAGE_KEY);
              if (
                storedMode === 'b2c' ||
                storedMode === 'b2b' ||
                storedMode === 'delivery'
              ) {
                console.log(`✅ UserModeContext: SR user with approved status - using stored mode: ${storedMode}`);
                setModeState(storedMode as UserMode);
              } else {
                // Default to B2B for approved SR users if no stored mode
                console.log(`✅ UserModeContext: SR user with approved status - defaulting to B2B`);
                setModeState('b2b');
                await AsyncStorage.setItem(STORAGE_KEY, 'b2b');
              }
            } else {
              // Unknown status, default to B2C
              console.log(`✅ UserModeContext: SR user with unknown approval status - defaulting to B2C`);
              setModeState('b2c');
              await AsyncStorage.setItem(STORAGE_KEY, 'b2c');
            }
          } catch (error) {
            console.warn('⚠️ UserModeContext: Failed to fetch profile for SR user, defaulting to B2C:', error);
            // If profile fetch fails, default to B2C as safe default
            setModeState('b2c');
            await AsyncStorage.setItem(STORAGE_KEY, 'b2c');
          }
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
      } else if (userType === 'SR' && newMode === 'b2b') {
        // For SR users trying to set B2B mode, check B2B shop's approval status specifically
        try {
          const { getProfile } = await import('../services/api/v2/profile');
          const profile = await getProfile(userData?.id);
          const b2bShop = (profile as any)?.b2bShop;
          const shop = profile?.shop as any;
          
          console.log(`🔍 UserModeContext.setMode: SR user trying to set B2B mode - checking B2B shop approval status`);
          console.log(`🔍 UserModeContext.setMode: SR user - b2bShop exists:`, !!b2bShop);
          console.log(`🔍 UserModeContext.setMode: SR user - shop data exists:`, !!shop);
          
          let b2bApprovalStatus = null;
          
          // If we have separate b2bShop object, use it directly
          if (b2bShop && b2bShop.id) {
            b2bApprovalStatus = b2bShop.approval_status;
            console.log(`✅ UserModeContext.setMode: Using b2bShop.approval_status: ${b2bApprovalStatus}`);
          } else if (shop && shop.id) {
            // Fallback: Use merged shop data
            const shopType = shop?.shop_type;
            const isB2BShop = shopType === 1 || shopType === 4; // B2B shop types
            const hasB2BFields = shop?.company_name || shop?.gst_number || shop?.business_license_url;
            const approvalStatus = shop?.approval_status;
            
            if (isB2BShop) {
              // This is the B2B shop itself, use its approval_status
              b2bApprovalStatus = approvalStatus;
              console.log(`✅ UserModeContext.setMode: Shop is B2B shop (type ${shopType}), approval_status: ${b2bApprovalStatus}`);
            } else if (hasB2BFields && approvalStatus === 'approved') {
              // Shop has B2B fields and is approved
              // Since merged shop prioritizes B2B approval_status, if it's approved and has B2B fields, B2B is approved
              b2bApprovalStatus = 'approved';
              console.log(`✅ UserModeContext.setMode: Shop has B2B fields and is approved, B2B shop is approved`);
            } else if (hasB2BFields) {
              // Shop has B2B fields but approval_status is not approved (pending/rejected/null)
              // This means B2B shop is not approved
              b2bApprovalStatus = approvalStatus || 'pending';
              console.log(`✅ UserModeContext.setMode: Shop has B2B fields but approval_status is ${approvalStatus}, B2B shop is ${b2bApprovalStatus}`);
            } else {
              // No B2B fields - B2B shop might not exist or not be set up
              b2bApprovalStatus = 'pending';
              console.log(`✅ UserModeContext.setMode: No B2B fields found, B2B shop might not exist`);
            }
          } else {
            // No shop data at all
            console.log(`✅ UserModeContext.setMode: SR user with no shop data - forcing B2C mode`);
            setModeState('b2c');
            await AsyncStorage.setItem(STORAGE_KEY, 'b2c');
            return;
          }
          
          if (b2bApprovalStatus === 'approved') {
            // B2B shop is approved - allow B2B mode
            console.log(`✅ UserModeContext.setMode: SR user with B2B shop approved - allowing B2B mode`);
            setModeState('b2b');
            await AsyncStorage.setItem(STORAGE_KEY, 'b2b');
          } else {
            // B2B shop is not approved (pending/rejected/null) - force B2C mode
            console.log(`✅ UserModeContext.setMode: SR user with B2B shop status '${b2bApprovalStatus}' - forcing B2C mode`);
            setModeState('b2c');
            await AsyncStorage.setItem(STORAGE_KEY, 'b2c');
          }
        } catch (error) {
          console.warn('⚠️ UserModeContext.setMode: Failed to fetch profile for SR user, forcing B2C as safe default:', error);
          // If profile fetch fails, force B2C as safe default
          setModeState('b2c');
          await AsyncStorage.setItem(STORAGE_KEY, 'b2c');
        }
      } else if (userType === 'SR' && newMode === 'b2c') {
        // For SR users switching to B2C, always allow (B2C is the default/fallback)
        console.log(`✅ UserModeContext.setMode: SR user switching to B2C mode - allowing`);
        setModeState('b2c');
        await AsyncStorage.setItem(STORAGE_KEY, 'b2c');
      } else {
        // For registered users (not 'N', 'D', or 'SR' trying to set B2B), allow mode change and store it
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

