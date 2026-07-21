import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import ProcessingStatus from '@/components/ProcessingStatus';
import RecordingControls from '@/components/RecordingControls';
import TranscriptionSettingsPanel from '@/components/TranscriptionSettingsPanel';
import { AppHeader, Card, Chip, MutedText, Screen, SectionTitle } from '@/components/ui';
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
  const [projectId, setProjectId] = useState(createProjectId);
  const projectIdRef = useRef(projectId);
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

  const now = () => new Date().toISOString();

  const resetForNewRecording = useCallback(() => {
    const nextId = createProjectId();
    projectIdRef.current = nextId;
    setProjectId(nextId);
    setIsRecording(false);
    setAudioPath(null);
    setStatus('idle');
    setProcessingStep('idle');
    setProcessingProgress(null);
    setErrorMessage(undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      // Tab screens stay mounted — mint a fresh project when returning after a completed run.
      if (status === 'complete') {
        resetForNewRecording();
      }
    }, [status, resetForNewRecording])
  );

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

  async function handleStart() {
    const granted = await requestRecordingPermissions();
    if (!granted) {
      Alert.alert('Permission required', 'Microphone access is needed to record audio.');
      return;
    }
    // Always start a new project so re-recording does not overwrite the previous one.
    const nextId = createProjectId();
    projectIdRef.current = nextId;
    setProjectId(nextId);
    setAudioPath(null);
    setErrorMessage(undefined);
    await startRecording(nextId, { preferWav: true });
    setIsRecording(true);
    setStatus('recording');
  }

  async function handleStop() {
    const activeId = projectIdRef.current;
    const path = await stopRecording(activeId, { preferWav: true });
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
    const activeId = projectIdRef.current;

    const project: Project = {
      id: activeId,
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
      setProcessingStep('decoding_audio');
      setProcessingProgress({ step: 'decoding_audio', fraction: 0 });
      setErrorMessage(undefined);

      const transcriptionMode = modeForInputType(inputType);
      const result = await transcribeProject({
        projectId: activeId,
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
      await updateProjectStatus(activeId, 'processing');

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
        processingModeUsed: result.processingModeUsed,
        errorMessage: result.errorMessage,
      };
      await saveProject(completed);
      setStatus('complete');
      setProcessingStep('complete');
      setProcessingProgress({ step: 'complete', fraction: 1 });
      router.push(`/project/${activeId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus('failed');
      setProcessingStep('failed');
      setProcessingProgress(null);
      setErrorMessage(message);
      await updateProjectStatus(activeId, 'failed', message);
      await saveProject({
        id: activeId,
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

      <Card style={styles.section}>
        <MutedText>
          Processing runs entirely on your device. Keep the app open while transcribing.
        </MutedText>
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
  chipRow: { flexDirection: 'row', gap: 10 },
  flexChip: { flex: 1 },
});
