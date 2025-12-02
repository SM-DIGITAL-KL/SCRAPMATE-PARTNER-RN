import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Alert } from 'react-native';
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
import UPIPaymentService from '../../services/upi/UPIPaymentService';
import { getSubscriptionPackages, SubscriptionPackage } from '../../services/api/v2/subscriptionPackages';

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
  const { data: profileData } = useProfile(userData?.id, !!userData?.id);

  // Fetch subscription packages from API
  useFocusEffect(
    React.useCallback(() => {
      const fetchPackages = async () => {
        try {
          setLoading(true);
          // Determine user type from UserModeContext (b2c or b2b)
          // Default to 'b2c' if mode is not available
          const userType = (mode === 'b2b' || mode === 'b2c') ? mode : 'b2c';
          const response = await getSubscriptionPackages(userType);
          
          if (response.status === 'success' && response.data) {
            setPlans(response.data);
          } else {
            console.error('Failed to fetch subscription packages:', response.message);
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
    setSelectedPlan(planId);
  };

  const handleSubscribe = async (plan: SubscriptionPackage) => {
    // Confirm subscription
    Alert.alert(
      'Subscribe to Plan',
      `Are you sure you want to subscribe to ${plan.name} for ₹${plan.price}/${plan.duration}?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Pay Now',
          onPress: async () => {
            if (isProcessingPayment) return;
            
            setIsProcessingPayment(true);
            try {
              // Generate transaction ID
              const transactionId = `TXN${Date.now()}`;
              
              // Get UPI ID and merchant name from package or use defaults
              const upiId = plan.upiId || '7736068251@pthdfc';
              const merchantName = plan.merchantName || 'Scrapmate Partner';
              
              // Initiate UPI payment
              const result = await UPIPaymentService.initiatePayment({
                upiId: upiId,
                amount: plan.price.toString(),
                transactionId: transactionId,
                merchantName: merchantName,
              });
              
              if (result.status === 'success') {
                // Payment successful - call subscription API
                Alert.alert(
                  'Payment Successful',
                  `Payment completed successfully!\nTransaction ID: ${result.transactionId || transactionId}\n\nSubscribing to ${plan.name}...`,
                  [
                    {
                      text: 'OK',
                      onPress: () => {
                        // TODO: Call subscription API with transaction details
                        console.log('Payment successful, subscribing to plan:', plan.id);
                        console.log('Transaction ID:', result.transactionId);
                        // navigation.goBack();
                      },
                    },
                  ]
                );
              } else if (result.status === 'cancelled') {
                Alert.alert('Payment Cancelled', 'Payment was cancelled. Please try again to subscribe.');
              } else {
                Alert.alert('Payment Failed', result.message || 'Payment failed. Please try again.');
              }
            } catch (error: any) {
              console.error('UPI Payment Error:', error);
              Alert.alert(
                'Payment Error',
                error.message || 'Failed to initiate payment. Please try again.'
              );
            } finally {
              setIsProcessingPayment(false);
            }
          },
        },
      ]
    );
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
        {!loading && plans.map((plan) => (
          <SectionCard
            key={plan.id}
            style={[
              styles.planCard,
              selectedPlan === plan.id && styles.selectedPlanCard,
              plan.popular && !selectedPlan && styles.popularPlanCard,
              plan.popular && selectedPlan === plan.id && styles.popularSelectedPlanCard,
            ]}
          >
            {plan.popular && (
              <View style={styles.popularBadge}>
                <AutoText style={styles.popularBadgeText}>Most Popular</AutoText>
              </View>
            )}
            
            <TouchableOpacity
              activeOpacity={0.9}
              onPress={() => handleSelectPlan(plan.id)}
            >
              <View style={styles.planHeader}>
                <View style={styles.planHeaderLeft}>
                  <AutoText style={styles.planName}>{plan.name}</AutoText>
                  <View style={styles.priceContainer}>
                    <AutoText style={styles.priceSymbol}>₹</AutoText>
                    <AutoText style={styles.priceAmount}>{plan.price.toLocaleString('en-IN')}</AutoText>
                    <AutoText style={styles.priceDuration}>
                      {plan.duration === 'order' ? ' + GST per order' : `/${plan.duration} + GST`}
                    </AutoText>
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
            </TouchableOpacity>

            <View style={styles.subscribeButtonContainer}>
              <GreenButton
                title={
                  isProcessingPayment 
                    ? 'Processing...' 
                    : `Subscribe - ₹${plan.price.toLocaleString('en-IN')}${plan.duration === 'order' ? ' + GST per order' : `/${plan.duration} + GST`}`
                }
                onPress={() => handleSubscribe(plan)}
                disabled={isProcessingPayment}
              />
            </View>
          </SectionCard>
        ))}

        {/* Info Section */}
        <SectionCard style={styles.infoCard}>
          <View style={styles.infoRow}>
            <MaterialCommunityIcons name="information" size={20} color={theme.primary} />
            <AutoText style={styles.infoText} numberOfLines={0}>
              All plans include unlimited orders. Cancel anytime from your account settings.
            </AutoText>
          </View>
        </SectionCard>
      </ScrollView>
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
    planCard: {
      marginBottom: '16@vs',
      position: 'relative',
      borderWidth: 2,
      borderColor: theme.border,
    },
    popularPlanCard: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    selectedPlanCard: {
      borderColor: theme.primary,
      backgroundColor: themeName === 'dark' ? 'rgba(74, 144, 226, 0.1)' : 'rgba(74, 144, 226, 0.05)',
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
  });

export default SubscriptionPlansScreen;

