import React, { useEffect, useRef } from 'react';
import { NativeModules, NativeEventEmitter, Platform, View, ViewStyle, StyleProp } from 'react-native';

const { KeyboardControllerModule } = NativeModules;

interface KeyboardProviderProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const KeyboardProvider: React.FC<KeyboardProviderProps> = ({ children, style }) => {
  const eventEmitterRef = useRef<NativeEventEmitter | null>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    if (Platform.OS === 'android' && KeyboardControllerModule) {
      try {
        // Enable keyboard controller on Android
        KeyboardControllerModule.setEnabled(true);
        
        // Set up event listener for keyboard changes
        eventEmitterRef.current = new NativeEventEmitter(KeyboardControllerModule);
        
        subscriptionRef.current = eventEmitterRef.current.addListener(
          'keyboardDidChangeFrame',
          (event: { visible: boolean; height: number }) => {
            // Handle keyboard events if needed
            // This can be extended to provide keyboard state to child components
            if (__DEV__) {
              console.log('Keyboard event:', event);
            }
          }
        );
      } catch (error) {
        console.warn('Error setting up keyboard controller:', error);
      }

      return () => {
        try {
          if (subscriptionRef.current) {
            subscriptionRef.current.remove();
            subscriptionRef.current = null;
          }
          if (Platform.OS === 'android' && KeyboardControllerModule) {
            KeyboardControllerModule.setEnabled(false);
          }
        } catch (error) {
          console.warn('Error cleaning up keyboard controller:', error);
        }
      };
    }
  }, []);

  // On iOS, keyboard handling is automatic, so we just return children
  // On Android, we wrap in a View to ensure proper layout
  if (Platform.OS === 'ios') {
    return <>{children}</>;
  }

  return <View style={[{ flex: 1 }, style]}>{children}</View>;
};

// Export dismissKeyboard function for convenience
export const dismissKeyboard = (): Promise<boolean> => {
  if (KeyboardControllerModule?.dismissKeyboard) {
    return KeyboardControllerModule.dismissKeyboard();
  }
  return Promise.resolve(false);
};

export default KeyboardProvider;





