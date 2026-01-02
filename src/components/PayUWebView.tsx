import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Modal, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from './ThemeProvider';
import { ScaledSheet } from 'react-native-size-matters';

interface PayUWebViewProps {
  visible: boolean;
  onClose: () => void;
  onPaymentResponse: (response: PayUPaymentResponse) => void;
  paymentData: {
    key: string;
    txnid: string;
    amount: string;
    productinfo: string;
    firstname: string;
    email: string;
    phone: string;
    surl: string;
    furl: string;
    hash: string;
    udf1?: string;
    udf2?: string;
    udf3?: string;
    udf4?: string;
    udf5?: string;
  };
  formUrl: string; // URL to the PayU form endpoint
}

export interface PayUPaymentResponse {
  status: 'success' | 'failure' | 'cancelled';
  txnid?: string;
  amount?: string;
  firstname?: string;
  email?: string;
  phone?: string;
  productinfo?: string;
  addedon?: string;
  message?: string;
  error?: string;
}

const PayUWebView: React.FC<PayUWebViewProps> = ({
  visible,
  onClose,
  onPaymentResponse,
  paymentData,
  formUrl,
}) => {
  const webViewRef = useRef<WebView>(null);
  const { theme, isDark } = useTheme();
  
  // Fallback theme values in case theme is undefined
  // Theme structure: theme.background, theme.text, theme.primary, etc. (not theme.colors)
  const backgroundColor = theme?.background || '#FFFFFF';
  const surfaceColor = theme?.surface || '#F5F5F5';
  const textColor = theme?.text || theme?.textPrimary || '#000000';
  const primaryColor = theme?.primary || '#4CAF50';

  // JavaScript to auto-fill and submit the PayU form
  const injectedJavaScript = `
    (function() {
      try {
        // Wait for form to be ready
        setTimeout(function() {
          var form = document.forms.payuForm;
          if (form) {
            // Fill form fields
            var amountField = document.getElementById('amount') || document.querySelector('input[name="amount"]');
            var firstnameField = document.getElementById('firstname') || document.querySelector('input[name="firstname"]');
            var emailField = document.getElementById('email') || document.querySelector('input[name="email"]');
            var phoneField = document.getElementById('phone') || document.querySelector('input[name="phone"]');
            var productinfoField = document.getElementById('productinfo') || document.querySelector('textarea[name="productinfo"]') || document.querySelector('input[name="productinfo"]');
            
            if (amountField) amountField.value = '${paymentData.amount}';
            if (firstnameField) firstnameField.value = '${paymentData.firstname}';
            if (emailField) emailField.value = '${paymentData.email}';
            if (phoneField) phoneField.value = '${paymentData.phone}';
            if (productinfoField) productinfoField.value = '${paymentData.productinfo}';
            
            // Submit form after a short delay
            setTimeout(function() {
              if (form) {
                form.submit();
              }
            }, 500);
          }
        }, 1000);
      } catch (e) {
        console.error('PayU form injection error:', e);
      }
    })();
    true; // Required for iOS
  `;

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;
    
    // Check if this is a success or failure URL
    if (url.includes(paymentData.surl) || url.includes('success') || url.includes('my_success.php')) {
      // Success URL - extract data from URL or wait for postMessage
      console.log('✅ PayU Success URL detected:', url);
    } else if (url.includes(paymentData.furl) || url.includes('failure') || url.includes('my_failure.php')) {
      // Failure URL
      console.log('❌ PayU Failure URL detected:', url);
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = event.nativeEvent.data;
      console.log('📱 PayU WebView Message:', data);
      
      // Parse the response from the success/failure page
      const response: PayUPaymentResponse = JSON.parse(data);
      
      // Determine status
      if (response.status === 'success' || response.txnid) {
        onPaymentResponse({
          status: 'success',
          txnid: response.txnid,
          amount: response.amount,
          firstname: response.firstname,
          email: response.email,
          phone: response.phone,
          productinfo: response.productinfo,
          addedon: response.addedon,
        });
      } else {
        onPaymentResponse({
          status: 'failure',
          message: response.message || response.error || 'Payment failed',
          txnid: response.txnid,
        });
      }
    } catch (error: any) {
      console.error('❌ Error parsing PayU response:', error);
      onPaymentResponse({
        status: 'failure',
        message: 'Failed to parse payment response',
        error: error.message,
      });
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ WebView error:', nativeEvent);
    
    // Check for connection timeout errors
    const errorCode = nativeEvent.code;
    const errorDescription = nativeEvent.description || nativeEvent.message || '';
    
    let errorMessage = 'WebView error occurred';
    if (errorCode === -8 || errorDescription.includes('ERR_CONNECTION_TIMED_OUT')) {
      errorMessage = 'Connection timeout. Please check your internet connection and try again.';
    } else if (errorDescription.includes('ERR_CONNECTION_REFUSED')) {
      errorMessage = 'Connection refused. The payment server may be temporarily unavailable.';
    } else if (errorDescription.includes('ERR_NAME_NOT_RESOLVED')) {
      errorMessage = 'Unable to resolve server address. Please check your internet connection.';
    } else if (errorDescription.includes('ERR_INTERNET_DISCONNECTED')) {
      errorMessage = 'No internet connection. Please check your network settings.';
    }
    
    onPaymentResponse({
      status: 'failure',
      message: errorMessage,
      error: errorDescription || nativeEvent.message,
    });
  };

  return (
    <Modal
      animationType="slide"
      visible={visible}
      onRequestClose={onClose}
      transparent={false}
    >
      <View style={[styles.container, { backgroundColor: backgroundColor }]}>
        {/* Header with close button */}
        <View style={[styles.header, { backgroundColor: surfaceColor }]}>
          <Text style={[styles.headerTitle, { color: textColor }]}>
            PayU Payment
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={textColor}
            />
          </TouchableOpacity>
        </View>

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: formUrl }}
          style={styles.webview}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          injectedJavaScript={injectedJavaScript}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          onError={handleError}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            console.error('❌ WebView HTTP error:', nativeEvent);
            
            let errorMessage = 'HTTP error occurred';
            const statusCode = nativeEvent.statusCode;
            
            if (statusCode === 404) {
              errorMessage = 'Payment page not found. Please try again.';
            } else if (statusCode === 500) {
              errorMessage = 'Server error. Please try again later.';
            } else if (statusCode === 503) {
              errorMessage = 'Service temporarily unavailable. Please try again later.';
            } else if (statusCode >= 400 && statusCode < 500) {
              errorMessage = 'Payment request error. Please check your payment details.';
            } else if (statusCode >= 500) {
              errorMessage = 'Server error. Please try again later.';
            }
            
            onPaymentResponse({
              status: 'failure',
              message: errorMessage,
              error: `Status: ${statusCode}`,
            });
          }}
          renderLoading={() => (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={primaryColor} />
              <Text style={[styles.loadingText, { color: textColor }]}>
                Loading payment form...
              </Text>
            </View>
          )}
        />
      </View>
    </Modal>
  );
};

const styles = ScaledSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: '16@s',
    paddingVertical: '12@vs',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: '18@s',
    fontWeight: '600',
  },
  closeButton: {
    padding: '4@s',
  },
  webview: {
    flex: 1,
  },
  loadingContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  loadingText: {
    marginTop: '12@vs',
    fontSize: '14@s',
  },
});

export default PayUWebView;

