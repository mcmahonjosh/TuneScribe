import { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface CardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  elevated?: boolean;
}

export default function Card({ children, style, elevated = false }: CardProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated ? theme.surfaceElevated : theme.surface,
          borderColor: theme.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
  },
});
