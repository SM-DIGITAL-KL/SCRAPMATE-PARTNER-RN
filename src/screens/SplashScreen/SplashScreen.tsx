import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, Animated, Text } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useTheme } from '../../components/ThemeProvider';

const SplashScreen: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const { theme } = useTheme();
  const [fadeAnim] = useState(new Animated.Value(1)); // Start visible

  useEffect(() => {
    // Hide splash screen after 2 seconds
    const timer = setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        onFinish();
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <Animated.View
      style={[
        styles.container,
        {
          backgroundColor: theme.background,
          opacity: fadeAnim,
        },
      ]}
    >
      <View style={styles.logoContainer}>
        <Image
          source={require('../../assets/images/logoDark.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Image
          source={require('../../assets/images/LogoText.png')}
          style={styles.logoText}
          resizeMode="contain"
        />
        <View style={styles.gradientContainer}>
          <LinearGradient
            colors={['#2E7D32', '#66BB6A', '#4CAF50']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          >
            <Text style={styles.businessText}>
              Partner
            </Text>
          </LinearGradient>
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 160,
    height: 160,
    marginBottom: 16,
  },
  logoText: {
    width: 200,
    height: 48,
    marginBottom: 8,
  },
  gradientContainer: {
    overflow: 'hidden',
    borderRadius: 4,
  },
  gradient: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  businessText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 1.5,
    textAlign: 'center',
    color: '#FFFFFF',
  },
});

export default SplashScreen;

