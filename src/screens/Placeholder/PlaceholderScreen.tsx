import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';

const PlaceholderScreen = () => {
  const { theme } = useTheme();
  const { t } = useTranslation();

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.background }}>
      <AutoText style={{ color: theme.textPrimary }}>{t('delivery.comingSoon')}</AutoText>
    </View>
  );
};

export default PlaceholderScreen;

