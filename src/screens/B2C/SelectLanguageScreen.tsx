import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StatusBar } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useNavigationState, useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SearchInput } from '../../components/SearchInput';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getStoredLanguage, setStoredLanguage } from '../../i18n/config';
import { useTabBar } from '../../context/TabBarContext';

const languages = [
  { id: 'en', name: 'English', nativeLetter: 'E' },
  { id: 'hi', name: 'Hindi', nativeLetter: 'अ' },
  { id: 'bn', name: 'Bengali', nativeLetter: 'অ' },
  { id: 'ta', name: 'Tamil', nativeLetter: 'அ' },
  { id: 'te', name: 'Telugu', nativeLetter: 'అ' },
  { id: 'mr', name: 'Marathi', nativeLetter: 'अ' },
  { id: 'gu', name: 'Gujarati', nativeLetter: 'અ' },
  { id: 'kn', name: 'Kannada', nativeLetter: 'ಅ' },
  { id: 'ml', name: 'Malayalam', nativeLetter: 'അ' },
  { id: 'pa', name: 'Punjabi', nativeLetter: 'ਅ' },
  { id: 'or', name: 'Oriya', nativeLetter: 'ଅ' },
  { id: 'as', name: 'Assamese', nativeLetter: 'অ' },
  { id: 'ur', name: 'Urdu', nativeLetter: 'ا' },
];

const SelectLanguageScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { setTabBarVisible } = useTabBar();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const nav = useNavigation();
  const canGoBack = nav.canGoBack();

  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);

  // Hide tab bar when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      setTabBarVisible(false);
      // Show tab bar when screen loses focus (cleanup)
      return () => {
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  useEffect(() => {
    // Load current language from storage
    getStoredLanguage().then(lang => {
      setSelectedLanguage(lang);
    });
  }, []);

  const filteredLanguages = languages.filter(lang =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const selectLanguage = (id: string) => {
    setSelectedLanguage(id);
  };

  const handleSave = async () => {
    await setStoredLanguage(selectedLanguage);
    // If we can go back (e.g., from profile settings), go back instead of navigating to JoinAs
    if (canGoBack) {
      navigation.goBack();
    } else {
      // After language selection, navigate to JoinAs screen (initial flow)
      navigation.navigate('JoinAs');
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        {canGoBack ? (
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons
              name="arrow-left"
              size={24}
              color={theme.textPrimary}
            />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 24 }} />
        )}
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('selectLanguage.title')}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.content}>
        <SearchInput
          placeholder={t('selectLanguage.searchPlaceholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchBar}
        />

        <ScrollView
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
        >
          {filteredLanguages.map(lang => {
            const isSelected = selectedLanguage === lang.id;
            return (
              <TouchableOpacity
                key={lang.id}
                style={[styles.gridItem, isSelected && styles.selected]}
                onPress={() => selectLanguage(lang.id)}
                activeOpacity={0.7}
              >
                <View style={styles.iconContainer}>
                  <AutoText style={styles.icon} numberOfLines={1}>
                    {lang.nativeLetter}
                  </AutoText>
                </View>
                <AutoText style={styles.label} numberOfLines={2}>
                  {lang.name}
                </AutoText>
                {isSelected && (
                  <View style={styles.checkContainer}>
                    <MaterialCommunityIcons
                      name="check-circle"
                      size={20}
                      color={theme.primary}
                    />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.footer}>
        <GreenButton
          title={t('selectLanguage.saveButton')}
          onPress={handleSave}
          style={styles.saveButton}
        />
      </View>
    </View>
  );
};

const getStyles = (theme: any, themeName?: string) =>
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
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    content: {
      flex: 1,
      paddingHorizontal: '18@s',
      paddingTop: '16@vs',
      backgroundColor: theme.card,
    },
    searchBar: {
      marginBottom: '24@vs',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'space-between',
      paddingBottom: '16@vs',
    },
    gridItem: {
      width: '98@s',
      height: '112@vs',
      borderRadius: '16@ms',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      paddingVertical: '12@vs',
      paddingHorizontal: '8@s',
      alignItems: 'center',
      justifyContent: 'flex-start',
      position: 'relative',
      marginBottom: '12@vs',
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    selected: {
      borderWidth: 2,
      borderColor: theme.primary,
    },
    iconContainer: {
      width: '56@s',
      height: '56@s',
      borderRadius: '28@s',
      backgroundColor: theme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: '8@vs',
      borderWidth: '1@ms',
      borderColor: theme.border,
    },
    icon: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '24@s',
      color: theme.textPrimary,
    },
    label: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
      textAlign: 'center',
      marginTop: '4@vs',
    },
    checkContainer: {
      position: 'absolute',
      top: '8@vs',
      right: '8@s',
      backgroundColor: theme.card,
      borderRadius: '10@s',
    },
    footer: {
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.card,
    },
    saveButton: {
      width: '100%',
    },
  });

export default SelectLanguageScreen;

