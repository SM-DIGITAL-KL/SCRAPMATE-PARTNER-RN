import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar, Vibration, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';

const categories = [
  { id: 'metal', translationKey: 'categories.metal', icon: 'aluminum' },
  { id: 'plastic', translationKey: 'categories.plastic', icon: 'bottle-soda' },
  { id: 'paper', translationKey: 'categories.paper', icon: 'file-document' },
  { id: 'ewaste', translationKey: 'categories.electronics', icon: 'lightbulb' },
  { id: 'glass', translationKey: 'categories.glass', icon: 'glass-wine' },
  { id: 'wood', translationKey: 'categories.wood', icon: 'tree' },
  { id: 'rubber', translationKey: 'categories.rubber', icon: 'circle' },
  { id: 'organic', translationKey: 'categories.organic', icon: 'sprout' },
];

const AddCategoryScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const styles = useMemo(() => getStyles(theme, isDark, themeName), [theme, isDark, themeName]);

  const toggleCategory = (id: string) => {
    // Haptic feedback
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(30);
    }
    setSelectedCategories(prev =>
      prev.includes(id)
        ? prev.filter(catId => catId !== id)
        : [...prev, id],
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('addCategory.title')}
        </AutoText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.grid}>
          {categories.map((category, index) => {
            const isSelected = selectedCategories.includes(category.id);
            const isLastInRow = (index + 1) % 3 === 0;
            return (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.gridItem,
                  isSelected && styles.selected,
                  Platform.OS === 'ios' && isLastInRow && styles.gridItemLastInRow,
                ]}
                onPress={() => toggleCategory(category.id)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={category.icon}
                  size={32}
                  color={theme.primary}
                />
                <AutoText style={styles.categoryLabel} numberOfLines={2}>
                  {t(category.translationKey)}
                </AutoText>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      <View style={styles.bottomButtonContainer}>
        <GreenButton
          title={t('addCategory.nextButton', { count: selectedCategories.length })}
          onPress={() => {}}
        />
      </View>
    </View>
  );
};

const getStyles = (theme: any, isDark: boolean, themeName?: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    backButton: {
      width: 24,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      paddingHorizontal: '18@s',
      paddingTop: '24@vs',
      paddingBottom: '100@vs',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: Platform.OS === 'ios' ? 'flex-start' : 'space-between',
    },
    gridItem: {
      width: Platform.OS === 'ios' ? '30.5%' : '31%',
      aspectRatio: 1,
      minHeight: '110@vs',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? theme.card : '#F5F5F5',
      gap: '8@vs',
      paddingVertical: '12@vs',
      marginBottom: '10@vs',
      ...(Platform.OS === 'ios' && {
        marginRight: '3.5%',
      }),
    },
    gridItemLastInRow: {
      marginRight: 0,
    },
    selected: {
      borderWidth: 2,
      borderColor: theme.primary,
      backgroundColor: isDark ? theme.accent + '33' : theme.accent + '40',
    },
    categoryLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    bottomButtonContainer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      paddingVertical: '18@vs',
      paddingHorizontal: '18@s',
      backgroundColor: theme.card,
      borderTopWidth: 1,
      borderTopColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 5,
    },
  });

export default AddCategoryScreen;

