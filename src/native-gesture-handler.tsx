// Native Gesture Handler Module
// This file provides compatibility with react-native-gesture-handler

import React from 'react';
import { requireNativeComponent, ViewStyle, StyleProp } from 'react-native';

// Use native components for proper ViewGroup support
const GestureHandlerRootViewNative = requireNativeComponent<any>('GestureHandlerRootView');
const PanGestureHandlerNative = requireNativeComponent<any>('PanGestureHandler');
const TapGestureHandlerNative = requireNativeComponent<any>('TapGestureHandler');

// Export GestureHandlerRootView as a native component that can contain children
export const GestureHandlerRootView: React.FC<{ 
  children: React.ReactNode; 
  style?: StyleProp<ViewStyle> 
}> = ({ children, style }) => {
  return <GestureHandlerRootViewNative style={style}>{children}</GestureHandlerRootViewNative>;
};

// Export gesture handlers as native components for compatibility
export const PanGestureHandler: React.FC<{ 
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  [key: string]: any;
}> = ({ children, style, ...props }) => {
  return <PanGestureHandlerNative style={style} {...props}>{children}</PanGestureHandlerNative>;
};

export const TapGestureHandler: React.FC<{ 
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  [key: string]: any;
}> = ({ children, style, ...props }) => {
  return <TapGestureHandlerNative style={style} {...props}>{children}</TapGestureHandlerNative>;
};

export const LongPressGestureHandler: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const Swipeable: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

export const DrawerLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Default export for 'react-native-gesture-handler' import
export default {
  GestureHandlerRootView,
  PanGestureHandler,
  TapGestureHandler,
  LongPressGestureHandler,
  Swipeable,
  DrawerLayout,
};



