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
import { getFileDownloadUrl } from '@/services/api';
import { playAudio, stopAudioPlayback } from '@/services/audio';
import { deleteProjectFiles, downloadFileToProjectIfOk } from '@/services/files';
import { deleteProject, getProject, saveProject } from '@/storage/projectRepository';
import { ChordProgressionData, Project } from '@/types/project';
import { readFileAsBase64 } from '@/utils/fileEncoding';
import { isValidWavFile, removeInvalidPreviewWav } from '@/utils/wavValidation';

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
        await removeInvalidPreviewWav(data.previewWavPath);
        if (!(await isValidWavFile(data.previewWavPath))) {
          data = { ...data, previewWavPath: undefined };
        }
      }

      if (data && !data.previewWavPath && data.backendJobId) {
        const previewWavPath = await downloadFileToProjectIfOk(
          data.id,
          'preview.wav',
          getFileDownloadUrl(`/files/${data.backendJobId}/preview.wav`)
        );
        if (previewWavPath && (await isValidWavFile(previewWavPath))) {
          data = {
            ...data,
            previewWavPath,
            updatedAt: new Date().toISOString(),
          };
          await saveProject(data);
        }
      }

      if (data && !data.pdfPath && data.backendJobId && data.inputType === 'sheet') {
        const pdfPath = await downloadFileToProjectIfOk(
          data.id,
          'output.pdf',
          getFileDownloadUrl(`/files/${data.backendJobId}/output.pdf`)
        );
        if (pdfPath) {
          data = { ...data, pdfPath, updatedAt: new Date().toISOString() };
          await saveProject(data);
        }
      }

      if (data && !data.midiPath && data.backendJobId && data.inputType === 'sheet') {
        const midiPath = await downloadFileToProjectIfOk(
          data.id,
          'preview.mid',
          getFileDownloadUrl(`/files/${data.backendJobId}/preview.mid`)
        );
        if (midiPath) {
          data = { ...data, midiPath, updatedAt: new Date().toISOString() };
          await saveProject(data);
        }
      }

      if (data && !data.chordsPath && data.backendJobId) {
        const chordsPath = await downloadFileToProjectIfOk(
          data.id,
          'chords.json',
          getFileDownloadUrl(`/files/${data.backendJobId}/chords.json`)
        );
        if (chordsPath) {
          data = { ...data, chordsPath, updatedAt: new Date().toISOString() };
          await saveProject(data);
        }
      }

      if (data && !data.chordsPreviewWavPath && data.backendJobId) {
        const chordsPreviewWavPath = await downloadFileToProjectIfOk(
          data.id,
          'chords_preview.wav',
          getFileDownloadUrl(`/files/${data.backendJobId}/chords_preview.wav`)
        );
        if (chordsPreviewWavPath) {
          data = { ...data, chordsPreviewWavPath, updatedAt: new Date().toISOString() };
          await saveProject(data);
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
    await Sharing.shareAsync(path);
  }

  async function handleExportPdf() {
    if (!project) return;

    let pdfPath = project.pdfPath;
    if (!pdfPath && project.backendJobId) {
      pdfPath = await downloadFileToProjectIfOk(
        project.id,
        'output.pdf',
        getFileDownloadUrl(`/files/${project.backendJobId}/output.pdf`)
      );
      if (pdfPath) {
        const updated = { ...project, pdfPath, updatedAt: new Date().toISOString() };
        await saveProject(updated);
        setProject(updated);
      }
    }

    if (!pdfPath) {
      Alert.alert(
        'PDF unavailable',
        'Install MuseScore on the backend PC to generate PDF export, or share the MusicXML file instead.'
      );
      return;
    }

    await shareFile(pdfPath, 'PDF');
  }

  async function ensureChordPreviewPath(): Promise<string | undefined> {
    if (!project) {
      return undefined;
    }
    if (project.chordsPreviewWavPath) {
      return project.chordsPreviewWavPath;
    }
    if (!project.backendJobId) {
      return undefined;
    }
    const chordsPreviewWavPath = await downloadFileToProjectIfOk(
      project.id,
      'chords_preview.wav',
      getFileDownloadUrl(`/files/${project.backendJobId}/chords_preview.wav`)
    );
    if (!chordsPreviewWavPath) {
      return undefined;
    }
    const updated = {
      ...project,
      chordsPreviewWavPath,
      updatedAt: new Date().toISOString(),
    };
    await saveProject(updated);
    setProject(updated);
    return chordsPreviewWavPath;
  }

  async function handlePlayOriginal() {
    if (!project?.audioPath) return;
    sheetPlayerRef.current?.stop();
    chordPlayerRef.current?.stop();
    await playAudio(project.audioPath);
  }

  async function handlePlayPreview() {
    if (!project?.previewWavPath) {
      Alert.alert(
        'Preview unavailable',
        'Re-transcribe this recording to generate preview audio.'
      );
      return;
    }
    sheetPlayerRef.current?.stop();
    chordPlayerRef.current?.stop();
    await playAudio(project.previewWavPath);
  }

  async function handlePlayChords() {
    if (!project || !chordData) {
      return;
    }
    setDetailView('chords');
    if (!project.chordsPreviewWavPath) {
      const path = await ensureChordPreviewPath();
      if (!path) {
        Alert.alert(
          'Chord playback unavailable',
          'This project does not have chord audio yet. Re-transcribe with Chord progression or Both selected on the Record tab.'
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
            {(project.pdfPath || project.inputType === 'sheet') && (
              <Button
                label={project.pdfPath ? 'Export PDF' : 'Download PDF'}
                variant="secondary"
                onPress={handleExportPdf}
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
