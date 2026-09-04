import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

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
  SectionTitle,
  SelectableTile,
  TrustCard,
} from '@/components/ui';
import { useProcessingMode } from '@/context/ProcessingModeContext';
import { useTheme } from '@/context/ThemeContext';
import { getTransposeSettings } from '@/services/api';
import { saveFileToProject } from '@/services/files';
import { transposeProject } from '@/services/processing/transposeProject';
import { isOmrInputFilename, PROCESSING_STEP_LABELS, type ProcessingStep } from '@/services/processing/types';
import { pickSheetWithDocumentPicker, validateSheetName } from '@/services/sheetPicker';
import { saveProject, updateProjectStatus } from '@/storage/projectRepository';
import { Project, ProjectStatus } from '@/types/project';
import { DEFAULT_TARGET_KEY, OmrEngine, TargetKey } from '@/types/transpose';

function createProjectId(): string {
  return `project_${Date.now()}`;
}

export default function TransposeScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { processingMode, isLocalMode } = useProcessingMode();
  const [projectId, setProjectId] = useState(createProjectId);
  const [sheetUri, setSheetUri] = useState<string | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [targetKey, setTargetKey] = useState<TargetKey>(DEFAULT_TARGET_KEY);
  const [status, setStatus] = useState<ProjectStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | undefined>();
  const [omrEngine, setOmrEngine] = useState<OmrEngine>('audiveris');
  const [audiverisAvailable, setAudiverisAvailable] = useState<boolean | null>(null);
  const [processingStep, setProcessingStep] = useState<ProcessingStep>('idle');

  const OMR_OPTIONS: { id: OmrEngine; label: string; hint: string; icon: string }[] = [
    {
      id: 'audiveris',
      label: 'Faster model',
      hint: 'Best for clean PDF scans — higher accuracy and usually finishes in about a minute. Not as good at reading phone photos.',
      icon: 'hare',
    },
    {
      id: 'oemer',
      label: 'Slower model',
      hint: 'Better for photos, including slightly blurry or angled shots. Takes about 2–3 minutes but handles difficult images more reliably.',
      icon: 'tortoise',
    },
  ];

  useEffect(() => {
    getTransposeSettings()
      .then((settings) => setAudiverisAvailable(settings.audiveris_available))
      .catch(() => setAudiverisAvailable(null));
  }, []);

  const now = () => new Date().toISOString();
  const isSubmitting = status === 'uploading' || status === 'processing';
  const isPhotoInput = sheetName ? /\.(jpe?g|png|webp)$/i.test(sheetName) : false;

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
      setProcessingStep(isLocalMode && !isOmrInputFilename(sheetName) ? 'exporting_musicxml' : 'server_omr');
      setErrorMessage(undefined);

      const sourceSheetPath = await saveFileToProject(attemptId, sheetName, sheetUri);

      setStatus('processing');
      await updateProjectStatus(attemptId, 'processing');

      const result = await transposeProject({
        processingMode,
        projectId: attemptId,
        sheetUri,
        sheetName,
        targetKey,
        omrEngine,
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
        pdfPath: result.pdfPath,
        backendJobId: result.backendJobId,
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
        subtitle="Upload MusicXML/MXL, PDF, or a photo. PDF/image reading uses OMR before transposing."
      />

      {isLocalMode ? (
        <InfoBanner>
          Local mode transposes MusicXML/MXL on your phone. PDF and photo uploads still use the
          backend for sheet reading.
        </InfoBanner>
      ) : null}

      <Card style={styles.section}>
        <SectionTitle>Sheet reading model</SectionTitle>
        <MutedText subtle>Only used for PDFs and photos. MusicXML uploads skip this step.</MutedText>
        <View style={styles.tileRow}>
          {OMR_OPTIONS.map((option) => {
            const disabled =
              isSubmitting || (option.id === 'audiveris' && audiverisAvailable === false);
            return (
              <SelectableTile
                key={option.id}
                label={option.label}
                icon={option.icon}
                selected={omrEngine === option.id}
                onPress={() => setOmrEngine(option.id)}
                disabled={disabled}
              />
            );
          })}
        </View>
        <MutedText>{OMR_OPTIONS.find((option) => option.id === omrEngine)?.hint}</MutedText>
        {audiverisAvailable === false && (
          <Text style={[styles.warning, { color: theme.error }]}>
            Faster model is not available on the backend yet. Install Audiveris or use the slower
            model.
          </Text>
        )}
        {isPhotoInput && omrEngine === 'audiveris' && (
          <Text style={[styles.warning, { color: theme.warning }]}>
            Phone photos often fail with the faster model. Use the slower model for photos,
            especially if the image is hard to read.
          </Text>
        )}
      </Card>

      <Button
        label={sheetName ? `Selected: ${sheetName}` : 'Choose sheet music file'}
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
          <MutedText>Change the file, key, or reading model below, then try again.</MutedText>
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

      <TrustCard />
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
  tileRow: { flexDirection: 'row', gap: 10 },
  warning: { fontSize: 12, lineHeight: 17 },
  errorTitle: { fontSize: 15, fontWeight: '700' },
  errorMessage: { fontSize: 13, lineHeight: 18 },
});
