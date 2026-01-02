import React from 'react';
import { Modal, View, TouchableOpacity, Platform, Linking } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AutoText } from './AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from './ThemeProvider';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTranslation } from 'react-i18next';
import { queryClient } from '../services/api/queryClient';
import { logout } from '../services/auth/authService';

interface UpdateModalProps {
  visible: boolean;
  latestVersion: string;
  onUpdate: () => void;
}

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.app.scrapmatepartner';

export const UpdateModal: React.FC<UpdateModalProps> = ({ visible, latestVersion, onUpdate }) => {
  const { theme, isDark } = useTheme();
  const { t } = useTranslation();
  const styles = getStyles(theme, isDark);

  React.useEffect(() => {
    console.log('🎯 UpdateModal - visible:', visible, 'latestVersion:', latestVersion);
  }, [visible, latestVersion]);

  const handleUpdate = async () => {
    try {
      console.log('🧹 Clearing all AsyncStorage, caches, and logging out before update...');
      
      // Perform logout first (this clears auth data and AsyncStorage)
      try {
        await logout();
        console.log('✅ Logout completed - auth data cleared');
      } catch (logoutError) {
        console.error('Error during logout:', logoutError);
        // If logout fails, still try to clear AsyncStorage manually
        try {
          await AsyncStorage.clear();
          console.log('✅ AsyncStorage cleared manually after logout error');
        } catch (storageError) {
          console.error('Error clearing AsyncStorage:', storageError);
        }
      }
      
      // Clear React Query cache
      try {
        queryClient.clear();
        console.log('✅ React Query cache cleared');
      } catch (cacheError) {
        console.error('Error clearing query cache:', cacheError);
      }
      
      // Clear persisted query cache from AsyncStorage if it exists
      try {
        await AsyncStorage.removeItem('REACT_QUERY_OFFLINE_CACHE');
        console.log('✅ React Query persisted cache cleared');
      } catch (persistedCacheError) {
        console.error('Error clearing persisted cache:', persistedCacheError);
      }
      
      console.log('✅ All caches cleared and logout completed. Opening Play Store...');
      
      const url = Platform.OS === 'android' ? PLAY_STORE_URL : undefined;
      if (url) {
        const supported = await Linking.canOpenURL(url);
        if (supported) {
          await Linking.openURL(url);
          onUpdate();
        }
      }
    } catch (error) {
      console.error('Error during update process:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={() => {}} // Prevent back button from closing (forced update)
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons name="update" size={48} color={theme.primary} />
          </View>
          
          <AutoText style={styles.title}>
            {t('updateModal.title') !== 'updateModal.title' 
              ? t('updateModal.title') 
              : 'Update Available'}
          </AutoText>
          
          <View style={styles.messageContainer}>
            <AutoText style={styles.message}>
              {t('updateModal.message') !== 'updateModal.message'
                ? t('updateModal.message', { version: latestVersion })
                : `A new version (v${latestVersion}) of ScrapMate Partner is now available on the Play Store.\n\nThis update includes important bug fixes, performance improvements, and new features that will enhance your experience.\n\nPlease update to the latest version to continue using the app and enjoy the latest improvements.`}
            </AutoText>
          </View>
          
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdate}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={[theme.primary, theme.secondary, theme.accent]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.updateButtonGradient}
            >
              <MaterialCommunityIcons name="download" size={20} color="#FFFFFF" />
              <AutoText style={styles.updateButtonText}>
                {t('updateModal.updateButton') !== 'updateModal.updateButton'
                  ? t('updateModal.updateButton')
                  : 'Update Now'}
              </AutoText>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme: any, isDark: boolean) =>
  ScaledSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20@s',
    },
    modalContent: {
      backgroundColor: theme.card,
      borderRadius: '16@s',
      padding: '24@s',
      width: '100%',
      maxWidth: '400@s',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    iconContainer: {
      marginBottom: '16@vs',
    },
    title: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '20@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
      textAlign: 'center',
    },
    messageContainer: {
      width: '100%',
      marginBottom: '24@vs',
      paddingHorizontal: '4@s',
    },
    message: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: '22@s',
      flexWrap: 'wrap',
    },
    updateButton: {
      width: '100%',
      borderRadius: '12@s',
      overflow: 'hidden',
    },
    updateButtonGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: '14@vs',
      paddingHorizontal: '24@s',
      gap: '8@s',
    },
    updateButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: '#FFFFFF',
    },
  });

