import React, { useMemo } from 'react';
import { View, StatusBar, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { WebView } from 'react-native-webview';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { TouchableOpacity } from 'react-native';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';

const TermsScreen = () => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const TERMS_URL = 'https://scrapmate.co.in/refund.html';

  // JavaScript to hide website headers and navigation and move content upwards
  const injectedJavaScript = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        header, nav, .header, .navbar, .navigation, 
        .site-header, .main-header, .top-header,
        .menu, .hamburger, .menu-toggle,
        #header, #nav, #navigation {
          display: none !important;
          height: 0 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        body {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
        html {
          padding-top: 0 !important;
          margin-top: 0 !important;
        }
        h1, .introduction, #introduction, 
        [class*="intro"], [id*="intro"] {
          margin-top: 0 !important;
          padding-top: 0 !important;
        }
        footer, .footer, .bottom-container, 
        [class*="footer"], [id*="footer"],
        [class*="bottom"], [id*="bottom"] {
          margin-top: 0 !important;
        }
        * {
          box-sizing: border-box;
        }
      \`;
      document.head.appendChild(style);
      
      // Remove any spacing elements and move content up
      setTimeout(function() {
        const headerElements = document.querySelectorAll('header, nav, .header, .navbar, .navigation, .site-header, .main-header, .top-header');
        headerElements.forEach(function(el) {
          el.style.display = 'none';
          el.style.height = '0';
          el.style.margin = '0';
          el.style.padding = '0';
          el.style.visibility = 'hidden';
        });
        
        // Move introduction section up
        const introElements = document.querySelectorAll('h1, .introduction, #introduction, [class*="intro"], [id*="intro"]');
        introElements.forEach(function(el) {
          el.style.marginTop = '0';
          el.style.paddingTop = '0';
        });
        
        // Move bottom containers up
        const bottomElements = document.querySelectorAll('footer, .footer, .bottom-container, [class*="footer"], [id*="footer"], [class*="bottom"], [id*="bottom"]');
        bottomElements.forEach(function(el) {
          el.style.marginTop = '0';
        });
        
        // Reset body and html margins
        document.body.style.marginTop = '0';
        document.body.style.paddingTop = '0';
        document.documentElement.style.marginTop = '0';
        document.documentElement.style.paddingTop = '0';
      }, 100);
    })();
    true;
  `;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('userProfile.terms') || 'Terms & Refund Policy'}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <WebView
        source={{ uri: TERMS_URL }}
        style={styles.webview}
        startInLoadingState={true}
        injectedJavaScript={injectedJavaScript}
        onMessage={() => {}}
        renderLoading={() => (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        )}
        onError={(syntheticEvent) => {
          const { nativeEvent } = syntheticEvent;
          console.error('WebView error: ', nativeEvent);
        }}
      />
    </View>
  );
};

const getStyles = (theme: any, isDark: boolean) =>
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
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    webview: {
      flex: 1,
      backgroundColor: theme.background,
    },
    loadingContainer: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.background,
    },
  });

export default TermsScreen;

