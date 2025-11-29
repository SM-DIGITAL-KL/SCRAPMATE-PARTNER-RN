import React from 'react';
import { View, TextInput } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { ScaledSheet } from 'react-native-size-matters';
import { useTheme } from './ThemeProvider';

interface SearchInputProps {
  placeholder: string;
  value: string;
  onChangeText: (text: string) => void;
  style?: any;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  placeholder,
  value,
  onChangeText,
  style,
}) => {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={[styles.container, style]}>
      <MaterialCommunityIcons
        name="magnify"
        size={16}
        color={theme.textSecondary}
        style={styles.icon}
      />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        value={value}
        onChangeText={onChangeText}
        adjustsFontSizeToFit={true}
        numberOfLines={1}
      />
    </View>
  );
};

const getStyles = (theme: any) =>
  ScaledSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      borderRadius: '10@ms',
      paddingHorizontal: '10@s',
      paddingVertical: '6@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    icon: {
      marginRight: '6@s',
    },
    input: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textPrimary,
    },
  });

