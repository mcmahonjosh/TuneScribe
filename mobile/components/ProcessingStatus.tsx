import { ActivityIndicator, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { type ProcessingStep } from '@/services/processing/types';
import { ProjectStatus } from '@/types/project';

interface ProcessingStatusProps {
  status: ProjectStatus;
  errorMessage?: string;
  statusLabels?: Partial<Record<ProjectStatus, string>>;
  processingStep?: ProcessingStep;
  processingStepLabel?: string;
  /** Overall progress 0–1 for local / staged jobs. Omit for indeterminate. */
  progressFraction?: number;
  /** Dev-only pipeline checkpoint shown under the progress bar. */
  debugCheckpoint?: string;
}

const DEFAULT_STATUS_LABELS: Record<ProjectStatus, string> = {
  idle: 'Ready',
  recording: 'Recording...',
  uploading: 'Uploading audio...',
  processing: 'Transcribing with Basic Pitch...',
  complete: 'Transcription complete',
  failed: 'Transcription failed',
};

export default function ProcessingStatus({
  status,
  errorMessage,
  statusLabels,
  processingStepLabel,
  progressFraction,
  debugCheckpoint,
}: ProcessingStatusProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles((t) => ({
    container: { alignItems: 'center' as const, gap: 12, padding: 8, width: '100%' as const },
    label: { fontSize: 16, color: t.text, textAlign: 'center' as const },
    progressRow: { width: '100%' as const, gap: 6 },
    progressTrack: {
      width: '100%' as const,
      height: 8,
      borderRadius: 4,
      backgroundColor: t.borderSubtle,
      overflow: 'hidden' as const,
    },
    progressFill: {
      height: '100%' as const,
      borderRadius: 4,
      backgroundColor: t.primary,
    },
    progressText: { fontSize: 13, color: t.textMuted, textAlign: 'center' as const },
    checkpoint: { fontSize: 11, color: t.textMuted, textAlign: 'center' as const },
    error: { fontSize: 14, color: t.error, textAlign: 'center' as const },
  }));

  const isLoading = status === 'uploading' || status === 'processing';
  const labels = { ...DEFAULT_STATUS_LABELS, ...statusLabels };
  const showProgress =
    isLoading && typeof progressFraction === 'number' && Number.isFinite(progressFraction);
  const percent = showProgress ? Math.min(100, Math.max(0, Math.round(progressFraction * 100))) : 0;

  return (
    <Card elevated>
      <View style={styles.container}>
        {isLoading && !showProgress ? (
          <ActivityIndicator size="large" color={theme.primary} />
        ) : null}
        <Text style={styles.label}>{processingStepLabel ?? labels[status]}</Text>
        {showProgress ? (
          <View style={styles.progressRow}>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${percent}%` }]} />
            </View>
            <Text style={styles.progressText}>{percent}%</Text>
            {debugCheckpoint ? (
              <Text style={styles.checkpoint}>{debugCheckpoint}</Text>
            ) : null}
          </View>
        ) : null}
        {errorMessage ? <Text style={styles.error}>{errorMessage}</Text> : null}
      </View>
    </Card>
  );
}
