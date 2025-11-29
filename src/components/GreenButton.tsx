import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Vibration, Platform } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from './ThemeProvider';

interface GreenButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
  numberOfLines?: number;
}

export const GreenButton: React.FC<GreenButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
  numberOfLines = 2,
}) => {
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme, isDark);

  const handlePress = () => {
    if (!disabled && !loading) {
      // Haptic feedback - light impact
      if (Platform.OS === 'ios') {
        Vibration.vibrate(10);
      } else {
        Vibration.vibrate(50);
      }
      onPress();
    }
  };

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={handlePress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={isDark ? theme.background : theme.card} />
      ) : (
        <Text
          style={styles.text}
          numberOfLines={numberOfLines}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (theme: any, isDark: boolean) =>
  ScaledSheet.create({
    button: {
      paddingVertical: '10@vs',
      borderRadius: '10@ms',
      backgroundColor: theme.primary,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: '2@vs' },
      shadowOpacity: 0.2,
      shadowRadius: '4@ms',
      elevation: 3,
    },
    disabled: {
      backgroundColor: theme.disabled,
    },
    text: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: isDark ? theme.background : theme.card,
      textAlign: 'center',
    },
  });

