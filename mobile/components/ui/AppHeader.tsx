import { SymbolView } from 'expo-symbols';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { OFFLINE_ONLY } from '@/constants/appConfig';
import { useProcessingMode } from '@/context/ProcessingModeContext';
import { useTheme } from '@/context/ThemeContext';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  showThemeToggle?: boolean;
  showProcessingToggle?: boolean;
}

export default function AppHeader({
  title,
  subtitle,
  showThemeToggle = true,
  showProcessingToggle = !OFFLINE_ONLY,
}: AppHeaderProps) {
  const { theme, themeId, toggleTheme } = useTheme();
  const { processingMode, toggleProcessingMode } = useProcessingMode();

  return (
    <View style={styles.row}>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>{subtitle}</Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {showProcessingToggle ? (
          <Pressable
            style={[
              styles.processingToggle,
              {
                backgroundColor:
                  processingMode === 'local' ? theme.primaryMuted : theme.surfaceElevated,
                borderColor: processingMode === 'local' ? theme.primary : theme.border,
              },
            ]}
            onPress={toggleProcessingMode}
            accessibilityLabel={
              processingMode === 'local' ? 'Switch to backend processing' : 'Switch to local processing'
            }
          >
            <Text
              style={[
                styles.processingLabel,
                { color: processingMode === 'local' ? theme.primaryText : theme.textMuted },
              ]}
            >
              {processingMode === 'local' ? 'Local' : 'Backend'}
            </Text>
          </Pressable>
        ) : null}
        {showThemeToggle ? (
          <Pressable
            style={[
              styles.toggle,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
            onPress={toggleTheme}
            accessibilityLabel={themeId === 'violet' ? 'Switch to amber theme' : 'Switch to violet theme'}
          >
            <SymbolView
              name={(themeId === 'violet' ? 'sun.max.fill' : 'moon.stars.fill') as 'sun.max.fill'}
              tintColor={theme.primary}
              size={20}
            />
          </Pressable>
        ) : null}
      </View>
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
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, marginTop: 4, lineHeight: 20 },
  processingToggle: {
    minWidth: 72,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  processingLabel: { fontSize: 12, fontWeight: '700' },
  toggle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
