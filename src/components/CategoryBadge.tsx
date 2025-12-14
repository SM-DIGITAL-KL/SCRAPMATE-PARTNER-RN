import React from 'react';
import { View, Image, TouchableOpacity } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from './ThemeProvider';
import { AutoText } from './AutoText';

interface CategoryBadgeProps {
  label: string;
  icon: string;
  image?: string | null;
  style?: any;
  onPress?: () => void;
}

export const CategoryBadge: React.FC<CategoryBadgeProps> = ({
  label,
  icon,
  image,
  style,
  onPress,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const content = (
    <View style={[styles.badge, style]}>
      <View style={styles.card}>
        <View style={styles.iconContainer}>
          {image ? (
            <Image
              source={{ uri: image }}
              style={styles.categoryImage}
              resizeMode="cover"
            />
          ) : (
            <MaterialCommunityIcons
              name={icon}
              size={28}
              color={theme.primary}
            />
          )}
        </View>
        <AutoText
          style={styles.label}
          numberOfLines={2}
        >
          {label}
        </AutoText>
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={styles.touchable}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const getStyles = (theme: any) =>
  ScaledSheet.create({
    touchable: {
      width: '30%',
      marginBottom: '12@vs',
    },
    badge: {
      width: '100%',
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      padding: '12@vs',
      paddingHorizontal: '8@s',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.border,
      minHeight: '110@vs',
    },
    iconContainer: {
      width: '56@s',
      height: '56@s',
      borderRadius: '8@ms',
      backgroundColor: theme.background,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '10@vs',
      overflow: 'hidden',
    },
    categoryImage: {
      width: '100%',
      height: '100%',
      borderRadius: '8@ms',
    },
    label: {
      fontFamily: 'Poppins-Medium',
      fontSize: '11@s',
      color: theme.textPrimary,
      textAlign: 'center',
      lineHeight: '14@s',
      width: '100%',
    },
  });
