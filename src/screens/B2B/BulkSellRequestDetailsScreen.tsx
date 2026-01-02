import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, RefreshControl, Alert, Linking, Platform, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { BulkSellRequestItem } from '../../services/api/v2/bulkSell';
import { SectionCard } from '../../components/SectionCard';
import { getProfile } from '../../services/api/v2/profile';
import { getUserData } from '../../services/auth/authService';
import { useAcceptBulkSellRequest, useRejectBulkSellRequest } from '../../hooks/useOrders';

interface BuyerWithDetails {
  user_id: number;
  user_type: string;
  shop_id?: number | null;
  committed_quantity?: number;
  bidding_price?: number;
  accepted_at?: string;
  status?: string;
  shopname?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  location?: string;
  phone?: string;
  contact?: string;
  images?: string[];
}

const BulkSellRequestDetailsScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const { request } = route.params || {};
  const [sellerLocation, setSellerLocation] = useState<{ latitude: number; longitude: number; shopname?: string; address?: string } | null>(null);
  const [loadingSeller, setLoadingSeller] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [buyersWithDetails, setBuyersWithDetails] = useState<BuyerWithDetails[]>([]);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);

  const acceptMutation = useAcceptBulkSellRequest();
  const rejectMutation = useRejectBulkSellRequest();

  // Check if current user is the seller/creator
  const isSeller = userData?.id && request?.seller_id && userData.id === request.seller_id;

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Fetch seller location
  useEffect(() => {
    const fetchSellerLocation = async () => {
      if (!request?.seller_id) return;

      setLoadingSeller(true);
      try {
        const profile = await getProfile(request.seller_id);
        const shopData = profile?.shop || profile?.b2cShop || profile?.b2bShop;
        
        if (shopData?.lat_log) {
          const [lat, lng] = shopData.lat_log.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            setSellerLocation({
              latitude: lat,
              longitude: lng,
              shopname: shopData.shopname,
              address: shopData.address,
            });
          }
        }
      } catch (error) {
        console.error('Error fetching seller location:', error);
      } finally {
        setLoadingSeller(false);
      }
    };

    fetchSellerLocation();
  }, [request?.seller_id]);

  // Fetch buyer details
  useEffect(() => {
    const fetchBuyerDetails = async () => {
      if (!request?.accepted_buyers || request.accepted_buyers.length === 0) {
        return;
      }

      try {
        const buyers: BuyerWithDetails[] = await Promise.all(
          request.accepted_buyers.map(async (buyer: any) => {
            try {
              const profile = await getProfile(buyer.user_id);
              const shopData = profile?.shop || profile?.b2cShop || profile?.b2bShop;
              
              let phone: string | undefined;
              if ((profile as any)?.mob_num) {
                phone = String((profile as any).mob_num);
              } else if (shopData?.contact) {
                phone = String(shopData.contact);
              }

              return {
                user_id: buyer.user_id,
                user_type: buyer.user_type,
                shop_id: buyer.shop_id,
                committed_quantity: buyer.committed_quantity,
                bidding_price: buyer.bidding_price,
                accepted_at: buyer.accepted_at,
                status: buyer.status,
                shopname: shopData?.shopname,
                address: shopData?.address,
                phone,
                contact: shopData?.contact,
                images: buyer.images || [],
              };
            } catch (error) {
              console.error(`Error fetching buyer ${buyer.user_id}:`, error);
              return {
                user_id: buyer.user_id,
                user_type: buyer.user_type,
                committed_quantity: buyer.committed_quantity,
                bidding_price: buyer.bidding_price,
                images: buyer.images || [],
              };
            }
          })
        );
        setBuyersWithDetails(buyers);
      } catch (error) {
        console.error('Error fetching buyer details:', error);
      }
    };

    fetchBuyerDetails();
  }, [request?.accepted_buyers]);

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    // Refetch seller location and buyer details
    if (request?.seller_id) {
      try {
        const profile = await getProfile(request.seller_id);
        const shopData = profile?.shop || profile?.b2cShop || profile?.b2bShop;
        if (shopData?.lat_log) {
          const [lat, lng] = shopData.lat_log.split(',').map(Number);
          if (!isNaN(lat) && !isNaN(lng)) {
            setSellerLocation({
              latitude: lat,
              longitude: lng,
              shopname: shopData.shopname,
              address: shopData.address,
            });
          }
        }
      } catch (error) {
        console.error('Error refreshing seller location:', error);
      }
    }
    setRefreshing(false);
  }, [request?.seller_id]);

  // Calculate distance
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Get user location for distance calculation
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    const loadUserLocation = async () => {
      try {
        const { getCurrentLocationWithAddress } = await import('../../components/LocationView');
        const locationData = await getCurrentLocationWithAddress();
        if (locationData?.latitude && locationData?.longitude) {
          setUserLocation({
            latitude: locationData.latitude,
            longitude: locationData.longitude,
          });
        }
      } catch (error) {
        console.warn('Could not get user location:', error);
      }
    };
    loadUserLocation();
  }, []);

  // Calculate distance to seller
  const distanceToSeller = useMemo(() => {
    if (!userLocation || !sellerLocation) return null;
    return calculateDistance(
      userLocation.latitude,
      userLocation.longitude,
      sellerLocation.latitude,
      sellerLocation.longitude
    );
  }, [userLocation, sellerLocation]);

  // Open Google Maps with route to seller's shop
  const handleNavigateToSeller = () => {
    if (!sellerLocation) {
      Alert.alert(
        t('common.error') || 'Error',
        t('bulkSellRequest.sellerLocationNotAvailable') || 'Seller location not available'
      );
      return;
    }

    const url = Platform.select({
      ios: `maps://app?daddr=${sellerLocation.latitude},${sellerLocation.longitude}&dirflg=d`,
      android: `google.navigation:q=${sellerLocation.latitude},${sellerLocation.longitude}`,
    });

    if (url) {
      Linking.canOpenURL(url)
        .then((supported: boolean) => {
          if (supported) {
            return Linking.openURL(url);
          } else {
            // Fallback to web-based Google Maps
            const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${sellerLocation.latitude},${sellerLocation.longitude}`;
            return Linking.openURL(webUrl);
          }
        })
        .catch((err: Error) => {
          console.error('Error opening maps:', err);
          Alert.alert(
            t('common.error') || 'Error',
            t('bulkSellRequest.cannotOpenMaps') || 'Cannot open maps application'
          );
        });
    } else {
      // Fallback to web-based Google Maps
      const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${sellerLocation.latitude},${sellerLocation.longitude}`;
      Linking.openURL(webUrl).catch((err: Error) => {
        console.error('Error opening maps:', err);
      });
    }
  };

  // Handle accept request
  const handleAccept = async () => {
    if (!userData?.id || !request?.id) {
      Alert.alert(t('common.error') || 'Error', t('common.loginRequired') || 'Please login first');
      return;
    }

    // Navigate to participate screen (similar to bulk buy)
    navigation.navigate('ParticipateBulkSellRequest', { request });
  };

  // Handle reject request
  const handleReject = async () => {
    if (!userData?.id || !request?.id) {
      Alert.alert(t('common.error') || 'Error', t('common.loginRequired') || 'Please login first');
      return;
    }

    Alert.alert(
      t('bulkSellRequest.rejectConfirm') || 'Reject Request',
      t('bulkSellRequest.rejectConfirmMessage') || 'Are you sure you want to reject this bulk sell request?',
      [
        { text: t('common.cancel') || 'Cancel', style: 'cancel' },
        {
          text: t('common.reject') || 'Reject',
          style: 'destructive',
          onPress: async () => {
            setRejecting(true);
            try {
              await rejectMutation.mutateAsync({
                requestId: request.id,
                buyer_id: userData.id,
                user_type: userData.user_type || 'S',
              });
              Alert.alert(
                t('common.success') || 'Success',
                t('bulkSellRequest.rejected') || 'Request rejected successfully',
                [{ text: t('common.ok') || 'OK', onPress: () => navigation.goBack() }]
              );
            } catch (error: any) {
              Alert.alert(
                t('common.error') || 'Error',
                error.message || t('bulkSellRequest.rejectError') || 'Failed to reject request'
              );
            } finally {
              setRejecting(false);
            }
          },
        },
      ]
    );
  };

  // Check if user has already accepted
  const hasAccepted = useMemo(() => {
    if (!userData?.id || !request?.accepted_buyers) return false;
    return request.accepted_buyers.some((b: any) => b.user_id === userData.id);
  }, [userData?.id, request?.accepted_buyers]);

  const quantityInTons = request?.quantity ? (request.quantity / 1000).toFixed(2) : '0';
  const subcategoriesText = request?.subcategories && request.subcategories.length > 0
    ? request.subcategories.map((s: any) => s.subcategory_name).join(', ')
    : request?.scrap_type || 'Scrap';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>
          {t('bulkSellRequest.details') || 'Bulk Sell Request Details'}
        </AutoText>
        <View style={styles.backButton} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Request Info */}
        <SectionCard>
          <View style={styles.sectionHeader}>
            <MaterialCommunityIcons name="information" size={20} color={theme.primary} />
            <AutoText style={styles.sectionTitle}>
              {t('bulkSellRequest.requestInfo') || 'Request Information'}
            </AutoText>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="store" size={16} color={theme.textSecondary} />
            <AutoText style={styles.detailLabel}>
              {t('bulkSellRequest.seller') || 'Seller'}:
            </AutoText>
            <AutoText style={styles.detailValue}>
              {request?.seller_name || `Seller #${request?.seller_id}`}
            </AutoText>
          </View>

          {request?.subcategories && request.subcategories.length > 0 ? (
            <>
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="package-variant" size={16} color={theme.textSecondary} />
                <AutoText style={styles.detailText} numberOfLines={3}>
                  {subcategoriesText}
                </AutoText>
              </View>
              {/* Display individual subcategory prices */}
              <View style={styles.subcategoriesList}>
                {request.subcategories.map((subcat: any, index: number) => (
                  <View key={subcat.subcategory_id || index} style={[styles.subcategoryItem, index > 0 && styles.subcategoryItemMargin]}>
                    <View style={styles.subcategoryItemHeader}>
                      <MaterialCommunityIcons name="package-variant-closed" size={16} color={theme.primary} />
                      <AutoText style={styles.subcategoryItemName} numberOfLines={2}>
                        {subcat.subcategory_name || `Subcategory ${subcat.subcategory_id}`}
                      </AutoText>
                    </View>
                    <View style={styles.subcategoryItemDetails}>
                      {subcat.quantity && (
                        <View style={styles.subcategoryDetailRow}>
                          <AutoText style={styles.subcategoryDetailLabel}>
                            {t('dashboard.quantity') || 'Quantity'}:
                          </AutoText>
                          <AutoText style={styles.subcategoryDetailValue}>
                            {subcat.quantity.toLocaleString('en-IN')} kg
                          </AutoText>
                        </View>
                      )}
                      {subcat.asking_price && (
                        <View style={styles.subcategoryDetailRow}>
                          <AutoText style={styles.subcategoryDetailLabel}>
                            {t('bulkSellRequest.sellingPrice') || 'Selling Price'}:
                          </AutoText>
                          <AutoText style={styles.subcategoryDetailValue}>
                            ₹{subcat.asking_price.toLocaleString('en-IN', { maximumFractionDigits: 2 })} / kg
                          </AutoText>
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : request?.scrap_type && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="package-variant" size={16} color={theme.textSecondary} />
              <AutoText style={styles.detailText}>
                {request.scrap_type}
              </AutoText>
            </View>
          )}

          <View style={styles.detailRow}>
            <MaterialCommunityIcons name="weight-kilogram" size={16} color={theme.textSecondary} />
            <AutoText style={styles.detailText}>
              {request?.quantity?.toLocaleString('en-IN') || '0'} kg ({quantityInTons} tons)
            </AutoText>
          </View>

          {request?.asking_price && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="currency-inr" size={16} color={theme.textSecondary} />
              <AutoText style={styles.detailText}>
                {t('bulkSellRequest.sellingPrice') || 'Selling Price'}: ₹{request.asking_price.toLocaleString('en-IN')} / kg
              </AutoText>
            </View>
          )}

          {request?.location && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="map-marker" size={16} color={theme.textSecondary} />
              <AutoText style={styles.detailText} numberOfLines={2}>
                {request.location}
              </AutoText>
            </View>
          )}

          {request?.when_available && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="calendar-clock" size={16} color={theme.textSecondary} />
              <AutoText style={styles.detailText}>
                {t('bulkSellRequest.whenAvailable') || 'Available'}: {request.when_available}
              </AutoText>
            </View>
          )}

          {request?.additional_notes && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons name="note-text" size={16} color={theme.textSecondary} />
              <AutoText style={styles.detailText} numberOfLines={5}>
                {request.additional_notes}
              </AutoText>
            </View>
          )}
        </SectionCard>

        {/* Seller Shop Location */}
        {sellerLocation && (
          <SectionCard>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="store-marker" size={20} color={theme.primary} />
              <AutoText style={styles.sectionTitle}>
                {t('bulkSellRequest.sellerShop') || 'Seller Shop Location'}
              </AutoText>
            </View>

            {sellerLocation.shopname && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="store" size={16} color={theme.textSecondary} />
                <AutoText style={styles.detailText}>
                  {sellerLocation.shopname}
                </AutoText>
              </View>
            )}

            {sellerLocation.address && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="map-marker" size={16} color={theme.textSecondary} />
                <AutoText style={styles.detailText} numberOfLines={3}>
                  {sellerLocation.address}
                </AutoText>
              </View>
            )}

            {distanceToSeller !== null && (
              <View style={styles.detailRow}>
                <MaterialCommunityIcons name="map-marker-distance" size={16} color={theme.textSecondary} />
                <AutoText style={styles.detailText}>
                  {distanceToSeller.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
                </AutoText>
              </View>
            )}

            <TouchableOpacity
              style={styles.navigateButton}
              onPress={handleNavigateToSeller}
              activeOpacity={0.7}
            >
              <MaterialCommunityIcons name="navigation" size={20} color={theme.primary} />
              <AutoText style={styles.navigateButtonText}>
                {t('bulkSellRequest.navigateToShop') || 'Navigate to Seller Shop'}
              </AutoText>
            </TouchableOpacity>
          </SectionCard>
        )}

        {/* Accepted Buyers */}
        {buyersWithDetails.length > 0 && (
          <SectionCard>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-group" size={20} color={theme.primary} />
              <AutoText style={styles.sectionTitle}>
                {t('bulkSellRequest.acceptedBuyers') || 'Accepted Buyers'} ({buyersWithDetails.length})
              </AutoText>
            </View>

            {buyersWithDetails.map((buyer, index) => (
              <View key={buyer.user_id} style={[styles.buyerCard, index > 0 && styles.buyerCardMargin]}>
                <View style={styles.buyerHeader}>
                  <AutoText style={styles.buyerName}>
                    {buyer.shopname || `Buyer #${buyer.user_id}`}
                  </AutoText>
                </View>

                {buyer.committed_quantity && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="weight-kilogram" size={16} color={theme.textSecondary} />
                    <AutoText style={styles.detailText}>
                      {t('dashboard.committedQuantity') || 'Committed'}: {buyer.committed_quantity.toLocaleString('en-IN')} kg
                    </AutoText>
                  </View>
                )}

                {buyer.bidding_price && (
                  <View style={styles.detailRow}>
                    <MaterialCommunityIcons name="currency-inr" size={16} color={theme.textSecondary} />
                    <AutoText style={styles.detailText}>
                      {t('dashboard.biddingPrice') || 'Bidding Price'}: ₹{buyer.bidding_price.toLocaleString('en-IN')} / kg
                    </AutoText>
                  </View>
                )}

                {buyer.images && buyer.images.length > 0 && (
                  <View style={styles.imagesContainer}>
                    <AutoText style={styles.imagesLabel}>
                      {t('bulkSellRequest.buyerImages') || 'Buyer Images'}:
                    </AutoText>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesScroll}>
                      {buyer.images.map((imageUrl, imgIndex) => (
                        <Image
                          key={imgIndex}
                          source={{ uri: imageUrl }}
                          style={styles.buyerImage}
                          resizeMode="cover"
                        />
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>
            ))}
          </SectionCard>
        )}

        {/* Action Buttons (only for 'S' users who haven't accepted) */}
        {!isSeller && userData?.user_type === 'S' && !hasAccepted && request?.status === 'active' && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={handleReject}
              disabled={rejecting}
            >
              {rejecting ? (
                <ActivityIndicator size="small" color={theme.textPrimary} />
              ) : (
                <>
                  <MaterialCommunityIcons name="close" size={20} color={theme.textPrimary} />
                  <AutoText style={styles.rejectButtonText}>
                    {t('common.reject') || 'Reject'}
                  </AutoText>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.acceptButton]}
              onPress={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="check" size={20} color="#FFFFFF" />
                  <AutoText style={styles.acceptButtonText}>
                    {t('bulkSellRequest.acceptAndBuy') || 'Accept & Buy'}
                  </AutoText>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
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
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: '16@s',
      paddingBottom: '32@vs',
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '16@vs',
      gap: '8@s',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: '12@vs',
      gap: '8@s',
    },
    detailLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    detailValue: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
      flex: 1,
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      flex: 1,
    },
    navigateButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.primary + '15',
      borderWidth: 1,
      borderColor: theme.primary,
      borderRadius: '12@ms',
      padding: '14@vs',
      marginTop: '16@vs',
      gap: '8@s',
    },
    navigateButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.primary,
    },
    buyerCard: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
    },
    buyerCardMargin: {
      marginTop: '12@vs',
    },
    buyerHeader: {
      marginBottom: '8@vs',
    },
    buyerName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
    },
    imagesContainer: {
      marginTop: '12@vs',
    },
    imagesLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '8@vs',
    },
    imagesScroll: {
      marginHorizontal: '-12@s',
      paddingHorizontal: '12@s',
    },
    buyerImage: {
      width: '80@s',
      height: '80@s',
      borderRadius: '8@ms',
      marginRight: '8@s',
      backgroundColor: theme.card,
    },
    actionButtons: {
      flexDirection: 'row',
      gap: '12@s',
      marginTop: '16@vs',
    },
    actionButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '14@vs',
      borderRadius: '12@ms',
      gap: '8@s',
    },
    rejectButton: {
      backgroundColor: theme.border,
      borderWidth: 1,
      borderColor: theme.border,
    },
    rejectButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    acceptButton: {
      backgroundColor: theme.primary,
    },
    acceptButtonText: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: '#FFFFFF',
    },
    subcategoriesList: {
      marginTop: '12@vs',
      gap: '12@vs',
    },
    subcategoryItem: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '12@s',
      borderWidth: 1,
      borderColor: theme.border,
    },
    subcategoryItemMargin: {
      marginTop: '0@vs',
    },
    subcategoryItemHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '12@vs',
      gap: '8@s',
    },
    subcategoryItemName: {
      flex: 1,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    subcategoryItemDetails: {
      gap: '8@vs',
    },
    subcategoryDetailRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: '4@vs',
    },
    subcategoryDetailLabel: {
      fontFamily: 'Poppins-Regular',
      fontSize: '13@s',
      color: theme.textSecondary,
    },
    subcategoryDetailValue: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.textPrimary,
    },
  });

export default BulkSellRequestDetailsScreen;

