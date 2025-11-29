import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Vibration, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SearchInput } from '../../components/SearchInput';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';

const partners = [
  { id: '1', name: 'Rajesh Kumar', location: 'House No. 12, MG Road, Bangalore - 560001', online: true },
  { id: '2', name: 'Priya Sharma', location: 'Flat 304, Sector 18, Noida - 201301', online: false },
  { id: '3', name: 'Amit Patel', location: 'B-45, Andheri West, Mumbai - 400053', online: true },
  { id: '4', name: 'Sunita Devi', location: 'House No. 8, Koramangala, Bangalore - 560095', online: true },
  { id: '5', name: 'Vikram Singh', location: 'Flat 201, DLF Phase 2, Gurgaon - 122002', online: false },
];

const AssignPartnerScreen = ({ route, navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const isEnglish = i18n.language === 'en';
  const styles = useMemo(() => getStyles(theme, isEnglish, themeName), [theme, isEnglish, themeName]);
  const { orderId } = route.params || { orderId: 'DEL12345' };

  const filteredPartners = partners.filter(
    partner =>
      partner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      partner.location.toLowerCase().includes(searchQuery.toLowerCase()),
  );

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
        <View style={styles.searchContainer}>
          <SearchInput
            placeholder={t('assignPartner.searchPlaceholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={styles.searchBar}
          />
        </View>
        <TouchableOpacity onPress={() => {}}>
          <MaterialCommunityIcons
            name="dots-vertical"
            size={20}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
      </View>

      <View style={styles.content}>

        <ScrollView
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        >
          {filteredPartners.map(partner => (
            <View key={partner.id} style={styles.partnerCard}>
              <View style={styles.partnerRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {partner.name.charAt(0)}
                  </Text>
                </View>
                <View style={styles.partnerInfo}>
                  <Text style={styles.partnerName} numberOfLines={1}>
                    {partner.name}
                  </Text>
                  <Text style={styles.partnerLocation} numberOfLines={1}>
                    {partner.location}
                  </Text>
                </View>
                <View style={styles.statusContainer}>
                  {partner.online ? (
                    <View style={styles.statusDot} />
                  ) : (
                    <View style={[styles.statusDot, styles.statusDotOffline]} />
                  )}
                  <AutoText
                    style={[
                      styles.statusText,
                      !partner.online && styles.statusTextOffline,
                    ]}
                    numberOfLines={1}
                  >
                    {partner.online ? t('assignPartner.online') : t('assignPartner.offline')}
                  </AutoText>
                </View>
                <TouchableOpacity
                  style={[
                    styles.assignButton,
                    !partner.online && styles.assignButtonDisabled,
                  ]}
                  onPress={() => {
                    if (partner.online) {
                      // Haptic feedback
                      if (Platform.OS === 'ios') {
                        Vibration.vibrate(10);
                      } else {
                        Vibration.vibrate(50);
                      }
                    }
                  }}
                  disabled={!partner.online}
                  activeOpacity={0.7}
                >
                  <AutoText
                    style={[
                      styles.assignButtonText,
                      !partner.online && styles.assignButtonTextDisabled,
                    ]}
                    numberOfLines={1}
                  >
                    {t('assignPartner.assign')}
                  </AutoText>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      <TouchableOpacity style={styles.fab} activeOpacity={0.7}>
        <MaterialCommunityIcons name="plus" size={22} color={theme.textPrimary} />
      </TouchableOpacity>
    </View>
  );
};

const getStyles = (theme: any, isEnglish: boolean, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.card,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '12@s',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    searchContainer: {
      flex: 1,
    },
    searchBar: {
      marginBottom: 0,
    },
    content: {
      flex: 1,
      paddingHorizontal: '14@s',
      paddingTop: '12@vs',
    },
    list: {
      gap: '10@vs',
      paddingBottom: '12@vs',
    },
    partnerCard: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '12@s',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    partnerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '10@s',
    },
    avatar: {
      width: '36@s',
      height: '36@s',
      borderRadius: '18@s',
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '11@s',
      color: theme.primary,
    },
    partnerInfo: {
      flex: 1,
    },
    partnerName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: isEnglish ? '11@s' : '14@s',
      color: theme.textPrimary,
      marginBottom: '3@vs',
    },
    partnerLocation: {
      fontFamily: 'Poppins-Regular',
      fontSize: isEnglish ? '11@s' : '13@s',
      color: theme.textSecondary,
      fontWeight: '400' as any,
    },
    statusContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '5@s',
      marginRight: '6@s',
    },
    statusDot: {
      width: '7@s',
      height: '7@s',
      borderRadius: '3.5@s',
      backgroundColor: theme.primary,
    },
    statusDotOffline: {
      backgroundColor: '#FF4444',
    },
    statusText: {
      fontFamily: 'Poppins-Regular',
      fontSize: isEnglish ? '11@s' : '9@s',
      color: theme.textPrimary,
      fontWeight: '400' as any,
    },
    statusTextOffline: {
      color: '#FF4444',
    },
    assignButton: {
      paddingHorizontal: '12@s',
      paddingVertical: '5@vs',
      borderRadius: '8@ms',
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '60@s',
    },
    assignButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: isEnglish ? '11@s' : '9@s',
      color: theme.textPrimary,
      textAlign: 'center',
      fontWeight: '500' as any,
    },
    assignButtonDisabled: {
      backgroundColor: theme.disabled,
    },
    assignButtonTextDisabled: {
      color: theme.textPrimary,
      opacity: 0.6,
    },
    fab: {
      position: 'absolute',
      right: '16@s',
      bottom: '24@vs',
      width: '48@s',
      height: '48@s',
      backgroundColor: theme.accent,
      borderRadius: '24@s',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 6,
    },
  });

export default AssignPartnerScreen;

