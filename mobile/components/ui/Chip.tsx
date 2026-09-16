import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: string;
}

export default function Chip({
  label,
  selected = false,
  onPress,
  disabled,
  style,
  icon,
}: ChipProps) {
  const { theme } = useTheme();
  const iconColor = selected ? theme.chipTextActive : theme.chipText;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.chipBackgroundActive : theme.chipBackground,
          borderColor: selected ? theme.primary : theme.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {icon ? <SymbolView name={icon as 'mic.fill'} tintColor={iconColor} size={16} /> : null}
      <Text
        style={[
          styles.label,
          { color: selected ? theme.chipTextActive : theme.chipText },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  label: { fontWeight: '600', fontSize: 13, textAlign: 'center' },
});
