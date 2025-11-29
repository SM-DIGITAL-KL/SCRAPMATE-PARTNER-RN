import React from 'react';
import { View, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';

const DeliveryPlaceholderScreen = () => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.content}>
        <AutoText style={styles.title} numberOfLines={1}>
          {t('delivery.title')}
        </AutoText>
        <AutoText style={styles.subtitle} numberOfLines={2}>
          {t('delivery.comingSoon')}
        </AutoText>
      </View>
    </View>
  );
};

const getStyles = (theme: any) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    content: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: '18@s',
    },
    title: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '24@s',
      color: theme.textPrimary,
      marginBottom: '12@vs',
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: 'Poppins-Regular',
      fontSize: '18@s',
      color: theme.textSecondary,
      textAlign: 'center',
    },
  });

export default DeliveryPlaceholderScreen;

