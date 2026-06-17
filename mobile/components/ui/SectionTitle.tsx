import { StyleSheet, Text } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface SectionTitleProps {
  children: string;
}

export default function SectionTitle({ children }: SectionTitleProps) {
  const { theme } = useTheme();
  return <Text style={[styles.title, { color: theme.text }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  title: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
});
