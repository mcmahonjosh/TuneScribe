import { type ReactNode } from 'react';
import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface MutedTextProps {
  children: ReactNode;
  style?: StyleProp<TextStyle>;
  subtle?: boolean;
}

export default function MutedText({ children, style, subtle = false }: MutedTextProps) {
  const { theme } = useTheme();
  return (
    <Text
      style={[
        styles.text,
        { color: subtle ? theme.textSubtle : theme.textMuted },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  text: { fontSize: 13, lineHeight: 18 },
});
