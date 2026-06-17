import { View } from 'react-native';

import { Button } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface RecordingControlsProps {
  isRecording: boolean;
  hasRecording: boolean;
  onStart: () => void;
  onStop: () => void;
  onPlayback: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
}

export default function RecordingControls({
  isRecording,
  hasRecording,
  onStart,
  onStop,
  onPlayback,
  onSubmit,
  isSubmitting,
}: RecordingControlsProps) {
  const styles = useThemedStyles(() => ({
    container: { gap: 16, width: '100%' as const },
    row: { flexDirection: 'row' as const, gap: 12 },
    flex: { flex: 1 },
  }));

  return (
    <View style={styles.container}>
      {!isRecording ? (
        <Button label="Start Recording" variant="danger" onPress={onStart} />
      ) : (
        <Button label="Stop Recording" variant="secondary" onPress={onStop} />
      )}

      {hasRecording && !isRecording && (
        <View style={styles.row}>
          <Button label="Play Back" variant="ghost" onPress={onPlayback} style={styles.flex} />
          <Button
            label={isSubmitting ? 'Processing...' : 'Transcribe'}
            onPress={onSubmit}
            disabled={isSubmitting}
            style={styles.flex}
          />
        </View>
      )}
    </View>
  );
}
