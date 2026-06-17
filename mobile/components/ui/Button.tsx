import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '@/context/ThemeContext';
import type { AppTheme } from '@/constants/theme';

export type ButtonVariant = 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'ghost';

interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

function variantColors(theme: AppTheme, variant: ButtonVariant) {
  switch (variant) {
    case 'success':
      return { bg: theme.success, text: '#0a1a0f', border: theme.success };
    case 'warning':
      return { bg: theme.warning, text: '#1a1208', border: theme.warning };
    case 'danger':
      return { bg: theme.errorMuted, text: theme.error, border: theme.error };
    case 'ghost':
      return { bg: 'transparent', text: theme.textMuted, border: theme.border };
    case 'secondary':
      return { bg: theme.surfaceElevated, text: theme.text, border: theme.border };
    default:
      return { bg: theme.primary, text: theme.primaryText, border: theme.primary };
  }
}

export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ButtonProps) {
  const { theme } = useTheme();
  const colors = variantColors(theme, variant);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 15, fontWeight: '600' },
});
