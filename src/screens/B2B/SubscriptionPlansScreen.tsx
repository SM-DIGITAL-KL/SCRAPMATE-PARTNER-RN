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
import InstamojoWebView, { InstamojoPaymentResponse } from '../../components/InstamojoWebView';
import { getSubscriptionPackages, saveUserSubscription, SubscriptionPackage, checkSubscriptionExpiry } from '../../services/api/v2/subscriptionPackages';
import { createInstamojoPaymentRequest } from '../../services/api/v2/instamojo';
import { API_BASE_URL } from '../../services/api/apiConfig';

// Using SubscriptionPackage from API service

const SubscriptionPlansScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const { mode } = useUserMode();
  const [userData, setUserData] = useState<any>(null);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [plans, setPlans] = useState<SubscriptionPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInstamojoWebView, setShowInstamojoWebView] = useState(false);
  const [instamojoPaymentUrl, setInstamojoPaymentUrl] = useState('');
  const [currentPlan, setCurrentPlan] = useState<SubscriptionPackage | null>(null);
  const [paymentRequestId, setPaymentRequestId] = useState<string | null>(null);
  const [redirectUrl, setRedirectUrl] = useState<string>('');
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
          const language = i18n.language || 'en';
          const response = await getSubscriptionPackages(userType, language);
          
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
    }, [userData?.id, mode, i18n.language])
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

  // Handle Instamojo WebView payment response
  const handleInstamojoResponse = async (response: InstamojoPaymentResponse) => {
    console.log('📱 Instamojo Payment Response:', response);
    
    // Close WebView
    setShowInstamojoWebView(false);
    
    const planToUse = currentPlan || plans.find(p => p.id === selectedPlan);
    
    if (!planToUse || !userData?.id) {
      Alert.alert(t('subscriptionPlans.error'), t('subscriptionPlans.userInfoNotFound'));
      setCurrentPlan(null);
      setInstamojoPaymentUrl('');
      setPaymentRequestId(null);
      setRedirectUrl('');
      return;
    }

    if (response.status === 'success' && response.paymentId) {
      // Payment successful - save subscription
      const transactionId = response.paymentId;
      const requestId = response.paymentRequestId || paymentRequestId || null;
      
      // Calculate total amount (base + GST for B2C)
      const baseAmount = planToUse.price;
      const gstRate = 0.18; // 18% GST
      const gstAmount = mode === 'b2c' ? baseAmount * gstRate : 0;
      const totalAmount = baseAmount + gstAmount;
      
      console.log('✅ Payment successful, saving subscription:', {
        userId: userData.id,
        packageId: planToUse.id,
        transactionId,
        paymentRequestId: requestId,
        baseAmount,
        gstAmount,
        totalAmount,
      });

      try {
        // Save subscription with transaction details (use total amount including GST)
        const saveResult = await saveUserSubscription(
          userData.id,
          planToUse.id,
          {
            transactionId: transactionId,
            paymentRequestId: requestId,
            responseCode: '00',
            approvalRefNo: transactionId,
            amount: response.amount || totalAmount.toString(),
            paymentMethod: 'Instamojo',
          }
        );

        if (saveResult.status === 'success') {
          Alert.alert(
            t('subscriptionPlans.paymentSubmitted'),
            t('subscriptionPlans.paymentSubmittedMessage', { transactionId }),
            [
              {
                text: t('common.ok'),
                onPress: () => {
                  navigation.goBack();
                },
              },
            ]
          );
        } else {
          Alert.alert(
            t('subscriptionPlans.subscriptionError'),
            saveResult.msg || t('subscriptionPlans.paymentSuccessSubscriptionFailed', { transactionId })
          );
        }
      } catch (saveError: any) {
        console.error('Error saving subscription:', saveError);
        Alert.alert(
          t('subscriptionPlans.subscriptionError'),
          t('subscriptionPlans.paymentSuccessSubscriptionFailed', { transactionId })
        );
      }
    } else if (response.status === 'cancelled') {
      console.log('⚠️ Instamojo Payment Cancelled');
      Alert.alert(t('subscriptionPlans.paymentCancelled'), t('subscriptionPlans.paymentCancelledMessage'));
    } else {
      console.error('❌ Instamojo Payment Failed:', response);
      Alert.alert(t('subscriptionPlans.paymentFailed'), response.message || response.error || t('subscriptionPlans.paymentFailedMessage'));
    }
    
    // Reset state
    setCurrentPlan(null);
    setInstamojoPaymentUrl('');
    setPaymentRequestId(null);
    setRedirectUrl('');
  };

  const handleSubscribe = async (plan: SubscriptionPackage) => {
    // For percentage-based plans, no upfront payment is required
    if (plan.isPercentageBased && plan.pricePercentage !== undefined) {
      Alert.alert(
        t('subscriptionPlans.subscribeToPlan'),
        t('subscriptionPlans.percentageChargeMessage', { percentage: plan.pricePercentage.toFixed(1) }),
        [
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
          {
            text: t('subscriptionPlans.subscribe'),
            onPress: async () => {
              // For percentage-based plans, we can activate subscription without payment
              // The actual charge happens when orders are accepted
              Alert.alert(
                t('subscriptionPlans.subscriptionActivated'),
                t('subscriptionPlans.percentageActivatedMessage', { 
                  planName: plan.name,
                  percentage: plan.pricePercentage?.toFixed(1) || '0.5'
                }),
                [{ text: t('common.ok'), onPress: () => navigation.goBack() }]
              );
            },
          },
        ]
      );
      return;
    }

    // For fixed-price plans, proceed with Instamojo payment
    // For B2C subscription, use Instamojo Android SDK
    handleInstamojoPayment(plan);
  };

  const handleInstamojoPayment = async (plan: SubscriptionPackage) => {
    if (isProcessingPayment) return;
    
    setIsProcessingPayment(true);
    try {
      if (!userData?.id) {
        Alert.alert(t('subscriptionPlans.error'), t('subscriptionPlans.userInfoNotFound'));
        setIsProcessingPayment(false);
        return;
      }

      // Get user profile data for buyer information
      const shop = profileData?.shop as any;
      const buyerName = userData.name || shop?.shopname || 'User';
      const buyerEmail = userData.email || shop?.email || '';
      const buyerPhone = String(userData.mob_num || shop?.contact || '').replace(/\D/g, '');

      if (!buyerEmail || !buyerPhone) {
        Alert.alert(
          t('subscriptionPlans.incompleteProfile'),
          t('subscriptionPlans.incompleteProfileMessage')
        );
          setIsProcessingPayment(false);
        return;
      }

      // Create redirect URL - use v2 API endpoint for payment callback
      const redirectUrlValue = `${API_BASE_URL}/v2/instamojo/payment-redirect`;
      setRedirectUrl(redirectUrlValue);

      // Calculate GST (18%) for B2C users
      const baseAmount = plan.price;
      const gstRate = 0.18; // 18% GST
      const gstAmount = mode === 'b2c' ? baseAmount * gstRate : 0;
      const totalAmount = baseAmount + gstAmount;

      // Create payment request via API
      console.log('💳 Creating Instamojo payment request:', {
        userId: userData.id,
        packageId: plan.id,
        baseAmount: baseAmount,
        gstAmount: gstAmount,
        totalAmount: totalAmount,
        purpose: plan.name || 'B2C Subscription Payment',
        buyerName,
        buyerEmail,
        buyerPhone,
      });

      // Create payment request via API with total amount (base + GST for B2C)
      const paymentRequest = await createInstamojoPaymentRequest({
        purpose: plan.name || 'B2C Subscription Payment',
        amount: totalAmount.toString(),
        buyer_name: buyerName,
        email: buyerEmail,
        phone: buyerPhone,
        redirect_url: redirectUrlValue,
        send_email: false,
        send_sms: false,
        allow_repeated_payments: false,
      });

      if (!paymentRequest.data?.longurl) {
        throw new Error('Failed to get payment URL from Instamojo');
      }

      console.log('✅ Instamojo payment request created:', {
        payment_request_id: paymentRequest.data.payment_request_id,
        longurl: paymentRequest.data.longurl,
      });

      setPaymentRequestId(paymentRequest.data.payment_request_id);
      setInstamojoPaymentUrl(paymentRequest.data.longurl);
      setCurrentPlan(plan);
      setShowInstamojoWebView(true);
      setIsProcessingPayment(false);
    } catch (error: any) {
      console.error('Error processing Instamojo payment:', error);
      Alert.alert(
        t('subscriptionPlans.paymentError'),
        error.message || t('subscriptionPlans.paymentRequestFailed')
      );
      setIsProcessingPayment(false);
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
          {t('subscriptionPlans.title')}
        </AutoText>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Plans Header */}
        <View style={styles.plansHeader}>
          <AutoText style={styles.plansTitle}>{t('subscriptionPlans.chooseYourPlan')}</AutoText>
          <AutoText style={styles.plansSubtitle}>
            {t('subscriptionPlans.selectPlanSubtitle')}
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
                      {t('subscriptionPlans.lastPaymentRejected')}
                    </AutoText>
                    {rejectionReason ? (
                      <AutoText style={[styles.statusText, styles.statusTextRejected, { marginTop: 4, fontSize: 12 }]}>
                        {t('subscriptionPlans.rejectionReason', { reason: rejectionReason })}
                      </AutoText>
                    ) : (
                      <AutoText style={[styles.statusText, styles.statusTextRejected, { marginTop: 4, fontSize: 12 }]}>
                        {t('subscriptionPlans.rejectionMessage')}
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
                    {t('subscriptionPlans.paymentPending')}
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
                      {t('subscriptionPlans.currentPlan', { planName: currentPlanName })}
                    </AutoText>
                    <AutoText style={[styles.statusText, styles.statusTextApproved, { marginTop: 4, fontSize: 12 }]}>
                      {t('subscriptionPlans.validUntil', { date: formattedDate })}
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
            <AutoText style={styles.loadingText}>{t('subscriptionPlans.loadingPackages')}</AutoText>
          </View>
        )}

        {/* Empty State */}
        {!loading && plans.length === 0 && (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="package-variant" size={48} color={theme.textSecondary} />
            <AutoText style={styles.emptyText}>{t('subscriptionPlans.noPackagesAvailable')}</AutoText>
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
          
          // Calculate GST for B2C users
          const baseAmount = plan.price;
          const gstRate = 0.18; // 18% GST
          const gstAmount = mode === 'b2c' && !plan.isPercentageBased ? baseAmount * gstRate : 0;
          const totalAmount = baseAmount + gstAmount;
          
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
                <AutoText style={styles.popularBadgeText}>{t('subscriptionPlans.mostPopular')}</AutoText>
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
                          {plan.duration === 'order' ? t('subscriptionPlans.ofOrderValue') : plan.duration === 'month' ? t('subscriptionPlans.perMonth') : plan.duration === 'year' ? t('subscriptionPlans.perYear') : `/${plan.duration}`}
                        </AutoText>
                      </>
                    ) : (
                      <>
                        <AutoText style={styles.priceSymbol}>₹</AutoText>
                        <AutoText style={styles.priceAmount}>{totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</AutoText>
                        <AutoText style={styles.priceDuration}>
                          {plan.duration === 'order' ? t('subscriptionPlans.perOrder') : plan.duration === 'month' ? t('subscriptionPlans.perMonth') : plan.duration === 'year' ? t('subscriptionPlans.perYear') : `/${plan.duration}`}
                        </AutoText>
                      </>
                    )}
                  </View>
                  {/* Show GST breakdown for B2C users */}
                  {mode === 'b2c' && !plan.isPercentageBased && gstAmount > 0 && (
                    <View style={styles.gstBreakdown}>
                      <AutoText style={styles.gstBreakdownText}>
                        {t('subscriptionPlans.gstBreakdown', { 
                          baseAmount: baseAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
                          gstAmount: gstAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 })
                        })}
                      </AutoText>
                    </View>
                  )}
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
                    {t('subscriptionPlans.automaticCharges')}
                  </AutoText>
                </View>
              ) : shouldDisablePlan ? (
                <View style={[styles.disabledButton, { backgroundColor: theme.border, opacity: 0.6 }]}>
                  <AutoText style={[styles.disabledButtonText, { color: theme.textSecondary }]}>
                    {t('subscriptionPlans.alreadySubscribed')}
                  </AutoText>
                </View>
              ) : (
                <GreenButton
                  title={
                    isProcessingPayment 
                      ? t('subscriptionPlans.processing')
                      : plan.isPercentageBased && plan.pricePercentage !== undefined
                        ? t('subscriptionPlans.subscribePercentage', { percentage: plan.pricePercentage.toFixed(1) })
                        : t('subscriptionPlans.subscribeAmount', { 
                            amount: totalAmount.toLocaleString('en-IN', { maximumFractionDigits: 2 }),
                            duration: plan.duration === 'order' ? t('subscriptionPlans.perOrder') : plan.duration === 'month' ? t('subscriptionPlans.perMonth') : plan.duration === 'year' ? t('subscriptionPlans.perYear') : `/${plan.duration}`
                          })
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
                ? t('subscriptionPlans.b2bInfo')
                : t('subscriptionPlans.b2cInfo')
              }
            </AutoText>
          </View>
        </SectionCard>
      </ScrollView>

      {/* Instamojo WebView Modal */}
      {showInstamojoWebView && instamojoPaymentUrl && currentPlan && (
        <InstamojoWebView
          visible={showInstamojoWebView}
          onClose={() => {
            setShowInstamojoWebView(false);
            setCurrentPlan(null);
            setInstamojoPaymentUrl('');
            setPaymentRequestId(null);
          }}
          onPaymentResponse={handleInstamojoResponse}
          paymentUrl={instamojoPaymentUrl}
          redirectUrl={redirectUrl}
        />
      )}
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
    gstBreakdown: {
      marginTop: '4@vs',
    },
    gstBreakdownText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      fontStyle: 'italic',
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

