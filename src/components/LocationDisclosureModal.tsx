import React, { useMemo } from 'react';
import {
  View,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { AutoText } from './AutoText';
import { useTheme } from './ThemeProvider';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';

interface LocationDisclosureModalProps {
  visible: boolean;
  onAccept: () => void;
  onDecline: () => void;
}

/**
 * Prominent Disclosure Modal for Background Location Permission
 * Required by Google Play Store policy when using ACCESS_BACKGROUND_LOCATION
 * 
 * This modal must be shown BEFORE requesting background location permission.
 * It explains why background location is needed and how it's used.
 */
const LocationDisclosureModal: React.FC<LocationDisclosureModalProps> = ({
  visible,
  onAccept,
  onDecline,
}) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, isDark, themeName), [theme, isDark, themeName]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={onDecline}
    >
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header Icon */}
          <View style={styles.iconContainer}>
            <MaterialCommunityIcons
              name="map-marker-radius"
              size={64}
              color={theme.primary}
            />
          </View>

          {/* Title */}
          <AutoText style={styles.title}>
            {t('locationDisclosure.title') || 'Location Access Required'}
          </AutoText>

          {/* Main Disclosure Text */}
          <View style={styles.disclosureSection}>
            <AutoText style={styles.disclosureTitle}>
              {t('locationDisclosure.disclosureTitle') || 'Why we need your location'}
            </AutoText>
            
            <AutoText style={styles.disclosureText}>
              {t('locationDisclosure.disclosureText') || 
                'This app needs access to your location to provide the following features:\n\n' +
                '• Track your location during order pickups and deliveries\n' +
                '• Show your current location on maps\n' +
                '• Enable real-time location sharing with customers\n' +
                '• Provide accurate delivery tracking\n\n' +
                'Your location is only used when you are actively using the app for order-related activities. ' +
                'We do not track your location when the app is not in use for order purposes.'}
            </AutoText>
          </View>

          {/* Background Location Explanation */}
          <View style={styles.backgroundSection}>
            <AutoText style={styles.backgroundTitle}>
              {t('locationDisclosure.backgroundTitle') || 'Background Location Access'}
            </AutoText>
            
            <AutoText style={styles.backgroundText}>
              {t('locationDisclosure.backgroundText') || 
                'We may need to access your location in the background when you are actively completing an order pickup or delivery. ' +
                'This allows us to provide real-time tracking to customers even when the app is minimized. ' +
                'Location tracking stops automatically when the order is completed.'}
            </AutoText>
          </View>

          {/* Privacy Note */}
          <View style={styles.privacySection}>
            <MaterialCommunityIcons
              name="shield-check"
              size={20}
              color={theme.primary}
              style={styles.privacyIcon}
            />
            <AutoText style={styles.privacyText}>
              {t('locationDisclosure.privacyText') || 
                'Your location data is only used for order tracking and is not shared with third parties. ' +
                'You can revoke this permission at any time in your device settings.'}
            </AutoText>
          </View>
        </ScrollView>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.declineButton, { borderColor: theme.border }]}
            onPress={onDecline}
            activeOpacity={0.7}
          >
            <AutoText style={[styles.declineButtonText, { color: theme.textPrimary }]}>
              {t('locationDisclosure.decline') || 'Not Now'}
            </AutoText>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.acceptButton, { backgroundColor: theme.primary }]}
            onPress={onAccept}
            activeOpacity={0.7}
          >
            <AutoText style={styles.acceptButtonText}>
              {t('locationDisclosure.accept') || 'Continue'}
            </AutoText>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const getStyles = (theme: any, isDark: boolean, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollContent: {
      padding: '20@s',
      paddingBottom: '40@vs',
    },
    iconContainer: {
      alignItems: 'center',
      marginTop: '20@vs',
      marginBottom: '24@vs',
    },
    title: {
      fontSize: '24@s',
      fontWeight: '700',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: '32@vs',
      fontFamily: 'Poppins-Bold',
    },
    disclosureSection: {
      marginBottom: '24@vs',
    },
    disclosureTitle: {
      fontSize: '18@s',
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: '12@vs',
      fontFamily: 'Poppins-SemiBold',
    },
    disclosureText: {
      fontSize: '15@s',
      lineHeight: '24@s',
      color: theme.textPrimary,
      fontFamily: 'Poppins-Regular',
    },
    backgroundSection: {
      backgroundColor: theme.cardBackground || theme.card,
      padding: '16@s',
      borderRadius: '12@ms',
      marginBottom: '24@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    backgroundTitle: {
      fontSize: '16@s',
      fontWeight: '600',
      color: theme.primary,
      marginBottom: '8@vs',
      fontFamily: 'Poppins-SemiBold',
    },
    backgroundText: {
      fontSize: '14@s',
      lineHeight: '20@s',
      color: theme.textPrimary,
      fontFamily: 'Poppins-Regular',
    },
    privacySection: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: themeName === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.05)',
      padding: '16@s',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.primary + '40',
    },
    privacyIcon: {
      marginRight: '12@s',
      marginTop: '2@vs',
    },
    privacyText: {
      flex: 1,
      fontSize: '13@s',
      lineHeight: '18@s',
      color: theme.textPrimary,
      fontFamily: 'Poppins-Regular',
    },
    buttonContainer: {
      flexDirection: 'row',
      padding: '20@s',
      paddingTop: '16@vs',
      gap: '12@s',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.background,
    },
    declineButton: {
      flex: 1,
      paddingVertical: '16@vs',
      borderRadius: '12@ms',
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    declineButtonText: {
      fontSize: '16@s',
      fontWeight: '600',
      fontFamily: 'Poppins-SemiBold',
    },
    acceptButton: {
      flex: 1,
      paddingVertical: '16@vs',
      borderRadius: '12@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    acceptButtonText: {
      fontSize: '16@s',
      fontWeight: '600',
      color: '#FFFFFF',
      fontFamily: 'Poppins-SemiBold',
    },
  });

export default LocationDisclosureModal;

