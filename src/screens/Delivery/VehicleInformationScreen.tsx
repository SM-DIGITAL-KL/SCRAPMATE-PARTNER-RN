import React, { useState, useMemo } from 'react';
import { View, ScrollView, TouchableOpacity, StatusBar, TextInput } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../../components/ThemeProvider';
import { SectionCard } from '../../components/SectionCard';
import { GreenButton } from '../../components/GreenButton';
import { OutlineGreenButton } from '../../components/OutlineGreenButton';
import { AutoText } from '../../components/AutoText';
import { ScaledSheet } from 'react-native-size-matters';
import { useTranslation } from 'react-i18next';

type VehicleType = 'car' | 'motorcycle' | 'van' | 'truck';
type DocumentStatus = 'uploaded' | 'pending' | 'failed';

interface Document {
  name: string;
  status: DocumentStatus;
}

const VehicleInformationScreen = ({ navigation }: any) => {
  const { theme, isDark, themeName } = useTheme();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const styles = useMemo(() => getStyles(theme, themeName), [theme, themeName]);
  
  const [vehicleType, setVehicleType] = useState<VehicleType>('car');
  const [vehicleModel, setVehicleModel] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [documents, setDocuments] = useState<Document[]>([
    { name: t('delivery.vehicle.vehicleRegistration'), status: 'uploaded' },
    { name: t('delivery.vehicle.vehicleInsurance'), status: 'pending' },
    { name: t('delivery.vehicle.driversLicenseBack'), status: 'failed' },
  ]);

  const vehicleTypes = [
    { key: 'car' as VehicleType, icon: 'car', label: t('delivery.vehicle.car') },
    { key: 'motorcycle' as VehicleType, icon: 'motorbike', label: t('delivery.vehicle.motorcycle') },
    { key: 'van' as VehicleType, icon: 'van-utility', label: t('delivery.vehicle.van') },
    { key: 'truck' as VehicleType, icon: 'truck', label: t('delivery.vehicle.truck') },
  ];

  const getStatusColor = (status: DocumentStatus) => {
    switch (status) {
      case 'uploaded':
        return '#4CAF50'; // Green
      case 'pending':
        return '#FF9800'; // Orange
      case 'failed':
        return '#F44336'; // Red
      default:
        return theme.textSecondary;
    }
  };

  const getStatusText = (status: DocumentStatus) => {
    switch (status) {
      case 'uploaded':
        return t('delivery.vehicle.uploadedSuccessfully');
      case 'pending':
        return t('delivery.vehicle.uploadPending');
      case 'failed':
        return t('delivery.vehicle.uploadFailed');
      default:
        return '';
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    switch (status) {
      case 'uploaded':
        return 'check-circle';
      case 'pending':
        return 'alert-circle';
      case 'failed':
        return 'close-circle';
      default:
        return 'help-circle';
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={isDark ? theme.background : '#FFFFFF'}
      />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="arrow-left" size={24} color={theme.textPrimary} />
        </TouchableOpacity>
        <AutoText style={styles.headerTitle}>{t('delivery.vehicle.title')}</AutoText>
        <View style={styles.placeholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Select Vehicle Type */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.vehicle.selectVehicleType')}</AutoText>
          <View style={styles.vehicleTypeGrid}>
            {vehicleTypes.map((type) => (
              <TouchableOpacity
                key={type.key}
                style={[
                  styles.vehicleTypeCard,
                  vehicleType === type.key && styles.vehicleTypeCardActive,
                ]}
                onPress={() => setVehicleType(type.key)}
                activeOpacity={0.7}
              >
                <MaterialCommunityIcons
                  name={type.icon as any}
                  size={32}
                  color={vehicleType === type.key ? theme.primary : theme.textSecondary}
                />
                <AutoText
                  style={[
                    styles.vehicleTypeLabel,
                    vehicleType === type.key && styles.vehicleTypeLabelActive,
                  ]}
                >
                  {type.label}
                </AutoText>
              </TouchableOpacity>
            ))}
          </View>
        </SectionCard>

        {/* Vehicle Details */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.vehicle.vehicleDetails')}</AutoText>
          
          <View style={styles.inputContainer}>
            <AutoText style={styles.inputLabel}>{t('delivery.vehicle.vehicleModel')}</AutoText>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder={t('delivery.vehicle.vehicleModelPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={vehicleModel}
              onChangeText={setVehicleModel}
            />
          </View>

          <View style={styles.inputContainer}>
            <AutoText style={styles.inputLabel}>{t('delivery.vehicle.registrationNumber')}</AutoText>
            <TextInput
              style={[styles.input, { color: theme.textPrimary }]}
              placeholder={t('delivery.vehicle.registrationNumberPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={registrationNumber}
              onChangeText={setRegistrationNumber}
            />
          </View>
        </SectionCard>

        {/* Document Uploads */}
        <SectionCard>
          <AutoText style={styles.sectionTitle}>{t('delivery.vehicle.documentUploads')}</AutoText>
          
          {documents.map((doc, index) => {
            const statusColor = getStatusColor(doc.status);
            return (
              <View key={index} style={styles.documentItem}>
                <View style={styles.documentInfo}>
                  <MaterialCommunityIcons
                    name={getStatusIcon(doc.status) as any}
                    size={20}
                    color={statusColor}
                  />
                  <View style={styles.documentTextContainer}>
                    <AutoText style={styles.documentName}>{doc.name}</AutoText>
                    <AutoText style={[styles.documentStatus, { color: statusColor }]}>
                      {getStatusText(doc.status)}
                    </AutoText>
                  </View>
                </View>
                <View style={styles.documentActions}>
                  <TouchableOpacity style={styles.documentActionButton} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="cloud-upload-outline" size={20} color={theme.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.documentActionButton} activeOpacity={0.7}>
                    <MaterialCommunityIcons name="delete-outline" size={20} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          
          <OutlineGreenButton
            title={t('delivery.vehicle.addDocument')}
            onPress={() => {}}
            style={styles.addDocumentButton}
          />
        </SectionCard>

        {/* Submit Button */}
        <GreenButton
          title={t('delivery.vehicle.submitVehicleInfo')}
          onPress={() => {}}
          style={styles.submitButton}
        />
      </ScrollView>
    </View>
  );
};

const getStyles = (theme: any, themeName: string) =>
  ScaledSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: '18@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.card,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    backButton: {
      padding: '4@s',
      marginRight: '12@s',
    },
    headerTitle: {
      flex: 1,
      fontFamily: 'Poppins-SemiBold',
      fontSize: '18@s',
      color: theme.textPrimary,
    },
    placeholder: {
      width: '32@s',
    },
    scrollContent: {
      padding: '18@s',
      paddingBottom: '24@vs',
    },
    sectionTitle: {
      fontFamily: 'Poppins-SemiBold',
      fontSize: '16@s',
      color: theme.textPrimary,
      marginBottom: '16@vs',
    },
    vehicleTypeGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: '12@s',
    },
    vehicleTypeCard: {
      width: '22%',
      alignItems: 'center',
      padding: '16@s',
      backgroundColor: theme.background,
      borderRadius: '12@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    vehicleTypeCardActive: {
      borderColor: theme.primary,
      borderWidth: 2,
      backgroundColor: themeName === 'whitePurple' ? theme.card : theme.background,
    },
    vehicleTypeLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '12@s',
      color: theme.textSecondary,
      marginTop: '8@vs',
      textAlign: 'center',
    },
    vehicleTypeLabelActive: {
      color: theme.primary,
    },
    inputContainer: {
      marginBottom: '16@vs',
    },
    inputLabel: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '8@vs',
    },
    input: {
      fontFamily: 'Poppins-Regular',
      fontSize: '14@s',
      paddingHorizontal: '16@s',
      paddingVertical: '12@vs',
      backgroundColor: theme.background,
      borderRadius: '10@ms',
      borderWidth: 1,
      borderColor: theme.border,
    },
    documentItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: '12@vs',
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    documentInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: '12@s',
    },
    documentTextContainer: {
      flex: 1,
    },
    documentName: {
      fontFamily: 'Poppins-Medium',
      fontSize: '14@s',
      color: theme.textPrimary,
      marginBottom: '4@vs',
    },
    documentStatus: {
      fontFamily: 'Poppins-Regular',
      fontSize: '12@s',
    },
    documentActions: {
      flexDirection: 'row',
      gap: '8@s',
    },
    documentActionButton: {
      padding: '8@s',
    },
    addDocumentButton: {
      marginTop: '12@vs',
    },
    submitButton: {
      marginTop: '8@vs',
    },
  });

export default VehicleInformationScreen;

