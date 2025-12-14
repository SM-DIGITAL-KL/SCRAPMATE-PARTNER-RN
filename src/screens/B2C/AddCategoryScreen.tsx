import React, { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, Vibration, Platform, ActivityIndicator, Image, Alert, TextInput, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { AutoText } from '../../components/AutoText';
import { useTranslation } from 'react-i18next';
import { useMemo } from 'react';
import { ScaledSheet } from 'react-native-size-matters';
import { Category, Subcategory } from '../../services/api/v2/categories';
import { getUserData } from '../../services/auth/authService';
import { useUserMode } from '../../context/UserModeContext';
import { 
  useCategories, 
  useSubcategories, 
  useUserCategories,
  useUserSubcategories,
  useUpdateUserSubcategories,
  useRemoveUserCategory,
  useRemoveUserSubcategories
} from '../../hooks/useCategories';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../../services/api/queryKeys';

interface UserSubcategory {
  subcategoryId: number;
  customPrice: string;
  priceUnit: string;
  defaultPrice?: string;
  name?: string;
}

const AddCategoryScreen = ({ navigation, route }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const { mode } = useUserMode();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const [step, setStep] = useState<'categories' | 'subcategories'>('categories');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [selectedSubcategories, setSelectedSubcategories] = useState<Map<number, UserSubcategory>>(new Map());
  const [userData, setUserData] = useState<any>(null);
  const [editingPrice, setEditingPrice] = useState<{ subcategoryId: number; price: string; unit: string } | null>(null);
  const [hadExistingSubcategories, setHadExistingSubcategories] = useState(false);
  // Track previously selected subcategories to detect deselections
  const [previousSelectedSubcategoryIds, setPreviousSelectedSubcategoryIds] = useState<Set<number>>(new Set());
  const styles = useMemo(() => getStyles(theme, isDark, themeName), [theme, isDark, themeName]);

  // React Query hooks
  const userType = mode === 'b2b' ? 'b2b' : mode === 'b2c' ? 'b2c' : 'all';
  const { data: categoriesData, isLoading: loading } = useCategories(userType, true);
  const { data: subcategoriesData, isLoading: loadingSubcategories } = useSubcategories(
    selectedCategoryId,
    userType,
    step === 'subcategories' && !!selectedCategoryId
  );
  const queryClient = useQueryClient();
  const { data: userCategoriesData, refetch: refetchUserCategories } = useUserCategories(
    userData?.id,
    !!userData?.id
  );
  const { data: userSubcategoriesData, refetch: refetchUserSubcategories } = useUserSubcategories(
    userData?.id,
    !!userData?.id && step === 'subcategories'
  );
  const updateSubcategoriesMutation = useUpdateUserSubcategories(userData?.id || 0);
  const removeCategoryMutation = useRemoveUserCategory(userData?.id || 0);
  const removeSubcategoriesMutation = useRemoveUserSubcategories(userData?.id || 0);

  const categories = categoriesData?.data || [];
  const subcategories = subcategoriesData?.data || [];
  
  // Get user's category IDs to mark already added categories
  const userCategoryIds = useMemo(() => {
    if (!userCategoriesData?.data?.category_ids) return new Set<number>();
    return new Set(userCategoriesData.data.category_ids.map((id: any) => Number(id)));
  }, [userCategoriesData]);

  // Load user data
  useEffect(() => {
    const loadUserData = async () => {
      const data = await getUserData();
      setUserData(data);
    };
    loadUserData();
  }, []);

  // Load user's existing subcategories when category is selected
  useEffect(() => {
    if (selectedCategoryId && step === 'subcategories' && userSubcategoriesData?.data?.subcategories) {
      const existingMap = new Map<number, UserSubcategory>();
      const existingIds = new Set<number>();
      userSubcategoriesData.data.subcategories.forEach((subcat: any) => {
        if (subcat.main_category_id === selectedCategoryId) {
          const subcatId = subcat.subcategory_id;
          existingIds.add(subcatId);
          existingMap.set(subcatId, {
            subcategoryId: subcatId,
            customPrice: subcat.custom_price || subcat.display_price || '',
            priceUnit: subcat.display_price_unit || subcat.price_unit || 'kg',
            defaultPrice: subcat.default_price,
            name: subcat.name
          });
        }
      });
      setSelectedSubcategories(existingMap);
      setPreviousSelectedSubcategoryIds(existingIds);
      setHadExistingSubcategories(existingMap.size > 0);
    }
  }, [selectedCategoryId, step, userSubcategoriesData]);

  const handleCategorySelect = (categoryId: number) => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(30);
    }
    setSelectedCategoryId(categoryId);
    setStep('subcategories');
  };

  const toggleSubcategory = (subcategoryId: number) => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(30);
    }

    setSelectedSubcategories(prev => {
      const newMap = new Map(prev);
      if (newMap.has(subcategoryId)) {
        newMap.delete(subcategoryId);
      } else {
        const subcat = subcategories.find(s => s.id === subcategoryId);
        newMap.set(subcategoryId, {
          subcategoryId,
          customPrice: subcat?.default_price || '',
          priceUnit: subcat?.price_unit || 'kg',
          defaultPrice: subcat?.default_price,
          name: subcat?.name
        });
      }
      return newMap;
    });
  };

  const selectAllSubcategories = () => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(30);
    }

    const newMap = new Map<number, UserSubcategory>();
    subcategories.forEach(subcat => {
      newMap.set(subcat.id, {
        subcategoryId: subcat.id,
        customPrice: subcat.default_price || '',
        priceUnit: subcat.price_unit || 'kg',
        defaultPrice: subcat.default_price,
        name: subcat.name
      });
    });
    setSelectedSubcategories(newMap);
  };

  const deselectAllSubcategories = () => {
    if (Platform.OS === 'ios') {
      Vibration.vibrate(10);
    } else {
      Vibration.vibrate(30);
    }
    setSelectedSubcategories(new Map());
  };

  const openPriceEditor = (subcategoryId: number) => {
    const subcat = selectedSubcategories.get(subcategoryId);
    setEditingPrice({
      subcategoryId,
      price: subcat?.customPrice || '',
      unit: subcat?.priceUnit || 'kg'
    });
  };

  const savePrice = () => {
    if (!editingPrice) return;

    setSelectedSubcategories(prev => {
      const newMap = new Map(prev);
      const existing = newMap.get(editingPrice.subcategoryId);
      if (existing) {
        newMap.set(editingPrice.subcategoryId, {
          ...existing,
          customPrice: editingPrice.price,
          priceUnit: editingPrice.unit
        });
      }
      return newMap;
    });
    setEditingPrice(null);
  };

  const handleSave = async () => {
    if (!userData?.id) {
      Alert.alert(t('common.error'), t('addCategory.userNotFound') || 'User not found');
      return;
    }

    if (selectedSubcategories.size === 0) {
      Alert.alert(
        t('common.warning'),
        t('addCategory.selectAtLeastOneSubcategory') || 'Please select at least one subcategory'
      );
      return;
    }

    try {
      // Get currently selected subcategory IDs
      const currentSelectedIds = new Set(Array.from(selectedSubcategories.keys()));
      
      // Find subcategories that were previously selected but are now unselected (deselected)
      const unselectedSubcategoryIds = Array.from(previousSelectedSubcategoryIds).filter(
        id => !currentSelectedIds.has(id)
      );
      
      console.log('💾 [Save Subcategories] Saving:', {
        selectedCategoryId,
        selectedCount: currentSelectedIds.size,
        previouslySelected: previousSelectedSubcategoryIds.size,
        unselectedCount: unselectedSubcategoryIds.length,
        unselectedIds: unselectedSubcategoryIds
      });
      
      // First, remove unselected subcategories if any
      if (unselectedSubcategoryIds.length > 0) {
        console.log('🗑️ [Save Subcategories] Removing unselected subcategories:', unselectedSubcategoryIds);
        await removeSubcategoriesMutation.mutateAsync(unselectedSubcategoryIds);
      }
      
      // Then, save/update selected subcategories
      const selectedSubcategoriesArray = Array.from(selectedSubcategories.values());
      
      if (selectedSubcategoriesArray.length > 0) {
        // Get all existing subcategories from other categories to preserve them
        const allExistingSubcategories = userSubcategoriesData?.data?.subcategories || [];
        const subcategoriesFromOtherCategories = allExistingSubcategories
          .filter((subcat: any) => Number(subcat.main_category_id) !== Number(selectedCategoryId))
          .map((subcat: any) => ({
            subcategoryId: subcat.subcategory_id,
            customPrice: subcat.custom_price || subcat.display_price || '',
            priceUnit: subcat.display_price_unit || subcat.price_unit || 'kg'
          }));
        
        // Merge: subcategories from other categories + selected subcategories for current category
        const allSubcategoriesToSave = [
          ...subcategoriesFromOtherCategories,
          ...selectedSubcategoriesArray
        ];
        
        console.log('💾 [Save Subcategories] Saving selected subcategories:', {
          fromOtherCategories: subcategoriesFromOtherCategories.length,
          selectedForCurrentCategory: selectedSubcategoriesArray.length,
          totalToSave: allSubcategoriesToSave.length
        });
        
        await updateSubcategoriesMutation.mutateAsync(allSubcategoriesToSave);
      }
      
      // Update previous selected IDs to current state
      setPreviousSelectedSubcategoryIds(currentSelectedIds);
      
      if (Platform.OS === 'ios') {
        Vibration.vibrate(10);
      } else {
        Vibration.vibrate(50);
      }
      
      console.log('✅ Subcategories saved successfully, cache will be invalidated automatically');
      
      // Force refetch to get updated data
      await refetchUserSubcategories();
      await refetchUserCategories();
      
      // Invalidate queries for the category and its subcategories
      if (selectedCategoryId) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.subcategories.byCategory(selectedCategoryId, userType)
        });
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.categories.detail(selectedCategoryId)
        });
      }
      // Also invalidate user's category/subcategory lists since they changed
      if (userData?.id) {
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.userCategories.byUser(userData.id)
        });
        queryClient.invalidateQueries({ 
          queryKey: queryKeys.userSubcategories.byUser(userData.id)
        });
      }
      
      Alert.alert(
        t('common.success'),
        t('addCategory.saveSuccess') || 'Subcategories saved successfully',
        [
          {
            text: t('common.ok'),
            onPress: () => {
              // Refetch will update the UI, so when user comes back, they'll see the correct state
              // Navigation will trigger refetch in dashboard due to useFocusEffect
              navigation.goBack();
            },
          },
        ]
      );
    } catch (error: any) {
      console.error('Error saving subcategories:', error);
      Alert.alert(
        t('common.error'),
        error.message || t('addCategory.saveError') || 'Failed to save subcategories. Please try again.'
      );
    }
  };

  const handleRemoveCategory = async () => {
    if (!userData?.id || !selectedCategoryId) {
      Alert.alert(t('common.error'), t('addCategory.userNotFound') || 'User not found');
      return;
    }

    Alert.alert(
      t('common.warning') || 'Warning',
      t('addCategory.removeCategoryConfirm') || 'Are you sure you want to remove this category? All subcategories will be removed.',
      [
        {
          text: t('common.cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('addCategory.remove') || 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!selectedCategoryId) {
                Alert.alert(t('common.error'), 'No category selected');
                return;
              }

              console.log('🗑️ [Remove Category] Removing category:', {
                selectedCategoryId,
                userId: userData?.id
              });
              
              // Use the new DELETE API to remove the category and all its subcategories
              const result = await removeCategoryMutation.mutateAsync(selectedCategoryId);
              
              console.log('✅ [Remove Category] Backend response:', {
                removed_category_id: result?.data?.removed_category_id,
                removed_subcategories_count: result?.data?.removed_subcategories_count,
                remaining_categories_count: result?.data?.remaining_categories_count,
                remaining_categories: result?.data?.remaining_categories
              });
              
              // Clear the selected category and subcategories state
              setSelectedCategoryId(null);
              setSelectedSubcategories(new Map());
              setStep('categories');
              
              // Invalidate queries for the removed category and its subcategories
              if (selectedCategoryId) {
                // Invalidate subcategories for this category
                queryClient.invalidateQueries({ 
                  queryKey: queryKeys.subcategories.byCategory(selectedCategoryId, userType)
                });
                // Invalidate category detail if it exists
                queryClient.invalidateQueries({ 
                  queryKey: queryKeys.categories.detail(selectedCategoryId)
                });
              }
              // Also invalidate user's category/subcategory lists since they changed
              if (userData?.id) {
                queryClient.invalidateQueries({ 
                  queryKey: queryKeys.userCategories.byUser(userData.id)
                });
                queryClient.invalidateQueries({ 
                  queryKey: queryKeys.userSubcategories.byUser(userData.id)
                });
              }
              
              // Force refetch to ensure dashboard updates immediately
              await refetchUserCategories();
              await refetchUserSubcategories();
              
              if (Platform.OS === 'ios') {
                Vibration.vibrate(10);
              } else {
                Vibration.vibrate(50);
              }
              
              console.log('✅ Category removed successfully');
              
              Alert.alert(
                t('common.success'),
                t('addCategory.removeSuccess') || 'Category removed successfully',
                [
                  {
                    text: t('common.ok'),
                    onPress: () => {
                      // Already cleared state above, just stay on categories screen
                    },
                  },
                ]
              );
            } catch (error: any) {
              console.error('Error removing category:', error);
              Alert.alert(
                t('common.error'),
                error.message || t('addCategory.removeError') || 'Failed to remove category. Please try again.'
              );
            }
          },
        },
      ]
    );
  };

  const getCategoryIcon = (categoryName: string): string => {
    const name = categoryName.toLowerCase();
    if (name.includes('metal') || name.includes('aluminum')) return 'aluminum';
    if (name.includes('plastic')) return 'bottle-soda';
    if (name.includes('paper')) return 'file-document';
    if (name.includes('electronic') || name.includes('e-waste')) return 'lightbulb';
    if (name.includes('glass')) return 'glass-wine';
    if (name.includes('wood')) return 'tree';
    if (name.includes('rubber')) return 'circle';
    if (name.includes('organic')) return 'sprout';
    return 'package-variant';
  };

  const selectedCategory = categories.find(c => c.id === selectedCategoryId);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => {
            if (step === 'subcategories') {
              setStep('categories');
              setSelectedCategoryId(null);
            } else {
              navigation.goBack();
            }
          }} 
          style={styles.backButton}
        >
          <MaterialCommunityIcons
            name="arrow-left"
            size={24}
            color={theme.textPrimary}
          />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle} numberOfLines={1}>
          {step === 'categories' 
            ? (t('addCategory.title') || 'Select Category')
            : (t('addCategory.selectSubcategories') || `Select Subcategories - ${selectedCategory?.name || ''}`)
          }
        </AutoText>
        <View style={styles.backButton} />
      </View>

      {step === 'categories' ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <AutoText style={styles.loadingText}>
                {t('common.loading') || 'Loading categories...'}
              </AutoText>
            </View>
          ) : categories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={48}
                color={theme.textSecondary}
              />
              <AutoText style={styles.emptyText}>
                {t('addCategory.noCategories') || 'No categories available'}
              </AutoText>
            </View>
          ) : (
            <View style={styles.grid}>
              {categories.map((category, index) => {
                const isLastInRow = (index + 1) % 3 === 0;
                const iconName = getCategoryIcon(category.name);
                const isAlreadyAdded = userCategoryIds.has(Number(category.id));
                
                return (
                  <TouchableOpacity
                    key={category.id}
                    style={[
                      styles.gridItem,
                      Platform.OS === 'ios' && isLastInRow && styles.gridItemLastInRow,
                      isAlreadyAdded && styles.gridItemAdded,
                    ]}
                    onPress={() => handleCategorySelect(category.id)}
                    activeOpacity={0.7}
                  >
                    {category.image ? (
                      <Image
                        source={{ uri: category.image }}
                        style={styles.categoryImage}
                        resizeMode="cover"
                      />
                    ) : (
                      <MaterialCommunityIcons
                        name={iconName}
                        size={32}
                        color={theme.primary}
                      />
                    )}
                    <AutoText style={styles.categoryLabel} numberOfLines={2}>
                      {category.name}
                    </AutoText>
                    <MaterialCommunityIcons
                      name="chevron-right"
                      size={16}
                      color={theme.textSecondary}
                      style={styles.chevron}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.subcategoriesContainer}>
          {loadingSubcategories ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.primary} />
              <AutoText style={styles.loadingText}>
                {t('common.loading') || 'Loading subcategories...'}
              </AutoText>
            </View>
          ) : subcategories.length === 0 ? (
            <View style={styles.emptyContainer}>
              <MaterialCommunityIcons
                name="package-variant-closed"
                size={48}
                color={theme.textSecondary}
              />
              <AutoText style={styles.emptyText}>
                {t('addCategory.noSubcategories') || 'No subcategories available'}
              </AutoText>
            </View>
          ) : (
            <>
              <View style={styles.selectAllContainer}>
                <TouchableOpacity
                  style={styles.selectAllButton}
                  onPress={
                    selectedSubcategories.size === subcategories.length
                      ? deselectAllSubcategories
                      : selectAllSubcategories
                  }
                  activeOpacity={0.7}
                >
                  <AutoText style={styles.selectAllText}>
                    {selectedSubcategories.size === subcategories.length
                      ? (t('addCategory.deselectAll') || 'Deselect All')
                      : (t('addCategory.selectAll') || 'Select All')
                    }
                  </AutoText>
                </TouchableOpacity>
              </View>
              <ScrollView
                contentContainerStyle={styles.subcategoriesList}
                showsVerticalScrollIndicator={false}
              >
                {subcategories.map(subcategory => {
                  const isSelected = selectedSubcategories.has(subcategory.id);
                  const userSubcat = selectedSubcategories.get(subcategory.id);
                  const displayPrice = userSubcat?.customPrice || subcategory.default_price || '';
                  const displayUnit = userSubcat?.priceUnit || subcategory.price_unit || 'kg';

                  return (
                    <View key={subcategory.id} style={styles.subcategoryItem}>
                      <TouchableOpacity
                        style={styles.subcategoryRow}
                        onPress={() => toggleSubcategory(subcategory.id)}
                        activeOpacity={0.7}
                      >
                        <View style={styles.subcategoryCheckbox}>
                          {isSelected && (
                            <MaterialCommunityIcons
                              name="check-circle"
                              size={24}
                              color={theme.primary}
                            />
                          )}
                          {!isSelected && (
                            <View style={styles.checkboxEmpty} />
                          )}
                        </View>
                        
                        {/* Subcategory Image */}
                        {subcategory.image ? (
                          <Image
                            source={{ uri: subcategory.image }}
                            style={styles.subcategoryImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={styles.subcategoryNoImage}>
                            <MaterialCommunityIcons
                              name="image-off"
                              size={20}
                              color={theme.textSecondary}
                            />
                          </View>
                        )}
                        
                        <View style={styles.subcategoryInfo}>
                          <AutoText style={styles.subcategoryName}>
                            {subcategory.name}
                          </AutoText>
                          <AutoText style={styles.subcategoryPrice}>
                            {t('addCategory.defaultPrice') || 'Default'}: ₹{subcategory.default_price || '0'}/{subcategory.price_unit || 'kg'}
                          </AutoText>
                        </View>
                      </TouchableOpacity>
                      {isSelected && (
                        <TouchableOpacity
                          style={styles.priceEditButton}
                          onPress={() => openPriceEditor(subcategory.id)}
                          activeOpacity={0.7}
                        >
                          <MaterialCommunityIcons
                            name="pencil"
                            size={18}
                            color={theme.primary}
                          />
                          <AutoText style={styles.priceEditText}>
                            {displayPrice ? `₹${displayPrice}/${displayUnit}` : t('addCategory.setPrice') || 'Set Price'}
                          </AutoText>
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </ScrollView>
            </>
          )}
        </View>
      )}

      {step === 'subcategories' && (
        <View style={styles.bottomButtonContainer}>
          {selectedSubcategories.size === 0 && hadExistingSubcategories ? (
            <OutlineGreenButton
              title={t('addCategory.removeCategory') || 'Remove Category'}
              onPress={handleRemoveCategory}
              disabled={updateSubcategoriesMutation.isPending}
            />
          ) : (
            <GreenButton
              title={
                updateSubcategoriesMutation.isPending
                  ? t('common.saving') || 'Saving...'
                  : selectedSubcategories.size === 1
                    ? t('addCategory.saveSubcategoriesOne') || 'Save 1 Subcategory'
                    : t('addCategory.saveSubcategoriesMany', { count: selectedSubcategories.size }) || `Save ${selectedSubcategories.size} Subcategories`
              }
              onPress={handleSave}
              disabled={updateSubcategoriesMutation.isPending || selectedSubcategories.size === 0}
            />
          )}
        </View>
      )}

      {/* Price Editor Modal */}
      <Modal
        visible={editingPrice !== null}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setEditingPrice(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <AutoText style={styles.modalTitle}>
                {t('addCategory.editPrice') || 'Edit Price'}
              </AutoText>
              <TouchableOpacity
                onPress={() => setEditingPrice(null)}
                style={styles.modalCloseButton}
              >
                <MaterialCommunityIcons
                  name="close"
                  size={24}
                  color={theme.textPrimary}
                />
              </TouchableOpacity>
            </View>
            {editingPrice && (
              <>
                <View style={styles.priceInputContainer}>
                  <AutoText style={styles.priceLabel}>
                    {t('addCategory.price') || 'Price (₹)'}
                  </AutoText>
                  <TextInput
                    style={styles.priceInput}
                    value={editingPrice.price}
                    onChangeText={(text) => setEditingPrice({ ...editingPrice, price: text })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    placeholderTextColor={theme.textSecondary}
                  />
                </View>
                <View style={styles.unitContainer}>
                  <AutoText style={styles.priceLabel}>
                    {t('addCategory.unit') || 'Unit'}
                  </AutoText>
                  <View style={styles.unitButtons}>
                    {['kg', 'pcs'].map(unit => (
                      <TouchableOpacity
                        key={unit}
                        style={[
                          styles.unitButton,
                          editingPrice.unit === unit && styles.unitButtonSelected
                        ]}
                        onPress={() => setEditingPrice({ ...editingPrice, unit })}
                      >
                        <AutoText style={[
                          styles.unitButtonText,
                          editingPrice.unit === unit && styles.unitButtonTextSelected
                        ]}>
                          {unit.toUpperCase()}
                        </AutoText>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
                <GreenButton
                  title={t('common.save') || 'Save'}
                  onPress={savePrice}
                  style={styles.modalSaveButton}
                />
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const getStyles = (theme: any, isDark: boolean, themeName?: string) =>
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
      paddingTop: '24@vs',
      paddingBottom: '100@vs',
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: Platform.OS === 'ios' ? 'flex-start' : 'space-between',
    },
    gridItem: {
      width: Platform.OS === 'ios' ? '30.5%' : '31%',
      aspectRatio: 1,
      minHeight: '110@vs',
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: isDark ? theme.card : '#F5F5F5',
      gap: '8@vs',
      paddingVertical: '12@vs',
      marginBottom: '10@vs',
      position: 'relative',
      ...(Platform.OS === 'ios' && {
        marginRight: '3.5%',
      }),
    },
    gridItemAdded: {
      borderColor: theme.primary,
      borderWidth: 2,
    },
    gridItemLastInRow: {
      marginRight: 0,
    },
    categoryLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textPrimary,
      textAlign: 'center',
    },
    categoryImage: {
      width: '48@s',
      height: '48@s',
      borderRadius: '8@ms',
      marginBottom: '4@vs',
    },
    chevron: {
      position: 'absolute',
      top: '8@vs',
      right: '8@s',
    },
    subcategoriesContainer: {
      flex: 1,
    },
    selectAllContainer: {
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    selectAllButton: {
      alignSelf: 'flex-end',
      paddingHorizontal: '16@s',
      paddingVertical: '8@vs',
      backgroundColor: theme.accent,
      borderRadius: '8@ms',
    },
    selectAllText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
    },
    subcategoriesList: {
      paddingHorizontal: '18@s',
      paddingTop: '12@vs',
      paddingBottom: '100@vs',
    },
    subcategoryItem: {
      backgroundColor: theme.card,
      borderRadius: '12@ms',
      marginBottom: '12@vs',
      borderWidth: 1,
      borderColor: theme.border,
      overflow: 'hidden',
    },
    subcategoryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: '16@s',
    },
    subcategoryCheckbox: {
      width: '32@s',
      height: '32@s',
      marginRight: '12@s',
      justifyContent: 'center',
      alignItems: 'center',
    },
    subcategoryImage: {
      width: '50@s',
      height: '50@s',
      borderRadius: '8@ms',
      marginRight: '12@s',
      backgroundColor: theme.card,
    },
    subcategoryNoImage: {
      width: '50@s',
      height: '50@s',
      borderRadius: '8@ms',
      marginRight: '12@s',
      backgroundColor: theme.card,
      borderWidth: 1,
      borderColor: theme.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    checkboxEmpty: {
      width: '24@s',
      height: '24@s',
      borderRadius: '12@s',
      borderWidth: 2,
      borderColor: theme.border,
    },
    subcategoryInfo: {
      flex: 1,
    },
    subcategoryName: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '15@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    subcategoryPrice: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
      color: theme.textSecondary,
    },
    priceEditButton: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      borderTopWidth: 1,
      borderTopColor: theme.border,
      backgroundColor: theme.accent + '20',
      gap: '8@s',
    },
    priceEditText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '13@s',
      color: theme.primary,
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
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
    },
    loadingText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
    },
    emptyContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingVertical: '60@vs',
    },
    emptyText: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      color: theme.textSecondary,
      marginTop: '12@vs',
      textAlign: 'center',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: theme.card,
      borderTopLeftRadius: '20@ms',
      borderTopRightRadius: '20@ms',
      paddingHorizontal: '18@s',
      paddingTop: '20@vs',
      paddingBottom: '30@vs',
      maxHeight: '70%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: '20@vs',
    },
    modalTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    modalCloseButton: {
      padding: '4@s',
    },
    priceInputContainer: {
      marginBottom: '20@vs',
    },
    priceLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    priceInput: {
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      fontFamily: 'Poppins-Regular',
      fontSize: '16@s',
      color: theme.textPrimary,
      borderWidth: 1,
      borderColor: theme.border,
    },
    unitContainer: {
      marginBottom: '24@vs',
    },
    unitButtons: {
      flexDirection: 'row',
      gap: '12@s',
    },
    unitButton: {
      flex: 1,
      paddingVertical: '12@vs',
      borderRadius: '8@ms',
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.background,
      alignItems: 'center',
    },
    unitButtonSelected: {
      borderColor: theme.primary,
      backgroundColor: theme.accent + '40',
    },
    unitButtonText: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textSecondary,
    },
    unitButtonTextSelected: {
      color: theme.primary,
    },
    modalSaveButton: {
      marginTop: '8@vs',
    },
  });

export default AddCategoryScreen;
