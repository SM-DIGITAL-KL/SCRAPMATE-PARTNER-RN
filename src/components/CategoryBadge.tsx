import React from 'react';
import { View, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from './ThemeProvider';

interface CategoryBadgeProps {
  label: string;
  icon: string;
  style?: any;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  label,
  icon,
  style,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={[styles.badge, style]}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          <MaterialCommunityIcons
            name={icon}
            size={20}
            color={theme.textSecondary}
          />
        </View>
        <Text
          style={styles.label}
          adjustsFontSizeToFit={true}
          numberOfLines={2}
          minimumFontScale={0.7}
        >
          {label}
        </Text>
      </View>
    </View>
  );
};

const getStyles = (theme: any) =>
  ScaledSheet.create({
    badge: {
      width: '30%',
      marginBottom: '12@vs',
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@vs',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: '80@vs',
      justifyContent: 'center',
    },
    iconContainer: {
      width: '40@s',
      height: '40@s',
      borderRadius: '20@s',
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '8@vs',
    },
    label: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.textPrimary,
      textAlign: 'center',
    },
  });

