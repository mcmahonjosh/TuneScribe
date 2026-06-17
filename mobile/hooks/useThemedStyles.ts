import { useMemo } from 'react';
import { StyleSheet, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import type { AppTheme } from '@/constants/theme';

type NamedStyles<T> = {
  [P in keyof T]: ViewStyle | TextStyle | ImageStyle;
};

export function useThemedStyles<T extends NamedStyles<T>>(
  factory: (theme: AppTheme) => T
): T {
  const { theme } = useTheme();
  return useMemo(() => StyleSheet.create(factory(theme)), [factory, theme]);
}
