import React from 'react';
import LinearGradient from 'react-native-linear-gradient';
import { ViewStyle, StyleProp } from 'react-native';

interface NativeLinearGradientProps {
  style?: StyleProp<ViewStyle>;
  colors: string[];
  startPoint?: { x: number; y: number };
  endPoint?: { x: number; y: number };
  locations?: number[];
  children?: React.ReactNode;
}

export const NativeLinearGradient: React.FC<NativeLinearGradientProps> = ({
  style,
  colors,
  startPoint = { x: 0, y: 0 },
  endPoint = { x: 1, y: 1 },
  locations,
  children,
}) => {
  return (
    <LinearGradient
      style={style}
      colors={colors}
      start={[startPoint.x, startPoint.y]}
      end={[endPoint.x, endPoint.y]}
      locations={locations}
    >
      {children}
    </LinearGradient>
  );
};

export default NativeLinearGradient;
