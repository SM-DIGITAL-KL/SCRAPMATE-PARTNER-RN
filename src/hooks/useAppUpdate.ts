import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkForUpdate } from '../services/api/v2/appVersion';

const LAST_UPDATE_CHECK_KEY = '@last_update_check';
const UPDATE_CHECK_INTERVAL = 0; // Disable throttling for testing - change back to 1000 * 60 * 60 * 4 for production

export const useAppUpdate = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState('');
  const [isChecking, setIsChecking] = useState(false);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  const checkUpdate = useCallback(async (forceCheck: boolean = false) => {
    try {
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
      // Don't show error to user, just log it
      setUpdateAvailable(false);
      setShowUpdateModal(false);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    // Check for updates on mount
    checkUpdate(false);
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

