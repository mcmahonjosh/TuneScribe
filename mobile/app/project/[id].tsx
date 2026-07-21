import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { Audio } from 'expo-av';

import ChordProgressionView, {
  ChordPlaybackState,
  ChordProgressionViewHandle,
} from '@/components/ChordProgressionView';
import ProcessingStatus from '@/components/ProcessingStatus';
import SheetMusicPlayer, {
  SheetMusicPlayerHandle,
  SheetPlaybackState,
} from '@/components/SheetMusicPlayer';
import { Button, Chip, MutedText, Screen, SectionTitle } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { playAudio, stopAudioPlayback } from '@/services/audio';
import { deleteProjectFiles } from '@/services/files';
import { deleteProject, getProject } from '@/storage/projectRepository';
import { ChordProgressionData, Project } from '@/types/project';
import { readFileAsBase64 } from '@/utils/fileEncoding';
import { isValidWavFile, waitForValidWavFile } from '@/utils/wavValidation';

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [project, setProject] = useState<Project | null>(null);
  const [musicxmlContent, setMusicxmlContent] = useState<string | null>(null);
  const [chordData, setChordData] = useState<ChordProgressionData | null>(null);
  const [detailView, setDetailView] = useState<'chords' | 'sheet'>('sheet');
  const [midiBase64, setMidiBase64] = useState<string | null>(null);
  const [sheetPlaybackState, setSheetPlaybackState] = useState<SheetPlaybackState>('idle');
  const [chordPlaybackState, setChordPlaybackState] = useState<ChordPlaybackState>('idle');
  const [pendingChordPlay, setPendingChordPlay] = useState(false);
  const sheetPlayerRef = useRef<SheetMusicPlayerHandle>(null);
  const chordPlayerRef = useRef<ChordProgressionViewHandle>(null);
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => ({
    title: { fontSize: 22, fontWeight: '700' as const, color: t.text, marginBottom: 8 },
    keyBanner: {
      backgroundColor: t.banner,
      borderRadius: 12,
      padding: 12,
      marginTop: 8,
      borderWidth: 1,
      borderColor: t.border,
    },
    keyBannerText: { fontSize: 15, fontWeight: '600' as const, color: t.bannerText, textAlign: 'center' as const },
    compareHint: { fontSize: 14, color: t.textMuted, marginTop: 4, lineHeight: 20 },
    actions: { gap: 10, marginTop: 16 },
    previewSection: { marginTop: 24, gap: 12 },
    viewToggleRow: { flexDirection: 'row' as const, gap: 8, marginBottom: 4 },
    viewChip: { flex: 1 },
    meta: { marginTop: 16, color: t.textMuted, fontSize: 13 },
    centered: { flex: 1, alignItems: 'center' as const, justifyContent: 'center' as const },
  }));

  useEffect(() => {
    if (!pendingChordPlay || !project?.chordsPreviewWavPath || !chordData) {
      return;
    }
    const chordsViewVisible = detailView === 'chords' || !musicxmlContent;
    if (!chordsViewVisible) {
      return;
    }

    setPendingChordPlay(false);
    sheetPlayerRef.current?.stop();
    void stopAudioPlayback().then(() => {
      void chordPlayerRef.current?.play();
    });
  }, [
    pendingChordPlay,
    project?.chordsPreviewWavPath,
    chordData,
    detailView,
    musicxmlContent,
  ]);

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    }).catch(() => {
      // Best-effort audio session for preview playback.
    });
  }, []);

  useEffect(() => {
    async function load() {
      if (!id) return;
      let data = await getProject(id);
      if (data?.previewWavPath) {
        const ready = await waitForValidWavFile(data.previewWavPath, 8000);
        if (!ready) {
          data = { ...data, previewWavPath: undefined };
        }
      }

      if (data?.chordsPreviewWavPath) {
        const chordsReady = await waitForValidWavFile(data.chordsPreviewWavPath, 4000);
        if (!chordsReady) {
          data = { ...data, chordsPreviewWavPath: undefined };
        }
      }

      setProject(data);
      setDetailView(data?.pianoOutputFormat === 'chords' ? 'chords' : 'sheet');

      if (data?.musicxmlPath) {
        const content = await FileSystem.readAsStringAsync(data.musicxmlPath);
        setMusicxmlContent(content);
      } else {
        setMusicxmlContent(null);
      }

      if (data?.chordsPath) {
        try {
          const raw = await FileSystem.readAsStringAsync(data.chordsPath);
          setChordData(JSON.parse(raw) as ChordProgressionData);
        } catch {
          setChordData(null);
        }
      } else {
        setChordData(null);
      }

      if (data?.midiPath) {
        const midi = await readFileAsBase64(data.midiPath);
        setMidiBase64(midi);
      } else {
        setMidiBase64(null);
      }
    }
    load();
  }, [id]);

  async function shareFile(path: string | undefined, label: string) {
    if (!path) {
      Alert.alert('Not available', `${label} file was not generated.`);
      return;
    }
    const canShare = await Sharing.isAvailableAsync();
    if (!canShare) {
      Alert.alert('Sharing unavailable', `File saved at: ${path}`);
      return;
    }

    const lower = path.toLowerCase();
    const stamp = Date.now();
    let shareUri = path;
    let mimeType: string | undefined;
    let uti: string | undefined;

    if (lower.endsWith('.musicxml') || lower.endsWith('.xml')) {
      const dest = `${FileSystem.cacheDirectory}TuneScribe_${stamp}.musicxml`;
      await FileSystem.copyAsync({ from: path, to: dest });
      shareUri = dest;
      mimeType = 'application/vnd.recordare.musicxml+xml';
      uti = 'public.xml';
    } else if (lower.endsWith('.mid') || lower.endsWith('.midi')) {
      const dest = `${FileSystem.cacheDirectory}TuneScribe_${stamp}.mid`;
      await FileSystem.copyAsync({ from: path, to: dest });
      shareUri = dest;
      mimeType = 'audio/midi';
      uti = 'public.midi-audio';
    } else if (lower.endsWith('.json')) {
      mimeType = 'application/json';
      uti = 'public.json';
    }

    await Sharing.shareAsync(shareUri, {
      mimeType,
      UTI: uti,
      dialogTitle: `Export ${label}`,
    });
  }

  function ensureChordPreviewPath(): string | undefined {
    return project?.chordsPreviewWavPath;
  }

  async function handlePlayOriginal() {
    if (!project?.audioPath) return;
    sheetPlayerRef.current?.stop();
    chordPlayerRef.current?.stop();
    await playAudio(project.audioPath);
  }

  async function handlePlayPreview() {
    const path = project?.previewWavPath;
    if (!path || !(await isValidWavFile(path))) {
      Alert.alert(
        'Preview unavailable',
        'Preview audio was not saved for this project. Sheet music and exports still work.'
      );
      return;
    }
    sheetPlayerRef.current?.stop();
    chordPlayerRef.current?.stop();
    await playAudio(path);
  }

  async function handlePlayChords() {
    if (!project || !chordData) {
      return;
    }
    setDetailView('chords');
    if (!project.chordsPreviewWavPath) {
      const path = ensureChordPreviewPath();
      if (!path) {
        Alert.alert(
          'Chord playback unavailable',
          'This project does not have chord audio yet. Record again with Chord progression or Both selected on the Record tab.'
        );
        return;
      }
    }
    setPendingChordPlay(true);
  }

  async function handlePauseChords() {
    await chordPlayerRef.current?.pause();
  }

  async function handleResumeChords() {
    await chordPlayerRef.current?.resume();
  }

  async function handleStopChords() {
    await chordPlayerRef.current?.stop();
  }

  async function handlePauseSheetMusic() {
    sheetPlayerRef.current?.pause();
  }

  async function handleResumeSheetMusic() {
    sheetPlayerRef.current?.resume();
  }

  async function handleStopSheetMusic() {
    sheetPlayerRef.current?.stop();
  }

  async function handleDelete() {
    if (!project) return;
    Alert.alert('Delete project?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteProjectFiles(project.id);
          await deleteProject(project.id);
          router.replace('/(tabs)');
        },
      },
    ]);
  }

  if (!project) {
    return (
      <Screen style={styles.centered}>
        <MutedText>Loading project...</MutedText>
      </Screen>
    );
  }

  const sheetIsPlaying = sheetPlaybackState === 'playing';
  const sheetIsPaused = sheetPlaybackState === 'paused';
  const sheetIsActive = sheetIsPlaying || sheetIsPaused;
  const chordIsPlaying = chordPlaybackState === 'playing';
  const chordIsPaused = chordPlaybackState === 'paused';
  const chordIsActive = chordIsPlaying || chordIsPaused;
  const hasChords = Boolean(chordData);
  const hasSheet = Boolean(musicxmlContent);
  const showViewToggle = hasChords && hasSheet;
  const showNotePreview =
    Boolean(project.previewWavPath) &&
    project.inputType !== 'sheet' &&
    (hasSheet || project.pianoOutputFormat !== 'chords');

  return (
    <Screen scroll contentContainerStyle={{ gap: 16, paddingBottom: 40 }}>
      <Text style={styles.title}>{project.title}</Text>
      <ProcessingStatus status={project.status} errorMessage={project.errorMessage} />

      {project.status === 'complete' && (
        <>
          {project.inputType === 'sheet' && project.sourceKeyDetected && project.targetKey && (
            <View style={styles.keyBanner}>
              <Text style={styles.keyBannerText}>
                {project.sourceKeyDetected} → {project.targetKey}
              </Text>
            </View>
          )}

          {project.inputType !== 'sheet' && (
            <Text style={styles.compareHint}>
              {hasChords
                ? 'Play Chords for block-chord playback with highlights. Play Notes plays every transcribed note.'
                : 'Play Original to hear your recording. Use Play in the Sheet Music section for audio with note highlights, or Play Notes for audio only.'}
            </Text>
          )}

          <View style={styles.actions}>
            {project.audioPath && (
              <Button label="Play Original" onPress={handlePlayOriginal} />
            )}
            {hasChords && project.inputType !== 'sheet' && (
              <Button label="▶ Play Chords" onPress={() => void handlePlayChords()} />
            )}
            {chordIsPlaying && (
              <Button label="⏸ Pause Chords" variant="warning" onPress={() => void handlePauseChords()} />
            )}
            {chordIsPaused && (
              <Button label="▶ Resume Chords" onPress={() => void handleResumeChords()} />
            )}
            {chordIsActive && (
              <Button label="■ Stop Chords" variant="secondary" onPress={() => void handleStopChords()} />
            )}
            {showNotePreview && (
              <Button label="▶ Play Notes" variant="success" onPress={handlePlayPreview} />
            )}
            {sheetIsPlaying && (
              <Button label="⏸ Pause Sheet" variant="warning" onPress={handlePauseSheetMusic} />
            )}
            {sheetIsPaused && (
              <Button label="▶ Resume Sheet" variant="success" onPress={handleResumeSheetMusic} />
            )}
            {sheetIsActive && (
              <Button label="■ Stop Sheet" variant="secondary" onPress={handleStopSheetMusic} />
            )}
            {project.midiPath && (
              <Button label="Export MIDI" variant="secondary" onPress={() => shareFile(project.midiPath, 'MIDI')} />
            )}
            {project.musicxmlPath && (
              <Button
                label="Export MusicXML"
                variant="secondary"
                onPress={() => shareFile(project.musicxmlPath, 'MusicXML')}
              />
            )}
            {project.chordsPath && (
              <Button
                label="Export Chords"
                variant="secondary"
                onPress={() => shareFile(project.chordsPath, 'Chords JSON')}
              />
            )}
          </View>

          {(hasChords || hasSheet) && (
            <View style={styles.previewSection}>
              {showViewToggle && (
                <View style={styles.viewToggleRow}>
                  <Chip
                    label="Chords"
                    selected={detailView === 'chords'}
                    onPress={() => setDetailView('chords')}
                    style={styles.viewChip}
                  />
                  <Chip
                    label="Sheet music"
                    selected={detailView === 'sheet'}
                    onPress={() => setDetailView('sheet')}
                    style={styles.viewChip}
                  />
                </View>
              )}

              {hasChords && (detailView === 'chords' || !hasSheet) && chordData && (
                <>
                  <SectionTitle>Chord Progression</SectionTitle>
                  <ChordProgressionView
                    ref={chordPlayerRef}
                    data={chordData}
                    previewUri={project.chordsPreviewWavPath}
                    onPlaybackStateChange={setChordPlaybackState}
                  />
                </>
              )}

              {hasSheet && (detailView === 'sheet' || !hasChords) && musicxmlContent && (
                <>
                  <SectionTitle>Sheet Music</SectionTitle>
                  <SheetMusicPlayer
                    ref={sheetPlayerRef}
                    musicxmlContent={musicxmlContent}
                    midiBase64={midiBase64}
                    previewWavUri={project.previewWavPath}
                    onPlaybackStateChange={setSheetPlaybackState}
                  />
                </>
              )}
            </View>
          )}

          {(project.modelUsed || project.transcriptionMode || project.detectedKey) && (
            <Text style={styles.meta}>
              {project.modelUsed ? `Model: ${project.modelUsed}` : ''}
              {project.transcriptionMode
                ? `${project.modelUsed ? ' · ' : ''}Mode: ${project.transcriptionMode}`
                : ''}
              {project.detectedKey
                ? `${project.modelUsed || project.transcriptionMode ? ' · ' : ''}Key: ${project.detectedKey}`
                : ''}
            </Text>
          )}
        </>
      )}

      <Button label="Delete Project" variant="danger" onPress={handleDelete} style={{ marginTop: 16 }} />
    </Screen>
  );
}
