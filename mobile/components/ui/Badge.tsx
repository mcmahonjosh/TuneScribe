import { StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface BadgeProps {
  label: string;
  color?: string;
}

export default function Badge({ label, color }: BadgeProps) {
  const { theme } = useTheme();
  const backgroundColor = color ?? theme.textSubtle;

  return (
    <View style={[styles.badge, { backgroundColor }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
});
