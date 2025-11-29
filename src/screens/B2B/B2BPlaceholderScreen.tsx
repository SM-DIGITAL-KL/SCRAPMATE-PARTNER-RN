import React from 'react';
import { View, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';

const B2BPlaceholderScreen = () => {
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
        <AutoText style={styles.title}>B2B</AutoText>
        <AutoText style={styles.subtitle}>{t('delivery.comingSoon')}</AutoText>
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
    },
    subtitle: {
      fontFamily: 'Poppins-Regular',
      fontSize: '16@s',
      color: theme.textSecondary,
    },
  });

export default B2BPlaceholderScreen;

