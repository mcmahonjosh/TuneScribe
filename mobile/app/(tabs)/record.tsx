import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import ProcessingStatus from '@/components/ProcessingStatus';
import RecordingControls from '@/components/RecordingControls';
import TranscriptionSettingsPanel from '@/components/TranscriptionSettingsPanel';
import { AppHeader, Button, Card, Chip, MutedText, Screen, SectionTitle } from '@/components/ui';
import { useProcessingMode } from '@/context/ProcessingModeContext';
import { checkHealthDetailed } from '@/services/api';
import { getApiBaseUrl } from '@/utils/apiConfig';
import {
  playAudio,
  requestRecordingPermissions,
  startRecording,
  stopRecording,
} from '@/services/audio';
import { transcribeProject } from '@/services/processing/transcribeProject';
import {
  PROCESSING_STEP_LABELS,
  type ProcessingProgress,
  type ProcessingStep,
} from '@/services/processing/types';
import { saveProject, updateProjectStatus } from '@/storage/projectRepository';
import { PianoOutputFormat, Project, ProjectStatus } from '@/types/project';
import {
  defaultSettingsForInputType,
  modeForInputType,
  TranscriptionSettings,
} from '@/types/transcriptionSettings';

function createProjectId(): string {
  return `project_${Date.now()}`;
}

