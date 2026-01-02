import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface AutoTextProps extends TextProps {
  numberOfLines?: number;
  minimumFontScale?: number;
  children?: React.ReactNode;
  style?: any;
}

export const AutoText: React.FC<AutoTextProps> = ({
  children,
  style,
  numberOfLines,
  minimumFontScale = 0.7,
  ...props
}) => {
  // Build text props - only include numberOfLines if it's explicitly provided
  const textProps: any = {
    style,
    ...props,
  };
  
  // Only add numberOfLines and adjustsFontSizeToFit if numberOfLines is explicitly set
  if (numberOfLines !== undefined) {
    textProps.numberOfLines = numberOfLines;
    textProps.adjustsFontSizeToFit = numberOfLines > 0;
    textProps.minimumFontScale = minimumFontScale;
  }
  
  return (
    <Text {...textProps}>
      {children}
    </Text>
  );
};

