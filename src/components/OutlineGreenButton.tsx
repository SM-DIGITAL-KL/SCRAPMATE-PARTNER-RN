import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, Vibration, Platform } from 'react-native';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from './ThemeProvider';

interface OutlineGreenButtonProps {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}

export const OutlineGreenButton: React.FC<OutlineGreenButtonProps> = ({
  title,
  onPress,
  disabled = false,
  loading = false,
  style,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

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
        <ActivityIndicator color={theme.primary} />
      ) : (
        <Text
          style={styles.text}
          adjustsFontSizeToFit={true}
          numberOfLines={1}
          minimumFontScale={0.7}
        >
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const getStyles = (theme: any) =>
  ScaledSheet.create({
    button: {
      paddingVertical: '10@vs',
      borderRadius: '10@ms',
      borderColor: theme.primary,
      borderWidth: 1,
      backgroundColor: 'transparent',
      alignItems: 'center',
      justifyContent: 'center',
    },
    disabled: {
      borderColor: theme.disabled,
    },
    text: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.primary,
    },
  });

