import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LOCAL_PIPELINE_BUILD } from '@/constants/localPipelineBuild';
import { useProcessingMode } from '@/context/ProcessingModeContext';
import { useTheme } from '@/context/ThemeContext';
import { checkHealthDetailed } from '@/services/api';
import { getApiBaseUrl } from '@/utils/apiConfig';
import { getJsBundleSource } from '@/utils/devBundleSource';

import Button from './Button';
import Chip from './Chip';
import MutedText from './MutedText';

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function SettingsSheet({ visible, onClose }: SettingsSheetProps) {
  const insets = useSafeAreaInsets();
  const { theme, themeId, setThemeId } = useTheme();
  const { processingMode, setProcessingMode, isLocalMode } = useProcessingMode();
  const [backendStatus, setBackendStatus] = useState('Not tested');
  const apiBase = getApiBaseUrl();

  async function handleTestBackend() {
    const result = await checkHealthDetailed();
    if (result.ok) {
      setBackendStatus(`OK (${result.status})`);
      Alert.alert('Backend connected', `${result.url}\n\n${result.body ?? ''}`);
      return;
    }
    setBackendStatus('Failed');
    Alert.alert(
      'Backend unreachable',
      `URL: ${result.url}\n` +
        (result.status ? `HTTP ${result.status}\n` : '') +
        (result.error ? `Error: ${result.error}\n\n` : '\n') +
        'Safari works but the app does not?\n' +
        '→ iPhone Settings → TuneScribe → enable Local Network\n' +
        '→ Settings → Privacy → Local Network → TuneScribe ON\n\n' +
        'Then restart the app and tap Test Backend again.'
    );
  }

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

          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Processing</Text>
          <View style={styles.row}>
            <Chip
              label="Local"
              selected={processingMode === 'local'}
              onPress={() => setProcessingMode('local')}
              style={styles.flex}
            />
            <Chip
              label="Backend"
              selected={processingMode === 'backend'}
              onPress={() => setProcessingMode('backend')}
              style={styles.flex}
            />
          </View>
          <MutedText>
            {isLocalMode
              ? 'Local mode runs transcription on your phone and falls back to the backend if needed.'
              : 'Backend mode sends audio to your TuneScribe server for processing.'}
          </MutedText>
          {isLocalMode ? (
            <MutedText subtle>
              {LOCAL_PIPELINE_BUILD} · {getJsBundleSource()}
            </MutedText>
          ) : null}

          <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Developer</Text>
          <MutedText style={styles.mono}>Backend: {apiBase}</MutedText>
          <MutedText>Status: {backendStatus}</MutedText>
          <Button label="Test Backend" variant="secondary" onPress={handleTestBackend} />

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
  mono: { fontSize: 12 },
  done: { marginTop: 8 },
});
