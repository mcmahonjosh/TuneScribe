import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/context/ThemeContext';

interface SelectableTileProps {
  label: string;
  icon: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function SelectableTile({
  label,
  icon,
  selected = false,
  onPress,
  disabled,
  style,
}: SelectableTileProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: selected ? theme.banner : theme.surface,
          borderColor: selected ? theme.primary : theme.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
    >
      <SymbolView
        name={icon as 'music.note'}
        tintColor={selected ? theme.primary : theme.textMuted}
        size={22}
      />
      <Text
        style={[
          styles.label,
          { color: selected ? theme.text : theme.textMuted },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minHeight: 92,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 16,
  },
});