export default function RecordScreen() {
  const router = useRouter();
  const { processingMode, isLocalMode } = useProcessingMode();
  const [projectId] = useState(createProjectId);
  const [isRecording, setIsRecording] = useState(false);
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [status, setStatus] = useState<ProjectStatus>('idle');
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');
  const [processingProgress, setProcessingProgress] = useState<ProcessingProgress | null>(null);
  const [inputType, setInputType] = useState<'piano' | 'vocal'>('piano');
  const [pianoOutputFormat, setPianoOutputFormat] = useState<PianoOutputFormat>('sheet_music');
  const [transcriptionSettings, setTranscriptionSettings] = useState<TranscriptionSettings>(
    () => defaultSettingsForInputType('piano')
  );
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [backendStatus, setBackendStatus] = useState<string>('Not tested');

  const now = () => new Date().toISOString();
  const apiBase = getApiBaseUrl();

  const PIANO_OUTPUT_OPTIONS: {
    id: PianoOutputFormat;
    label: string;
    hint: string;
  }[] = [
    {
      id: 'sheet_music',
      label: 'Sheet music',
      hint: 'Full note-for-note notation (current behavior).',
    },
    {
      id: 'chords',
      label: 'Chord progression',
      hint: 'Estimates the song’s chords — a good overview, not every note.',
    },
    {
      id: 'both',
      label: 'Both',
      hint: 'Generate notation and chords; switch views after transcribing.',
    },
  ];

  useEffect(() => {
    setTranscriptionSettings(defaultSettingsForInputType(inputType));
  }, [inputType]);

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

  async function handleStart() {
    const granted = await requestRecordingPermissions();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed to record audio.');
      return;
    }
    await startRecording(projectId, { preferWav: isLocalMode });
    setIsRecording(true);
    setStatus('recording');
    setErrorMessage(undefined);
  }

  async function handleStop() {
    const path = await stopRecording(projectId, { preferWav: isLocalMode });
    setAudioPath(path);
    setIsRecording(false);
    setStatus('idle');
  }

  async function handlePlayback() {
    if (!audioPath) return;
    await playAudio(audioPath);
  }

  async function handleSubmit() {
    if (!audioPath) return;

    const project: Project = {
      id: projectId,
      title: `Recording ${new Date().toLocaleString()}`,
      createdAt: now(),
      updatedAt: now(),
      status: 'uploading',
      inputType,
      audioPath,
    };
    await saveProject(project);

    try {
      setStatus('uploading');
      setProcessingStep(isLocalMode ? 'decoding_audio' : 'server_transcribe');
      setProcessingProgress(isLocalMode ? { step: 'decoding_audio', fraction: 0 } : null);
      setErrorMessage(undefined);

      const transcriptionMode = modeForInputType(inputType);
      const result = await transcribeProject({
        processingMode,
        projectId,
        audioUri: audioPath,
        filename: audioPath.endsWith('.wav') ? 'recording.wav' : 'recording.m4a',
        transcriptionMode,
        settings: transcriptionSettings,
        outputFormat: inputType === 'piano' ? pianoOutputFormat : 'sheet_music',
        onStep: setProcessingStep,
        onProgress: (progress) => {
          setProcessingStep(progress.step);
          setProcessingProgress(progress);
        },
      });

      setStatus('processing');
      await updateProjectStatus(projectId, 'processing');

      const completed: Project = {
        ...project,
        updatedAt: now(),
        status: 'complete',
        midiPath: result.midiPath,
        musicxmlPath: result.musicxmlPath,
        previewWavPath: result.previewWavPath,
        pdfPath: result.pdfPath,
        modelUsed: result.response.model_used,
        transcriptionMode: result.response.mode ?? transcriptionMode,
        pianoOutputFormat:
          inputType === 'piano'
            ? result.response.output_format ?? pianoOutputFormat
            : undefined,
        chordsPath: result.chordsPath,
        chordsPreviewWavPath: result.chordsPreviewWavPath,
        detectedKey: result.detectedKey,
        backendJobId: result.backendJobId,
        processingModeUsed: result.processingModeUsed,
        errorMessage: result.errorMessage,
      };
      await saveProject(completed);
      setStatus('complete');
      setProcessingStep('complete');
      setProcessingProgress({ step: 'complete', fraction: 1 });
      router.push(`/project/${projectId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus('failed');
      setProcessingStep('failed');
      setProcessingProgress(null);
      setErrorMessage(message);
      await updateProjectStatus(projectId, 'failed', message);
      await saveProject({
        id: projectId,
        title: `Recording ${new Date().toLocaleString()}`,
        createdAt: project.createdAt,
        updatedAt: now(),
        status: 'failed',
        inputType,
        audioPath,
        errorMessage: message,
      });
    }
  }

  const isSubmitting = status === 'uploading' || status === 'processing';

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      <AppHeader title="New Recording" subtitle="Record 15–60 seconds of solo piano or vocal audio." />

      {isLocalMode ? (
        <Card style={styles.section}>
          <MutedText>
            Local mode runs Basic Pitch on your phone. Keep the app open while processing. Falls
            back to the backend if on-device transcription fails.
          </MutedText>
        </Card>
      ) : null}

      <Card style={styles.section}>
        <MutedText style={styles.mono}>Backend: {apiBase}</MutedText>
        <MutedText>Status: {backendStatus}</MutedText>
        <Button label="Test Backend" variant="secondary" onPress={handleTestBackend} />
      </Card>

      <View style={styles.chipRow}>
        {(['piano', 'vocal'] as const).map((type) => (
          <Chip
            key={type}
            label={type === 'piano' ? 'Piano' : 'Vocal'}
            selected={inputType === type}
            onPress={() => setInputType(type)}
            disabled={isRecording || isSubmitting}
            style={styles.flexChip}
          />
        ))}
      </View>

      {inputType === 'piano' && (
        <Card style={styles.section}>
          <SectionTitle>Piano output</SectionTitle>
          <View style={styles.chipRow}>
            {PIANO_OUTPUT_OPTIONS.map((option) => (
              <Chip
                key={option.id}
                label={option.label}
                selected={pianoOutputFormat === option.id}
                onPress={() => setPianoOutputFormat(option.id)}
                disabled={isRecording || isSubmitting}
                style={styles.flexChip}
              />
            ))}
          </View>
          <MutedText>
            {PIANO_OUTPUT_OPTIONS.find((option) => option.id === pianoOutputFormat)?.hint}
          </MutedText>
          <MutedText subtle>
            Chord detection works best on clear piano recordings. Vocal mode always uses sheet
            music.
          </MutedText>
        </Card>
      )}

      <TranscriptionSettingsPanel
        inputType={inputType}
        settings={transcriptionSettings}
        onChange={setTranscriptionSettings}
        disabled={isRecording || isSubmitting}
      />

      {isSubmitting || status === 'failed' ? (
        <ProcessingStatus
          status={status}
          errorMessage={errorMessage}
          processingStepLabel={PROCESSING_STEP_LABELS[processingStep]}
          progressFraction={processingProgress?.fraction}
          debugCheckpoint={processingProgress?.checkpoint}
        />
      ) : (
        <RecordingControls
          isRecording={isRecording}
          hasRecording={!!audioPath}
          onStart={handleStart}
          onStop={handleStop}
          onPlayback={handlePlayback}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 40 },
  section: { gap: 8 },
  mono: { fontSize: 12 },
  chipRow: { flexDirection: 'row', gap: 10 },
  flexChip: { flex: 1 },
});
