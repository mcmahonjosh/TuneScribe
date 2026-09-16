import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';

import KeyPicker from '@/components/KeyPicker';
import ProcessingStatus from '@/components/ProcessingStatus';
import SheetFilePickerModal from '@/components/SheetFilePickerModal';
import {
  AppHeader,
  Button,
  Card,
  InfoBanner,
  MutedText,
  Screen,
} from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { saveFileToProject } from '@/services/files';
import { transposeProject } from '@/services/processing/transposeProject';
import { PROCESSING_STEP_LABELS, type ProcessingStep } from '@/services/processing/types';
import { pickSheetWithDocumentPicker, validateSheetName } from '@/services/sheetPicker';
import { saveProject, updateProjectStatus } from '@/storage/projectRepository';
import { Project, ProjectStatus } from '@/types/project';
import { DEFAULT_TARGET_KEY, TargetKey } from '@/types/transpose';

function createProjectId(): string {
  return `project_${Date.now()}`;
}

export default function TransposeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const [projectId, setProjectId] = useState(createProjectId);
  const [sheetUri, setSheetUri] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [targetKey, setTargetKey] = useState<TargetKey>(DEFAULT_TARGET_KEY);
  const [status, setStatus] = useState<ProjectStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');

  const now = () => new Date().toISOString();
  const isSubmitting = status === 'uploading' || status === 'processing';

  async function handlePickSheet() {
    const result = await pickSheetWithDocumentPicker();
    if (result.status === 'picked') {
      setSheetUri(result.file.uri);
      setSheetName(result.file.name);
      setErrorMessage(undefined);
      if (status === 'failed') {
        setStatus('idle');
      }
      return;
    }

    if (result.status === 'unavailable') {
      setPickerVisible(true);
    }
  }

  function handleWebPick(file: { uri: string; name: string }) {
    if (!validateSheetName(file.name)) {
      return;
    }
    setSheetUri(file.uri);
    setSheetName(file.name);
    setErrorMessage(undefined);
    if (status === 'failed') {
      setStatus('idle');
    }
  }

  async function handleSubmit() {
    if (!sheetUri || !sheetName) return;

    const attemptId = createProjectId();
    setProjectId(attemptId);

    const project: Project = {
      id: attemptId,
      title: `Transpose ${sheetName}`,
      createdAt: now(),
      updatedAt: now(),
      status: 'uploading',
      inputType: 'sheet',
    };
    await saveProject(project);

    try {
      setStatus('uploading');
      setProcessingStep('exporting_musicxml');
      setErrorMessage(undefined);

      const sourceSheetPath = await saveFileToProject(attemptId, sheetName, sheetUri);

      setStatus('processing');
      await updateProjectStatus(attemptId, 'processing');

      const result = await transposeProject({
        projectId: attemptId,
        sheetUri,
        sheetName,
        targetKey,
        onStep: setProcessingStep,
      });
      const completed: Project = {
        ...project,
        updatedAt: now(),
        status: 'complete',
        sourceSheetPath,
        sourceKeyDetected: result.sourceKeyDetected,
        targetKey: result.targetKeyLabel,
        musicxmlPath: result.musicxmlPath,
        midiPath: result.midiPath,
        previewWavPath: result.previewWavPath,
        processingModeUsed: result.processingModeUsed,
        errorMessage: result.errorMessage,
      };
      await saveProject(completed);
      setStatus('complete');
      setProcessingStep('complete');
      router.push(`/project/${attemptId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      setStatus('failed');
      setProcessingStep('failed');
      setErrorMessage(message);
      await updateProjectStatus(attemptId, 'failed', message);
      await saveProject({
        ...project,
        updatedAt: now(),
        status: 'failed',
        sourceSheetPath: sheetUri,
        errorMessage: message,
      });
    }
  }

  return (
    <Screen scroll contentContainerStyle={styles.container}>
      <AppHeader
        title="Transpose Sheet Music"
        subtitle="Upload a MusicXML or MXL file to transpose to a new key on your device."
      />

      <InfoBanner>
        Use a MusicXML file (.musicxml, .xml, or .mxl). From a recording project, tap Export
        MusicXML and save to Files — not Export MIDI. MIDI cannot be transposed in offline v1.
      </InfoBanner>

      <Button
        label={sheetName ? `Selected: ${sheetName}` : 'Choose MusicXML file'}
        variant="ghost"
        icon="doc.fill"
        onPress={handlePickSheet}
        disabled={isSubmitting}
      />

      <Card style={styles.section}>
        <KeyPicker value={targetKey} onChange={setTargetKey} disabled={isSubmitting} />
      </Card>

      {isSubmitting ? (
        <ProcessingStatus
          status={status}
          errorMessage={errorMessage}
          processingStepLabel={PROCESSING_STEP_LABELS[processingStep]}
        />
      ) : null}

      {status === 'failed' && errorMessage ? (
        <Card style={[styles.section, { borderColor: theme.errorMuted }]}>
          <Text style={[styles.errorTitle, { color: theme.error }]}>Transpose failed</Text>
          <Text style={[styles.errorMessage, { color: theme.error }]}>{errorMessage}</Text>
          <MutedText>Change the file or key below, then try again.</MutedText>
        </Card>
      ) : null}

      {!isSubmitting ? (
        <Button
          label={status === 'failed' ? 'Try again' : 'Transpose'}
          icon="arrow.up.arrow.down"
          onPress={handleSubmit}
          disabled={!sheetUri}
        />
      ) : null}
      <SheetFilePickerModal
        visible={pickerVisible}
        onClose={() => setPickerVisible(false)}
        onPick={handleWebPick}
        onError={(message) => Alert.alert('File picker error', message)}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { gap: 16, paddingBottom: 40 },
  section: { gap: 10 },
  errorTitle: { fontSize: 15, fontWeight: '700' },
  errorMessage: { fontSize: 13, lineHeight: 18 },
});
