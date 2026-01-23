/**
 * Live Prices Screen
 * Displays all live scrap prices in a table format
 * Applies 20% markup for B2B users, no markup for B2C users
 */

import React, { useMemo, useState, useRef } from 'react';
import { View, TouchableOpacity, StatusBar, TextInput, ActivityIndicator, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { useLivePrices } from '../../hooks/useLivePrices';
import { useUserMode } from '../../context/UserModeContext';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';
import { getLivePrices } from '../../services/api/v2/livePrices';

const LivePricesScreen = () => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { t, i18n: i18nInstance } = useTranslation();
  const navigation = useNavigation();
  const { mode } = useUserMode();
  const isB2B = mode === 'b2b';
  const [searchQuery, setSearchQuery] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100); // Zoom percentage (50% to 200%)
  const webViewRef = useRef<WebView>(null);
  const [webViewKey, setWebViewKey] = useState(0); // Key to force WebView remount when language changes
  const [forceRefresh, setForceRefresh] = useState(false); // Force refresh flag
  const queryClient = useQueryClient(); // Query client for cache invalidation

  // Zoom functions
  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 10, 200); // Max zoom 200%
    setZoomLevel(newZoom);
    updateWebViewZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 10, 10); // Min zoom 10%
    setZoomLevel(newZoom);
    updateWebViewZoom(newZoom);
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
    updateWebViewZoom(100);
  };

  const updateWebViewZoom = (zoom: number) => {
    const zoomScript = `
      document.body.style.zoom = '${zoom}%';
      true; // note: this is required, or you'll sometimes get silent failures
    `;
    webViewRef.current?.injectJavaScript(zoomScript);
  };

  // Enable pinch-to-zoom on WebView load
  const enablePinchZoom = () => {
    const enableZoomScript = `
      (function() {
        var meta = document.querySelector('meta[name="viewport"]');
        if (meta) {
          meta.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes');
        }
        document.body.style.touchAction = 'pan-x pan-y pinch-zoom';
        document.documentElement.style.touchAction = 'pan-x pan-y pinch-zoom';
        true;
      })();
    `;
    webViewRef.current?.injectJavaScript(enableZoomScript);
  };

  // Fetch live prices
  const {
    data: livePricesData,
    isLoading: loadingLivePrices,
    error: livePricesError,
    refetch: refetchLivePrices
  } = useLivePrices(undefined, undefined, true, forceRefresh);

  // Handle manual refresh
  const handleRefresh = async () => {
    try {
      // Invalidate all live prices cache in React Query
      await queryClient.invalidateQueries({
        queryKey: queryKeys.livePrices.all,
      });
      
      // Fetch fresh data with refresh=1 parameter, bypassing all caches
      const refreshQueryKey = queryKeys.livePrices.list(undefined, undefined, true);
      await queryClient.fetchQuery({
        queryKey: refreshQueryKey,
        queryFn: () => getLivePrices(undefined, undefined, true),
        staleTime: 0, // Always consider stale for refresh
        gcTime: 12 * 60 * 60 * 1000, // Cache new data for 12 hours
      });
      
      // Also invalidate the non-refresh query to force update
      await queryClient.invalidateQueries({
        queryKey: queryKeys.livePrices.list(undefined, undefined, false),
      });
      
      // Refetch the main query to update the UI (will be cached for 12 hours)
      await refetchLivePrices();
    } catch (error) {
      console.error('Error refreshing live prices:', error);
    }
  };

  // Filter and process live prices with 20% markup for B2B
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
          price.mcx_price || '',
          price.pe_63 || '',
          price.drum_scrap || '',
          price.black_cable || '',
          price.white_pipe || '',
          price.grey_pvc || '',
          price.injection_moulding || '',
          price.battery_price || ''
        ];
        return searchableFields.some(field =>
          field.toString().toLowerCase().includes(query)
        );
      });
    }

    // Apply 20% markup for B2B, no markup for B2C
    return filtered.map((price: any) => {
      // Helper function to apply 20% markup to any numerical value
      // Preserves formatting like "LME: 12872" or "PE63: 62"
      const applyMarkupToValue = (value: string | null, prefix?: string): string => {
        if (!value || value === '-') return '-';
        
        const valueStr = value.toString().trim();
        
        // Extract numerical value (handles formats like "LME: 12872", "12872", "₹12872", etc.)
        // Remove currency symbols and commas, then find the first number
        const cleanedStr = valueStr.replace(/[₹,$]/g, '').replace(/,/g, '');
        const numericMatch = cleanedStr.match(/(\d+\.?\d*)/);
        if (!numericMatch) return valueStr;

        const numericValue = parseFloat(numericMatch[1]);
        if (isNaN(numericValue)) return valueStr;

        if (isB2B) {
          // Apply 20% markup for B2B
          const markedUpValue = numericValue * 1.2;
          
          // If there's a prefix parameter (like "LME", "PE63", "Drum", etc.), use it
          if (prefix) {
            // For whole numbers, show as whole number if result is whole, otherwise 2 decimals
            const isWhole = markedUpValue % 1 === 0;
            return `${prefix}: ${isWhole ? markedUpValue.toFixed(0) : markedUpValue.toFixed(2)}`;
          }
          
          // Check if the original string had a prefix pattern (e.g., "LME: 12872", "PE63: 62")
          const prefixMatch = valueStr.match(/^([A-Za-z0-9\s]+):\s*/);
          if (prefixMatch) {
            const isWhole = markedUpValue % 1 === 0;
            return `${prefixMatch[1]}: ${isWhole ? markedUpValue.toFixed(0) : markedUpValue.toFixed(2)}`;
          }
          
          // Default: replace the number in the original string or add ₹ symbol
          const isWhole = markedUpValue % 1 === 0;
          if (valueStr.includes('₹')) {
            return valueStr.replace(/(\d+\.?\d*)/, isWhole ? markedUpValue.toFixed(0) : markedUpValue.toFixed(2));
          }
          return `₹${isWhole ? markedUpValue.toFixed(0) : markedUpValue.toFixed(2)}`;
        } else {
          // No markup for B2C - return price as is, but ensure formatting
          if (prefix) {
            return `${prefix}: ${valueStr}`;
          }
          const prefixMatch = valueStr.match(/^([A-Za-z0-9\s]+):\s*/);
          if (prefixMatch) {
            return valueStr; // Already formatted
          }
          return valueStr.includes('₹') ? valueStr : `₹${valueStr}`;
        }
      };

      const calculatePrice = (basePrice: string | null): string => {
        return applyMarkupToValue(basePrice);
      };

      // Format LME/MCX prices with markup in B2B
      const formatLMEMCXPrice = (priceValue: string | null, prefix: string): string => {
        return applyMarkupToValue(priceValue, prefix);
      };

      // Determine buy price and sell price
      let buyPrice = calculatePrice(price.buy_price);
      let sellPrice = calculatePrice(price.sell_price);

      // For Metal LME/MCX Rates, use lme_price and mcx_price if buy_price/sell_price are null or '-'
      // Check if this is specifically a Metal LME/MCX Rates entry
      const isMetalLMEMCX = price.location === 'Metal LME/MCX Rates' || 
                           (price.category === 'Metal' && (price.lme_price || price.mcx_price));
      
      if (isMetalLMEMCX) {
        if ((buyPrice === '-' || !price.buy_price) && price.lme_price) {
          buyPrice = formatLMEMCXPrice(price.lme_price, 'LME');
        }
        if ((sellPrice === '-' || !price.sell_price) && price.mcx_price) {
          sellPrice = formatLMEMCXPrice(price.mcx_price, 'MCX');
        }
      }

      // For HDPE Scrap, use pe_63 and drum_scrap if buy_price/sell_price are null
      if (price.item === 'HDPE Scrap' || price.category === 'HDPE') {
        if (buyPrice === '-' && price.pe_63) {
          buyPrice = applyMarkupToValue(price.pe_63, 'PE63');
        }
        if (sellPrice === '-' && price.drum_scrap) {
          sellPrice = applyMarkupToValue(price.drum_scrap, 'Drum');
        }
      }

      // Build additional details string for items with extra price fields (with markup in B2B)
      // Helper to format additional detail prices (extracts just the number, no ₹ symbol or prefix)
      const formatAdditionalDetailPrice = (value: string | null): string => {
        if (!value || value === '-') return '-';
        
        // Extract the numeric value and apply markup
        const valueStr = value.toString().trim();
        const cleanedStr = valueStr.replace(/[₹,$]/g, '').replace(/,/g, '');
        const numericMatch = cleanedStr.match(/(\d+\.?\d*)/);
        if (!numericMatch) return valueStr;

        const numericValue = parseFloat(numericMatch[1]);
        if (isNaN(numericValue)) return valueStr;

        if (isB2B) {
          // Apply 20% markup for B2B
          const markedUpValue = numericValue * 1.2;
          const isWhole = markedUpValue % 1 === 0;
          return isWhole ? markedUpValue.toFixed(0) : markedUpValue.toFixed(2);
        } else {
          // No markup for B2C - return as is
          return valueStr;
        }
      };
      
      const additionalDetails: string[] = [];
      if (price.black_cable) additionalDetails.push(`Black Cable: ${formatAdditionalDetailPrice(price.black_cable)}`);
      if (price.white_pipe) additionalDetails.push(`White Pipe: ${formatAdditionalDetailPrice(price.white_pipe)}`);
      if (price.grey_pvc) additionalDetails.push(`Grey PVC: ${formatAdditionalDetailPrice(price.grey_pvc)}`);
      if (price.injection_moulding) additionalDetails.push(`Injection Moulding: ${formatAdditionalDetailPrice(price.injection_moulding)}`);
      if (price.battery_price) additionalDetails.push(`Battery: ${formatAdditionalDetailPrice(price.battery_price)}`);
      if (price.pe_63 && price.item !== 'HDPE Scrap' && price.category !== 'HDPE') {
        additionalDetails.push(`PE63: ${formatAdditionalDetailPrice(price.pe_63)}`);
      }
      if (price.drum_scrap && price.item !== 'HDPE Scrap' && price.category !== 'HDPE') {
        additionalDetails.push(`Drum: ${formatAdditionalDetailPrice(price.drum_scrap)}`);
      }

      const additionalDetailsStr = additionalDetails.length > 0 
        ? `Additional Details: ${additionalDetails.join(' ')}`
        : '';

      return {
        location: price.location || '-',
        category: price.category || '-',
        item: price.item || '-',
        city: price.city || '-',
        buyPrice,
        sellPrice,
        additionalDetails: additionalDetailsStr,
        status: t('livePrices.liveData') || 'Live Data'
      };
    });
  }, [livePricesData?.data, searchQuery, t, isB2B]);

  // Generate HTML content for WebView
  const htmlContent = useMemo(() => {
    const isDarkMode = isDark;
    const bgColor = isDarkMode ? '#1a1a1a' : '#ffffff';
    const textColor = isDarkMode ? '#ffffff' : '#000000';
    const headerBg = theme.primary || '#007AFF';
    const rowEvenBg = isDarkMode ? '#2a2a2a' : '#f5f5f5';
    const rowOddBg = isDarkMode ? '#1a1a1a' : '#ffffff';
    const borderColor = isDarkMode ? '#333333' : '#e0e0e0';

    const tableRows = filteredAndMarkedUpPrices.map((price: any, index: number) => {
      const rowBg = index % 2 === 0 ? rowEvenBg : rowOddBg;
      const mainRow = `
        <tr style="background-color: ${rowBg};">
          <td style="padding: 12px 4px; text-align: center; border-bottom: 1px solid ${borderColor}; font-size: 12px; color: ${textColor}; word-wrap: break-word; word-break: break-word; line-height: 1.4;">${price.location}</td>
          <td style="padding: 12px 4px; text-align: center; border-bottom: 1px solid ${borderColor}; font-size: 12px; color: ${textColor}; word-wrap: break-word; word-break: break-word; line-height: 1.4;">${price.category}</td>
          <td style="padding: 12px 3px; text-align: center; border-bottom: 1px solid ${borderColor}; font-size: 12px; color: ${textColor}; word-wrap: break-word; word-break: break-word; line-height: 1.4;">${price.item}</td>
          <td style="padding: 12px 2px; text-align: center; border-bottom: 1px solid ${borderColor}; font-size: 12px; color: ${textColor}; word-wrap: break-word; word-break: break-word; line-height: 1.4;">${price.city}</td>
          <td style="padding: 12px 3px; text-align: center; border-bottom: 1px solid ${borderColor}; font-size: 12px; color: ${headerBg}; font-weight: bold; word-wrap: break-word; word-break: break-word; line-height: 1.4;">${price.buyPrice}</td>
          <td style="padding: 12px 4px; text-align: center; border-bottom: 1px solid ${borderColor}; font-size: 12px; color: ${headerBg}; font-weight: bold; word-wrap: break-word; word-break: break-word; line-height: 1.4;">${price.sellPrice}</td>
          <td style="padding: 12px 4px; text-align: center; border-bottom: 1px solid ${borderColor};">
            <span style="background-color: ${headerBg}20; padding: 4px 8px; border-radius: 6px; font-size: 10px; color: ${headerBg}; font-weight: 500;">${price.status}</span>
          </td>
        </tr>
      `;
      
      // Add additional details row if available
      if (price.additionalDetails) {
        const detailsRow = `
          <tr style="background-color: ${rowBg};">
            <td colspan="7" style="padding: 8px 12px; text-align: left; border-bottom: 1px solid ${borderColor}; font-size: 11px; color: ${isDarkMode ? '#aaa' : '#666'}; font-style: italic; word-wrap: break-word; word-break: break-word; line-height: 1.4;">
              ${price.additionalDetails}
            </td>
          </tr>
        `;
        return mainRow + detailsRow;
      }
      
      return mainRow;
    }).join('');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
              -webkit-touch-callout: default;
              -webkit-user-select: text;
              user-select: text;
            }
            html {
              -webkit-text-size-adjust: 100%;
              touch-action: manipulation;
            }
            body {
              background-color: ${bgColor};
              color: ${textColor};
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              padding: 0;
              margin: 0;
              overflow-x: auto;
              overflow-y: scroll;
              -webkit-overflow-scrolling: touch;
              -webkit-user-select: text;
              user-select: text;
              touch-action: pan-x pan-y pinch-zoom;
              -webkit-tap-highlight-color: transparent;
              height: 100vh;
            }
            .table-container {
              width: 100%;
              overflow-x: auto;
              overflow-y: visible;
              -webkit-overflow-scrolling: touch;
              touch-action: pan-x pan-y pinch-zoom;
              -webkit-user-select: text;
              user-select: text;
              position: relative;
            }
            .table-container table {
              margin: 0;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              min-width: 600px;
              table-layout: fixed;
            }
            thead {
              position: -webkit-sticky;
              position: sticky;
              top: 0;
              z-index: 1000;
              display: table-header-group;
              background-color: ${headerBg};
            }
            th {
              background-color: ${headerBg};
              color: #ffffff;
              padding: 12px 4px;
              text-align: center;
              font-size: 12px;
              font-weight: 600;
              border-bottom: 2px solid ${headerBg};
              word-wrap: break-word;
              word-break: break-word;
              line-height: 1.4;
              position: -webkit-sticky;
              position: sticky;
              top: 0;
              z-index: 1001;
              box-shadow: 0 2px 2px -1px rgba(0, 0, 0, 0.1);
            }
            th:nth-child(1) { width: 80px; } /* Location */
            th:nth-child(2) { width: 90px; } /* Category */
            th:nth-child(3) { width: 100px; } /* Item */
            th:nth-child(4) { width: 60px; } /* City - reduced */
            th:nth-child(5) { width: 85px; } /* Buy Price - reduced */
            th:nth-child(6) { width: 85px; } /* Sell Price */
            th:nth-child(7) { width: 70px; } /* Status */
            td {
              padding: 12px 4px;
              text-align: center;
              border-bottom: 1px solid ${borderColor};
              font-size: 12px;
              word-wrap: break-word;
              word-break: break-word;
              line-height: 1.4;
            }
            td:nth-child(1) { width: 80px; } /* Location */
            td:nth-child(2) { width: 90px; } /* Category */
            td:nth-child(3) { width: 100px; } /* Item */
            td:nth-child(4) { width: 60px; } /* City - reduced */
            td:nth-child(5) { width: 85px; } /* Buy Price - reduced */
            td:nth-child(6) { width: 85px; } /* Sell Price */
            td:nth-child(7) { width: 70px; } /* Status */
            .empty-message {
              text-align: center;
              padding: 40px 20px;
              color: ${isDarkMode ? '#888' : '#666'};
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="table-container">
            <table>
              <thead>
                <tr>
                  <th>${t('livePrices.location') || 'Location'}</th>
                  <th>${t('livePrices.category') || 'Category'}</th>
                  <th>${t('livePrices.item') || 'Item'}</th>
                  <th>${t('livePrices.city') || 'City'}</th>
                  <th>${t('livePrices.buyPrice') || 'Buy Price'}</th>
                  <th>${t('livePrices.sellPrice') || 'Sell Price'}</th>
                  <th>${t('livePrices.status') || 'Status'}</th>
                </tr>
              </thead>
              <tbody>
                ${tableRows || `<tr><td colspan="7" class="empty-message">${t('livePrices.noDataAvailable') || 'No data available'}</td></tr>`}
              </tbody>
            </table>
          </div>
        </body>
      </html>
    `;
  }, [filteredAndMarkedUpPrices, theme, isDark, t, i18nInstance.language]);
  
  // Force WebView to reload when language changes
  React.useEffect(() => {
    setWebViewKey(prev => prev + 1);
  }, [i18nInstance.language]);

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
        <View style={styles.headerRight}>
          <TouchableOpacity
            onPress={handleZoomOut}
            style={styles.zoomButton}
            disabled={zoomLevel <= 10}
          >
            <MaterialCommunityIcons
              name="magnify-minus"
              size={20}
              color={zoomLevel <= 10 ? theme.textSecondary : theme.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomReset}
            style={styles.zoomButton}
          >
            <AutoText style={[styles.zoomLevelText, { color: theme.textPrimary }]}>
              {zoomLevel}%
            </AutoText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleZoomIn}
            style={styles.zoomButton}
            disabled={zoomLevel >= 200}
          >
            <MaterialCommunityIcons
              name="magnify-plus"
              size={20}
              color={zoomLevel >= 200 ? theme.textSecondary : theme.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <MaterialCommunityIcons name="magnify" size={20} color={theme.textSecondary} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('livePrices.searchPlaceholder') || 'Search by location, item, category, price...'}
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

      {/* WebView Content */}
      {loadingLivePrices ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
          <AutoText style={styles.loadingText}>
            {t('common.loading') || 'Loading live prices...'}
          </AutoText>
          <AutoText style={styles.loadingSubText}>
            {t('livePrices.loadingSubtext') || 'Please wait while we fetch the latest prices from Redis cache'}
          </AutoText>
        </View>
      ) : livePricesError ? (
        <View style={styles.errorContainer}>
          <AutoText style={styles.errorText}>
            {t('common.error') || 'Error'}: {livePricesError?.message || t('livePrices.failedToLoad') || 'Failed to load live prices'}
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
      ) : (
        <WebView
          key={webViewKey}
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webView}
          // Enable pinch-to-zoom
          scalesPageToFit={true}
          showsVerticalScrollIndicator={true}
          showsHorizontalScrollIndicator={true}
          bounces={true}
          scrollEnabled={true}
          // Media props
          allowsInlineMediaPlayback={true}
          mediaPlaybackRequiresUserAction={false}
          // iOS specific
          allowsBackForwardNavigationGestures={false}
          // Enable JavaScript and storage
          javaScriptEnabled={true}
          domStorageEnabled={true}
          // Loading state
          startInLoadingState={true}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
            </View>
          )}
          // Event handlers
          onLoadEnd={() => {
            // Enable pinch-to-zoom with JavaScript
            enablePinchZoom();
            // Set initial zoom level when WebView loads
            setTimeout(() => {
              updateWebViewZoom(zoomLevel);
            }, 100);
          }}
          onError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.warn('WebView error: ', nativeEvent);
          }}
          // Android WebView settings for zoom (via injectedJavaScript)
          injectedJavaScript={`
            (function() {
              // Enable zoom on Android
              if (window.Android && window.Android.setSupportZoom) {
                window.Android.setSupportZoom(true);
              }
              // Ensure viewport allows zoom
              var meta = document.querySelector('meta[name="viewport"]');
              if (meta) {
                meta.setAttribute('content', 'width=device-width, initial-scale=1.0, minimum-scale=0.1, maximum-scale=5.0, user-scalable=yes');
              }
              // Enable touch actions for pinch-zoom
              document.body.style.touchAction = 'pan-x pan-y pinch-zoom';
              document.documentElement.style.touchAction = 'pan-x pan-y pinch-zoom';
              true;
            })();
          `}
        />
      )}
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
      fontSize: '16@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '8@s',
    },
    zoomButton: {
      padding: '6@s',
      borderRadius: '6@ms',
      backgroundColor: theme.card,
    },
    zoomLevelText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      minWidth: '40@s',
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
      fontSize: '11@s',
      color: theme.textPrimary,
      padding: 0,
    },
    searchClearButton: {
      padding: '4@s',
      marginLeft: '8@s',
    },
    webView: {
      flex: 1,
      backgroundColor: theme.background,
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
