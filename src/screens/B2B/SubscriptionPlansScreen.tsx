import React, { useMemo, useState, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Alert, Modal, TextInput, Image, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { getUserData } from '../../services/auth/authService';
import { useProfile } from '../../hooks/useProfile';
import { useUserMode } from '../../context/UserModeContext';
import PayUWebView, { PayUPaymentResponse } from '../../components/PayUWebView';
import { getSubscriptionPackages, saveUserSubscription, generatePayUHash, SubscriptionPackage, checkSubscriptionExpiry } from '../../services/api/v2/subscriptionPackages';
import { buildApiUrl } from '../../services/api/apiConfig';
import UPIPaymentService from '../../services/upi/UPIPaymentService';
import { Platform } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import ViewShot from 'react-native-view-shot';

// Using SubscriptionPackage from API service

const SubscriptionPlansScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { mode } = useUserMode();
  const [userData, setUserData] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayUWebView, setShowPayUWebView] = useState(false);
  const [payUFormUrl, setPayUFormUrl] = useState('');
  const [payUPaymentData, setPayUPaymentData] = useState<any>(null);
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPackage | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'payu' | 'upi'>('payu');
  const [showPaymentMethodSelector, setShowPaymentMethodSelector] = useState(false);
  const [showUPIVerificationModal, setShowUPIVerificationModal] = useState(false);
  const [upiTransactionRef, setUpiTransactionRef] = useState('');
  const [pendingUPITransactionId, setPendingUPITransactionId] = useState<string | null>(null);
  const [pendingUPIPlan, setPendingUPIPlan] = useState<SubscriptionPackage | null>(null);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [qrCodeFilePath, setQrCodeFilePath] = useState<string | null>(null);
  const [currentUPIIntentUrl, setCurrentUPIIntentUrl] = useState<string | null>(null);
  const qrCodeViewRef = useRef<any>(null);
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

  // Load user data and fetch profile
  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
      };
      loadUserData();
    }, [])
  );

  // Fetch profile data
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);
  
  // Debug: Log profile data when it changes
  useEffect(() => {
    if (profileData) {
      console.log('🔍 [Subscription Plans] Profile data received:', {
        hasInvoices: !!(profileData as any)?.invoices,
        invoicesCount: ((profileData as any)?.invoices || []).length,
        invoices: ((profileData as any)?.invoices || []).map((inv: any) => ({
          id: inv.id,
          approval_status: inv.approval_status,
          approval_notes: inv.approval_notes,
          type: inv.type
        }))
      });
    }
  }, [profileData]);

  // Check subscription expiry when screen loads and subscription date has passed
  useEffect(() => {
    const checkExpiry = async () => {
      if (!profileData || !userData?.id) return;
      
      const shop = profileData.shop as any;
      const invoices = (profileData as any).invoices || [];
      const approvedInvoice = invoices.find((inv: any) => inv?.approval_status === 'approved' && inv?.type === 'Paid');
      const isSubscribed = shop?.is_subscribed && approvedInvoice;
      const subscriptionEndsAt = shop?.subscription_ends_at;
      
      // Only check if user is subscribed and has an end date
      if (isSubscribed && subscriptionEndsAt) {
        const endDate = new Date(subscriptionEndsAt);
        const now = new Date();
        
        // Set time to midnight for date comparison
        endDate.setHours(0, 0, 0, 0);
        now.setHours(0, 0, 0, 0);
        
        // Check if subscription has expired
        if (endDate < now) {
          console.log('⚠️ Subscription has expired, checking and updating status...');
          try {
            const result = await checkSubscriptionExpiry(userData.id);
            if (result.status === 'success' && result.data?.updated) {
              console.log('✅ Subscription expiry updated - refetching profile');
              // Refetch profile to get updated subscription status
              await refetchProfile();
            }
          } catch (error) {
            console.error('❌ Error checking subscription expiry:', error);
          }
        }
      }
    };
    
    checkExpiry();
  }, [profileData, userData?.id, refetchProfile]);

  // Setup UPI payment callback listener
  useEffect(() => {
    // Set callback to handle UPI payment responses
    UPIPaymentService.setPaymentCallback((result) => {
      console.log('📱 UPI Payment Callback Received:', result);
      
      if (result.status === 'success') {
        // Close QR code modal
        setShowQRCodeModal(false);
        setQrCodeFilePath(null);
        setCurrentUPIIntentUrl(null);
        
        // Show verification modal immediately - keep it open until user cancels or verifies
        // Don't show success alert, just open verification modal
        if (pendingUPITransactionId) {
          setShowUPIVerificationModal(true);
          setUpiTransactionRef(result.transactionId || pendingUPITransactionId);
        }
      } else {
        // Payment failed
        Alert.alert(
          'Payment Failed',
          result.message || 'Payment could not be completed. Please try again.',
          [{ text: 'OK' }]
        );
      }
    });

    // Cleanup on unmount
    return () => {
      UPIPaymentService.setPaymentCallback(null);
    };
  }, [pendingUPITransactionId]);

  // Check for payment callback when screen comes into focus
  // This helps catch callbacks that might have been missed
  useFocusEffect(
    React.useCallback(() => {
      // When screen comes into focus, check if there's a pending payment callback
      // This is useful when returning from UPI app after QR payment
      console.log('🔍 Screen focused, checking for payment callback...');
      UPIPaymentService.checkForPaymentCallback();
    }, [])
  );

  // Fetch subscription packages from API
  useFocusEffect(
    React.useCallback(() => {
      const fetchPackages = async () => {
        try {
          setLoading(true);
          // Determine user type from UserModeContext (b2c or b2b)
          // Default to 'b2c' if mode is not available
          // API expects lowercase values
          const userType: 'b2b' | 'b2c' = mode === 'b2b' ? 'b2b' : 'b2c';
          const response = await getSubscriptionPackages(userType);
          
          if (response.status === 'success' && response.data) {
            setPlans(response.data);
          } else {
            console.error('Failed to fetch subscription packages:', response.msg || 'Unknown error');
            // Fallback to empty array
            setPlans([]);
          }
        } catch (error) {
          console.error('Error fetching subscription packages:', error);
          // Fallback to empty array
          setPlans([]);
        } finally {
          setLoading(false);
        }
      };
      
      if (userData?.id) {
        fetchPackages();
      }
    }, [userData?.id, mode])
  );

  const handleSelectPlan = (planId: string) => {
    // Disable plan selection for B2B users
    if (mode === 'b2b') {
      return;
    }
    setSelectedPlan(planId);
  };
  
  // Check if plans should be disabled (B2B users)
  const isB2BUser = mode === 'b2b';

  // Handle PayU WebView payment response
  const handlePayUResponse = async (response: PayUPaymentResponse) => {
    console.log('📱 PayU Payment Response:', response);
    
    setShowPayUWebView(false);
    
    if (!currentPlan || !userData?.id) {
      Alert.alert('Error', 'Payment data not found. Please try again.');
      return;
    }

    if (response.status === 'success' && response.txnid) {
      // Payment successful - save subscription
      const transactionId = response.txnid;
      
      console.log('✅ Payment successful, saving subscription:', {
        userId: userData.id,
        packageId: currentPlan.id,
        transactionId,
      });

      try {
        // Save subscription with transaction details
        const saveResult = await saveUserSubscription(
          userData.id,
          currentPlan.id,
          {
            transactionId: transactionId,
            responseCode: '00',
            approvalRefNo: transactionId,
            amount: response.amount || currentPlan.price.toString(),
          }
        );

        if (saveResult.status === 'success') {
          Alert.alert(
            'Payment Submitted',
            `Payment verification submitted successfully!\nTransaction ID: ${transactionId}\n\nOur admin team will review your subscription request and notify you soon. You can check your subscription status in your profile.`,
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.goBack();
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Subscription Error',
            saveResult.msg || 'Payment was successful but subscription activation failed. Please contact support with Transaction ID: ' + transactionId
          );
        }
      } catch (saveError: any) {
        console.error('Error saving subscription:', saveError);
        Alert.alert(
          'Subscription Error',
          `Payment was successful but subscription activation failed.\n\nTransaction ID: ${transactionId}\n\nError: ${saveError.message || 'Unknown error'}\n\nPlease contact support with the Transaction ID.`
        );
      }
    } else if (response.status === 'cancelled') {
      console.log('⚠️ PayU Payment Cancelled');
      Alert.alert('Payment Cancelled', 'Payment was cancelled. Please try again to subscribe.');
    } else {
      console.error('❌ PayU Payment Failed:', response);
      Alert.alert('Payment Failed', response.message || response.error || 'Payment failed. Please try again.');
    }
    
    // Reset state
    setCurrentPlan(null);
    setPayUPaymentData(null);
    setPayUFormUrl('');
  };

  const handleSubscribe = async (plan: SubscriptionPackage) => {
    // For percentage-based plans, no upfront payment is required
    if (plan.isPercentageBased && plan.pricePercentage !== undefined) {
      Alert.alert(
        'Subscribe to Plan',
        `You will be charged ${plan.pricePercentage.toFixed(1)}% of each order value when you accept orders. No upfront payment required.`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Subscribe',
            onPress: async () => {
              // For percentage-based plans, we can activate subscription without payment
              // The actual charge happens when orders are accepted
              Alert.alert(
                'Subscription Activated',
                `Your ${plan.name} subscription is now active. You will be charged ${plan.pricePercentage?.toFixed(1) || '0.5'}% of each order value when accepting orders.`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
              );
            },
          },
        ]
      );
      return;
    }

    // For fixed-price plans, proceed with payment
    const priceText = plan.isPercentageBased && plan.pricePercentage !== undefined
      ? `${plan.pricePercentage.toFixed(1)}% per order`
      : `₹${plan.price.toLocaleString('en-IN')}/${plan.duration}`;
    
    // Check if UPI is available and plan has UPI ID
    const isUPIAvailable = Platform.OS === 'android' && UPIPaymentService.isAvailable() && plan.upiId;
    
    // Show payment method selector if both methods are available
    if (isUPIAvailable) {
      Alert.alert(
        'Select Payment Method',
        `Choose how you want to pay for ${plan.name} (${priceText})`,
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Pay via UPI',
            onPress: () => {
              setCurrentPlan(plan);
              handleUPIPayment(plan);
            },
          },
          {
            text: 'Pay via PayU',
            onPress: () => {
              setCurrentPlan(plan);
              handlePayUPayment(plan);
            },
          },
        ]
      );
      return;
    }
    
    // If only PayU is available, proceed directly
    setCurrentPlan(plan);
    handlePayUPayment(plan);
  };

  const handleUPIPayment = async (plan: SubscriptionPackage) => {
    if (isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    try {
      if (!userData?.id) {
        Alert.alert('Error', 'User information not found. Please try again.');
        setIsProcessingPayment(false);
        return;
      }

      if (!plan.upiId) {
        Alert.alert('Error', 'UPI ID not configured for this plan. Please use PayU payment.');
        setIsProcessingPayment(false);
        return;
      }

      // Generate unique transaction ID
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const transactionId = `TXN${userData.id}_${plan.id}_${Date.now()}_${randomSuffix}`;
      
      // User details
      const userName = userData.name || 'User';
      const transactionNote = `Subscription payment for ${plan.name}`;
      
      console.log('💳 Initiating UPI payment:', {
        transactionId,
        amount: plan.price,
        upiId: plan.upiId,
        merchantName: plan.merchantName || 'Scrapmate Partner',
      });

      // Generate UPI intent URL for QR code
      // Transaction ID will come from the UPI callback response
      const upiResult = await UPIPaymentService.generateQRCodeForDisplay({
        upiId: plan.upiId,
        merchantName: plan.merchantName || 'Scrapmate Partner',
        amount: plan.price.toString(),
      });

      console.log('📱 UPI Payment Result:', upiResult);

      // Handle UPI payment result
      if (upiResult.status === 'qr_generated' && upiResult.upiIntentUrl) {
        // Generate PNG QR code from intent URL
        setCurrentUPIIntentUrl(upiResult.upiIntentUrl);
        setPendingUPITransactionId(transactionId);
        setPendingUPIPlan(plan);
        setShowQRCodeModal(true);
        setIsProcessingPayment(false);
        
        // Generate PNG QR code after a short delay to ensure modal is rendered
        setTimeout(() => {
          generateQRCodePNG(upiResult.upiIntentUrl!);
        }, 100);
      } else if (upiResult.status === 'app_launched') {
        // UPI app opened - show instruction to user
        Alert.alert(
          'Complete Payment',
          'Please complete the payment in your UPI app. After payment, you will need to verify the transaction.',
          [
            {
              text: 'I have paid',
              onPress: () => {
                // Show verification modal
                setPendingUPITransactionId(transactionId);
                setPendingUPIPlan(plan);
                setUpiTransactionRef(transactionId);
                setShowUPIVerificationModal(true);
                setIsProcessingPayment(false);
              },
            },
            {
              text: 'Cancel',
              style: 'cancel',
              onPress: () => {
                setIsProcessingPayment(false);
              },
            },
          ]
        );
      } else if (upiResult.status === 'success') {
        // Payment completed successfully
        try {
          const saveResult = await saveUserSubscription(
            userData.id,
            plan.id,
            {
              transactionId: upiResult.transactionId || transactionId,
              responseCode: upiResult.responseCode || '00',
              approvalRefNo: upiResult.approvalRefNo || transactionId,
              amount: plan.price.toString(),
            }
          );

          if (saveResult.status === 'success') {
            Alert.alert(
              'Payment Submitted',
              `Payment verification submitted successfully!\nTransaction ID: ${upiResult.transactionId || transactionId}\n\nOur admin team will review your subscription request and notify you soon. You can check your subscription status in your profile.`,
              [
                {
                  text: 'OK',
                  onPress: () => {
                    navigation.goBack();
                  },
                },
              ]
            );
          } else {
            throw new Error(saveResult.msg || 'Failed to save subscription');
          }
        } catch (error: any) {
          console.error('Error saving subscription:', error);
          Alert.alert(
            'Subscription Error',
            error.message || 'Payment was successful but subscription activation failed. Please contact support.'
          );
        } finally {
          setIsProcessingPayment(false);
        }
      } else if (upiResult.status === 'cancelled') {
        Alert.alert('Payment Cancelled', 'Payment was cancelled. Please try again to subscribe.');
        setIsProcessingPayment(false);
      } else {
        Alert.alert(
          'Payment Failed',
          upiResult.message || 'Payment failed. Please try again or use PayU payment method.'
        );
        setIsProcessingPayment(false);
      }
    } catch (error: any) {
      console.error('Error processing UPI payment:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to process UPI payment. Please try again or use PayU payment method.'
      );
      setIsProcessingPayment(false);
    }
  };

  // Generate PNG QR code from UPI intent URL and automatically open in UPI apps
  const generateQRCodePNG = async (intentUrl: string) => {
    try {
      if (!qrCodeViewRef.current) {
        console.warn('QR code view ref not ready, retrying...');
        setTimeout(() => generateQRCodePNG(intentUrl), 200);
        return;
      }

      // Wait a bit for the QR code to render
      await new Promise<void>(resolve => setTimeout(() => resolve(), 500));

      // Capture the QR code view as PNG (returns file URI)
      const pngFileUri = await qrCodeViewRef.current.capture();
      
      // Convert file URI to path
      const filePath = pngFileUri.replace('file://', '');
      setQrCodeFilePath(filePath);
      
      // Automatically open QR code in UPI apps after 2 seconds (shows only UPI apps)
      // Use filePath directly instead of state variable to avoid stale closure issue
      setTimeout(async () => {
        try {
          console.log('Opening QR code in UPI apps:', filePath);
          // Use QR code image file - native module will filter to show only UPI apps
          await UPIPaymentService.openQRCodeInApps(filePath);
          
          // Close QR code modal and show verification modal - keep it open until user cancels or verifies
          setShowQRCodeModal(false);
          // Don't auto-close verification modal - keep it open for user to verify
          setShowUPIVerificationModal(true);
          setUpiTransactionRef(pendingUPITransactionId || '');
        } catch (error: any) {
          console.error('Error opening QR code in UPI apps:', error);
          Alert.alert('UPI App Error', error.message || 'Failed to open QR code in UPI apps. Please try scanning the QR code manually.');
        }
      }, 2000);
    } catch (error: any) {
      console.error('Error generating QR code PNG:', error);
      Alert.alert('Error', 'Failed to generate QR code. Please try again.');
      setShowQRCodeModal(false);
      setIsProcessingPayment(false);
    }
  };

  const handlePayUPayment = async (plan: SubscriptionPackage) => {
    // PayU is currently not available
    Alert.alert(
      'Payment Method Unavailable',
      'PayU payment is currently not available. Please use UPI payment method.',
      [{ text: 'OK' }]
    );
    return;
    
    // Keep existing PayU code for future use (preserved but not executed)
    if (false) { // This block will never execute but preserves the code
    if (isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    try {
      if (!userData?.id) {
        Alert.alert('Error', 'User information not found. Please try again.');
        setIsProcessingPayment(false);
        return;
      }

      // Generate unique transaction ID
      const randomSuffix = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
      const transactionId = `TXN${userData.id}_${plan.id}_${Date.now()}_${randomSuffix}`;
      
      // PayU merchant credentials (should be stored in environment variables or config)
      const PAYU_KEY = 'eO7BjK'; // Test key - replace with production key
      const PAYU_SALT = 'BrOTecyan06WRQwHkkFw2XAXRBpR0jKi'; // Test salt - replace with production salt
      const PAYU_ENVIRONMENT = '1'; // "1" for Stage, "0" for production
      
      // User details
      const firstName = userData.name?.split(' ')[0] || 'User';
      const email = userData.email || `${userData.mob_num}@scrapmate.com`;
      const phone = String(userData.mob_num || '');
      
      // Product info
      const productInfo = `Subscription payment for ${plan.name}`;
      
      // Generate PayU payment hash
      console.log('💳 Generating PayU hash:', {
        transactionId,
        amount: plan.price,
      });
      
      const hashResult = await generatePayUHash({
        key: PAYU_KEY,
        txnid: transactionId,
        amount: plan.price.toString(),
        productinfo: productInfo,
        firstname: firstName,
        email: email,
        salt: PAYU_SALT,
        udf1: `Package: ${plan.id}`,
        udf2: `User: ${userData.id}`,
      });
      
      if (hashResult.status !== 'success' || !hashResult.data?.hash) {
        throw new Error('Failed to generate payment hash');
      }
      
      // Build PayU payment parameters for WebView
      // Use v2 API routes - buildApiUrl handles route construction
      // Build URLs directly using buildApiUrl to avoid double slashes
      const surl = buildApiUrl('/v2/payu-success');
      const furl = buildApiUrl('/v2/payu-failure');
      
      // Build form URL with query parameters
      const formParams = new URLSearchParams({
        key: PAYU_KEY,
        txnid: transactionId,
        amount: plan.price.toString(),
        productinfo: productInfo,
        firstname: firstName,
        email: email,
        phone: phone,
        surl: surl,
        furl: furl,
        hash: hashResult.data.hash,
        udf1: `Package: ${plan.id}`,
        udf2: `User: ${userData.id}`,
        udf3: plan.name,
      });
      
      const formUrl = `${buildApiUrl('/v2/payu-form')}?${formParams.toString()}`;
      
      console.log('🔗 PayU URLs:', {
        formUrl,
        surl,
        furl,
      });
      
      // Set payment data for WebView
      setPayUPaymentData({
        key: PAYU_KEY,
        txnid: transactionId,
        amount: plan.price.toString(),
        productinfo: productInfo,
        firstname: firstName,
        email: email,
        phone: phone,
        surl: surl,
        furl: furl,
        hash: hashResult.data.hash,
        udf1: `Package: ${plan.id}`,
        udf2: `User: ${userData.id}`,
        udf3: plan.name,
      });
      
      setPayUFormUrl(formUrl);
      
      console.log('💳 Opening PayU WebView:', {
        userId: userData.id,
        packageId: plan.id,
        amount: plan.price,
        transactionId,
        formUrl,
      });
      
      setShowPayUWebView(true);
      setIsProcessingPayment(false);
    } catch (error: any) {
      console.error('Error processing PayU payment:', error);
      Alert.alert(
        'Payment Error',
        error.message || 'Failed to process payment. Please try again.'
      );
      setIsProcessingPayment(false);
    }
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          Subscription Plans
        </AutoText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Plans Header */}
        <View style={styles.plansHeader}>
          <AutoText style={styles.plansTitle}>Choose Your Plan</AutoText>
          <AutoText style={styles.plansSubtitle}>
            Select a subscription plan to get unlimited orders
          </AutoText>
          {/* Subscription Status Banner */}
          {profileData && (() => {
            // Check for pending subscriptions from invoices (if available in profile)
            const invoices = (profileData as any).invoices || [];
            const hasPendingSubscription = invoices.some((inv: any) => inv?.approval_status === 'pending');
            const approvedInvoice = invoices.find((inv: any) => inv?.approval_status === 'approved' && inv?.type === 'Paid');
            const shop = profileData.shop as any;
            const isSubscribed = shop?.is_subscribed && approvedInvoice;
            const subscriptionEndsAt = shop?.subscription_ends_at;
            
            // Get current plan name from approved invoice
            const currentPlanName = approvedInvoice?.name || approvedInvoice?.package_id || 'B2C Monthly';
            
            // Sort all invoices by created_at descending (newest first) to find the most recent one
            const sortedInvoices = invoices
              .filter((inv: any) => inv?.type === 'Paid')
              .sort((a: any, b: any) => {
                // Sort by created_at if available, otherwise by id
                if (a.created_at && b.created_at) {
                  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
                }
                return (b.id || 0) - (a.id || 0);
              });
            
            // Find the most recent invoice (first in sorted array)
            const mostRecentInvoice = sortedInvoices.length > 0 ? sortedInvoices[0] : null;
            
            // Only show rejected banner if the most recent invoice is rejected
            // If there's a newer approved/pending invoice, don't show the rejected one
            const shouldShowRejected = mostRecentInvoice?.approval_status === 'rejected';
            const lastRejectedInvoice = shouldShowRejected ? mostRecentInvoice : null;
            const rejectionReason = lastRejectedInvoice?.approval_notes;
            
            // Debug logging
            console.log('🔍 [Subscription Plans] Invoice check:', {
              totalInvoices: invoices.length,
              sortedInvoicesCount: sortedInvoices.length,
              mostRecentInvoice: mostRecentInvoice ? {
                id: mostRecentInvoice.id,
                approval_status: mostRecentInvoice.approval_status,
                approval_notes: mostRecentInvoice.approval_notes,
                created_at: mostRecentInvoice.created_at,
                type: mostRecentInvoice.type
              } : null,
              shouldShowRejected: shouldShowRejected,
              allInvoices: invoices.map((inv: any) => ({
                id: inv.id,
                approval_status: inv.approval_status,
                type: inv.type,
                created_at: inv.created_at,
                hasNotes: !!inv.approval_notes
              }))
            });
            
            // Show rejected banner only if the most recent invoice is rejected
            if (shouldShowRejected && lastRejectedInvoice) {
              return (
                <View style={[styles.statusBanner, styles.statusBannerRejected]}>
                  <MaterialCommunityIcons name="alert-circle" size={20} color="#F44336" />
                  <View style={{ flex: 1 }}>
                    <AutoText style={[styles.statusText, styles.statusTextRejected]}>
                      Last Payment Rejected
                    </AutoText>
                    {rejectionReason ? (
                      <AutoText style={[styles.statusText, styles.statusTextRejected, { marginTop: 4, fontSize: 12 }]}>
                        Reason: {rejectionReason}
                      </AutoText>
                    ) : (
                      <AutoText style={[styles.statusText, styles.statusTextRejected, { marginTop: 4, fontSize: 12 }]}>
                        Your payment was rejected. Please contact support for more details.
                      </AutoText>
                    )}
                  </View>
                </View>
              );
            } else if (hasPendingSubscription) {
              return (
                <View style={styles.statusBanner}>
                  <MaterialCommunityIcons name="clock-outline" size={20} color="#FF9800" />
                  <AutoText style={styles.statusText}>
                    Your subscription payment is pending admin approval. We will notify you once it's approved.
                  </AutoText>
                </View>
              );
            } else if (isSubscribed && subscriptionEndsAt) {
              const endDate = new Date(subscriptionEndsAt);
              const formattedDate = endDate.toLocaleDateString('en-IN', { 
                day: 'numeric', 
                month: 'short', 
                year: 'numeric' 
              });
              return (
                <View style={[styles.statusBanner, styles.statusBannerApproved]}>
                  <MaterialCommunityIcons name="check-circle" size={20} color="#4CAF50" />
                  <View style={{ flex: 1 }}>
                    <AutoText style={[styles.statusText, styles.statusTextApproved]}>
                      Current Plan: {currentPlanName}
                    </AutoText>
                    <AutoText style={[styles.statusText, styles.statusTextApproved, { marginTop: 4, fontSize: 12 }]}>
                      Valid until: {formattedDate}
                    </AutoText>
                  </View>
                </View>
              );
            }
            return null;
          })()}
        </View>

        {/* Loading State */}
        {loading && (
          <View style={styles.loadingContainer}>
            <AutoText style={styles.loadingText}>Loading packages...</AutoText>
          </View>
        )}

        {/* Empty State */}
        {!loading && plans.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant" size={48} color={theme.textSecondary} />
            <AutoText style={styles.emptyText}>No subscription packages available</AutoText>
          </View>
        )}

        {/* Subscription Plans */}
        {!loading && plans.map((plan) => {
          // For B2C users: disable monthly subscription if already subscribed
          const shop = profileData?.shop as any;
          const invoices = (profileData as any)?.invoices || [];
          const approvedInvoice = invoices.find((inv: any) => inv?.approval_status === 'approved' && inv?.type === 'Paid');
          const isSubscribed = shop?.is_subscribed && approvedInvoice;
          const isMonthlyPlan = plan.id?.toLowerCase().includes('monthly') || plan.name?.toLowerCase().includes('monthly');
          const shouldDisablePlan = !isB2BUser && isSubscribed && isMonthlyPlan;
          
          return (
          <SectionCard
            key={plan.id}
            style={[
              styles.planCard,
              selectedPlan === plan.id && !isB2BUser && !shouldDisablePlan && styles.selectedPlanCard,
              plan.popular && !selectedPlan && !isB2BUser && !shouldDisablePlan && styles.popularPlanCard,
              plan.popular && selectedPlan === plan.id && !isB2BUser && !shouldDisablePlan && styles.popularSelectedPlanCard,
              (isB2BUser || shouldDisablePlan) && styles.disabledPlanCard,
            ]}
          >
            {plan.popular && (
              <View style={styles.popularBadge}>
                <AutoText style={styles.popularBadgeText}>Most Popular</AutoText>
              </View>
            )}
            
            <TouchableOpacity
              activeOpacity={(isB2BUser || shouldDisablePlan) ? 1 : 0.9}
              onPress={() => handleSelectPlan(plan.id)}
              disabled={isB2BUser || shouldDisablePlan}
            >
              <View style={styles.planHeader}>
                <View style={styles.planHeaderLeft}>
                  <AutoText style={styles.planName}>{plan.name}</AutoText>
                  <View style={styles.priceContainer}>
                    {plan.isPercentageBased && plan.pricePercentage !== undefined ? (
                      <>
                        <AutoText style={styles.priceAmount}>{plan.pricePercentage.toFixed(1)}%</AutoText>
                        <AutoText style={styles.priceDuration}>
                          {plan.duration === 'order' ? ' of order value' : `/${plan.duration}`}
                        </AutoText>
                      </>
                    ) : (
                      <>
                        <AutoText style={styles.priceSymbol}>₹</AutoText>
                        <AutoText style={styles.priceAmount}>{plan.price.toLocaleString('en-IN')}</AutoText>
                        <AutoText style={styles.priceDuration}>
                          {plan.duration === 'order' ? ' + GST per order' : `/${plan.duration} + GST`}
                        </AutoText>
                      </>
                    )}
                  </View>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedPlan === plan.id && styles.radioButtonSelected
                ]}>
                  {selectedPlan === plan.id && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </View>

              {plan.features && plan.features.length > 0 && (
                <View style={styles.featuresContainer}>
                  {plan.features.map((feature, index) => (
                    <View key={index} style={styles.featureRow}>
                      <MaterialCommunityIcons
                        name="check-circle"
                        size={18}
                        color={theme.primary}
                      />
                      <AutoText style={styles.featureText}>{feature}</AutoText>
                    </View>
                  ))}
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.subscribeButtonContainer}>
              {isB2BUser ? (
                <View style={[styles.disabledButton, { backgroundColor: theme.border, opacity: 0.6 }]}>
                  <AutoText style={[styles.disabledButtonText, { color: theme.textSecondary }]}>
                    Automatic - Charges apply per order
                  </AutoText>
                </View>
              ) : shouldDisablePlan ? (
                <View style={[styles.disabledButton, { backgroundColor: theme.border, opacity: 0.6 }]}>
                  <AutoText style={[styles.disabledButtonText, { color: theme.textSecondary }]}>
                    Already Subscribed
                  </AutoText>
                </View>
              ) : (
                <GreenButton
                  title={
                    isProcessingPayment 
                      ? 'Processing...' 
                      : plan.isPercentageBased && plan.pricePercentage !== undefined
                        ? `Subscribe - ${plan.pricePercentage.toFixed(1)}% per order`
                        : `Subscribe - ₹${plan.price.toLocaleString('en-IN')}${plan.duration === 'order' ? ' + GST per order' : `/${plan.duration} + GST`}`
                  }
                  onPress={() => handleSubscribe(plan)}
                  disabled={isProcessingPayment}
                />
              )}
            </View>
          </SectionCard>
          );
        })}

        {/* Info Section */}
        <SectionCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="information" size={20} color={theme.primary} />
            <AutoText style={styles.infoText} numberOfLines={0}>
              {isB2BUser 
                ? 'B2B subscription is automatic. You will be charged based on your plan when accepting orders. No upfront payment required.'
                : 'All plans include unlimited orders. Cancel anytime from your account settings.'
              }
            </AutoText>
          </View>
        </SectionCard>
      </ScrollView>

      {/* PayU WebView Modal */}
      {showPayUWebView && payUPaymentData && payUFormUrl && (
        <PayUWebView
          visible={showPayUWebView}
          onClose={() => {
            setShowPayUWebView(false);
            setCurrentPlan(null);
            setPayUPaymentData(null);
            setPayUFormUrl('');
          }}
          onPaymentResponse={handlePayUResponse}
          paymentData={payUPaymentData}
          formUrl={payUFormUrl}
        />
      )}

      {/* UPI QR Code Modal */}
      <Modal
        visible={showQRCodeModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          setShowQRCodeModal(false);
          setQrCodeFilePath(null);
          setCurrentUPIIntentUrl(null);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.background }]}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>Scan QR Code to Pay</AutoText>
              <TouchableOpacity
                onPress={() => {
                  setShowQRCodeModal(false);
                  setQrCodeFilePath(null);
                  setCurrentUPIIntentUrl(null);
                }}
                style={styles.closeButton}
              >
                <MaterialCommunityIcons name="close" size={24} color={theme.textPrimary} />
              </TouchableOpacity>
            </View>

            <AutoText style={styles.modalDescription}>
              Opening UPI app to scan QR code...
            </AutoText>

            <View style={styles.qrCodeContainer}>
              {currentUPIIntentUrl ? (
                <ViewShot
                  ref={qrCodeViewRef}
                  options={{ format: 'png', quality: 1.0, result: 'tmpfile' }}
                  style={styles.qrCodeView}
                >
                  <QRCode
                    value={currentUPIIntentUrl}
                    size={250}
                    color="black"
                    backgroundColor="white"
                  />
                </ViewShot>
              ) : (
                <ActivityIndicator size="large" color={theme.primary} />
              )}
            </View>

            <TouchableOpacity
              style={[styles.cancelButtonModal, { borderColor: theme.border, marginTop: '20@vs' }]}
              onPress={() => {
                setShowQRCodeModal(false);
                setQrCodeFilePath(null);
                setCurrentUPIIntentUrl(null);
                setIsProcessingPayment(false);
              }}
            >
              <AutoText style={[styles.cancelButtonText, { color: theme.textSecondary }]}>
                Cancel
              </AutoText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* UPI Verification Modal */}
      <Modal
        visible={showUPIVerificationModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => {
          // Prevent closing by back button - user must use Cancel or Verify buttons
          // Modal will only close when user explicitly clicks Cancel or Verify
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>Verify UPI Payment</AutoText>
              {/* Remove close button - user must use Cancel or Verify buttons */}
            </View>
            
            <AutoText style={styles.modalDescription}>
              Enter the UPI transaction reference number from your payment app (if available), or use the transaction ID below.
            </AutoText>

            <View style={styles.inputContainer}>
              <AutoText style={styles.inputLabel}>Transaction Reference</AutoText>
              <TextInput
                style={[styles.textInput, { color: theme.textPrimary, borderColor: theme.border }]}
                value={upiTransactionRef}
                onChangeText={setUpiTransactionRef}
                placeholder="Enter transaction reference"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
              />
              {pendingUPITransactionId && (
                <AutoText style={styles.hintText}>
                  Default: {pendingUPITransactionId}
                </AutoText>
              )}
            </View>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton, { borderColor: theme.border }]}
                onPress={() => {
                  Alert.alert(
                    'Payment Pending',
                    'Your payment is pending verification. Please contact support with transaction ID: ' + (pendingUPITransactionId || 'N/A'),
                    [{ text: 'OK', onPress: () => {
                      setShowUPIVerificationModal(false);
                      setUpiTransactionRef('');
                      setPendingUPITransactionId(null);
                      setPendingUPIPlan(null);
                    }}]
                  );
                }}
              >
                <AutoText style={[styles.modalButtonText, { color: theme.textSecondary }]}>
                  Verify Later
                </AutoText>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.modalButton, styles.verifyButton, { backgroundColor: theme.primary }]}
                onPress={async () => {
                  if (!pendingUPIPlan || !userData?.id || !pendingUPITransactionId) {
                    Alert.alert('Error', 'Payment data not found. Please try again.');
                    return;
                  }

                  const transactionRef = upiTransactionRef.trim() || pendingUPITransactionId;
                  
                  try {
                    setIsProcessingPayment(true);
                    const saveResult = await saveUserSubscription(
                      userData.id,
                      pendingUPIPlan.id,
                      {
                        transactionId: transactionRef,
                        responseCode: '00',
                        approvalRefNo: transactionRef,
                        amount: pendingUPIPlan.price.toString(),
                        paymentMethod: 'UPI',
                      }
                    );

                    if (saveResult.status === 'success') {
                      Alert.alert(
                        'Payment Submitted',
                        `Payment verification submitted successfully!\nTransaction ID: ${transactionRef}\n\nOur admin team will review your subscription request and notify you soon. You can check your subscription status in your profile.`,
                        [
                          {
                            text: 'OK',
                            onPress: () => {
                              setShowUPIVerificationModal(false);
                              setUpiTransactionRef('');
                              setPendingUPITransactionId(null);
                              setPendingUPIPlan(null);
                              navigation.goBack();
                            },
                          },
                        ]
                      );
                    } else {
                      throw new Error(saveResult.msg || 'Failed to save subscription');
                    }
                  } catch (error: any) {
                    console.error('Error saving subscription:', error);
                    Alert.alert(
                      'Verification Error',
                      error.message || 'Failed to verify payment. Please contact support with transaction ID: ' + transactionRef
                    );
                  } finally {
                    setIsProcessingPayment(false);
                  }
                }}
                disabled={isProcessingPayment}
              >
                <AutoText style={[styles.modalButtonText, { color: '#FFFFFF' }]}>
                  {isProcessingPayment ? 'Verifying...' : 'Verify Payment'}
                </AutoText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
      paddingHorizontal: '20@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.background,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: '8@s',
      marginLeft: '-8@s',
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    headerSpacer: {
      width: '40@s',
    },
    scrollContent: {
      padding: '16@s',
      paddingBottom: '30@vs',
    },
    plansHeader: {
      marginBottom: '20@vs',
    },
    plansTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    plansSubtitle: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    statusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: themeName === 'dark' ? 'rgba(255, 152, 0, 0.1)' : 'rgba(255, 152, 0, 0.1)',
      padding: '12@s',
      borderRadius: '8@ms',
      marginTop: '12@vs',
      borderWidth: 1,
      borderColor: '#FF9800',
      gap: '10@s',
    },
    statusBannerApproved: {
      backgroundColor: themeName === 'dark' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(76, 175, 80, 0.1)',
      borderColor: '#4CAF50',
    },
    statusBannerRejected: {
      backgroundColor: themeName === 'dark' ? 'rgba(244, 67, 54, 0.1)' : 'rgba(244, 67, 54, 0.1)',
      borderColor: '#F44336',
    },
    statusText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: '#FF9800',
      flex: 1,
    },
    statusTextApproved: {
      color: '#4CAF50',
    },
    statusTextRejected: {
      color: '#F44336',
    },
    planCard: {
      marginBottom: '16@vs',
      position: 'relative',
      borderWidth: 2,
      borderColor: theme.border,
    },
    disabledPlanCard: {
      opacity: 0.7,
    },
    popularPlanCard: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    selectedPlanCard: {
      borderColor: theme.primary,
      backgroundColor: themeName === 'dark' ? 'rgba(74, 144, 226, 0.1)' : 'rgba(74, 144, 226, 0.05)',
    },
    popularSelectedPlanCard: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: themeName === 'dark' ? 'rgba(74, 144, 226, 0.15)' : 'rgba(74, 144, 226, 0.08)',
    },
    popularBadge: {
      position: 'absolute',
      top: '-10@vs',
      right: '50@s',
      backgroundColor: theme.primary,
      paddingHorizontal: '12@s',
      paddingVertical: '4@vs',
      borderRadius: '12@ms',
      zIndex: 1,
    },
    popularBadgeText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '10@s',
      color: '#FFFFFF',
    },
    planHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: '16@vs',
    },
    planHeaderLeft: {
      flex: 1,
    },
    planName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '6@vs',
    },
    priceContainer: {
      flexDirection: 'row',
      alignItems: 'baseline',
    },
    priceSymbol: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.primary,
    },
    priceAmount: {
      fontFamily: 'Poppins-Bold',
      fontSize: '24@s',
      color: theme.primary,
    },
    priceDuration: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginLeft: '4@s',
    },
    radioButton: {
      width: '24@s',
      height: '24@s',
      borderRadius: '12@ms',
      borderWidth: 2,
      borderColor: theme.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    radioButtonSelected: {
      borderColor: theme.primary,
    },
    radioButtonInner: {
      width: '12@s',
      height: '12@s',
      borderRadius: '6@ms',
      backgroundColor: theme.primary,
    },
    featuresContainer: {
      marginBottom: '16@vs',
    },
    featureRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '10@vs',
      gap: '10@s',
    },
    featureText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textPrimary,
      flex: 1,
    },
    subscribeButtonContainer: {
      marginTop: '8@vs',
    },
    disabledButton: {
      paddingVertical: '14@vs',
      paddingHorizontal: '20@s',
      borderRadius: '8@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabledButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      textAlign: 'center',
    },
    infoCard: {
      marginTop: '8@vs',
    },
    infoRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: '12@s',
    },
    infoText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      flex: 1,
      lineHeight: '16@s',
      flexWrap: 'wrap',
    },
    loadingContainer: {
      padding: '40@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    emptyContainer: {
      padding: '40@vs',
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '16@vs',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '20@s',
    },
    modalContent: {
      backgroundColor: theme.background,
      borderRadius: '16@ms',
      padding: '20@s',
      width: '100%',
      maxWidth: '400@s',
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16@vs',
    },
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    modalCloseButton: {
      padding: '4@s',
    },
    modalDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
      marginBottom: '20@vs',
      lineHeight: '18@s',
    },
    inputContainer: {
      marginBottom: '20@vs',
    },
    inputLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    textInput: {
      borderWidth: 1,
      borderRadius: '8@ms',
      paddingHorizontal: '12@s',
      paddingVertical: '12@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      backgroundColor: theme.cardBackground || theme.background,
    },
    hintText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginTop: '6@vs',
      fontStyle: 'italic',
    },
    modalButtons: {
      flexDirection: 'row',
      gap: '12@s',
    },
    modalButton: {
      flex: 1,
      paddingVertical: '14@vs',
      borderRadius: '8@ms',
      alignItems: 'center',
      justifyContent: 'center',
    },
    cancelButton: {
      borderWidth: 1,
      backgroundColor: 'transparent',
    },
    verifyButton: {
      // backgroundColor set inline
    },
    modalButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
    },
    qrCodeContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      marginVertical: '20@vs',
      padding: '20@s',
      backgroundColor: '#FFFFFF',
      borderRadius: '12@ms',
    },
    qrCodeView: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: '10@s',
      backgroundColor: '#FFFFFF',
    },
    qrCodeImage: {
      width: '250@s',
      height: '250@s',
    },
    payButton: {
      paddingVertical: '14@vs',
      borderRadius: '8@ms',
      alignItems: 'center',
      marginBottom: '12@vs',
    },
    payButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
    },
    cancelButtonModal: {
      paddingVertical: '12@vs',
      borderRadius: '8@ms',
      alignItems: 'center',
      borderWidth: 1,
    },
    cancelButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
    },
    closeButton: {
      padding: '4@s',
    },
  });

export default SubscriptionPlansScreen;

