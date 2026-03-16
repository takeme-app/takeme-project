import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

const fontByWeight: Record<string, string> = {
  '400': 'Inter_400Regular',
  '600': 'Inter_600SemiBold',
  '700': 'Inter_700Bold',
  normal: 'Inter_400Regular',
  bold: 'Inter_700Bold',
};

function getInterFontFamily(style: TextProps['style']): string {
  const flat = StyleSheet.flatten(Array.isArray(style) ? style : style ? [style] : []);
  const weight = flat?.fontWeight as string | undefined;
  if (weight !== undefined && weight !== null) {
    const key = typeof weight === 'number' ? String(weight) : weight;
    if (fontByWeight[key]) return fontByWeight[key];
  }
  return 'Inter_400Regular';
}

export function Text({ style, ...props }: TextProps) {
  const fontFamily = getInterFontFamily(style);
  return <RNText style={[{ fontFamily }, style]} {...props} />;
}
