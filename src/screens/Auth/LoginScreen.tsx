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
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState('');
  const [shouldNavigateToJoinAs, setShouldNavigateToJoinAs] = useState(false);
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
      
      // Get join type from AsyncStorage or current mode (for both new and existing users)
      // This ensures we use the user's selected join type, not the API's dashboardType
      let joinType: 'b2b' | 'b2c' | 'delivery' | undefined;
      const storedJoinType = await AsyncStorage.getItem('@selected_join_type');
      if (storedJoinType === 'b2b' || storedJoinType === 'b2c' || storedJoinType === 'delivery') {
        joinType = storedJoinType as 'b2b' | 'b2c' | 'delivery';
        console.log('📝 LoginScreen: Using stored join type:', joinType);
      } else {
        // Fallback: if no stored join type, use current mode from UserModeContext
        // This works for new users who selected a type in JoinAsScreen but it wasn't stored
        const { useUserMode } = await import('../../context/UserModeContext');
        // We can't use hooks here, so we'll use a different approach
        // Instead, we'll temporarily store it in JoinAsScreen just for the login flow
        console.log('⚠️ LoginScreen: No stored join type found - will use API dashboardType or mode');
      }

      const response = await verifyOtp(cleanedPhone, otpString, joinType);
      
      if (response.status === 'success' && response.data) {
        // Store auth token and user data
        await setAuthToken(response.data.token);
        await setUserData(response.data.user);
        
        // Check user type FIRST before doing anything else
        const user = response.data.user;
        const userType = user?.user_type;
        const appType = user?.app_type || user?.app_version;
        console.log('🔍 LoginScreen: User type from API:', userType);
        console.log('🔍 LoginScreen: App type/version:', appType);
        console.log('🔍 LoginScreen: Dashboard type:', response.data.dashboardType);
        console.log('🔍 LoginScreen: Join type (from user selection):', joinType);
        
        
        // Determine dashboard type based on user_type (only if app_type is V2)
        let determinedDashboardType: 'b2b' | 'b2c' | 'delivery' | null = null;
        let finalDashboardTypeForCallback: 'b2b' | 'b2c' | 'delivery' = response.data.dashboardType;
        const isV2 = appType === 'V2' || appType === 'v2' || appType === 'V2.0' || appType === 'v2.0';
        
        if (isV2) {
          if (userType === 'D') {
            determinedDashboardType = 'delivery';
            console.log('✅ LoginScreen: User type is D (Delivery) with app_type V2 - routing to delivery dashboard');
          } else if (userType === 'R') {
            determinedDashboardType = 'b2c';
            console.log('✅ LoginScreen: User type is R with app_type V2 - routing to B2C dashboard');
          } else if (userType === 'S') {
            determinedDashboardType = 'b2b';
            console.log('✅ LoginScreen: User type is S with app_type V2 - routing to B2B dashboard');
          } else if (userType === 'SR') {
            determinedDashboardType = 'b2b';
            console.log('✅ LoginScreen: User type is SR with app_type V2 - routing to B2B dashboard');
          }
        } else {
          console.log('⚠️ LoginScreen: app_type is not V2 - using API dashboardType or stored join type');
        }
        
        // IMPORTANT: If user_type is 'N' (new_user), DO NOT store any AsyncStorage data
        // Only use joinType temporarily for routing - user can change it later
        if (userType === 'N') {
          console.log('✅ LoginScreen: User type is N (new_user) - NOT storing AsyncStorage data');
          console.log('🔍 LoginScreen: Using joinType for routing only:', joinType);
          
          // Clear ALL AsyncStorage flags for new users - they start fresh
          await AsyncStorage.removeItem('@b2b_status');
          await AsyncStorage.removeItem('@b2c_signup_needed');
          await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
          await AsyncStorage.removeItem('@allowed_dashboards');
          // IMPORTANT: Clear @selected_join_type for new users - they can change it anytime
          await AsyncStorage.removeItem('@selected_join_type');
          console.log('✅ LoginScreen: Cleared @selected_join_type for new user - they can change join type anytime');
          
          // Determine final dashboard type to pass to callback
          // Use joinType (from user's selection) instead of API dashboardType
          finalDashboardTypeForCallback = joinType || response.data.dashboardType || 'b2c';
          console.log('🔍 LoginScreen: Final dashboard type for new user:', finalDashboardTypeForCallback);
          
          // Call success callback with dashboard type and allowed dashboards
          onLoginSuccess?.(
            phoneNumber, 
            finalDashboardTypeForCallback,
            response.data.allowedDashboards
          );
        } else {
          // For registered users (not 'N'), store data normally
          // If we determined a dashboard type from user_type, use it
          if (determinedDashboardType) {
            await AsyncStorage.setItem('@selected_join_type', determinedDashboardType);
            console.log('✅ LoginScreen: Set @selected_join_type based on user_type:', determinedDashboardType);
            
            // Clear any incorrect flags
            if (determinedDashboardType === 'delivery') {
              await AsyncStorage.removeItem('@b2b_status');
              await AsyncStorage.removeItem('@b2c_signup_needed');
            } else if (determinedDashboardType === 'b2c') {
              await AsyncStorage.removeItem('@b2b_status');
            } else if (determinedDashboardType === 'b2b') {
              await AsyncStorage.removeItem('@b2c_signup_needed');
            }
          } else {
            // Fallback to existing logic for other user types or if SR is not V2
            // BUT: Don't save for new users (user_type 'N')
            if (userType !== 'N') {
            const currentJoinType = await AsyncStorage.getItem('@selected_join_type');
            if (!currentJoinType && response.data.dashboardType) {
              await AsyncStorage.setItem('@selected_join_type', response.data.dashboardType);
              console.log('📝 LoginScreen: Stored dashboardType as join type:', response.data.dashboardType);
            } else {
              console.log('📝 LoginScreen: Keeping existing join type:', currentJoinType);
              }
            } else {
              console.log('✅ LoginScreen: User type is N - NOT storing @selected_join_type in fallback');
            }
          }
          
          if (userType !== 'D') {
            // User type is not 'N' and not 'D' - use existing logic for B2B/B2C users
            const b2bStatus = response.data.b2bStatus;
            console.log('🔍 LoginScreen: Received b2bStatus from API:', b2bStatus);
            
            if (b2bStatus && response.data.dashboardType === 'b2b') {
              await AsyncStorage.setItem('@b2b_status', b2bStatus);
              console.log('✅ LoginScreen: Stored b2bStatus in AsyncStorage:', b2bStatus);
            } else {
              await AsyncStorage.removeItem('@b2b_status');
              console.log('🗑️  LoginScreen: Removed b2bStatus from AsyncStorage (not B2B or no status)');
            }
            
            // Check if B2C user needs to complete signup (new user or v1 user)
            if (response.data.dashboardType === 'b2c') {
              const isV1User = user?.app_version === 'v1' || user?.app_version === 'v1.0';
              const isNewUserFlag = isNewUser; // Use the state variable
              
              // Check if profile is incomplete
              // For B2C users, check name, and shop address/contact (if shop exists)
              const hasName = user?.name && user.name.trim() !== '';
              const hasAddress = user?.shop?.address && user.shop.address.trim() !== '';
              const hasContact = user?.shop?.contact && user.shop.contact.trim() !== '';
              const hasIncompleteProfile = !hasName || !hasAddress || !hasContact;
              
              const needsSignup = isV1User || isNewUserFlag || hasIncompleteProfile;
              
              if (needsSignup) {
                await AsyncStorage.setItem('@b2c_signup_needed', 'true');
                console.log('✅ LoginScreen: B2C signup needed (v1 user or new user or incomplete profile)');
                console.log('   isV1User:', isV1User, 'isNewUser:', isNewUserFlag, 'hasIncompleteProfile:', hasIncompleteProfile);
                console.log('   hasName:', hasName, 'hasAddress:', hasAddress, 'hasContact:', hasContact);
              } else {
                await AsyncStorage.removeItem('@b2c_signup_needed');
                console.log('🗑️  LoginScreen: B2C signup not needed (profile complete)');
              }
            } else {
              await AsyncStorage.removeItem('@b2c_signup_needed');
            }
          }
          
          // Verify the status was stored
          const storedStatus = await AsyncStorage.getItem('@b2b_status');
          console.log('🔍 LoginScreen: Verified stored b2bStatus:', storedStatus);
          
          // Determine final dashboard type to pass to callback
          // Use determinedDashboardType if available, otherwise use API dashboardType
          finalDashboardTypeForCallback = determinedDashboardType || response.data.dashboardType;
          
          // Call success callback with dashboard type and allowed dashboards
          onLoginSuccess?.(
            phoneNumber, 
            finalDashboardTypeForCallback,
            response.data.allowedDashboards
          );
        }
      } else {
        Alert.alert('Error', response.message || 'Invalid OTP. Please try again.');
        // Clear OTP on error
        setOtp(['', '', '', '', '', '']);
        otpInputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      const errorMessage = error.message || 'Invalid OTP. Please try again.';
      
      // Check if error is about B2B/B2C users trying to join as delivery
      if (errorMessage.includes('B2B or B2C users cannot login or register as delivery') ||
          errorMessage.includes('cannot login or register as delivery partners')) {
        console.log('⚠️ LoginScreen: B2B/B2C user tried to join as delivery');
        console.log('🗑️  Clearing auth data and join type');
        
        // Clear auth data since login should not proceed
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('user_data');
        await AsyncStorage.removeItem('@selected_join_type');
        await AsyncStorage.removeItem('@b2b_status');
        await AsyncStorage.removeItem('@b2c_signup_needed');
        await AsyncStorage.removeItem('@delivery_vehicle_info_needed');
        await AsyncStorage.removeItem('@allowed_dashboards');
        
        // Show error modal with backend message and navigate to JoinAs
        setErrorModalMessage(errorMessage);
        setShouldNavigateToJoinAs(true);
        setShowErrorModal(true);
      }
      // If error is about delivery users trying to login as B2B/B2C, show modal and navigate to JoinAs
      else if (errorMessage.includes('Delivery partners cannot login') || 
          errorMessage.includes('delivery account') ||
          errorMessage.includes('Delivery partners')) {
        console.log('⚠️ LoginScreen: Delivery user tried to login with wrong join type');
        console.log('🗑️  Clearing incorrect join type and setting to delivery');
        // Clear incorrect join type and set to delivery
        await AsyncStorage.setItem('@selected_join_type', 'delivery');
        // Also clear any other related flags
        await AsyncStorage.removeItem('@b2b_status');
        await AsyncStorage.removeItem('@b2c_signup_needed');
        await AsyncStorage.removeItem('@allowed_dashboards');
        console.log('✅ LoginScreen: Set join type to delivery for delivery user');
        
        // Show error modal and navigate to JoinAs
        setErrorModalMessage(errorMessage);
        setShouldNavigateToJoinAs(true);
        setShowErrorModal(true);
      } else {
        // For other errors, show regular alert
        Alert.alert('Error', errorMessage);
      }
      
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

      {/* Error Modal for Delivery User */}
      <Modal
        visible={showErrorModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowErrorModal(false);
          if (shouldNavigateToJoinAs) {
            navigation?.navigate('JoinAs' as never);
            setShouldNavigateToJoinAs(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <MaterialCommunityIcons
                name="alert-circle"
                size={40}
                color="#FF4444"
              />
            </View>
            <AutoText style={styles.modalTitle} numberOfLines={3}>
              {errorModalMessage || 'Error'}
            </AutoText>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowErrorModal(false);
                if (shouldNavigateToJoinAs) {
                  navigation?.navigate('JoinAs' as never);
                  setShouldNavigateToJoinAs(false);
                }
              }}
              activeOpacity={0.7}
            >
              <AutoText style={styles.modalButtonText}>OK</AutoText>
            </TouchableOpacity>
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
      maxWidth: '280@s',
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
      fontSize: '14@s',
      fontFamily: 'Poppins-Medium',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: '16@vs',
      lineHeight: '20@vs',
      paddingHorizontal: '8@s',
    },
    modalButton: {
      marginTop: '8@vs',
      paddingVertical: '8@vs',
      paddingHorizontal: '20@s',
      borderRadius: '8@ms',
      backgroundColor: theme.primary,
      minWidth: '70@s',
      alignSelf: 'center',
    },
    modalButtonText: {
      fontSize: '12@s',
      fontFamily: 'Poppins-SemiBold',
      color: '#FFFFFF',
      textAlign: 'center',
    },
  });

export default LoginScreen;

