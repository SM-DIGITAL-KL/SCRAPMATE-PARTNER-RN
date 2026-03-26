import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkForUpdate } from '../services/api/v2/appVersion';

const LAST_UPDATE_CHECK_KEY = '@last_update_check';
const UPDATE_CHECK_INTERVAL = 0; // Disable throttling for testing - change back to 1000 * 60 * 60 * 4 for production

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const isCheckingRef = useRef(false);

  const checkUpdate = useCallback(async (forceCheck: boolean = false) => {
    // Skip update check on iOS
    if (Platform.OS === 'ios') {
      console.log('⏭️ Skipping update check on iOS');
      setShowUpdateModal(false);
      return;
    }
    try {
      if (isCheckingRef.current) {
        return;
      }

      isCheckingRef.current = true;
      setIsChecking(true);

      // Check if we need to check again (throttle checks)
      if (!forceCheck) {
        const lastCheck = await AsyncStorage.getItem(LAST_UPDATE_CHECK_KEY);
        if (lastCheck) {
          const lastCheckTime = parseInt(lastCheck, 10);
          const now = Date.now();
          if (now - lastCheckTime < UPDATE_CHECK_INTERVAL) {
            console.log('⏭️ Skipping update check - checked recently');
            setIsChecking(false);
            return;
          }
        }
      }

      console.log('🔍 Checking for app updates...');
      const result = await checkForUpdate();
      
      console.log(`📱 Update check result:`, {
        current: result.currentVersion,
        latest: result.latestVersion,
        updateAvailable: result.updateAvailable,
      });

      if (result.updateAvailable) {
        console.log(`✅ Update available! Latest: ${result.latestVersion}, Current: ${result.currentVersion}`);
        setLatestVersion(result.latestVersion);
        setUpdateAvailable(true);
        setShowUpdateModal(true);
        console.log(`🎯 Setting showUpdateModal to: true`);
      } else {
        setUpdateAvailable(false);
        setShowUpdateModal(false);
        console.log(`ℹ️ App is up to date. Current: ${result.currentVersion}, Latest: ${result.latestVersion}`);
      }

      // Store last check time
      await AsyncStorage.setItem(LAST_UPDATE_CHECK_KEY, Date.now().toString());
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      // Keep existing UI state on transient failures; next retry can recover.
    } finally {
      isCheckingRef.current = false;
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Check for updates on mount (only on Android)
    if (Platform.OS !== 'android') return;

    checkUpdate(true);

    // Retry shortly after startup to handle API/session not-ready timing.
    const retry1 = setTimeout(() => checkUpdate(true), 5000);
    const retry2 = setTimeout(() => checkUpdate(true), 20000);

    return () => {
      clearTimeout(retry1);
      clearTimeout(retry2);
    };
  }, [checkUpdate]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        checkUpdate(false);
      }
    });

    return () => subscription.remove();
  }, [checkUpdate]);

  return {
    updateAvailable,
    latestVersion,
    isChecking,
    showUpdateModal,
    setShowUpdateModal,
    checkUpdate,
  };
};
