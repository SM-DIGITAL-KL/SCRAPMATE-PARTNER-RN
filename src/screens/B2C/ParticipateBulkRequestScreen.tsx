import React, { useState, useMemo, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, ActivityIndicator, TextInput, Alert, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import { useTheme } from '../../components/ThemeProvider';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';
import { getUserData } from '../../services/auth/authService';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { useAcceptBulkScrapRequest } from '../../hooks/useOrders';
import { BulkScrapRequest } from '../../services/api/v2/bulkScrap';

const ParticipateBulkRequestScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const { request } = route.params || {};
  const [userData, setUserData] = useState<any>(null);
  const [subcategoryQuantities, setSubcategoryQuantities] = useState<Record<number, string>>({});
  const [subcategoryBiddingPrices, setSubcategoryBiddingPrices] = useState<Record<number, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Array<{ uri: string; type?: string; name?: string }>>([]);

  const acceptBulkScrapMutation = useAcceptBulkScrapRequest();

  // Load user data
  useFocusEffect(
    React.useCallback(() => {
      const loadUserData = async () => {
        const data = await getUserData();
        setUserData(data);
      };
      loadUserData();
    }, [])
  );

  // Calculate remaining quantity
  const requestedQuantity = request?.quantity || 0;
  const totalCommitted = request?.total_committed_quantity || 0;
  const remainingQuantity = requestedQuantity - totalCommitted;

  // Initialize subcategory quantities and bidding prices
  useEffect(() => {
    if (request?.subcategories && Array.isArray(request.subcategories)) {
      const initialQuantities: Record<number, string> = {};
      const initialPrices: Record<number, string> = {};
      
      request.subcategories.forEach((subcat: any) => {
        const subcatId = subcat.subcategory_id || subcat.id;
        if (subcatId) {
          initialQuantities[subcatId] = '';
          // Set default bidding price to subcategory preferred_price or request preferred_price
          initialPrices[subcatId] = (subcat.preferred_price || request.preferred_price || '').toString();
        }
      });
      
      setSubcategoryQuantities(initialQuantities);
      setSubcategoryBiddingPrices(initialPrices);
    }
  }, [request?.subcategories, request?.preferred_price]);

  // Calculate total quantity from subcategory quantities
  const calculateTotalQuantity = (): number => {
    let total = 0;
    Object.values(subcategoryQuantities).forEach((qty) => {
      if (qty.trim()) {
        const val = parseFloat(qty.trim());
        if (!isNaN(val) && val > 0) {
          total += val;
        }
      }
    });
    return total;
  };

  // Calculate average bidding price from subcategory prices
  const calculateAverageBiddingPrice = (): number | null => {
    const prices: number[] = [];
    Object.values(subcategoryBiddingPrices).forEach((price) => {
      if (price.trim()) {
        const val = parseFloat(price.trim());
        if (!isNaN(val) && val > 0) {
          prices.push(val);
        }
      }
    });
    
    if (prices.length === 0) return null;
    return prices.reduce((sum, p) => sum + p, 0) / prices.length;
  };

  // Handle participate
  const handleParticipate = async () => {
    if (!request || !userData?.id) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.missingRequestData') || 'Missing request or user data',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    // Validate subcategory quantities
    const subcategories = request.subcategories || [];
    if (subcategories.length === 0) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.noSubcategories') || 'No subcategories found in this request',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    let hasAnyQuantity = false;
    let totalQuantity = 0;
    const subcategoryQuantitiesMap: Record<number, number> = {};

    // Validate each subcategory
    for (const subcat of subcategories) {
      const subcatId = subcat.subcategory_id || subcat.id;
      if (!subcatId) continue;

      const qtyStr = subcategoryQuantities[subcatId] || '';
      const subcatQty = subcat.quantity || 0;
      
      if (qtyStr.trim()) {
        const qtyValue = parseFloat(qtyStr.trim());
        if (isNaN(qtyValue) || qtyValue <= 0) {
          Alert.alert(
            t('common.error') || 'Error',
            `${subcat.subcategory_name || 'Subcategory'}: ${t('dashboard.invalidQuantity') || 'Please enter a valid quantity (greater than 0)'}`,
            [{ text: t('common.ok') || 'OK' }]
          );
          return;
        }
        
        if (qtyValue > subcatQty) {
          Alert.alert(
            t('common.error') || 'Error',
            `${subcat.subcategory_name || 'Subcategory'}: ${t('dashboard.quantityExceedsRequested') || 'Cannot commit more than requested quantity'} (${subcatQty.toLocaleString('en-IN')} kg)`,
            [{ text: t('common.ok') || 'OK' }]
          );
          return;
        }

        subcategoryQuantitiesMap[subcatId] = qtyValue;
        totalQuantity += qtyValue;
        hasAnyQuantity = true;
      }

      // Validate bidding price for this subcategory
      const priceStr = subcategoryBiddingPrices[subcatId] || '';
      if (qtyStr.trim() && (!priceStr.trim())) {
        Alert.alert(
          t('common.error') || 'Error',
          `${subcat.subcategory_name || 'Subcategory'}: ${t('dashboard.biddingPriceRequired') || 'Please enter your bidding price'}`,
          [{ text: t('common.ok') || 'OK' }]
        );
        return;
      }

      if (priceStr.trim()) {
        const priceValue = parseFloat(priceStr.trim());
        if (isNaN(priceValue) || priceValue <= 0) {
          Alert.alert(
            t('common.error') || 'Error',
            `${subcat.subcategory_name || 'Subcategory'}: ${t('dashboard.invalidBiddingPrice') || 'Please enter a valid bidding price (greater than 0)'}`,
            [{ text: t('common.ok') || 'OK' }]
          );
          return;
        }
      }
    }

    if (!hasAnyQuantity) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.enterQuantityForAtLeastOne') || 'Please enter quantity for at least one subcategory',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    if (totalQuantity > remainingQuantity) {
      Alert.alert(
        t('common.error') || 'Error',
        (t('dashboard.totalQuantityExceedsRemaining') || 'Total committed quantity ({total}) exceeds remaining quantity ({remaining}) kg').replace('{total}', totalQuantity.toFixed(2)).replace('{remaining}', remainingQuantity.toFixed(2)),
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    // Calculate average bidding price
    const avgBiddingPrice = calculateAverageBiddingPrice();
    if (!avgBiddingPrice) {
      Alert.alert(
        t('common.error') || 'Error',
        t('dashboard.biddingPriceRequired') || 'Please enter bidding prices for all subcategories',
        [{ text: t('common.ok') || 'OK' }]
      );
      return;
    }

    setIsSubmitting(true);

    try {
      // Send total quantity, average bidding price, and images to backend
      await acceptBulkScrapMutation.mutateAsync({
        requestId: request.id,
        userId: userData.id,
        userType: (userData?.user_type || 'R') as 'R' | 'S' | 'SR',
        quantity: totalQuantity,
        biddingPrice: avgBiddingPrice,
        images: selectedImages.slice(0, 6) // Limit to 6 images
      });

      setIsSubmitting(false);

      Alert.alert(
        t('dashboard.requestAccepted') || 'Request Accepted',
        t('dashboard.bulkScrapRequestAcceptedMessage') || 'Bulk scrap purchase request accepted successfully!',
        [
          {
            text: t('common.ok') || 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error: any) {
      setIsSubmitting(false);
      console.error('Error participating in bulk request:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error?.message || t('dashboard.requestAcceptError') || 'Failed to accept request. Please try again.',
        [{ text: t('common.ok') || 'OK' }]
      );
    }
  };

  if (!request) {
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
          <AutoText style={styles.headerTitle}>
            {t('dashboard.participateInRequest') || 'Participate in Request'}
          </AutoText>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.emptyContainer}>
          <AutoText style={styles.emptyText}>
            {t('dashboard.requestNotFound') || 'Request not found'}
          </AutoText>
        </View>
      </View>
    );
  }

  const quantityInTons = (request.quantity / 1000).toFixed(2);
  const subcategories = request.subcategories || [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('dashboard.participateInRequest') || 'Participate in Request'}
        </AutoText>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Request Details */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>
            {t('dashboard.requestDetails') || 'Request Details'}
          </AutoText>
          
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="account"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              {t('dashboard.requestFrom') || 'Request from'}: {request.buyer_name || `User #${request.buyer_id}`}
            </AutoText>
          </View>

          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="weight-kilogram"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              {t('dashboard.requestedQuantity') || 'Requested'}: {request.quantity.toLocaleString('en-IN')} kg ({quantityInTons} tons)
            </AutoText>
          </View>

          {request.total_committed_quantity !== undefined && request.total_committed_quantity > 0 && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="progress-check"
                size={16}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.committed') || 'Committed'}: {request.total_committed_quantity.toLocaleString('en-IN')} kg
              </AutoText>
            </View>
          )}

          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="progress-check"
              size={16}
              color={theme.primary}
            />
            <AutoText style={[styles.detailText, { color: theme.primary, fontWeight: '600' }]} numberOfLines={1}>
              {t('dashboard.remainingQuantity') || 'Remaining'}: {remainingQuantity.toLocaleString('en-IN')} kg
            </AutoText>
          </View>

          {request.preferred_price && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={16}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{request.preferred_price.toLocaleString('en-IN')} / kg
              </AutoText>
            </View>
          )}

          {request.location && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker"
                size={16}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={2}>
                {request.location}
              </AutoText>
            </View>
          )}

          {request.distance_km !== undefined && request.distance_km !== null && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="map-marker-distance"
                size={16}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {request.distance_km.toFixed(1)} {t('dashboard.kmAway') || 'km away'}
              </AutoText>
            </View>
          )}
        </SectionCard>

        {/* Your Participation by Subcategory */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>
            {t('dashboard.yourParticipation') || 'Your Participation'}
          </AutoText>
          
          {subcategories.length > 0 ? (
            subcategories.map((subcat: any, index: number) => {
              const subcatId = subcat.subcategory_id || subcat.id;
              const subcatQty = subcat.quantity || 0;
              const subcatRemaining = subcatQty; // For now, assume full quantity available
              
              return (
                <View key={subcatId || index} style={styles.subcategoryParticipationCard}>
                  <View style={styles.subcategoryParticipationHeader}>
                    <MaterialCommunityIcons
                      name="package-variant"
                      size={20}
                      color={theme.primary}
                    />
                    <View style={styles.subcategoryParticipationHeaderInfo}>
                      <AutoText style={styles.subcategoryParticipationName} numberOfLines={2}>
                        {subcat.subcategory_name}
                      </AutoText>
                    </View>
                  </View>

                  {/* Requested Quantity Display */}
                  <View style={styles.requestedQuantitySection}>
                    <View style={styles.requestedQuantityRow}>
                      <View style={styles.requestedQuantityLabelContainer}>
                        <MaterialCommunityIcons
                          name="weight-kilogram"
                          size={16}
                          color={theme.textSecondary}
                        />
                        <AutoText style={styles.requestedQuantityLabel}>
                          {t('dashboard.requestedQuantity') || 'Requested Quantity'}:
                        </AutoText>
                      </View>
                      <AutoText style={styles.requestedQuantityValue}>
                        {subcatQty.toLocaleString('en-IN')} kg
                      </AutoText>
                    </View>
                    {subcat.preferred_price && (
                      <View style={styles.requestedQuantityRow}>
                        <View style={styles.requestedQuantityLabelContainer}>
                          <MaterialCommunityIcons
                            name="currency-inr"
                            size={16}
                            color={theme.textSecondary}
                          />
                          <AutoText style={styles.requestedQuantityLabel}>
                            {t('dashboard.preferredPrice') || 'Preferred Price'}:
                          </AutoText>
                        </View>
                        <AutoText style={styles.requestedQuantityValue}>
                          ₹{subcat.preferred_price.toLocaleString('en-IN')} / kg
                        </AutoText>
                      </View>
                    )}
                  </View>

                  {/* Quantity Input for this subcategory */}
                  <View style={styles.inputContainer}>
                    <AutoText style={styles.inputLabel}>
                      {t('dashboard.yourQuantity') || 'Your Quantity (kg)'}
                    </AutoText>
                    <TextInput
                      style={styles.input}
                      placeholder={`0 - ${subcatQty.toLocaleString('en-IN')} kg`}
                      placeholderTextColor={theme.textSecondary}
                      value={subcategoryQuantities[subcatId] || ''}
                      onChangeText={(text) => {
                        setSubcategoryQuantities({
                          ...subcategoryQuantities,
                          [subcatId]: text
                        });
                      }}
                      keyboardType="numeric"
                    />
                    <AutoText style={styles.inputHint}>
                      {t('dashboard.maxQuantity') || 'Maximum'}: {subcatQty.toLocaleString('en-IN')} kg
                    </AutoText>
                  </View>

                  {/* Bidding Price Input for this subcategory */}
                  <View style={styles.inputContainer}>
                    <AutoText style={styles.inputLabel}>
                      {t('dashboard.yourBiddingPrice') || 'Your Bidding Price (₹/kg)'}
                    </AutoText>
                    <TextInput
                      style={styles.input}
                      placeholder={subcat.preferred_price ? `e.g., ${subcat.preferred_price.toLocaleString('en-IN')}` : t('dashboard.enterBiddingPrice') || 'Enter your bidding price...'}
                      placeholderTextColor={theme.textSecondary}
                      value={subcategoryBiddingPrices[subcatId] || ''}
                      onChangeText={(text) => {
                        setSubcategoryBiddingPrices({
                          ...subcategoryBiddingPrices,
                          [subcatId]: text
                        });
                      }}
                      keyboardType="numeric"
                    />
                    {subcat.preferred_price && (
                      <AutoText style={styles.inputHint}>
                        {t('dashboard.preferredPrice') || 'Preferred Price'}: ₹{subcat.preferred_price.toLocaleString('en-IN')} / kg
                      </AutoText>
                    )}
                  </View>
                </View>
              );
            })
          ) : (
            <AutoText style={styles.noSubcategoriesText}>
              {t('dashboard.noSubcategories') || 'No subcategories available'}
            </AutoText>
          )}

          {/* Total Summary */}
          {subcategories.length > 0 && (
            <View style={styles.totalSummary}>
              <View style={styles.totalSummaryRow}>
                <AutoText style={styles.totalSummaryLabel}>
                  {t('dashboard.totalCommitted') || 'Total Committed'}:
                </AutoText>
                <AutoText style={styles.totalSummaryValue}>
                  {calculateTotalQuantity().toLocaleString('en-IN')} kg
                </AutoText>
              </View>
              {calculateAverageBiddingPrice() && (
                <View style={styles.totalSummaryRow}>
                  <AutoText style={styles.totalSummaryLabel}>
                    {t('dashboard.averageBiddingPrice') || 'Average Bidding Price'}:
                  </AutoText>
                  <AutoText style={styles.totalSummaryValue}>
                    ₹{calculateAverageBiddingPrice()?.toFixed(2).toLocaleString('en-IN')} / kg
                  </AutoText>
                </View>
              )}
            </View>
          )}
        </SectionCard>

        {/* Image Upload Section */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>
            {t('dashboard.scrapImages') || 'Scrap Images'} ({selectedImages.length}/6)
          </AutoText>
          <AutoText style={styles.imageHint}>
            {t('dashboard.uploadScrapImages') || 'Upload images of the scrap you will provide (up to 6 images)'}
          </AutoText>
          
          <View style={styles.imageContainer}>
            {selectedImages.map((image, index) => (
              <View key={index} style={styles.imageWrapper}>
                <Image source={{ uri: image.uri }} style={styles.imagePreview} />
                <TouchableOpacity
                  style={styles.removeImageButton}
                  onPress={() => {
                    setSelectedImages(selectedImages.filter((_, i) => i !== index));
                  }}
                >
                  <MaterialCommunityIcons name="close-circle" size={24} color="#FF4444" />
                </TouchableOpacity>
              </View>
            ))}
            
            {selectedImages.length < 6 && (
              <TouchableOpacity
                style={styles.addImageButton}
                onPress={() => {
                  const options = {
                    mediaType: 'photo' as MediaType,
                    quality: 0.8,
                    maxWidth: 1920,
                    maxHeight: 1920,
                  };

                  launchImageLibrary(options, (response: ImagePickerResponse) => {
                    if (response.didCancel) {
                      return;
                    }

                    if (response.errorMessage) {
                      Alert.alert('Error', response.errorMessage);
                      return;
                    }

                    const asset = response.assets?.[0];
                    if (!asset?.uri) {
                      return;
                    }

                    setSelectedImages([
                      ...selectedImages,
                      {
                        uri: asset.uri,
                        type: asset.type || 'image/jpeg',
                        name: asset.fileName || `image_${Date.now()}.jpg`
                      }
                    ]);
                  });
                }}
              >
                <MaterialCommunityIcons name="camera-plus" size={32} color={theme.primary} />
                <AutoText style={styles.addImageText}>
                  {t('dashboard.addImage') || 'Add Image'}
                </AutoText>
              </TouchableOpacity>
            )}
          </View>
        </SectionCard>

        {/* Submit Button */}
        <GreenButton
          title={isSubmitting ? (t('common.submitting') || 'Submitting...') : (t('dashboard.participate') || 'Participate')}
          onPress={handleParticipate}
          disabled={isSubmitting}
          style={styles.submitButton}
        />
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
      paddingHorizontal: '16@ms',
      paddingVertical: '12@ms',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    headerTitle: {
      fontSize: '18@ms',
      fontWeight: '600',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      padding: '16@ms',
      paddingBottom: '24@ms',
    },
    sectionTitle: {
      fontSize: '16@ms',
      fontWeight: '600',
      color: theme.textPrimary,
      marginBottom: '12@ms',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: '10@ms',
      gap: '8@ms',
    },
    detailText: {
      fontSize: '14@ms',
      color: theme.textSecondary,
      flex: 1,
    },
    subcategoryParticipationCard: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '16@ms',
      marginBottom: '16@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    subcategoryParticipationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: '14@ms',
      gap: '12@ms',
    },
    subcategoryParticipationHeaderInfo: {
      flex: 1,
    },
    subcategoryParticipationName: {
      fontSize: '17@ms',
      fontWeight: '600',
      color: theme.textPrimary,
    },
    requestedQuantitySection: {
      backgroundColor: theme.background,
      borderRadius: '8@ms',
      padding: '12@ms',
      marginBottom: '16@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    requestedQuantityRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8@ms',
    },
    requestedQuantityLabelContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: '6@ms',
      flex: 1,
    },
    requestedQuantityLabel: {
      fontSize: '13@ms',
      color: theme.textSecondary,
    },
    requestedQuantityValue: {
      fontSize: '14@ms',
      fontWeight: '600',
      color: theme.textPrimary,
    },
    noSubcategoriesText: {
      fontSize: '14@ms',
      color: theme.textSecondary,
      textAlign: 'center',
      paddingVertical: '20@ms',
    },
    totalSummary: {
      marginTop: '12@ms',
      paddingTop: '12@ms',
      borderTopWidth: 2,
      borderTopColor: theme.border,
      backgroundColor: theme.primary + '08',
      borderRadius: '8@ms',
      padding: '12@ms',
    },
    totalSummaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '8@ms',
    },
    totalSummaryLabel: {
      fontSize: '14@ms',
      fontWeight: '500',
      color: theme.textPrimary,
    },
    totalSummaryValue: {
      fontSize: '15@ms',
      fontWeight: '700',
      color: theme.primary,
    },
    inputContainer: {
      marginBottom: '16@ms',
    },
    inputLabel: {
      fontSize: '14@ms',
      fontWeight: '500',
      color: theme.textPrimary,
      marginBottom: '8@ms',
    },
    input: {
      fontSize: '16@ms',
      color: theme.textPrimary,
      backgroundColor: theme.card,
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
      padding: '12@ms',
      marginBottom: '4@ms',
    },
    inputHint: {
      fontSize: '12@ms',
      color: theme.textSecondary,
      fontStyle: 'italic',
    },
    submitButton: {
      marginTop: '8@ms',
    },
    imageHint: {
      fontSize: '13@ms',
      color: theme.textSecondary,
      marginBottom: '12@ms',
    },
    imageContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '12@ms',
    },
    imageWrapper: {
      position: 'relative',
      width: '30%',
      aspectRatio: 1,
      marginBottom: '12@ms',
    },
    imagePreview: {
      width: '100%',
      height: '100%',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
    },
    removeImageButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: theme.background,
      borderRadius: '12@ms',
    },
    addImageButton: {
      width: '30%',
      aspectRatio: 1,
      borderWidth: 2,
      borderColor: theme.border,
      borderStyle: 'dashed',
      borderRadius: '8@ms',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.card,
      marginBottom: '12@ms',
    },
    addImageText: {
      fontSize: '12@ms',
      color: theme.primary,
      marginTop: '4@ms',
      fontWeight: '500',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@ms',
    },
    emptyText: {
      fontSize: '16@ms',
      color: theme.textSecondary,
    },
  });

export default ParticipateBulkRequestScreen;

