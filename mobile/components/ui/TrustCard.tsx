import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { useProcessingMode } from '@/context/ProcessingModeContext';
import { useTheme } from '@/context/ThemeContext';

interface TrustCardProps {
  style?: StyleProp<ViewStyle>;
  onPress?: () => void;
}

export default function TrustCard({ style, onPress }: TrustCardProps) {
  const { theme } = useTheme();
  const { isLocalMode } = useProcessingMode();

  const title = isLocalMode ? '100% Private & On-Device' : 'On-device transcription available';
  const body = isLocalMode
    ? 'Your audio, projects, and transcriptions stay on this device.'
    : 'Switch to Local in Settings to keep audio on your phone. Backend mode sends audio to your server for processing.';

  const content = (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
        style,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: theme.banner }]}>
        <SymbolView name={'lock.fill' as 'lock.fill'} tintColor={theme.primary} size={18} />
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
        <Text style={[styles.body, { color: theme.textMuted }]}>{body}</Text>
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 18,
    borderWidth: 1,
    padding: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textBlock: { flex: 1, gap: 2 },
  title: { fontSize: 14, fontWeight: '700' },
  body: { fontSize: 12, lineHeight: 17 },
});
