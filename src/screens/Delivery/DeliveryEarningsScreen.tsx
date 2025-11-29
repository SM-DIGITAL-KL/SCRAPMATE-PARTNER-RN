import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';

interface RecentOrder {
  id: string;
  date: string;
  status: 'completed' | 'pending' | 'cancelled';
  earnings: string;
}

const DeliveryEarningsScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [timePeriod, setTimePeriod] = useState('thisMonth');
  const [chartPeriod, setChartPeriod] = useState('last6Months');
  
  const totalEarnings = 2875.50;
  const changePercentage = 5.2;
  
  const metrics = [
    { label: t('delivery.earnings.activeGigs'), value: '12', subtext: t('delivery.earnings.currentlyWorking'), icon: 'briefcase-outline', color: theme.primary },
    { label: t('delivery.earnings.avgEarningsPerGig'), value: '$239.63', subtext: t('delivery.earnings.thisMonth'), icon: 'currency-usd', color: themeName === 'whitePurple' ? theme.secondary : theme.accent },
    { label: t('delivery.earnings.completionRate'), value: '98%', subtext: t('delivery.earnings.last30Days'), icon: 'check-circle-outline', color: '#4CAF50' },
    { label: t('delivery.earnings.rating'), value: '4.8/5', subtext: t('delivery.earnings.overallFeedback'), icon: 'star-outline', color: themeName === 'whitePurple' ? theme.secondary : theme.primary },
  ];
  
  const monthlyEarnings = [550, 1100, 1650, 2200, 2500, 2875];
  const maxEarning = Math.max(...monthlyEarnings);
  
  const getLast6Months = () => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const currentDate = new Date();
    const last6Months = [];
    for (let i = 5; i >= 0; i--) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
      last6Months.push(months[date.getMonth()]);
    }
    return last6Months;
  };
  
  const monthLabels = getLast6Months();
  
  const recentOrders: RecentOrder[] = [
    { id: 'ORD001', date: '2023-10-26', status: 'completed', earnings: '$1' },
    { id: 'ORD002', date: '2023-10-25', status: 'pending', earnings: '$20' },
    { id: 'ORD003', date: '2023-10-24', status: 'completed', earnings: '$5' },
    { id: 'ORD004', date: '2023-10-23', status: 'completed', earnings: '$31' },
    { id: 'ORD005', date: '2023-10-22', status: 'cancelled', earnings: '$1' },
  ];
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'pending':
        return '#FF9800';
      case 'cancelled':
        return '#F44336';
      default:
        return theme.textSecondary;
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
        <AutoText style={styles.headerTitle}>{t('delivery.earnings.title')}</AutoText>
        <TouchableOpacity style={styles.iconButton} activeOpacity={0.7}>
          <MaterialCommunityIcons name="cog-outline" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Total Earnings */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.earnings.totalEarnings')}</AutoText>
          <View style={styles.earningsHeader}>
            <AutoText style={styles.earningsAmount}>${totalEarnings.toFixed(2)}</AutoText>
            <TouchableOpacity style={styles.periodSelector} activeOpacity={0.7}>
              <AutoText style={styles.periodText}>{t('delivery.earnings.thisMonth')}</AutoText>
              <MaterialCommunityIcons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.changeIndicator}>
            <MaterialCommunityIcons name="trending-up" size={16} color="#4CAF50" />
            <AutoText style={styles.changeText}>
              {changePercentage}% {t('delivery.earnings.vsLastMonth')}
            </AutoText>
          </View>
        </SectionCard>

        {/* Key Metrics */}
        <SectionCard>
          <View style={styles.metricsGrid}>
            {metrics.map((metric, index) => (
              <View key={index} style={styles.metricCard}>
                <View style={[styles.metricIconContainer, { backgroundColor: `${metric.color}20` }]}>
                  <MaterialCommunityIcons name={metric.icon as any} size={24} color={metric.color} />
                </View>
                <AutoText style={styles.metricValue}>{metric.value}</AutoText>
                <AutoText style={styles.metricLabel}>{metric.label}</AutoText>
                <AutoText style={styles.metricSubtext}>{metric.subtext}</AutoText>
              </View>
            ))}
          </View>
        </SectionCard>

        {/* Earnings Trend */}
        <SectionCard>
          <View style={styles.chartHeader}>
            <AutoText style={styles.sectionTitle}>{t('delivery.earnings.earningsTrend')}</AutoText>
            <TouchableOpacity style={styles.periodSelector} activeOpacity={0.7}>
              <AutoText style={styles.periodText}>{t('delivery.earnings.last6Months')}</AutoText>
              <MaterialCommunityIcons name="chevron-down" size={16} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {/* Bar Chart */}
          <View style={styles.chartContainer}>
            <View style={styles.chart}>
              {monthlyEarnings.map((earning, index) => {
                const height = (earning / maxEarning) * 120;
                return (
                  <View key={index} style={styles.barContainer}>
                    <View style={[styles.bar, { height: height }]} />
                    <AutoText style={styles.barLabel}>{monthLabels[index]}</AutoText>
                  </View>
                );
              })}
            </View>
          </View>
        </SectionCard>

        {/* Recent Orders */}
        <SectionCard>
          <View style={styles.ordersHeader}>
            <MaterialCommunityIcons name="cart-outline" size={20} color={theme.textPrimary} />
            <AutoText style={styles.sectionTitle}>{t('delivery.earnings.recentOrders')}</AutoText>
          </View>
          
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <AutoText style={styles.tableHeaderText}>{t('delivery.earnings.orderId')}</AutoText>
              <AutoText style={styles.tableHeaderText}>{t('delivery.earnings.date')}</AutoText>
              <AutoText style={styles.tableHeaderText}>{t('delivery.earnings.status')}</AutoText>
              <AutoText style={styles.tableHeaderText}>{t('delivery.earnings.earnings')}</AutoText>
            </View>
            
            {recentOrders.map((order) => (
              <View key={order.id} style={styles.tableRow}>
                <AutoText style={styles.tableCell}>{order.id}</AutoText>
                <AutoText style={styles.tableCell}>{order.date}</AutoText>
                <AutoText style={[styles.tableCell, { color: getStatusColor(order.status) }]}>
                  {t(`common.${order.status}`)}
                </AutoText>
                <AutoText style={styles.tableCell}>{order.earnings}</AutoText>
              </View>
            ))}
          </View>
        </SectionCard>
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, themeName: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    iconButton: {
      padding: '4@s',
    },
    scrollContent: {
      padding: '18@s',
      paddingBottom: '24@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
    },
    earningsHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8@vs',
    },
    earningsAmount: {
      fontFamily: 'Poppins-Bold',
      fontSize: '32@s',
      color: theme.textPrimary,
    },
    periodSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '12@s',
      paddingVertical: '6@vs',
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
      gap: '4@s',
    },
    periodText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    changeIndicator: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '4@s',
    },
    changeText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: '#4CAF50',
    },
    metricsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '12@s',
    },
    metricCard: {
      width: '47%',
      alignItems: 'center',
      padding: '16@s',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    metricIconContainer: {
      width: '48@s',
      height: '48@s',
      borderRadius: '24@ms',
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '8@vs',
    },
    metricValue: {
      fontFamily: 'Poppins-Bold',
      fontSize: '20@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    metricLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
      textAlign: 'center',
      marginBottom: '2@vs',
    },
    metricSubtext: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
    chartHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '16@vs',
    },
    chartContainer: {
      marginTop: '8@vs',
    },
    chart: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      height: '140@vs',
      gap: '8@s',
      paddingBottom: '20@vs',
    },
    barContainer: {
      flex: 1,
      alignItems: 'center',
      height: '100%',
      justifyContent: 'flex-end',
    },
    bar: {
      width: '100%',
      backgroundColor: theme.primary,
      borderRadius: '4@ms',
      minHeight: '4@vs',
    },
    barLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
      marginTop: '4@vs',
    },
    ordersHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
      marginBottom: '16@vs',
    },
    table: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: '12@ms',
      overflow: 'hidden',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: theme.background,
      paddingVertical: '12@vs',
      paddingHorizontal: '12@s',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tableHeaderText: {
      flex: 1,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
    tableRow: {
      flexDirection: 'row',
      paddingVertical: '12@vs',
      paddingHorizontal: '12@s',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    tableCell: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
  });

export default DeliveryEarningsScreen;

