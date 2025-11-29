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

const PrivacyPolicyScreen = () => {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, isDark), [theme, isDark]);

  const PRIVACY_POLICY_URL = 'https://scrapmate.co.in/privacy_policy.html';

  // JavaScript to hide website headers and navigation and move content upwards
  const injectedJavaScript = `
    (function() {
      function applyStyles() {
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
            visibility: hidden !important;
            position: absolute !important;
            top: -9999px !important;
          }
          body {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          html {
            padding-top: 0 !important;
            margin-top: 0 !important;
          }
          main, .main, .content, .container,
          [class*="main"], [class*="content"], [class*="container"] {
            margin-top: 0 !important;
            padding-top: 0 !important;
          }
          h1, .introduction, #introduction, 
          [class*="intro"], [id*="intro"],
          h1:first-of-type, h1:first-child {
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
        if (document.head) {
          document.head.appendChild(style);
        }
        
        // Remove any spacing elements and move content up
        const headerElements = document.querySelectorAll('header, nav, .header, .navbar, .navigation, .site-header, .main-header, .top-header');
        headerElements.forEach(function(el) {
          el.style.display = 'none';
          el.style.height = '0';
          el.style.margin = '0';
          el.style.padding = '0';
          el.style.visibility = 'hidden';
          el.style.position = 'absolute';
          el.style.top = '-9999px';
        });
        
        // Remove spacing from main content containers
        const mainElements = document.querySelectorAll('main, .main, .content, .container, [class*="main"], [class*="content"], [class*="container"]');
        mainElements.forEach(function(el) {
          el.style.marginTop = '0';
          el.style.paddingTop = '0';
        });
        
        // Move introduction section up - target first content element
        const firstContent = document.querySelector('h1, h2, .introduction, #introduction, [class*="intro"], [id*="intro"], main > *, body > *:not(header):not(nav):not(script):not(style)');
        if (firstContent) {
          firstContent.style.marginTop = '0';
          firstContent.style.paddingTop = '0';
        }
        
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
        if (document.body) {
          document.body.style.marginTop = '0';
          document.body.style.paddingTop = '0';
          // Find first child and remove its top margin
          const firstChild = document.body.firstElementChild;
          if (firstChild && firstChild.tagName !== 'HEADER' && firstChild.tagName !== 'NAV') {
            firstChild.style.marginTop = '0';
            firstChild.style.paddingTop = '0';
          }
        }
        if (document.documentElement) {
          document.documentElement.style.marginTop = '0';
          document.documentElement.style.paddingTop = '0';
        }
      }
      
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyStyles);
      } else {
        applyStyles();
      }
      
      // Also apply after a short delay to catch dynamically loaded content
      setTimeout(applyStyles, 100);
      setTimeout(applyStyles, 500);
      setTimeout(applyStyles, 1000);
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
          {t('userProfile.privacyPolicy') || 'Privacy Policy'}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <WebView
        source={{ uri: PRIVACY_POLICY_URL }}
        style={styles.webview}
        startInLoadingState={true}
        injectedJavaScript={injectedJavaScript}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScript}
        onMessage={() => {}}
        onLoadEnd={() => {
          // Re-inject JavaScript after page fully loads
        }}
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

export default PrivacyPolicyScreen;

