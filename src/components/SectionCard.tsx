import React from 'react';
import { View } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from './ThemeProvider';

interface SectionCardProps {
  children: React.ReactNode;
  style?: any;
}

export const SectionCard: React.FC<SectionCardProps> = ({
  children,
  style,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return <View style={[styles.card, style]}>{children}</View>;
};

const getStyles = (theme: any) =>
  ScaledSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '16@s',
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 8,
      elevation: 3,
      marginBottom: '18@vs',
    },
  });

