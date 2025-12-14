// DigitalCardScreen.js
import React from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StatusBar,
    ScrollView,
    Platform,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { ScaledSheet } from 'react-native-size-matters';
import LinearGradient from 'react-native-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTabBar } from '../../context/TabBarContext';
import { useTheme } from '../../components/ThemeProvider';
import { useUserMode } from '../../context/UserModeContext';
import { useTranslation } from 'react-i18next';
import { isLoggedIn, getUserData } from '../../services/auth/authService';
import { DeviceEventEmitter, CommonActions } from 'react-native';

const JoinAsScreen = () => {
    const navigation = useNavigation();
    const { setTabBarVisible } = useTabBar();
    const { theme, isDark, themeName } = useTheme();
    const { setMode } = useUserMode();
    const { t } = useTranslation();
    const [selectedOption, setSelectedOption] = React.useState<'b2b' | 'b2c' | 'delivery' | null>(null);
    const styles = getStyles(theme, isDark, themeName);

    // Hide tab bar when screen is focused
    useFocusEffect(
        React.useCallback(() => {
            setTabBarVisible(false);
        }, [setTabBarVisible])
    );

    // Also ensure it's hidden on initial mount
    React.useEffect(() => {
        setTabBarVisible(false);
    }, [setTabBarVisible]);

    const handleContinue = async () => {
        // Mark join as screen as shown
        await AsyncStorage.setItem('@join_as_shown', 'true');
        
        if (!selectedOption) {
            // No option selected - just navigate to login without setting join type
            // This allows existing users to login without selecting a type
            navigation.navigate('Login' as never);
            return;
        }

            // Clear previous signup flags
            await AsyncStorage.removeItem('@b2b_status');
            await AsyncStorage.removeItem('@b2c_signup_needed');
            await AsyncStorage.removeItem('@delivery_vehicle_info_needed');

        // IMPORTANT: Store @selected_join_type temporarily for login flow
        // It will be cleared after login if user is type 'N' (new user)
        // This allows LoginScreen to read it and use it for routing
        await AsyncStorage.setItem('@selected_join_type', selectedOption);
        console.log('✅ JoinAsScreen: Stored join type temporarily for login flow:', selectedOption);
        console.log('   (Will be cleared after login if user is type N)');

        await setMode(selectedOption);

        // Always navigate to login screen to force OTP verification
        // This ensures users always go through the OTP flow as requested
        navigation.navigate('Login' as never);
    };

    const handleAlreadyHaveAccount = async () => {
        await AsyncStorage.setItem('@join_as_shown', 'true');
        navigation.navigate('Login' as never);
    };

    // Create gradient colors based on theme
    const gradientColors = isDark
        ? [theme.background, theme.card]
        : [theme.background, theme.accent || theme.background];

    // Choose illustration asset based on current theme
    const illustrationSource = isDark
        ? require("../../assets/images/joinaswhite1.png")
        : require("../../assets/images/Joinasblack.png");

    // Create button gradient colors based on theme (primary to secondary)
    const buttonGradientColors = [theme.primary, theme.secondary];

    return (
        <LinearGradient
            colors={gradientColors}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.root}
        >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <StatusBar
                    barStyle={isDark ? "light-content" : "dark-content"}
                    backgroundColor="transparent"
                    translucent
                />
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    bounces={true}
                >
                    <View style={styles.content}>
                        {/* Top illustration */}
                        <View style={styles.topSection}>
                            <Image
                                source={illustrationSource}
                                style={styles.illustration}
                                resizeMode="contain"
                            />
                        </View>

                        {/* Features list */}
                        <View style={styles.featuresSection}>
                            <FeatureItem
                                id="b2b"
                                title={t('joinAs.b2b.title')}
                                description={t('joinAs.b2b.description')}
                                isSelected={selectedOption === 'b2b'}
                                onSelect={() => {
                                    // Toggle selection - if already selected, deselect it
                                    setSelectedOption(selectedOption === 'b2b' ? null : 'b2b');
                                }}
                                styles={styles}
                                theme={theme}
                            />
                            <FeatureItem
                                id="b2c"
                                title={t('joinAs.b2c.title')}
                                description={t('joinAs.b2c.description')}
                                isSelected={selectedOption === 'b2c'}
                                onSelect={() => {
                                    // Toggle selection - if already selected, deselect it
                                    setSelectedOption(selectedOption === 'b2c' ? null : 'b2c');
                                }}
                                styles={styles}
                                theme={theme}
                            />
                            <FeatureItem
                                id="delivery"
                                title={t('joinAs.delivery.title')}
                                description={t('joinAs.delivery.description')}
                                isSelected={selectedOption === 'delivery'}
                                onSelect={() => {
                                    // Toggle selection - if already selected, deselect it
                                    setSelectedOption(selectedOption === 'delivery' ? null : 'delivery');
                                }}
                                styles={styles}
                                theme={theme}
                            />
                        </View>

                        {/* Bottom CTA button */}
                        <View style={styles.buttonWrapper}>
                            <TouchableOpacity
                                activeOpacity={0.9}
                                style={styles.buttonTouchable}
                                onPress={handleContinue}
                            >
                                <LinearGradient
                                    colors={buttonGradientColors}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={styles.button}
                                >
                                    <Text style={styles.buttonText}>
                                        {selectedOption ? t('joinAs.continue') : (t('joinAs.login') || 'Login')}
                                    </Text>
                                </LinearGradient>
                            </TouchableOpacity>

                            <View style={styles.alreadyAccountWrapper}>
                                <Text style={styles.alreadyAccountText}>{t('joinAs.alreadyHaveAccount')}</Text>
                                <TouchableOpacity onPress={handleAlreadyHaveAccount} activeOpacity={0.7}>
                                    <Text style={styles.alreadyAccountLink}>{t('joinAs.login')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </LinearGradient>
    );
};

