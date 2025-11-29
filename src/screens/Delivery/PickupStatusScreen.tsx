import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { AutoText } from '../../components/AutoText';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';

const pendingPickups = [
  {
    id: 'DLV001',
    name: 'Alice Johnson',
    address: '123 Main St, Anytown',
    time: '10:30 AM',
    urgent: true,
  },
  {
    id: 'DLV002',
    name: 'Bob Williams',
    address: '456 Oak Ave, Anytown',
    time: '11:00 AM',
    urgent: false,
  },
];

const onTheWay = [
  {
    id: 'DLV003',
    name: 'Charlie Davis',
    address: '789 Pine Ln, Anytown',
    time: '11:45 AM',
  },
];

const completed = [
  {
    id: 'DLV000',
    name: 'Diana Prince',
    address: '101 Hero Blvd, Anytown',
    time: '09:00 AM',
  },
];

const PickupStatusScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

  return (
    <>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={2}>
          {t('pickupStatus.title')}
        </AutoText>
        <TouchableOpacity>
          <MaterialCommunityIcons
            name="bell"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('pickupStatus.pendingPickups')}
          </AutoText>
          {pendingPickups.map(pickup => (
            <View key={pickup.id} style={styles.orderRow}>
              <View style={styles.avatar}>
                <AutoText style={styles.avatarText} numberOfLines={1}>
                  {pickup.name.charAt(0)}
                </AutoText>
              </View>
              <View style={styles.orderInfo}>
                <View style={styles.orderHeader}>
                  <AutoText style={styles.orderId} numberOfLines={1}>
                    {t('pickupStatus.order')} #{pickup.id}
                  </AutoText>
                  {pickup.urgent && (
                    <View style={styles.chipUrgent}>
                      <AutoText style={styles.urgentText} numberOfLines={1}>
                        {t('pickupStatus.urgent')}
                      </AutoText>
                    </View>
                  )}
                </View>
                <AutoText style={styles.orderName} numberOfLines={1}>
                  {pickup.name}
                </AutoText>
                <AutoText style={styles.orderAddress} numberOfLines={2}>
                  {pickup.address}
                </AutoText>
                <AutoText style={styles.orderTime} numberOfLines={1}>
                  {pickup.time}
                </AutoText>
              </View>
            </View>
          ))}
          <GreenButton
            title={t('pickupStatus.confirmOnTheWay')}
            onPress={() => {}}
            style={styles.actionButton}
          />
        </View>

        <View style={styles.statusSection}>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('pickupStatus.onTheWay')}
          </AutoText>
          {onTheWay.map(pickup => (
            <View key={pickup.id} style={styles.orderRow}>
              <View style={styles.avatar}>
                <AutoText style={styles.avatarText} numberOfLines={1}>
                  {pickup.name.charAt(0)}
                </AutoText>
              </View>
              <View style={styles.orderInfo}>
                <AutoText style={styles.orderId} numberOfLines={1}>
                  {t('pickupStatus.order')} #{pickup.id}
                </AutoText>
                <AutoText style={styles.orderName} numberOfLines={1}>
                  {pickup.name}
                </AutoText>
                <AutoText style={styles.orderAddress} numberOfLines={2}>
                  {pickup.address}
                </AutoText>
                <AutoText style={styles.orderTime} numberOfLines={1}>
                  {pickup.time}
                </AutoText>
              </View>
            </View>
          ))}
          <GreenButton
            title={t('pickupStatus.confirmArrived')}
            onPress={() => {}}
            style={styles.actionButton}
          />
        </View>

        <View style={styles.statusSection}>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('pickupStatus.arrivedAtPickup')}
          </AutoText>
          <AutoText style={styles.emptyText} numberOfLines={1}>
            {t('pickupStatus.noItems')}
          </AutoText>
        </View>

        <View style={styles.statusSection}>
          <AutoText style={styles.sectionTitle} numberOfLines={1}>
            {t('pickupStatus.completedPickups')}
          </AutoText>
          {completed.map(pickup => (
            <View key={pickup.id} style={styles.orderRow}>
              <View style={styles.avatar}>
                <AutoText style={styles.avatarText} numberOfLines={1}>
                  {pickup.name.charAt(0)}
                </AutoText>
              </View>
              <View style={styles.orderInfo}>
                <AutoText style={styles.orderId} numberOfLines={1}>
                  {t('pickupStatus.order')} #{pickup.id}
                </AutoText>
                <AutoText style={styles.orderName} numberOfLines={1}>
                  {pickup.name}
                </AutoText>
                <AutoText style={styles.orderAddress} numberOfLines={2}>
                  {pickup.address}
                </AutoText>
                <AutoText style={styles.orderTime} numberOfLines={1}>
                  {pickup.time}
                </AutoText>
              </View>
            </View>
          ))}
          <OutlineGreenButton
            title={t('pickupStatus.viewDetails')}
            onPress={() => {}}
            style={styles.actionButton}
          />
        </View>
      </ScrollView>
    </View>
    </>
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
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    scrollContent: {
      paddingBottom: '24@vs',
      paddingTop: '10@vs',
    },
    statusSection: {
      marginBottom: '18@vs',
      paddingHorizontal: '14@s',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '10@vs',
    },
    orderRow: {
      backgroundColor: theme.card,
      borderRadius: '10@ms',
      padding: '12@s',
      borderWidth: '1@ms',
      borderColor: theme.border,
      flexDirection: 'row',
      gap: '10@s',
      marginBottom: '10@vs',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: '2@vs' },
      shadowOpacity: 0.1,
      shadowRadius: '4@ms',
      elevation: 2,
    },
    avatar: {
      width: '40@s',
      height: '40@s',
      borderRadius: '20@s',
      backgroundColor: theme.card,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: '1@ms',
      borderColor: theme.border,
    },
    avatarText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    orderInfo: {
      flex: 1,
    },
    orderHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '3@vs',
    },
    orderId: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: theme.textPrimary,
    },
    chipUrgent: {
      backgroundColor: '#FFB3BA',
      paddingHorizontal: '10@s',
      paddingVertical: '3@vs',
      borderRadius: '10@ms',
      flexShrink: 0,
    },
    urgentText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: '#C2185B',
    },
    orderName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '13@s',
      color: theme.textPrimary,
      marginBottom: '2@vs',
    },
    orderAddress: {
      fontFamily: 'Poppins-Regular',
      fontSize: '11@s',
      color: theme.textSecondary,
      marginBottom: '2@vs',
    },
    orderTime: {
      fontFamily: 'Poppins-Regular',
      fontSize: '10@s',
      color: theme.textSecondary,
    },
    actionButton: {
      marginTop: '6@vs',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      textAlign: 'center',
      paddingVertical: '12@vs',
    },
  });

export default PickupStatusScreen;

