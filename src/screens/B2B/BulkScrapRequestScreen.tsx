import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { View, Text, TextInput, TouchableOpacity, StatusBar, ScrollView, KeyboardAvoidingView, Platform, Keyboard, Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { useTabBar } from '../../context/TabBarContext';
import { GreenButton } from '../../components/GreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';

const BulkScrapRequestScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  const { setTabBarVisible } = useTabBar();
  const buttonTranslateY = useRef(new Animated.Value(0)).current;
  const buttonOpacity = useRef(new Animated.Value(1)).current;

  // Function to hide UI (tab bar and button)
  const hideUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(false);
        Animated.parallel([
          Animated.timing(buttonTranslateY, {
            toValue: 100,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 0,
            duration: 500,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Function to show UI (tab bar and button)
  const showUI = useCallback(() => {
    // Start both animations at exactly the same time
    requestAnimationFrame(() => {
      setTabBarVisible(true);
        Animated.parallel([
          Animated.timing(buttonTranslateY, {
            toValue: 0,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(buttonOpacity, {
            toValue: 1,
            duration: 500,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]).start();
    });
  }, [setTabBarVisible, buttonTranslateY, buttonOpacity]);

  // Show UI when keyboard closes
  useEffect(() => {
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        showUI();
      }
    );

    return () => {
      hideSubscription.remove();
    };
  }, [showUI]);

  // Restore tab bar visibility when screen loses focus
  useFocusEffect(
    React.useCallback(() => {
      return () => {
        // Restore tab bar when leaving screen
        setTabBarVisible(true);
      };
    }, [setTabBarVisible])
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>{t('bulkScrapRequest.title')}</AutoText>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        {/* Scrap Details */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.scrapDetails')}</AutoText>
          <View style={styles.formRow}>
            <TouchableOpacity style={styles.dropdown} activeOpacity={0.7}>
              <AutoText style={styles.dropdownText}>{t('bulkScrapRequest.selectScrapType')}</AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.formRow}>
            <TouchableOpacity style={styles.dropdown} activeOpacity={0.7}>
              <AutoText style={styles.dropdownText}>{t('bulkScrapRequest.selectSubcategory')}</AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              placeholder={t('bulkScrapRequest.quantityPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              onFocus={hideUI}
            />
            <AutoText style={styles.inputLabel}>{t('bulkScrapRequest.quantityLabel')}</AutoText>
          </View>
        </View>

        {/* Pricing & Delivery */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.pricingDelivery')}</AutoText>
          <View style={styles.formRow}>
            <TouchableOpacity style={styles.dropdown} activeOpacity={0.7}>
              <AutoText style={styles.dropdownText}>{t('bulkScrapRequest.frequencyQuestion')}</AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              placeholder={t('bulkScrapRequest.preferredPricePlaceholder')}
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
              onFocus={hideUI}
            />
            <AutoText style={styles.inputLabel}>{t('bulkScrapRequest.preferredPriceLabel')}</AutoText>
          </View>
          <View style={styles.formRow}>
            <TouchableOpacity style={styles.dropdown} activeOpacity={0.7}>
              <AutoText style={styles.dropdownText}>{t('bulkScrapRequest.deliveryMethod')}</AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
          <View style={styles.formRow}>
            <TouchableOpacity style={styles.dropdown} activeOpacity={0.7}>
              <AutoText style={styles.dropdownText}>{t('bulkScrapRequest.whenNeeded')}</AutoText>
              <MaterialCommunityIcons name="chevron-down" size={20} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Location & Additional Information */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.locationAdditional')}</AutoText>
          <View style={styles.formRow}>
            <TextInput
              style={styles.input}
              placeholder={t('bulkScrapRequest.locationPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              onFocus={hideUI}
            />
            <AutoText style={styles.inputLabel}>{t('bulkScrapRequest.locationLabel')}</AutoText>
          </View>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder={t('bulkScrapRequest.additionalNotesPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              multiline
              numberOfLines={4}
              onFocus={hideUI}
            />
            <AutoText style={styles.inputLabel}>{t('bulkScrapRequest.additionalNotesLabel')}</AutoText>
          </View>
        </View>

        {/* Attachments */}
        <View style={styles.section}>
          <AutoText style={styles.sectionTitle}>{t('bulkScrapRequest.attachments')}</AutoText>
          <View style={styles.fileUploadArea}>
            <TouchableOpacity style={styles.uploadButton} activeOpacity={0.7}>
              <MaterialCommunityIcons name="upload" size={24} color={theme.primary} />
              <AutoText style={styles.uploadButtonText}>{t('bulkScrapRequest.uploadDocument')}</AutoText>
            </TouchableOpacity>
            <AutoText style={styles.fileStatusText}>{t('bulkScrapRequest.noFileSelected')}</AutoText>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Submit Button */}
      <Animated.View
        style={[
          styles.bottomButtonContainer,
          {
            transform: [{ translateY: buttonTranslateY }],
            opacity: buttonOpacity,
          },
        ]}
      >
        <GreenButton
          title={t('bulkScrapRequest.submitRequest')}
          onPress={() => {}}
        />
      </Animated.View>
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
      paddingTop: '18@vs',
      paddingBottom: '100@vs',
    },
    section: {
      backgroundColor: theme.card,
      borderRadius: '18@ms',
      padding: '16@s',
      marginBottom: '18@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '14@vs',
    },
    formRow: {
      marginBottom: '16@vs',
    },
    input: {
      height: '52@vs',
      borderWidth: 1,
      borderRadius: '14@ms',
      borderColor: theme.border,
      paddingHorizontal: '14@s',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    textArea: {
      height: '100@vs',
      textAlignVertical: 'top',
      paddingTop: '14@vs',
    },
    inputLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '6@vs',
    },
    dropdown: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: '14@ms',
      paddingVertical: '14@vs',
      paddingHorizontal: '18@s',
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: theme.background,
    },
    dropdownText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    fileUploadArea: {
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: '14@ms',
      borderStyle: 'dashed',
      padding: '24@s',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
    uploadButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
      paddingVertical: '12@vs',
      paddingHorizontal: '18@s',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.primary,
      marginBottom: '12@vs',
    },
    uploadButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    fileStatusText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
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

export default BulkScrapRequestScreen;

