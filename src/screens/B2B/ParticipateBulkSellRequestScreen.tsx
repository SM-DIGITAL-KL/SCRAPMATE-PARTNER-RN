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
import { useAcceptBulkSellRequest } from '../../hooks/useOrders';
import { BulkSellRequestItem } from '../../services/api/v2/bulkSell';

const ParticipateBulkSellRequestScreen = ({ navigation, route }: any) => {
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
  const [imagePickerModalVisible, setImagePickerModalVisible] = useState(false);

  const acceptBulkSellMutation = useAcceptBulkSellRequest();

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
          // Set default bidding price to subcategory asking_price or request asking_price
          initialPrices[subcatId] = (subcat.asking_price || request.asking_price || '').toString();
        }
      });
      
      setSubcategoryQuantities(initialQuantities);
      setSubcategoryBiddingPrices(initialPrices);
    }
  }, [request?.subcategories, request?.asking_price]);

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

  // Handle image picker
  const handleImagePicker = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8,
      selectionLimit: 6 - selectedImages.length,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Alert.alert(
          t('common.error') || 'Error',
          response.errorMessage || t('dashboard.imagePickerError') || 'Failed to pick image'
        );
        return;
      }

      if (response.assets && response.assets.length > 0) {
        const newImages = response.assets
          .slice(0, 6 - selectedImages.length)
          .map((asset) => ({
            uri: asset.uri || '',
            type: asset.type || 'image/jpeg',
            name: asset.fileName || `image_${Date.now()}.jpg`,
          }));
        
        setSelectedImages([...selectedImages, ...newImages]);
      }
    });
  };

  // Remove image
  const removeImage = (index: number) => {
    const newImages = selectedImages.filter((_, i) => i !== index);
    setSelectedImages(newImages);
  };

  // Handle accept
  const handleAccept = async () => {
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
      await acceptBulkSellMutation.mutateAsync({
        requestId: request.id,
        buyer_id: userData.id,
        user_type: userData.user_type || 'S',
        committed_quantity: totalQuantity,
        bidding_price: avgBiddingPrice,
        images: selectedImages.slice(0, 6),
      });

      setIsSubmitting(false);

      Alert.alert(
        t('bulkSellRequest.acceptAndBuy') || 'Request Accepted',
        t('bulkSellRequest.requestSubmitted') || 'Bulk sell request accepted successfully!',
        [
          {
            text: t('common.ok') || 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error: any) {
      setIsSubmitting(false);
      console.error('Error accepting bulk sell request:', error);
      Alert.alert(
        t('common.error') || 'Error',
        error?.message || t('bulkSellRequest.submitError') || 'Failed to accept request. Please try again.',
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
            {t('bulkSellRequest.acceptAndBuy') || 'Accept & Buy'}
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
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {t('bulkSellRequest.acceptAndBuy') || 'Accept & Buy'}
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
            {t('bulkSellRequest.requestInfo') || 'Request Details'}
          </AutoText>
          
          <View style={styles.detailRow}>
            <MaterialCommunityIcons
              name="store"
              size={16}
              color={theme.primary}
            />
            <AutoText style={styles.detailText} numberOfLines={1}>
              {t('bulkSellRequest.seller') || 'Seller'}: {request.seller_name || `Seller #${request.seller_id}`}
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

          {request.asking_price && (
            <View style={styles.detailRow}>
              <MaterialCommunityIcons
                name="currency-inr"
                size={16}
                color={theme.primary}
              />
              <AutoText style={styles.detailText} numberOfLines={1}>
                {t('bulkSellRequest.sellingPrice') || 'Selling Price'}: ₹{request.asking_price.toLocaleString('en-IN')} / kg
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
        </SectionCard>

        {/* Your Participation by Subcategory */}
        {subcategories.length > 0 && (
          <SectionCard>
            <AutoText style={styles.sectionTitle}>
              {t('dashboard.yourParticipation') || 'Your Participation'}
            </AutoText>

            {subcategories.map((subcat: any) => {
              const subcatId = subcat.subcategory_id || subcat.id;
              const subcatQty = subcat.quantity || 0;
              const remainingSubcatQty = subcatQty - (subcat.committed_quantity || 0);

              return (
                <View key={subcatId} style={styles.subcategoryCard}>
                  <AutoText style={styles.subcategoryName}>
                    {subcat.subcategory_name || 'Subcategory'}
                  </AutoText>
                  <AutoText style={styles.subcategoryQuantity}>
                    {t('dashboard.available') || 'Available'}: {remainingSubcatQty.toLocaleString('en-IN')} kg
                  </AutoText>

                  <View style={styles.inputRow}>
                    <View style={styles.inputContainer}>
                      <AutoText style={styles.inputLabel}>
                        {t('dashboard.quantity') || 'Quantity'} (kg)
                      </AutoText>
                      <TextInput
                        style={styles.input}
                        value={subcategoryQuantities[subcatId] || ''}
                        onChangeText={(text) => {
                          setSubcategoryQuantities({
                            ...subcategoryQuantities,
                            [subcatId]: text,
                          });
                        }}
                        placeholder="0"
                        keyboardType="numeric"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>

                    <View style={styles.inputContainer}>
                      <AutoText style={styles.inputLabel}>
                        {t('dashboard.biddingPrice') || 'Bidding Price'} (₹/kg)
                      </AutoText>
                      <TextInput
                        style={styles.input}
                        value={subcategoryBiddingPrices[subcatId] || ''}
                        onChangeText={(text) => {
                          setSubcategoryBiddingPrices({
                            ...subcategoryBiddingPrices,
                            [subcatId]: text,
                          });
                        }}
                        placeholder={subcat.asking_price?.toString() || '0'}
                        keyboardType="decimal-pad"
                        placeholderTextColor={theme.textSecondary}
                      />
                    </View>
                  </View>
                </View>
              );
            })}
          </SectionCard>
        )}

        {/* Upload Images */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>
            {t('dashboard.uploadImages') || 'Upload Images (up to 6)'}
          </AutoText>
          <AutoText style={styles.hintText}>
            {t('dashboard.uploadImageHint') || 'Upload images of the scrap you are committing (max 6)'}
          </AutoText>

          {selectedImages.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.imagesContainer}>
              {selectedImages.map((image, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: image.uri }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <MaterialCommunityIcons name="close-circle" size={20} color={theme.error || '#FF4444'} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          {selectedImages.length < 6 && (
            <TouchableOpacity
              style={styles.addImageButton}
              onPress={handleImagePicker}
            >
              <MaterialCommunityIcons name="camera" size={20} color={theme.primary} />
              <AutoText style={styles.addImageButtonText}>
                {t('dashboard.selectImages') || 'Select Images'} ({selectedImages.length}/6)
              </AutoText>
            </TouchableOpacity>
          )}
        </SectionCard>

        {/* Submit Button */}
        <GreenButton
          title={isSubmitting ? (t('common.submitting') || 'Submitting...') : t('bulkSellRequest.acceptAndBuy') || 'Accept & Buy'}
          onPress={handleAccept}
          disabled={isSubmitting}
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
      paddingHorizontal: '18@s',
      paddingVertical: '16@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
      backgroundColor: themeName === 'whitePurple' ? '#FFFFFF' : theme.card,
    },
    headerTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
      flex: 1,
      textAlign: 'center',
    },
    scrollContent: {
      padding: '16@s',
      paddingBottom: '32@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '16@vs',
    },
    detailRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginTop: '12@vs',
      gap: '8@s',
    },
    detailText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      flex: 1,
    },
    subcategoryCard: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      padding: '12@s',
      marginTop: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
    },
    subcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    subcategoryQuantity: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '12@vs',
    },
    inputRow: {
      flexDirection: 'row',
      gap: '12@s',
    },
    inputContainer: {
      flex: 1,
    },
    inputLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '6@vs',
    },
    input: {
      height: '44@vs',
      borderWidth: 1,
      borderRadius: '8@ms',
      borderColor: theme.border,
      paddingHorizontal: '12@s',
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textPrimary,
      backgroundColor: theme.background,
    },
    hintText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginBottom: '12@vs',
    },
    imagesContainer: {
      marginTop: '12@vs',
      marginHorizontal: '-16@s',
      paddingHorizontal: '16@s',
    },
    imageWrapper: {
      position: 'relative',
      marginRight: '12@s',
    },
    image: {
      width: '100@s',
      height: '100@s',
      borderRadius: '8@ms',
      backgroundColor: theme.card,
    },
    removeImageButton: {
      position: 'absolute',
      top: -8,
      right: -8,
      backgroundColor: theme.background,
      borderRadius: 12,
    },
    addImageButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.primary,
      borderStyle: 'dashed',
      borderRadius: '8@ms',
      padding: '14@vs',
      marginTop: '12@vs',
      gap: '8@s',
    },
    addImageButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.primary,
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      padding: '32@s',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '16@s',
      color: theme.textSecondary,
    },
  });

export default ParticipateBulkSellRequestScreen;

