import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTheme } from '@/context/ThemeContext';

import SettingsSheet from './SettingsSheet';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showSettings?: boolean;
}

export default function AppHeader({ title, subtitle, showSettings = true }: AppHeaderProps) {
  const { theme } = useTheme();
  const [settingsVisible, setSettingsVisible] = useState(false);

  return (
    <View style={styles.row}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      {showSettings ? (
        <Pressable
          style={[
            styles.toggle,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}
          onPress={() => setSettingsVisible(true)}
          accessibilityLabel="Open settings"
        >
          <SymbolView name={'gearshape.fill' as 'gearshape.fill'} tintColor={theme.primary} size={20} />
        </Pressable>
      ) : null}
      <SettingsSheet visible={settingsVisible} onClose={() => setSettingsVisible(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 12,
  },
  textBlock: { flex: 1 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  toggle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
