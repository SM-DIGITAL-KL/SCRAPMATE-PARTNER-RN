// DigitalCardScreen.js
import React from "react";
import {
    View,
    Text,
    Image,
    TouchableOpacity,
    StatusBar,
} from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { ScaledSheet } from 'react-native-size-matters';
import LinearGradient from "react-native-linear-gradient";
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTabBar } from '../../context/TabBarContext';
import { useTheme } from '../../components/ThemeProvider';
import { useUserMode } from '../../context/UserModeContext';

const JoinAsScreen = () => {
    const navigation = useNavigation();
    const { setTabBarVisible } = useTabBar();
    const { theme, isDark, themeName } = useTheme();
    const { setMode } = useUserMode();
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
        if (!selectedOption) {
            return;
        }
        
        // Mark join as screen as shown
        await AsyncStorage.setItem('@join_as_shown', 'true');
        await setMode(selectedOption);
        
        // Navigate to login screen
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
            style={styles.root}
        >
            <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
                <StatusBar
                    barStyle={isDark ? "light-content" : "dark-content"}
                    backgroundColor="transparent"
                    translucent
                />
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
                            title="Join as B2B"
                            description="For Industrial and Wholesale scrap sellers and buyers. Manage bulk orders and business transactions."
                            isSelected={selectedOption === 'b2b'}
                            onSelect={() => setSelectedOption('b2b')}
                            styles={styles}
                            theme={theme}
                        />
                        <FeatureItem
                            id="b2c"
                            title="Join as B2C"
                            description="For Retail scrap buyers and sellers. Sell directly to customers and manage retail orders."
                            isSelected={selectedOption === 'b2c'}
                            onSelect={() => setSelectedOption('b2c')}
                            styles={styles}
                            theme={theme}
                        />
                        <FeatureItem
                            id="delivery"
                            title="Join as Door Step Buyer"
                            description="Become a delivery partner. Pick up scrap from customers and earn on every delivery."
                            isSelected={selectedOption === 'delivery'}
                            onSelect={() => setSelectedOption('delivery')}
                            styles={styles}
                            theme={theme}
                        />
                    </View>

                    {/* Bottom CTA button */}
                    <View style={styles.buttonWrapper}>
                        <TouchableOpacity 
                            activeOpacity={0.9} 
                            style={[styles.buttonTouchable, !selectedOption && styles.buttonDisabled]}
                            onPress={handleContinue}
                            disabled={!selectedOption}
                        >
                            <LinearGradient
                                colors={buttonGradientColors}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.button}
                            >
                                <Text style={styles.buttonText}>Continue</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <View style={styles.alreadyAccountWrapper}>
                            <Text style={styles.alreadyAccountText}>Already have an account?</Text>
                            <TouchableOpacity onPress={handleAlreadyHaveAccount} activeOpacity={0.7}>
                                <Text style={styles.alreadyAccountLink}>Log in</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
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
        content: {
            flex: 1,
            paddingHorizontal: '24@s',
            paddingTop: '40@vs',
            paddingBottom: '32@vs',
            justifyContent: 'space-between',
        },
        topSection: {
            alignItems: "center",
            marginTop: '-10@vs',
            marginBottom: '24@vs',
        },
        illustration: {
            width: "90%",
            height: '170@vs',
            marginBottom: '12@vs',
        },
        title: {
            fontSize: '22@s',
            lineHeight: '28@vs',
            color: theme.textPrimary,
            fontFamily: "Poppins-SemiBold",
            textAlign: "center",
        },
        featuresSection: {
            marginTop: '8@vs',
            flex: 1,
            justifyContent: 'center',
            paddingBottom: '32@vs', // ensure CTA has breathing room
        },
        featureItem: {
            flexDirection: "row",
            alignItems: "flex-start",
            marginBottom: '20@vs',
            padding: '16@s',
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
            marginBottom: '4@vs',
        },
        featureDescription: {
            fontSize: '12@s',
            lineHeight: '16@vs',
            color: theme.textSecondary,
            fontFamily: "Poppins-Regular",
        },
        buttonWrapper: {
            marginTop: '24@vs',
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
            color: "#FFFFFF",
            fontFamily: "Poppins-SemiBold",
        },
        alreadyAccountWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: '16@vs',
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
