import React, { useRef, useEffect } from 'react';
import { StyleSheet, View, Modal, ActivityIndicator, TouchableOpacity, Text, Alert } from 'react-native';
import { WebView } from 'react-native-webview';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from './ThemeProvider';
import { ScaledSheet } from 'react-native-size-matters';
import { getInstamojoPaymentDetails } from '../services/api/v2/instamojo';

interface InstamojoWebViewProps {
  visible: boolean;
  onClose: () => void;
  onPaymentResponse: (response: InstamojoPaymentResponse) => void;
  paymentUrl: string; // Instamojo longurl from payment request
  redirectUrl?: string; // Redirect URL to detect payment status
}

export interface InstamojoPaymentResponse {
  status: 'success' | 'failure' | 'cancelled';
  paymentId?: string;
  paymentRequestId?: string;
  amount?: string;
  buyerName?: string;
  buyerEmail?: string;
  buyerPhone?: string;
  message?: string;
  error?: string;
}

const InstamojoWebView: React.FC<InstamojoWebViewProps> = ({
  visible,
  onClose,
  onPaymentResponse,
  paymentUrl,
  redirectUrl,
}) => {
  const webViewRef = useRef<WebView>(null);
  const { theme, isDark } = useTheme();
  
  const backgroundColor = theme?.background || '#FFFFFF';
  const surfaceColor = theme?.surface || '#F5F5F5';
  const textColor = theme?.text || theme?.textPrimary || '#000000';
  const primaryColor = theme?.primary || '#4CAF50';

  // Get payment details from Instamojo API using payment request ID
  const getPaymentDetails = async (paymentRequestId: string) => {
    try {
      console.log('🔍 Fetching payment details for request ID:', paymentRequestId);
      const paymentDetails = await getInstamojoPaymentDetails(paymentRequestId);
      
      if (paymentDetails.data?.payments && paymentDetails.data.payments.length > 0) {
        const payment = paymentDetails.data.payments[0];
        console.log('✅ Payment details:', payment);
        
        // Payment was successful
        onPaymentResponse({
          status: payment.status === 'Credit' ? 'success' : 'failure',
          paymentId: payment.payment_id,
          paymentRequestId: paymentRequestId,
          amount: payment.amount,
          buyerName: payment.buyer_name,
          buyerEmail: payment.buyer_email,
          buyerPhone: payment.buyer_phone,
          message: payment.status === 'Credit' ? 'Payment successful' : `Payment status: ${payment.status}`,
        });
      } else {
        // No payments found - payment might be pending or failed
        console.log('⚠️ No payments found for request ID:', paymentRequestId);
        onPaymentResponse({
          status: 'failure',
          paymentRequestId: paymentRequestId,
          message: 'No payment found. Payment may be pending or failed.',
        });
      }
    } catch (error: any) {
      console.error('❌ Error fetching payment details:', error);
      onPaymentResponse({
        status: 'failure',
        paymentRequestId: paymentRequestId,
        message: 'Failed to verify payment status',
        error: error.message,
      });
    }
  };

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('📱 Instamojo WebView Message:', data);
      // Messages from WebView can be handled here if needed
    } catch (error: any) {
      console.error('❌ Error parsing WebView message:', error);
    }
  };

  const handleNavigationStateChange = (navState: any) => {
    const { url } = navState;
    console.log('🔗 Instamojo WebView Navigation:', url);
    
    // Check if this is the redirect URL (payment completed)
    // Check for payment parameters in the URL (payment_id, payment_request_id, payment_status)
    const hasPaymentParams = url.includes('payment_id=') || 
                            url.includes('payment_request_id=') || 
                            url.includes('payment_status=');
    
    const isRedirectUrl = redirectUrl && url.includes(redirectUrl);
    
    if (hasPaymentParams || isRedirectUrl) {
      console.log('✅ Payment redirect URL detected:', url);
      
      // Extract payment details directly from URL query parameters
      let paymentId: string | null = null;
      let paymentRequestId: string | null = null;
      let paymentStatus: string | null = null;
      
      try {
        const urlObj = new URL(url);
        paymentId = urlObj.searchParams.get('payment_id');
        paymentRequestId = urlObj.searchParams.get('payment_request_id') || 
                          urlObj.searchParams.get('request_id');
        paymentStatus = urlObj.searchParams.get('payment_status');
        
        // Fallback: parse from URL string if URL parsing fails
        if (!paymentId && url.includes('payment_id=')) {
          paymentId = url.split('payment_id=').pop()?.split('&')[0] || null;
        }
        if (!paymentRequestId) {
          if (url.includes('payment_request_id=')) {
            paymentRequestId = url.split('payment_request_id=').pop()?.split('&')[0] || null;
          } else if (url.includes('request_id=')) {
            paymentRequestId = url.split('request_id=').pop()?.split('&')[0] || null;
          }
        }
        if (!paymentStatus && url.includes('payment_status=')) {
          paymentStatus = url.split('payment_status=').pop()?.split('&')[0] || null;
        }
        
        console.log('✅ Payment parameters extracted:', {
          paymentId,
          paymentRequestId,
          paymentStatus,
        });
        
        if (paymentRequestId) {
          // If we have payment_status=Credit, we can immediately report success
          // Otherwise, fetch full payment details from API
          if (paymentStatus === 'Credit' && paymentId) {
            console.log('✅ Payment successful (from URL parameters)');
            onPaymentResponse({
              status: 'success',
              paymentId: paymentId,
              paymentRequestId: paymentRequestId,
            });
          } else if (paymentStatus && paymentStatus !== 'Credit') {
            console.log('❌ Payment failed (from URL parameters):', paymentStatus);
            onPaymentResponse({
              status: 'failure',
              paymentId: paymentId || undefined,
              paymentRequestId: paymentRequestId,
              message: `Payment status: ${paymentStatus}`,
              error: `Payment ${paymentStatus}`,
            });
          } else {
            // Fetch full payment details from API to get complete information
            console.log('🔍 Fetching full payment details from API...');
            getPaymentDetails(paymentRequestId);
          }
        } else {
          console.error('❌ Could not extract payment_request_id from URL:', url);
          onPaymentResponse({
            status: 'failure',
            message: 'Could not extract payment request ID from redirect URL',
          });
        }
      } catch (error: any) {
        console.error('❌ Error parsing redirect URL:', error);
        onPaymentResponse({
          status: 'failure',
          message: 'Error processing payment redirect',
          error: error.message,
        });
      }
    }
  };

  const handleError = (syntheticEvent: any) => {
    const { nativeEvent } = syntheticEvent;
    console.error('❌ WebView error:', nativeEvent);
    
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
            Instamojo Payment
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
          source={{ uri: paymentUrl }}
          style={styles.webview}
          startInLoadingState={true}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          scalesPageToFit={true}
          onMessage={handleMessage}
          onNavigationStateChange={handleNavigationStateChange}
          onShouldStartLoadWithRequest={(request) => {
            // Allow all navigation - we'll handle redirect in onNavigationStateChange
            return true;
          }}
          onError={handleError}
          onHttpError={(syntheticEvent) => {
            const { nativeEvent } = syntheticEvent;
            const { url, statusCode } = nativeEvent;
            console.error('❌ WebView HTTP error:', nativeEvent);
            
            // If this is the redirect URL with payment parameters, don't treat 404 as error
            // The payment details are in the URL query parameters
            const isRedirectUrl = redirectUrl && url && url.includes(redirectUrl);
            const hasPaymentParams = url && (url.includes('payment_id=') || url.includes('payment_request_id='));
            
            if (isRedirectUrl || hasPaymentParams) {
              console.log('⚠️ HTTP error on redirect URL - payment details may be in URL parameters');
              // Don't call onPaymentResponse here - let onNavigationStateChange handle it
              // The navigation state change will extract payment details from URL
              return;
            }
            
            let errorMessage = 'HTTP error occurred';
            
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
                Loading payment gateway...
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

export default InstamojoWebView;

