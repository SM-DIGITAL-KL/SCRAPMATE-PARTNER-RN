import React, { useMemo, useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  Animated,
  Easing,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { useTabBar } from '../../context/TabBarContext';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { submitB2BSignup, B2BSignupData } from '../../services/api/v2/b2bSignup';
import { Alert } from 'react-native';

const DealerSignupScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { setTabBarVisible } = useTabBar();
  const buttonTranslateY = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  // Form state
  const [companyName, setCompanyName] = useState('');
  const [gstNumber, setGstNumber] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactNumber, setContactNumber] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [userData, setUserData] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Function to hide UI (tab bar and button)
  const hideUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(false);
        Animated.parallel([
          Animated.timing(buttonTranslateY, {
            toValue: 100,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Function to show UI (tab bar and button)
  const showUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(true);
        Animated.parallel([
          Animated.timing(buttonTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Show UI when keyboard closes
  useEffect(() => {
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        showUI();
      }
    );

    return () => {
      hideSubscription.remove();
    };
  }, [showUI]);

  // Restore tab bar visibility when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Restore tab bar when leaving screen
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>{t('dealerSignup.title')}</AutoText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 100 } // Add padding at bottom for button
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled={true}
          contentInsetAdjustmentBehavior="automatic"
        >
          {/* Company Information */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('dealerSignup.companyInformation')}</AutoText>
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.companyNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={companyName}
              onChangeText={setCompanyName}
              onFocus={hideUI}
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.gstNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={gstNumber}
              onChangeText={setGstNumber}
              onFocus={hideUI}
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.panNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={panNumber}
              onChangeText={setPanNumber}
              onFocus={hideUI}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('dealerSignup.businessAddressPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={businessAddress}
              onChangeText={setBusinessAddress}
              multiline
              numberOfLines={3}
              onFocus={hideUI}
            />
          </View>

          {/* Contact Person Details */}
          <View style={styles.section}>
            <AutoText style={styles.sectionTitle}>{t('dealerSignup.contactPersonDetails')}</AutoText>
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.contactPersonNamePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={contactPersonName}
              onChangeText={setContactPersonName}
              onFocus={hideUI}
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.contactNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={contactNumber}
              onChangeText={setContactNumber}
              keyboardType="phone-pad"
              onFocus={hideUI}
            />
            <TextInput
              style={styles.input}
              placeholder={t('dealerSignup.emailPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={contactEmail}
              onChangeText={setContactEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={hideUI}
            />
          </View>
        </ScrollView>

        {/* Next Button */}
        <Animated.View
          style={[
            styles.bottomButtonContainer,
            {
              transform: [{ translateY: buttonTranslateY }],
              opacity: buttonOpacity,
            },
          ]}
        >
          <GreenButton
            title={t('common.next')}
            onPress={async () => {
              // Pass form data to DocumentUpload screen
              navigation.navigate('DocumentUpload', {
                signupData: {
                  companyName,
                  gstNumber,
                  panNumber,
                  businessAddress,
                  contactPersonName,
                  contactNumber,
                  contactEmail,
                },
              });
            }}
            disabled={isSubmitting}
          />
        </Animated.View>
      </KeyboardAvoidingView>
    </View>
  );
};

const getStyles = (theme: any, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    backButton: {
      width: 24,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      paddingHorizontal: '18@s',
      paddingTop: '18@vs',
      paddingBottom: '100@vs',
    },
    section: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '16@s',
      marginBottom: '18@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '14@vs',
    },
    input: {
      height: '52@vs',
      borderWidth: 1,
      borderRadius: '14@ms',
      borderColor: theme.border,
      paddingHorizontal: '14@s',
      marginBottom: '14@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    textArea: {
      height: '80@vs',
      textAlignVertical: 'top',
      paddingTop: '14@vs',
    },
    bottomButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: '18@vs',
      paddingHorizontal: '18@s',
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
  });

export default DealerSignupScreen;
