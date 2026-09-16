import { type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useTheme } from '@/context/ThemeContext';

interface InfoBannerProps {
  children: ReactNode;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

export default function InfoBanner({
  children,
  icon = 'info.circle.fill',
  style,
}: InfoBannerProps) {
  const { theme } = useTheme();

  return (
    <View
      style={[
        styles.banner,
        { backgroundColor: theme.banner, borderColor: theme.border },
        style,
      ]}
    >
      <SymbolView name={icon as 'info.circle.fill'} tintColor={theme.bannerText} size={18} />
      <Text style={[styles.text, { color: theme.bannerText }]}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
  },
  text: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '500' },
});
