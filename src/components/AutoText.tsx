import React from 'react';
import { Text, TextProps, StyleSheet } from 'react-native';

interface AutoTextProps extends TextProps {
  numberOfLines?: number;
  minimumFontScale?: number;
}

export const AutoText: React.FC<AutoTextProps> = ({
  children,
  style,
  numberOfLines = 1,
  minimumFontScale = 0.7,
  ...props
}) => {
  return (
    <Text
      style={style}
      adjustsFontSizeToFit={true}
      numberOfLines={numberOfLines}
      minimumFontScale={minimumFontScale}
      {...props}
    >
      {children}
    </Text>
  );
};

