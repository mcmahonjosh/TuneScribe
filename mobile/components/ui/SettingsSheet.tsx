import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '@/context/ThemeContext';

import Button from './Button';
import Chip from './Chip';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme, themeId, setThemeId } = useTheme();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close settings" />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.surface,
              borderColor: theme.border,
              paddingBottom: Math.max(insets.bottom, 20),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>Settings</Text>

          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Appearance</Text>
          <View style={styles.row}>
            <Chip
              label="Violet"
              selected={themeId === 'violet'}
              onPress={() => setThemeId('violet')}
              style={styles.flex}
            />
            <Chip
              label="Amber"
              selected={themeId === 'amber'}
              onPress={() => setThemeId('amber')}
              style={styles.flex}
            />
          </View>

          <Button label="Done" onPress={onClose} style={styles.done} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    gap: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 8,
  },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.4 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 4,
  },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
  done: { marginTop: 8 },
});
