import React from 'react';
import { requireNativeComponent, ViewStyle, StyleProp, View } from 'react-native';

interface NativeGestureHandlerProps {
  style?: StyleProp<ViewStyle>;
  enablePanGesture?: boolean;
  enableTapGesture?: boolean;
  enableLongPressGesture?: boolean;
  onGestureEvent?: (event: {
    nativeEvent: {
      type: 'pan' | 'tap' | 'longPress';
      state: number;
      x: number;
      y: number;
      translationX?: number;
      translationY?: number;
      velocityX?: number;
      velocityY?: number;
      numberOfTaps?: number;
    };
  }) => void;
  children?: React.ReactNode;
}

const NativeGestureHandlerView = requireNativeComponent<NativeGestureHandlerProps>('NativeGestureHandlerView');

export const NativeGestureHandler: React.FC<NativeGestureHandlerProps> = ({
  style,
  enablePanGesture = false,
  enableTapGesture = false,
  enableLongPressGesture = false,
  onGestureEvent,
  children,
}) => {
  return (
    <NativeGestureHandlerView
      style={style}
      enablePanGesture={enablePanGesture}
      enableTapGesture={enableTapGesture}
      enableLongPressGesture={enableLongPressGesture}
      onGestureEvent={onGestureEvent}
    >
      {children}
    </NativeGestureHandlerView>
  );
};

// Export a GestureHandlerRootView component for compatibility with react-navigation
// This is a simple View wrapper that can contain children
export const GestureHandlerRootView: React.FC<{ children: React.ReactNode; style?: StyleProp<ViewStyle> }> = ({
  children,
  style,
}) => {
  return <View style={style}>{children}</View>;
};

export default NativeGestureHandler;



