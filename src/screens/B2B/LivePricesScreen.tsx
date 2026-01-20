/**
 * Live Prices Screen
 * Displays all live scrap prices in a table format with 20% markup
 */

import React, { useMemo, useState } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useLivePrices } from '../../hooks/useLivePrices';

const LivePricesScreen = () => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch live prices
  const {
    data: livePricesData,
    isLoading: loadingLivePrices,
    error: livePricesError,
    refetch: refetchLivePrices
  } = useLivePrices(undefined, undefined, true);

  // Filter and process live prices with 20% markup
  const filteredAndMarkedUpPrices = useMemo(() => {
    if (!livePricesData?.data || livePricesData.data.length === 0) {
      return [];
    }

    let filtered = livePricesData.data;

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((price: any) => {
        const searchableFields = [
          price.location || '',
          price.item || '',
          price.category || '',
          price.city || '',
          price.buy_price || '',
          price.sell_price || '',
          price.lme_price || '',
          price.mcx_price || ''
        ];
        return searchableFields.some(field => 
          field.toString().toLowerCase().includes(query)
        );
      });
    }

    // Apply 20% markup and format prices
    return filtered.map((price: any) => {
      const calculateMarkedUpPrice = (basePrice: string | null): string | null => {
        if (!basePrice) return null;
        // Extract numeric value from price string
        const numericMatch = basePrice.toString().replace(/[₹,]/g, '').match(/(\d+\.?\d*)/);
        if (!numericMatch) return basePrice;
        
        const numericValue = parseFloat(numericMatch[1]);
        if (isNaN(numericValue)) return basePrice;
        
        // Apply 20% markup
        const markedUpValue = numericValue * 1.2;
        return `₹${markedUpValue.toFixed(2)}`;
      };

      return {
        location: price.location || '-',
        category: price.category || '-',
        item: price.item || '-',
        city: price.city || '-',
        buyPrice: calculateMarkedUpPrice(price.buy_price) || '-',
        sellPrice: calculateMarkedUpPrice(price.sell_price) || '-',
        status: 'Live Data'
      };
    });
  }, [livePricesData?.data, searchQuery]);

  const styles = useMemo(() => getStyles(theme), [theme]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>
          {t('dealerDashboard.liveScrapPrices') || 'Live Scrap Prices'}
        </AutoText>
        <View style={{ width: 40 }} />
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('common.search') || 'Search by location, item, category, price...'}
          placeholderTextColor={theme.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchQuery('')}
            style={styles.searchClearButton}
          >
            <MaterialCommunityIcons name="close-circle" size={20} color={theme.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Table Header - Only show when not loading */}
      {!loadingLivePrices && (
        <View style={styles.tableHeader}>
          <AutoText style={[styles.tableHeaderText, styles.colLocation]}>Location</AutoText>
          <AutoText style={[styles.tableHeaderText, styles.colCategory]}>Category</AutoText>
          <AutoText style={[styles.tableHeaderText, styles.colItem]}>Item</AutoText>
          <AutoText style={[styles.tableHeaderText, styles.colCity]}>City</AutoText>
          <AutoText style={[styles.tableHeaderText, styles.colBuyPrice]}>Buy Price</AutoText>
          <AutoText style={[styles.tableHeaderText, styles.colSellPrice]}>Sell Price</AutoText>
          <AutoText style={[styles.tableHeaderText, styles.colStatus]}>Status</AutoText>
        </View>
      )}

      {/* Table Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={true}
        refreshControl={
          <RefreshControl
            refreshing={loadingLivePrices}
            onRefresh={refetchLivePrices}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      >
        {loadingLivePrices ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
            <AutoText style={styles.loadingText}>
              {t('common.loading') || 'Loading live prices...'}
            </AutoText>
            <AutoText style={styles.loadingSubText}>
              {t('common.pleaseWait') || 'Please wait while we fetch the latest prices from Redis cache'}
            </AutoText>
          </View>
        ) : livePricesError ? (
          <View style={styles.errorContainer}>
            <AutoText style={styles.errorText}>
              {t('common.error') || 'Error'}: {livePricesError?.message || 'Failed to load live prices'}
            </AutoText>
            <TouchableOpacity
              onPress={() => refetchLivePrices()}
              style={styles.retryButton}
            >
              <AutoText style={styles.retryButtonText}>
                {t('common.retry') || 'Retry'}
              </AutoText>
            </TouchableOpacity>
          </View>
        ) : filteredAndMarkedUpPrices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <AutoText style={styles.emptyText}>
              {searchQuery ? 
                (t('common.noResults') || 'No results found') : 
                (t('common.noData') || 'No live prices available')}
            </AutoText>
          </View>
        ) : (
          filteredAndMarkedUpPrices.map((price: any, index: number) => (
            <View key={index} style={[styles.tableRow, index % 2 === 0 && styles.tableRowEven]}>
              <AutoText style={[styles.tableCell, styles.colLocation]} numberOfLines={1}>
                {price.location}
              </AutoText>
              <AutoText style={[styles.tableCell, styles.colCategory]} numberOfLines={1}>
                {price.category}
              </AutoText>
              <AutoText style={[styles.tableCell, styles.colItem]} numberOfLines={2}>
                {price.item}
              </AutoText>
              <AutoText style={[styles.tableCell, styles.colCity]} numberOfLines={1}>
                {price.city}
              </AutoText>
              <AutoText style={[styles.tableCell, styles.colBuyPrice, styles.priceCell]}>
                {price.buyPrice}
              </AutoText>
              <AutoText style={[styles.tableCell, styles.colSellPrice, styles.priceCell]}>
                {price.sellPrice}
              </AutoText>
              <View style={[styles.tableCell, styles.colStatus]}>
                <View style={styles.statusBadge}>
                  <AutoText style={styles.statusText}>{price.status}</AutoText>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any) =>
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
      backgroundColor: theme.card,
    },
    backButton: {
      padding: '8@s',
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginHorizontal: '18@s',
      marginVertical: '12@vs',
      borderRadius: '12@ms',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    searchIcon: {
      marginRight: '12@s',
    },
    searchInput: {
      flex: 1,
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      padding: 0,
    },
    searchClearButton: {
      padding: '4@s',
      marginLeft: '8@s',
    },
    tableHeader: {
      flexDirection: 'row',
      backgroundColor: theme.primary,
      paddingVertical: '12@vs',
      paddingHorizontal: '12@s',
      borderBottomWidth: 2,
      borderBottomColor: theme.primary,
    },
    tableHeaderText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '12@s',
      color: '#FFFFFF',
      textAlign: 'center',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      paddingBottom: '20@vs',
    },
    tableRow: {
      flexDirection: 'row',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      paddingVertical: '12@vs',
      paddingHorizontal: '12@s',
      backgroundColor: theme.card,
    },
    tableRowEven: {
      backgroundColor: theme.background,
    },
    tableCell: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textPrimary,
      textAlign: 'center',
      paddingHorizontal: '4@s',
    },
    // Column widths
    colLocation: {
      width: '80@s',
      flexShrink: 0,
    },
    colCategory: {
      width: '90@s',
      flexShrink: 0,
    },
    colItem: {
      width: '120@s',
      flexShrink: 0,
    },
    colCity: {
      width: '70@s',
      flexShrink: 0,
    },
    colBuyPrice: {
      width: '90@s',
      flexShrink: 0,
    },
    colSellPrice: {
      width: '90@s',
      flexShrink: 0,
    },
    colStatus: {
      width: '80@s',
      flexShrink: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    priceCell: {
      fontFamily: 'Poppins-SemiBold',
      color: theme.primary,
    },
    statusBadge: {
      backgroundColor: theme.primary + '20',
      paddingHorizontal: '8@s',
      paddingVertical: '4@vs',
      borderRadius: '6@ms',
    },
    statusText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '10@s',
      color: theme.primary,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
      minHeight: '300@vs',
    },
    loadingText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginTop: '16@vs',
      textAlign: 'center',
    },
    loadingSubText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
      textAlign: 'center',
    },
    errorContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '40@vs',
      paddingHorizontal: '20@s',
    },
    errorText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.error || '#F44336',
      textAlign: 'center',
      marginBottom: '16@vs',
    },
    retryButton: {
      backgroundColor: theme.primary,
      paddingHorizontal: '24@s',
      paddingVertical: '12@vs',
      borderRadius: '8@ms',
    },
    retryButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '40@vs',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
  });

export default LivePricesScreen;