const FeatureItem = ({
    id,
    title,
    description,
    isSelected,
    onSelect,
    styles,
    theme
}: {
    id: string;
    title: string;
    description: string;
    isSelected: boolean;
    onSelect: () => void;
    styles: any;
    theme: any;
}) => {
    return (
        <TouchableOpacity
            style={[styles.featureItem, isSelected && styles.featureItemSelected]}
            onPress={onSelect}
            activeOpacity={0.7}
        >
            <View style={[styles.checkboxContainer, isSelected && { backgroundColor: theme.primary }]}>
                {isSelected && (
                    <View style={styles.checkboxInner}>
                        <Text style={[styles.checkmark, { color: theme.card }]}>✓</Text>
                    </View>
                )}
            </View>
            <View style={styles.featureTextContainer}>
                <Text style={styles.featureTitle}>{title}</Text>
                <Text style={styles.featureDescription}>{description}</Text>
            </View>
        </TouchableOpacity>
    );
};

const getStyles = (theme: any, isDark: boolean, themeName: string) =>
    ScaledSheet.create({
        root: {
            flex: 1,
        },
        container: {
            flex: 1,
        },
        scrollContent: {
            flexGrow: 1,
            paddingBottom: Platform.OS === 'ios' ? '24@vs' : '20@vs',
        },
        content: {
            paddingHorizontal: '24@s',
            paddingTop: '20@vs',
            paddingBottom: Platform.OS === 'ios' ? '12@vs' : '16@vs',
        },
        topSection: {
            alignItems: "center",
            marginTop: '0@vs',
            marginBottom: '8@vs',
        },
        illustration: {
            width: "90%",
            height: '150@vs',
            marginBottom: '0@vs',
        },
        title: {
            fontSize: '22@s',
            lineHeight: '28@vs',
            color: theme.textPrimary,
            fontFamily: "Poppins-SemiBold",
            textAlign: "center",
        },
        featuresSection: {
            marginTop: '0@vs',
            marginBottom: '8@vs',
        },
        featureItem: {
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: '12@vs',
            padding: '14@s',
            borderRadius: '12@ms',
            borderWidth: 1,
            borderColor: theme.border,
            backgroundColor: theme.card,
        },
        featureItemSelected: {
            borderColor: theme.primary,
            borderWidth: 2,
        },
        checkboxContainer: {
            width: '24@s',
            height: '24@s',
            borderRadius: '6@ms',
            borderWidth: 2,
            borderColor: theme.border,
            justifyContent: "center",
            alignItems: "center",
            marginRight: '14@s',
            marginTop: '2@vs',
        },
        checkboxInner: {
            width: '100%',
            height: '100%',
            justifyContent: "center",
            alignItems: "center",
        },
        checkmark: {
            fontSize: '14@s',
            fontFamily: "Poppins-Bold",
        },
        featureTextContainer: {
            flex: 1,
        },
        featureTitle: {
            fontSize: '14@s',
            lineHeight: '18@vs',
            color: theme.textPrimary,
            fontFamily: "Poppins-Medium",
            marginBottom: '2@vs',
        },
        featureDescription: {
            fontSize: '12@s',
            lineHeight: '16@vs',
            color: theme.textSecondary,
            fontFamily: "Poppins-Regular",
        },
        buttonWrapper: {
            paddingTop: '8@vs',
            paddingHorizontal: '8@s',
            alignItems: 'center',
        },
        buttonTouchable: {
            width: "100%",
            alignSelf: "center",
        },
        buttonDisabled: {
            opacity: 0.5,
        },
        button: {
            width: "100%",
            maxWidth: '320@s',
            paddingVertical: '14@vs',
            borderRadius: '12@ms',
            justifyContent: "center",
            alignItems: "center",
            alignSelf: "center",
        },
        buttonText: {
            fontSize: '15@s',
            color: themeName === 'darkGreen' ? '#000000' : '#FFFFFF',
            fontFamily: "Poppins-SemiBold",
        },
        alreadyAccountWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: '12@vs',
        },
        alreadyAccountText: {
            fontSize: '12@s',
            color: theme.textSecondary,
            fontFamily: "Poppins-Regular",
            marginRight: '6@s',
        },
        alreadyAccountLink: {
            fontSize: '15@s',
            color: theme.primary,
            fontFamily: "Poppins-SemiBold",
            textDecorationLine: 'underline',
        },
    });

export default JoinAsScreen;
