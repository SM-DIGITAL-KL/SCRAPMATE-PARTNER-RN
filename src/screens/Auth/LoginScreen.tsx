import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from '../../components/ThemeProvider';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTabBar } from '../../context/TabBarContext';
import { sendOtp, verifyOtp } from '../../services/api';
import { setAuthToken, setUserData } from '../../services/auth/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface LoginScreenProps {
  navigation?: any;
  onLoginSuccess?: (
    phoneNumber: string, 
    dashboardType: 'b2b' | 'b2c' | 'delivery',
    allowedDashboards?: ('b2b' | 'b2c' | 'delivery')[]
  ) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({
  navigation,
  onLoginSuccess,
}) => {
  const { theme, isDark } = useTheme();
  const { setTabBarVisible } = useTabBar();
  const styles = getStyles(theme, isDark);

  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [showOtp, setShowOtp] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [showOtpSentModal, setShowOtpSentModal] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null);

  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  // Hide tab bar when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setTabBarVisible(false);
      // Show tab bar when screen loses focus (cleanup)
      return () => {
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  // Countdown timer for resend OTP
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Auto-close OTP sent modal after 2 seconds
  useEffect(() => {
    if (showOtpSentModal) {
      const timer = setTimeout(() => {
        setShowOtpSentModal(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showOtpSentModal]);

  useEffect(() => {
    if (showOtp) {
      setTabBarVisible(false);
    }
  }, [showOtp, setTabBarVisible]);

  // Auto-fill OTP from API response
  useEffect(() => {
    if (receivedOtp && receivedOtp.length === 6 && showOtp) {
      // Split OTP into individual digits
      const otpDigits = receivedOtp.split('');
      setOtp(otpDigits);
      
      // Auto-verify OTP after a short delay to allow UI to update
      const autoVerifyTimer = setTimeout(() => {
        handleVerifyOtp(receivedOtp);
      }, 500);
      
      return () => clearTimeout(autoVerifyTimer);
    }
  }, [receivedOtp, showOtp, handleVerifyOtp]);

  // Validate phone number
  const validatePhoneNumber = (phone: string): boolean => {
    // Remove any non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    // Check if it's 10 digits (Indian phone number format)
    return cleaned.length === 10;
  };

  // Handle send OTP
  const handleSendOtp = async () => {
    const cleanedPhone = phoneNumber.replace(/\D/g, '');
    
    if (!validatePhoneNumber(phoneNumber)) {
      Alert.alert('Invalid Phone Number', 'Please enter a valid 10-digit phone number');
      return;
    }

    setIsLoading(true);
    try {
      const response = await sendOtp(cleanedPhone);
      
      if (response.status === 'success' && response.data) {
        // Store OTP from response (for development/testing)
        setReceivedOtp(response.data.otp);
        setIsNewUser(response.data.isNewUser);
        
        setOtpSent(true);
        setShowOtp(true);
        setCountdown(60); // 60 seconds countdown
        setShowOtpSentModal(true);
      } else {
        Alert.alert('Error', response.message || 'Failed to send OTP. Please try again.');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Handle OTP input change
  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (index === 5 && value && newOtp.every(digit => digit !== '')) {
      handleVerifyOtp(newOtp.join(''));
    }
  };

  // Handle OTP backspace
  const handleOtpKeyPress = (key: string, index: number) => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Handle verify OTP
  const handleVerifyOtp = useCallback(async (otpValue?: string) => {
    const otpString = otpValue || otp.join('');
    
    if (otpString.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit OTP');
      return;
    }

    setIsLoading(true);
    try {
      const cleanedPhone = phoneNumber.replace(/\D/g, '');
      
      // Get join type from AsyncStorage if new user
      let joinType: 'b2b' | 'b2c' | 'delivery' | undefined;
      if (isNewUser) {
        const storedJoinType = await AsyncStorage.getItem('@selected_join_type');
        if (storedJoinType === 'b2b' || storedJoinType === 'b2c' || storedJoinType === 'delivery') {
          joinType = storedJoinType as 'b2b' | 'b2c' | 'delivery';
        }
      }

      const response = await verifyOtp(cleanedPhone, otpString, joinType);
      
      if (response.status === 'success' && response.data) {
        // Store auth token and user data
        await setAuthToken(response.data.token);
        await setUserData(response.data.user);
        
        // Store dashboard type
        await AsyncStorage.setItem('@selected_join_type', response.data.dashboardType);
        
        // Store B2B status for navigation after login completes
        const b2bStatus = response.data.b2bStatus;
        console.log('🔍 LoginScreen: Received b2bStatus from API:', b2bStatus);
        console.log('🔍 LoginScreen: Dashboard type:', response.data.dashboardType);
        
        if (b2bStatus && response.data.dashboardType === 'b2b') {
          await AsyncStorage.setItem('@b2b_status', b2bStatus);
          console.log('✅ LoginScreen: Stored b2bStatus in AsyncStorage:', b2bStatus);
        } else {
          await AsyncStorage.removeItem('@b2b_status');
          console.log('🗑️  LoginScreen: Removed b2bStatus from AsyncStorage (not B2B or no status)');
        }
        
        // Verify the status was stored
        const storedStatus = await AsyncStorage.getItem('@b2b_status');
        console.log('🔍 LoginScreen: Verified stored b2bStatus:', storedStatus);
        
        // Call success callback with dashboard type and allowed dashboards
        onLoginSuccess?.(
          phoneNumber, 
          response.data.dashboardType,
          response.data.allowedDashboards
        );
      } else {
        Alert.alert('Error', response.message || 'Invalid OTP. Please try again.');
        // Clear OTP on error
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Invalid OTP. Please try again.');
      // Clear OTP on error
      setOtp(['', '', '', '', '', '']);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }, [phoneNumber, isNewUser, onLoginSuccess, otp]);

  // Handle resend OTP
  const handleResendOtp = async () => {
    if (countdown > 0) {
      return;
    }

    await handleSendOtp();
  };

  // Format phone number display
  const formatPhoneNumber = (text: string) => {
    // Remove all non-digits
    let cleaned = text.replace(/\D/g, '');
    
    // Remove leading 91 or +91 (India country code) if present
    if (cleaned.startsWith('91') && cleaned.length > 10) {
      cleaned = cleaned.substring(2);
    }
    
    // Limit to 10 digits
    const limited = cleaned.slice(0, 10);
    return limited;
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.content}>
            {/* Header */}
            {!showOtp && (
              <View style={styles.header}>
                <AutoText style={styles.title} numberOfLines={0}>
                  Enter your mobile number
                </AutoText>
              </View>
            )}

            {/* Phone Number Input */}
            {!showOtp && (
              <View style={styles.inputContainer}>
                <View style={styles.phoneInputWrapper}>
                  <View style={styles.countryCode}>
                    <AutoText style={styles.countryCodeText}>+91</AutoText>
                  </View>
                  <View style={styles.divider} />
                  <TextInput
                    style={styles.phoneInput}
                    placeholder="Enter mobile number"
                    placeholderTextColor={theme.textSecondary}
                    value={phoneNumber}
                    onChangeText={(text) => setPhoneNumber(formatPhoneNumber(text))}
                    keyboardType="phone-pad"
                    maxLength={10}
                    autoFocus
                    editable={!isLoading}
                  />
                </View>
                <GreenButton
                  title="Continue"
                  onPress={handleSendOtp}
                  loading={isLoading}
                  disabled={!validatePhoneNumber(phoneNumber) || isLoading}
                  style={styles.continueButton}
                />
              </View>
            )}

            {/* OTP Screen Header */}
            {showOtp && (
              <View style={styles.header}>
                <AutoText style={styles.title}>
                  Enter OTP
                </AutoText>
                <AutoText style={styles.subtitle}>
                  We've sent a 6-digit OTP to {phoneNumber}
                </AutoText>
              </View>
            )}

            {/* OTP Input */}
            {showOtp && (
              <View style={styles.otpContainer}>
                <View style={styles.otpInputs}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => (otpInputRefs.current[index] = ref)}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                      ]}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={({ nativeEvent }) =>
                        handleOtpKeyPress(nativeEvent.key, index)
                      }
                      keyboardType="number-pad"
                      maxLength={1}
                      selectTextOnFocus
                      editable={!isLoading}
                    />
                  ))}
                </View>

                <GreenButton
                  title="Verify OTP"
                  onPress={() => handleVerifyOtp()}
                  loading={isLoading}
                  disabled={otp.some((digit) => !digit) || isLoading}
                  style={styles.verifyButton}
                />

                {/* Resend OTP */}
                <View style={styles.resendContainer}>
                  <AutoText style={styles.resendText}>
                    Didn't receive OTP?{' '}
                  </AutoText>
                  <TouchableOpacity
                    onPress={handleResendOtp}
                    disabled={countdown > 0 || isLoading}
                  >
                    <AutoText
                      style={[
                        styles.resendLink,
                        (countdown > 0 || isLoading) && styles.resendLinkDisabled,
                      ]}
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                    </AutoText>
                  </TouchableOpacity>
                </View>

                {/* Change Phone Number */}
                <TouchableOpacity
                  onPress={() => {
                    setShowOtp(false);
                    setOtp(['', '', '', '', '', '']);
                    setOtpSent(false);
                    setCountdown(0);
                  }}
                  style={styles.changePhoneButton}
                >
                  <AutoText style={styles.changePhoneText}>
                    Change Phone Number
                  </AutoText>
                </TouchableOpacity>
              </View>
            )}

            {/* Terms and Conditions */}
            {!showOtp && (
              <View style={styles.termsContainer}>
                <AutoText style={styles.termsText} numberOfLines={0}>
                  By continuing, You accept the{' '}
                  <AutoText style={styles.termsLink} onPress={() => {}}>
                    Terms of Service
                  </AutoText>
                  ,{' '}
                  <AutoText style={styles.termsLink} onPress={() => {}}>
                    Privacy Policy
                  </AutoText>
                  {' '}and{' '}
                  <AutoText style={styles.termsLink} onPress={() => {}}>
                    Content Policy
                  </AutoText>
                </AutoText>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* OTP Sent Modal */}
      <Modal
        visible={showOtpSentModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowOtpSentModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons
                name="check-circle"
                size={40}
                color={theme.primary}
              />
            </View>
            <AutoText style={styles.modalTitle}>
              OTP Sent
            </AutoText>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const getStyles = (theme: any, isDark: boolean) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    keyboardView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      paddingHorizontal: '24@s',
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      paddingVertical: '60@vs',
    },
    header: {
      alignItems: 'flex-start',
      marginBottom: '40@vs',
      paddingHorizontal: '4@s',
    },
    title: {
      fontSize: '32@s',
      fontFamily: 'Poppins-Bold',
      color: theme.textPrimary,
      marginBottom: '8@vs',
      textAlign: 'left',
      lineHeight: '42@vs',
      flexWrap: 'wrap',
    },
    subtitle: {
      fontSize: '14@s',
      fontFamily: 'Poppins-Regular',
      color: theme.textSecondary,
      textAlign: 'left',
      marginTop: '8@vs',
      lineHeight: '20@vs',
    },
    inputContainer: {
      marginBottom: '40@vs',
    },
    phoneInputWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '24@vs',
      borderRadius: '8@ms',
      borderWidth: 1.5,
      borderColor: theme.primary,
      backgroundColor: isDark ? theme.card : '#FFFFFF',
      overflow: 'hidden',
      minHeight: '56@vs',
    },
    countryCode: {
      paddingHorizontal: '16@s',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '56@vs',
    },
    countryCodeText: {
      fontSize: '16@s',
      fontFamily: 'Poppins-Medium',
      color: theme.textPrimary,
    },
    divider: {
      width: 1,
      height: '24@vs',
      backgroundColor: theme.border,
    },
    phoneInput: {
      flex: 1,
      paddingHorizontal: '16@s',
      paddingVertical: '16@vs',
      fontSize: '16@s',
      fontFamily: 'Poppins-Regular',
      color: theme.textPrimary,
      minHeight: '56@vs',
    },
    continueButton: {
      marginTop: '8@vs',
    },
    otpContainer: {
      marginBottom: '30@vs',
    },
    otpInputs: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: '30@vs',
    },
    otpInput: {
      width: '45@s',
      height: '55@vs',
      borderRadius: '12@ms',
      borderWidth: 2,
      borderColor: theme.border,
      backgroundColor: theme.card,
      textAlign: 'center',
      fontSize: '20@s',
      fontFamily: 'Poppins-SemiBold',
      color: theme.textPrimary,
    },
    otpInputFilled: {
      borderColor: theme.primary,
      backgroundColor: theme.card,
    },
    verifyButton: {
      marginBottom: '20@vs',
    },
    resendContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: '20@vs',
    },
    resendText: {
      fontSize: '14@s',
      fontFamily: 'Poppins-Regular',
      color: theme.textSecondary,
    },
    resendLink: {
      fontSize: '14@s',
      fontFamily: 'Poppins-Medium',
      color: theme.primary,
    },
    resendLinkDisabled: {
      color: theme.disabled,
    },
    changePhoneButton: {
      alignItems: 'center',
      paddingVertical: '10@vs',
    },
    changePhoneText: {
      fontSize: '14@s',
      fontFamily: 'Poppins-Medium',
      color: theme.primary,
    },
    termsContainer: {
      marginTop: 'auto',
      paddingTop: '1@vs',
      paddingHorizontal: '4@s',
    },
    termsText: {
      fontSize: '12@s',
      fontFamily: 'Poppins-Regular',
      color: theme.textSecondary,
      textAlign: 'left',
      lineHeight: '22@vs',
      flexWrap: 'wrap',
    },
    termsLink: {
      fontSize: '14@s',
      fontFamily: 'Poppins-Medium',
      color: theme.primary,
      textDecorationLine: 'underline',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'transparent',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: '20@s',
      paddingBottom: '40@vs',
    },
    modalContent: {
      backgroundColor: theme.card,
      borderRadius: '16@ms',
      padding: '20@s',
      width: '100%',
      maxWidth: '240@s',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    modalIconContainer: {
      marginBottom: '12@vs',
    },
    modalTitle: {
      fontSize: '16@s',
      fontFamily: 'Poppins-Medium',
      color: theme.textPrimary,
      textAlign: 'center',
    },
  });

export default LoginScreen;

