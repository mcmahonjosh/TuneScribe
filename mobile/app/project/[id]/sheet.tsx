import * as FileSystem from 'expo-file-system/legacy';
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SheetMusicPlayer from '@/components/SheetMusicPlayer';
import { MutedText, Screen } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { getProject } from '@/storage/projectRepository';
import { readFileAsBase64 } from '@/utils/fileEncoding';
import {
  restorePortraitAfterTransition,
  unlockSheetOrientation,
} from '@/utils/sheetOrientation';
import { waitForValidWavFile } from '@/utils/wavValidation';

export default function ProjectSheetScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const router = useRouter();
  const { theme } = useTheme();
  const { width, height } = useWindowDimensions();
  const [sideways, setSideways] = useState(false);
  const [musicxmlContent, setMusicxmlContent] = useState<string | null>(null);
  const [midiBase64, setMidiBase64] = useState<string | null>(null);
  const [previewWavUri, setPreviewWavUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      void unlockSheetOrientation();
      return restorePortraitAfterTransition();
    }, [])
  );

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: !sideways,
      headerRight: () => (
        <Pressable
          onPress={() => setSideways(true)}
          hitSlop={12}
          accessibilityLabel="Landscape"
          style={{ paddingHorizontal: 8, paddingVertical: 6 }}
        >
          <Text style={{ color: theme.primary, fontWeight: '700', fontSize: 16 }}>Landscape</Text>
        </Pressable>
      ),
    });
  }, [navigation, sideways, theme.primary]);

  useEffect(() => {
    async function load() {
      if (!id) return;
      const data = await getProject(id);
      if (!data?.musicxmlPath) {
        setError('No sheet music for this project.');
        return;
      }

      const content = await FileSystem.readAsStringAsync(data.musicxmlPath);
      setMusicxmlContent(content);

      if (data.midiPath) {
        setMidiBase64(await readFileAsBase64(data.midiPath));
      }

      if (data.previewWavPath) {
        const ready = await waitForValidWavFile(data.previewWavPath, 4000);
        setPreviewWavUri(ready ? data.previewWavPath : null);
      }
    }
    void load();
  }, [id]);

  if (error) {
    return (
      <Screen style={styles.centered}>
        <MutedText>{error}</MutedText>
      </Screen>
    );
  }

  if (!musicxmlContent) {
    return (
      <Screen style={styles.centered}>
        <MutedText>Loading sheet music...</MutedText>
      </Screen>
    );
  }

  const player = (
    <SheetMusicPlayer
      variant="fullscreen"
      musicxmlContent={musicxmlContent}
      midiBase64={midiBase64}
      previewWavUri={previewWavUri}
      style={styles.player}
    />
  );

  if (sideways) {
    return (
      <View style={[styles.sidewaysRoot, { backgroundColor: theme.background }]}>
        <View
          style={[
            styles.sidewaysFrame,
            {
              width: height,
              height: width,
              top: (height - width) / 2,
              left: (width - height) / 2,
              backgroundColor: theme.background,
              paddingLeft: Math.max(insets.top, 8),
              paddingRight: Math.max(insets.bottom, 8),
            },
          ]}
        >
          <View style={styles.sidewaysBar}>
            <Pressable
              onPress={() => router.back()}
              hitSlop={8}
              style={[styles.sidewaysBtn, { borderColor: theme.border, backgroundColor: theme.surfaceElevated }]}
            >
              <Text style={[styles.sidewaysBtnText, { color: theme.text }]}>Back</Text>
            </Pressable>
            <Pressable
              onPress={() => setSideways(false)}
              hitSlop={8}
              style={[styles.sidewaysBtn, { borderColor: theme.primary, backgroundColor: theme.primary }]}
            >
              <Text style={[styles.sidewaysBtnText, { color: theme.primaryText }]}>Portrait</Text>
            </Pressable>
          </View>
          {player}
        </View>
      </View>
    );
  }

  return (
    <Screen
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        {
          paddingLeft: Math.max(insets.left, 8),
          paddingRight: Math.max(insets.right, 8),
        },
      ]}
    >
      {player}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 0, paddingBottom: 0 },
  content: { flex: 1, paddingBottom: 8, paddingHorizontal: 0 },
  player: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sidewaysRoot: { flex: 1, overflow: 'hidden' },
  sidewaysFrame: {
    position: 'absolute',
    transform: [{ rotate: '90deg' }],
  },
  sidewaysBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
  },
  sidewaysBtn: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  sidewaysBtnText: { fontSize: 14, fontWeight: '700' },
});
