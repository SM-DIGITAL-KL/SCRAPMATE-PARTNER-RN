import React, { useState, useMemo } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { useUserSubcategoryRequests } from '../../hooks/useCategories';
import { UserSubcategoryRequest } from '../../services/api/v2/categories';

const SubcategoryRequestsScreen = () => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, isDark, themeName), [theme, isDark, themeName]);
  const [userData, setUserData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

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

  // Fetch user's subcategory requests
  const {
    data: requestsData,
    isLoading,
    error,
    refetch,
  } = useUserSubcategoryRequests(userData?.id, !!userData?.id);

  const requests = requestsData?.data || [];

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }, [refetch]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#4CAF50'; // Green
      case 'rejected':
        return '#F44336'; // Red
      case 'pending':
        return '#FF9800'; // Orange
      default:
        return theme.textSecondary;
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'approved':
        return '#E8F5E9'; // Light green
      case 'rejected':
        return '#FFEBEE'; // Light red
      case 'pending':
        return '#FFF3E0'; // Light orange
      default:
        return theme.border + '40';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'approved':
        return t('subcategoryRequests.approved') || t('userProfile.approved') || 'Approved';
      case 'rejected':
        return t('subcategoryRequests.rejected') || t('userProfile.rejected') || 'Rejected';
      case 'pending':
        return t('subcategoryRequests.pending') || t('userProfile.pending') || 'Pending';
      default:
        return status;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return 'check-circle';
      case 'rejected':
        return 'close-circle';
      case 'pending':
        return 'clock-outline';
      default:
        return 'help-circle';
    }
  };

  // Group requests by status
  const groupedRequests = useMemo(() => {
    const grouped: {
      pending: UserSubcategoryRequest[];
      approved: UserSubcategoryRequest[];
      rejected: UserSubcategoryRequest[];
    } = {
      pending: [],
      approved: [],
      rejected: [],
    };

    requests.forEach((request) => {
      const status = request.approval_status || 'pending';
      if (status === 'pending') {
        grouped.pending.push(request);
      } else if (status === 'approved') {
        grouped.approved.push(request);
      } else if (status === 'rejected') {
        grouped.rejected.push(request);
      }
    });

    return grouped;
  }, [requests]);

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  const renderRequestCard = (request: UserSubcategoryRequest) => {
    const statusColor = getStatusColor(request.approval_status);
    const statusBgColor = getStatusBgColor(request.approval_status);
    const statusLabel = getStatusLabel(request.approval_status);

    return (
      <View key={request.id} style={styles.requestCard}>
        <View style={styles.cardHeader}>
          <View style={styles.requestInfo}>
            <AutoText style={styles.subcategoryName} numberOfLines={2}>
              {request.subcategory_name}
            </AutoText>
            <View style={[styles.statusBadge, { backgroundColor: statusBgColor }]}>
              <AutoText style={[styles.statusText, { color: statusColor }]} numberOfLines={1}>
                {statusLabel}
              </AutoText>
            </View>
          </View>
          {request.main_category?.image ? (
            <Image
              source={{ uri: request.main_category.image }}
              style={styles.categoryImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.categoryImage, styles.categoryImagePlaceholder]}>
              <MaterialCommunityIcons
                name="package-variant"
                size={20}
                color={theme.textSecondary}
              />
            </View>
          )}
        </View>

        {request.main_category?.name && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="tag"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              {request.main_category.name}
            </AutoText>
          </View>
        )}

        <View style={styles.detailRow}>
          <MaterialCommunityIcons
            name="currency-inr"
            size={16}
            color={theme.primary}
          />
          <AutoText style={styles.detailText} numberOfLines={1}>
            ₹{request.default_price} / {request.price_unit.toUpperCase()}
          </AutoText>
        </View>

        <View style={styles.detailRow}>
          <MaterialCommunityIcons
            name="calendar-clock"
            size={16}
            color={theme.primary}
          />
          <AutoText style={styles.detailText} numberOfLines={1}>
            {formatDate(request.created_at)}
          </AutoText>
        </View>

        {request.approval_notes && (
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="note-text"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={3}>
              {t('subcategoryRequests.adminNotes') || 'Admin Notes'}: {request.approval_notes}
            </AutoText>
          </View>
        )}

        <View style={styles.cardFooter}>
          <View style={styles.footerInfo}>
            {request.updated_at && request.updated_at !== request.created_at && (
              <View style={styles.timeInfo}>
                <MaterialCommunityIcons
                  name="clock-outline"
                  size={14}
                  color={theme.textSecondary}
                />
                <AutoText style={styles.timeText}>
                  {t('subcategoryRequests.updatedOn') || 'Updated'}: {formatDate(request.updated_at)}
                </AutoText>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('subcategoryRequests.title') || t('userProfile.subcategoryRequests') || 'Subcategory Requests'}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <AutoText style={styles.loadingText} numberOfLines={1}>
              {t('common.loading') || 'Loading...'}
            </AutoText>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <MaterialCommunityIcons
              name="alert-circle"
              size={48}
              color={theme.error || '#F44336'}
            />
            <AutoText style={styles.errorText} numberOfLines={2}>
              {t('subcategoryRequests.error') || 'Failed to load requests'}
            </AutoText>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={() => refetch()}
            >
              <AutoText style={styles.retryButtonText} numberOfLines={1}>
                {t('common.retry') || 'Retry'}
              </AutoText>
            </TouchableOpacity>
          </View>
        ) : requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons
              name="file-document-outline"
              size={64}
              color={theme.textSecondary}
            />
            <AutoText style={styles.emptyText}>
              {t('subcategoryRequests.noRequests') || 'No subcategory requests found'}
            </AutoText>
          </View>
        ) : (
          <>
            {/* Pending Requests */}
            {groupedRequests.pending.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons
                      name="clock-time-four-outline"
                      size={20}
                      color={theme.primary}
                    />
                    <AutoText style={styles.sectionTitle} numberOfLines={1}>
                      {t('subcategoryRequests.pending') || t('userProfile.pending') || 'Pending'} ({groupedRequests.pending.length})
                    </AutoText>
                  </View>
                </View>
                {groupedRequests.pending.map(renderRequestCard)}
              </View>
            )}

            {/* Approved Requests */}
            {groupedRequests.approved.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={theme.primary}
                    />
                    <AutoText style={styles.sectionTitle} numberOfLines={1}>
                      {t('subcategoryRequests.approved') || t('userProfile.approved') || 'Approved'} ({groupedRequests.approved.length})
                    </AutoText>
                  </View>
                </View>
                {groupedRequests.approved.map(renderRequestCard)}
              </View>
            )}

            {/* Rejected Requests */}
            {groupedRequests.rejected.length > 0 && (
              <View style={styles.section}>
                <View style={styles.sectionHeader}>
                  <View style={styles.sectionTitleRow}>
                    <MaterialCommunityIcons
                      name="close-circle"
                      size={20}
                      color={theme.primary}
                    />
                    <AutoText style={styles.sectionTitle} numberOfLines={1}>
                      {t('subcategoryRequests.rejected') || t('userProfile.rejected') || 'Rejected'} ({groupedRequests.rejected.length})
                    </AutoText>
                  </View>
                </View>
                {groupedRequests.rejected.map(renderRequestCard)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, isDark: boolean, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '16@ms',
      paddingVertical: '12@ms',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    headerTitle: {
      fontSize: '18@ms',
      fontWeight: '600',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      padding: '16@ms',
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '40@ms',
    },
    loadingText: {
      marginTop: '12@ms',
      fontSize: '14@ms',
      color: theme.textSecondary,
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
    },
    errorText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    retryButton: {
      marginTop: '20@vs',
      paddingHorizontal: '24@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.primary,
      borderRadius: '8@ms',
    },
    retryButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@ms',
    },
    emptyText: {
      marginTop: '16@ms',
      fontSize: '16@ms',
      color: theme.textSecondary,
    },
    requestCard: {
      backgroundColor: theme.cardBackground || theme.card,
      borderRadius: '12@ms',
      padding: '16@ms',
      marginBottom: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    cardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '12@ms',
    },
    requestInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      marginRight: '12@ms',
    },
    subcategoryName: {
      fontSize: '16@ms',
      fontWeight: '600',
      color: theme.textPrimary,
      marginRight: '8@ms',
      flex: 1,
    },
    statusBadge: {
      paddingHorizontal: '8@ms',
      paddingVertical: '4@ms',
      borderRadius: '6@ms',
    },
    statusText: {
      fontSize: '12@ms',
      fontWeight: '500',
    },
    categoryImage: {
      width: '48@ms',
      height: '48@ms',
      borderRadius: '8@ms',
      backgroundColor: theme.border,
    },
    categoryImagePlaceholder: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.accent + '40',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: '8@ms',
    },
    detailText: {
      fontSize: '14@ms',
      color: theme.textPrimary,
      marginLeft: '8@ms',
      flex: 1,
    },
    cardFooter: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: '12@ms',
      paddingTop: '12@ms',
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    footerInfo: {
      flex: 1,
    },
    timeInfo: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    timeText: {
      fontSize: '12@ms',
      color: theme.textSecondary,
      marginLeft: '4@ms',
    },
    section: {
      marginBottom: '24@ms',
    },
    sectionHeader: {
      marginBottom: '12@ms',
    },
    sectionTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@ms',
    },
    sectionTitle: {
      fontSize: '16@ms',
      fontWeight: '600',
      color: theme.textPrimary,
    },
  });

export default SubcategoryRequestsScreen;
