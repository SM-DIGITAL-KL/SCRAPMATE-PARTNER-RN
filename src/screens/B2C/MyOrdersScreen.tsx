import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';

const orders = [
  {
    id: '1',
    status: 'completed',
    date: 'October 26, 2023',
    amount: '₹10,500',
    statusColor: 'green',
  },
  {
    id: '2',
    status: 'pending',
    date: 'November 01, 2023',
    amount: '₹6,300',
    statusColor: 'mint',
  },
  {
    id: '3',
    status: 'cancelled',
    date: 'September 15, 2023',
    amount: '₹0',
    statusColor: 'dark',
  },
  {
    id: '4',
    status: 'completed',
    date: 'August 29, 2023',
    amount: '₹17,650',
    statusColor: 'green',
  },
  {
    id: '5',
    status: 'completed',
    date: 'July 10, 2023',
    amount: '₹8,300',
    statusColor: 'green',
  },
];

const MyOrdersScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

  const getStatusStyle = (statusColor: string) => {
    switch (statusColor) {
      case 'green':
        return styles.statusChipCompleted;
      case 'mint':
        return styles.statusChipPending;
      case 'dark':
        return styles.statusChipCancelled;
      default:
        return styles.statusChipCompleted;
    }
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
          {t('myOrders.title')}
        </AutoText>
        <TouchableOpacity>
          <MaterialCommunityIcons
            name="filter"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {orders.map(order => (
          <View key={order.id} style={styles.orderCard}>
            <View style={styles.orderHeader}>
              <View style={getStatusStyle(order.statusColor)}>
                <AutoText
                  style={[
                    styles.statusText,
                    order.statusColor === 'mint' && styles.statusTextPending,
                    order.statusColor === 'dark' && styles.statusTextCancelled,
                  ]}
                  numberOfLines={1}
                >
                  {t(`common.${order.status.toLowerCase()}`)}
                </AutoText>
              </View>
              <AutoText style={styles.orderDate} numberOfLines={1}>
                {order.date}
              </AutoText>
            </View>
            <AutoText style={styles.amount} numberOfLines={1}>
              {order.amount}
            </AutoText>
            <AutoText style={styles.earningsDescription} numberOfLines={2}>
              {t('myOrders.earningsForPickup')}
            </AutoText>
            <View style={styles.orderActions}>
              <TouchableOpacity style={styles.invoiceButton}>
                <MaterialCommunityIcons
                  name="file-document-outline"
                  size={16}
                  color={theme.primary}
                />
                <AutoText style={styles.invoiceText} numberOfLines={2}>
                  {t('myOrders.viewInvoice')}
                </AutoText>
              </TouchableOpacity>
              <GreenButton
                title={t('myOrders.rebookPickup')}
                onPress={() => {}}
                style={styles.rebookButton}
              />
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.card,
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
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    scrollContent: {
      paddingHorizontal: '14@s',
      paddingTop: '14@vs',
      paddingBottom: '24@vs',
    },
    orderCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: '12@vs',
    },
    orderHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '10@vs',
    },
    statusChipCompleted: {
      paddingHorizontal: '10@s',
      paddingVertical: '5@vs',
      borderRadius: '10@ms',
      backgroundColor: theme.accent,
    },
    statusChipPending: {
      paddingHorizontal: '10@s',
      paddingVertical: '5@vs',
      borderRadius: '10@ms',
      backgroundColor: theme.accent,
    },
    statusChipCancelled: {
      paddingHorizontal: '10@s',
      paddingVertical: '5@vs',
      borderRadius: '10@ms',
      backgroundColor: theme.accent,
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.textPrimary,
    },
    statusTextPending: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.textPrimary,
    },
    statusTextCancelled: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.textPrimary,
    },
    orderDate: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    amount: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      fontWeight: '700',
      color: theme.textPrimary,
      marginBottom: '3@vs',
    },
    earningsDescription: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginBottom: '12@vs',
    },
    orderActions: {
      flexDirection: 'row',
      gap: '10@s',
      alignItems: 'center',
    },
    invoiceButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '5@s',
      paddingVertical: '8@vs',
      paddingHorizontal: '10@s',
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: '10@ms',
      backgroundColor: theme.card,
      flexShrink: 1,
      minWidth: 0,
      maxWidth: '45%',
    },
    invoiceText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
      flexShrink: 1,
      minWidth: 0,
    },
    rebookButton: {
      flex: 1,
      paddingVertical: '8@vs',
    },
  });

export default MyOrdersScreen;

