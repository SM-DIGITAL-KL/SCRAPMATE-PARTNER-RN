import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useProfile } from '../../hooks/useProfile';
import { getUserData } from '../../services/auth/authService';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ApprovalWorkflowScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [userData, setUserData] = useState<any>(null);
  const [demoStatus, setDemoStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  // Check if user came from profile settings
  const fromProfile = route?.params?.fromProfile || false;

  // Load user data
  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
      };
      loadUserData();
    }, [])
  );

  // Fetch profile data to get approval status - refetch on focus to get latest status
  const { data: profileData, refetch: refetchProfile } = useProfile(userData?.id, !!userData?.id);
  
  // Refetch profile when screen comes into focus to get latest approval status
  useFocusEffect(
    React.useCallback(() => {
      if (userData?.id) {
        // Small delay to ensure navigation is complete
        const timer = setTimeout(() => {
          refetchProfile();
        }, 200);
        return () => clearTimeout(timer);
      }
    }, [userData?.id, refetchProfile])
  );
  
  // Get approval status from profile - support both shop (B2B/B2C) and delivery/delivery_boy (Delivery)
  const approvalStatus = profileData?.shop?.approval_status || profileData?.delivery?.approval_status || profileData?.delivery_boy?.approval_status || 'pending';
  const rejectionReason = profileData?.shop?.rejection_reason || profileData?.delivery?.rejection_reason || profileData?.delivery_boy?.rejection_reason || null;
  
  // Get timestamps from profile - support both shop (B2B/B2C) and delivery/delivery_boy (Delivery)
  const applicationSubmittedAt = profileData?.shop?.application_submitted_at || profileData?.delivery?.application_submitted_at || profileData?.delivery_boy?.application_submitted_at || null;
  const documentsVerifiedAt = profileData?.shop?.documents_verified_at || profileData?.delivery?.documents_verified_at || profileData?.delivery_boy?.documents_verified_at || null;
  const reviewInitiatedAt = profileData?.shop?.review_initiated_at || profileData?.delivery?.review_initiated_at || profileData?.delivery_boy?.review_initiated_at || null;
  
  // Format timestamp for display
  const formatTimestamp = (timestamp: string | null) => {
    if (!timestamp) return null;
    try {
      const date = new Date(timestamp);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      // Check if it's today
      if (date.toDateString() === today.toDateString()) {
        return `Today, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      }
      // Check if it's yesterday
      if (date.toDateString() === yesterday.toDateString()) {
        return `Yesterday, ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`;
      }
      // Otherwise show date and time
      return date.toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit', 
        hour12: true 
      });
    } catch (e) {
      return null;
    }
  };
  
  // Map approval status to display status
  const getDisplayStatus = (): 'Pending' | 'Approved' | 'Rejected' => {
    if (approvalStatus === 'approved') return 'Approved';
    if (approvalStatus === 'rejected') return 'Rejected';
    return 'Pending';
  };
  
  const status = getDisplayStatus(); // Use actual approval status from API

  // Calculate application progress based on approval status
  const getApplicationProgress = (): number => {
    if (approvalStatus === 'approved') return 100;
    if (approvalStatus === 'rejected') return 0;
    if (approvalStatus === 'pending') return 50;
    return 50; // Default to 50% for unknown status
  };

  const applicationProgress = getApplicationProgress();

  // Sync AsyncStorage with latest approval status (for both B2B and B2C)
  React.useEffect(() => {
    const syncApprovalStatus = async () => {
      if (approvalStatus && userData?.id) {
        try {
          // Check user type to determine which status to sync
          const userType = userData?.user_type;
          
          if (userType === 'S' || userType === 'SR') {
            // B2B user - sync to @b2b_status
            await AsyncStorage.setItem('@b2b_status', approvalStatus);
            console.log('✅ ApprovalWorkflowScreen: Synced @b2b_status to AsyncStorage:', approvalStatus);
            
            // Handle rejected status - navigate to signup screen
            if (!fromProfile && approvalStatus === 'rejected') {
              console.log('✅ Approval status is rejected, navigating to DealerSignup');
              setTimeout(() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'DealerSignup' }],
                });
              }, 1000);
            }
            // Only auto-navigate if NOT coming from profile settings
            else if (!fromProfile && approvalStatus === 'approved') {
              console.log('✅ Approval status is approved, navigating to DealerDashboard');
              setTimeout(() => {
                navigation.replace('DealerDashboard');
              }, 1000);
            }
          } else if (userType === 'R' || userType === 'SR') {
            // B2C user - sync to @b2c_approval_status
            await AsyncStorage.setItem('@b2c_approval_status', approvalStatus);
            console.log('✅ ApprovalWorkflowScreen: Synced @b2c_approval_status to AsyncStorage:', approvalStatus);
            
            // Handle rejected status - navigate to signup screen
            if (!fromProfile && approvalStatus === 'rejected') {
              console.log('✅ Approval status is rejected, navigating to B2CSignup');
              setTimeout(() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'B2CSignup' }],
                });
              }, 1000);
            }
            // Only auto-navigate if NOT coming from profile settings
            else if (!fromProfile && approvalStatus === 'approved') {
              console.log('✅ Approval status is approved, navigating to Dashboard');
              setTimeout(() => {
                navigation.replace('Dashboard');
              }, 1000);
            }
          } else if (userType === 'D') {
            // Delivery/Door Step user - sync to @delivery_approval_status
            await AsyncStorage.setItem('@delivery_approval_status', approvalStatus);
            console.log('✅ ApprovalWorkflowScreen: Synced @delivery_approval_status to AsyncStorage:', approvalStatus);
            
            // Handle rejected status - navigate to signup screen
            if (!fromProfile && approvalStatus === 'rejected') {
              console.log('✅ Approval status is rejected, navigating to VehicleInformation');
              setTimeout(() => {
                navigation.reset({
                  index: 0,
                  routes: [{ name: 'VehicleInformation' }],
                });
              }, 1000);
            }
            // Only auto-navigate if NOT coming from profile settings
            else if (!fromProfile && approvalStatus === 'approved') {
              console.log('✅ Approval status is approved, navigating to Dashboard');
              setTimeout(() => {
                navigation.replace('Dashboard');
              }, 1000);
            }
          }
        } catch (error) {
          console.error('❌ Error syncing approval status:', error);
        }
      }
    };
    
    syncApprovalStatus();
  }, [approvalStatus, userData?.id, userData?.user_type, fromProfile, navigation]);

  // Auto-navigate to dashboard after 3 seconds if status is pending (only if NOT from profile)
  React.useEffect(() => {
    // Don't auto-navigate if user came from profile settings
    if (fromProfile) {
      return;
    }
    
    // Check actual approval status from API
    const isPending = approvalStatus === 'pending' || approvalStatus === null || approvalStatus === '';
    
    if (isPending) {
      // Determine which dashboard to navigate to based on user type
      const userType = userData?.user_type;
      const targetDashboard = (userType === 'S' || userType === 'SR') ? 'DealerDashboard' : 'Dashboard';
      
      console.log(`⏳ Approval status is pending, will navigate to ${targetDashboard} in 3 seconds`);
      const timer = setTimeout(() => {
        console.log(`✅ Navigating to ${targetDashboard} after 3 seconds`);
        navigation.replace(targetDashboard);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [approvalStatus, userData?.user_type, navigation, fromProfile]);

  // Build updates array dynamically based on available timestamps
  const updates = [];
  
  // Application Submitted - always show if timestamp exists
  if (applicationSubmittedAt) {
    updates.push({
      id: '1',
      title: t('approvalWorkflow.applicationSubmitted'),
      description: t('approvalWorkflow.applicationSubmittedDesc'),
      time: formatTimestamp(applicationSubmittedAt) || 'N/A',
      icon: 'check-circle',
      completed: true,
    });
  }
  
  // Documents Verified - show if timestamp exists
  if (documentsVerifiedAt) {
    updates.push({
      id: '2',
      title: t('approvalWorkflow.documentsVerified'),
      description: t('approvalWorkflow.documentsVerifiedDesc'),
      time: formatTimestamp(documentsVerifiedAt) || 'N/A',
      icon: 'file-check',
      completed: true,
    });
  } else if (approvalStatus === 'approved' || approvalStatus === 'rejected') {
    // Show as pending if status is approved/rejected but no timestamp (shouldn't happen, but handle gracefully)
    updates.push({
      id: '2',
      title: t('approvalWorkflow.documentsVerified'),
      description: t('approvalWorkflow.documentsVerifiedDesc'),
      time: 'Pending',
      icon: 'file-check',
      completed: false,
    });
  }
  
  // Internal Review Initiated - show if timestamp exists
  if (reviewInitiatedAt) {
    updates.push({
      id: '3',
      title: t('approvalWorkflow.internalReviewInitiated'),
      description: t('approvalWorkflow.internalReviewInitiatedDesc'),
      time: formatTimestamp(reviewInitiatedAt) || 'N/A',
      icon: 'clock-outline',
      completed: true,
    });
  } else if (approvalStatus === 'pending') {
    // Show as pending if status is pending but no timestamp yet
    updates.push({
      id: '3',
      title: t('approvalWorkflow.internalReviewInitiated'),
      description: t('approvalWorkflow.internalReviewInitiatedDesc'),
      time: 'Pending',
      icon: 'clock-outline',
      completed: false,
    });
  }
  
  // If no updates available, show default message
  if (updates.length === 0) {
    updates.push({
      id: '1',
      title: t('approvalWorkflow.applicationSubmitted'),
      description: t('approvalWorkflow.applicationSubmittedDesc'),
      time: 'Pending',
      icon: 'check-circle',
      completed: false,
    });
  }

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
        <AutoText style={styles.headerTitle}>{t('approvalWorkflow.title')}</AutoText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Application Status */}
        <View style={styles.statusCard}>
          <MaterialCommunityIcons 
            name={status === 'Approved' ? 'check-circle' : status === 'Rejected' ? 'close-circle' : 'hourglass-outline'} 
            size={64} 
            color={status === 'Approved' ? '#4CAF50' : status === 'Rejected' ? '#F44336' : theme.primary} 
          />
          <AutoText style={styles.statusTitle}>
            {status === 'Approved' 
              ? t('approvalWorkflow.applicationApproved') || 'Application Approved'
              : status === 'Rejected'
              ? t('approvalWorkflow.applicationRejected') || 'Application Rejected'
              : t('approvalWorkflow.applicationPending')}
          </AutoText>
          <AutoText style={styles.statusDescription} numberOfLines={4}>
            {status === 'Approved'
              ? t('approvalWorkflow.applicationApprovedDesc') || 'Your application has been approved. You can now access all features.'
              : status === 'Rejected'
              ? t('approvalWorkflow.applicationRejectedDesc') || 'Your application has been rejected. Please contact support for more information.'
              : t('approvalWorkflow.applicationPendingDesc')}
          </AutoText>
          
          {/* Rejection Reason */}
          {status === 'Rejected' && rejectionReason && (
            <View style={[styles.rejectionReasonCard, { backgroundColor: '#F4433622', borderColor: '#F44336' }]}>
              <View style={styles.rejectionReasonHeader}>
                <MaterialCommunityIcons name="alert-circle" size={20} color="#F44336" />
                <AutoText style={[styles.rejectionReasonTitle, { color: '#F44336' }]}>
                  Rejection Reason
                </AutoText>
              </View>
              <AutoText style={[styles.rejectionReasonText, { color: '#721c24' }]}>
                {rejectionReason}
              </AutoText>
            </View>
          )}
          
          <View style={[
            styles.statusPill,
            status === 'Approved' && { backgroundColor: '#4CAF5022' },
            status === 'Rejected' && { backgroundColor: '#F4433622' }
          ]}>
            <AutoText style={[
              styles.statusPillText,
              status === 'Approved' && { color: '#4CAF50' },
              status === 'Rejected' && { color: '#F44336' }
            ]}>
              {status === 'Approved' 
                ? t('approvalWorkflow.approved') || 'Approved'
                : status === 'Rejected'
                ? t('approvalWorkflow.rejected') || 'Rejected'
                : t('approvalWorkflow.inReview')}
            </AutoText>
          </View>
          {profileData?.shop?.updated_at && (
            <AutoText style={styles.lastUpdated}>
              {t('approvalWorkflow.lastUpdated')}: {new Date(profileData.shop.updated_at).toLocaleDateString()}
            </AutoText>
          )}
        </View>

        {/* Application Progress */}
        <View style={styles.progressCard}>
          <View style={styles.progressHeader}>
            <AutoText style={styles.progressTitle}>{t('approvalWorkflow.applicationProgress')}</AutoText>
            <AutoText style={styles.progressPercent}>{applicationProgress}%</AutoText>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressInner, { width: `${applicationProgress}%` }]} />
          </View>
        </View>

        {/* Recent Updates */}
        <View style={styles.updatesSection}>
          <AutoText style={styles.sectionTitle}>{t('approvalWorkflow.recentUpdates')}</AutoText>
          {updates.map((update, index) => (
            <View key={update.id} style={styles.updateItem}>
              <View style={[
                styles.updateIconContainer,
                update.completed && { backgroundColor: theme.primary + '40' }
              ]}>
                <MaterialCommunityIcons 
                  name={update.icon as any} 
                  size={20} 
                  color={update.completed ? theme.primary : theme.textSecondary} 
                />
              </View>
              <View style={styles.updateContent}>
                <AutoText style={styles.updateTitle}>{update.title}</AutoText>
                <AutoText style={styles.updateDescription} numberOfLines={3}>
                  {update.description}
                </AutoText>
                <AutoText style={[
                  styles.updateTime,
                  !update.completed && { color: theme.textSecondary, fontStyle: 'italic' }
                ]}>
                  {update.time}
                </AutoText>
              </View>
            </View>
          ))}
        </View>

        {/* Contact Support Button */}
        <View style={styles.supportButtonContainer}>
          <OutlineGreenButton
            title={t('approvalWorkflow.contactSupport')}
            onPress={() => {}}
          />
        </View>

      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any) =>
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
      backgroundColor: theme.card,
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
      paddingBottom: '24@vs',
    },
    statusCard: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '16@s',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '18@vs',
      alignItems: 'center',
    },
    statusTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      marginTop: '14@vs',
      marginBottom: '12@vs',
    },
    statusDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: '20@vs',
      marginBottom: '16@vs',
      flexShrink: 1,
    },
    statusPill: {
      paddingVertical: '6@vs',
      paddingHorizontal: '16@s',
      borderRadius: '14@ms',
      backgroundColor: theme.primary + '22',
      marginBottom: '12@vs',
    },
    statusPillText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
    },
    lastUpdated: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    rejectionReasonCard: {
      marginTop: '16@vs',
      marginBottom: '16@vs',
      padding: '16@s',
      borderRadius: '12@ms',
      borderWidth: 1,
    },
    rejectionReasonHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '8@vs',
      gap: '8@s',
    },
    rejectionReasonTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
    },
    rejectionReasonText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      lineHeight: '20@vs',
    },
    progressCard: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '16@s',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '18@vs',
    },
    progressHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@vs',
    },
    progressTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    progressPercent: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.primary,
    },
    progressBar: {
      height: '10@vs',
      borderRadius: '18@ms',
      backgroundColor: theme.border,
      overflow: 'hidden',
    },
    progressInner: {
      height: '10@vs',
      borderRadius: '18@ms',
      backgroundColor: theme.primary,
    },
    updatesSection: {
      marginBottom: '18@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    updateItem: {
      flexDirection: 'row',
      marginBottom: '16@vs',
      gap: '12@s',
    },
    updateIconContainer: {
      width: '32@s',
      height: '32@s',
      borderRadius: '16@s',
      backgroundColor: theme.accent + '40',
      alignItems: 'center',
      justifyContent: 'center',
    },
    updateContent: {
      flex: 1,
    },
    updateTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    updateDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      lineHeight: '18@vs',
      marginBottom: '4@vs',
      flexShrink: 1,
    },
    updateTime: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
    },
    supportButtonContainer: {
      marginBottom: '24@vs',
    },
    demoControl: {
      flexDirection: 'row',
      gap: '12@s',
      marginTop: '8@vs',
    },
    statusButton: {
      flex: 1,
      paddingVertical: '10@vs',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    statusButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    statusButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    statusButtonTextActive: {
      color: theme.card,
    },
  });

export default ApprovalWorkflowScreen;

