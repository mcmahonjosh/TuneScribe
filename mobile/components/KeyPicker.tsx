import { View } from 'react-native';

import { Chip, SectionTitle } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { KEY_TONICS, TargetKey, TargetMode } from '@/types/transpose';

interface KeyPickerProps {
  value: TargetKey;
  onChange: (value: TargetKey) => void;
  disabled?: boolean;
}

export default function KeyPicker({ value, onChange, disabled = false }: KeyPickerProps) {
  const styles = useThemedStyles(() => ({
    container: { gap: 10 },
    row: { flexDirection: 'row' as const, flexWrap: 'wrap' as const, gap: 8 },
    modeRow: { flexDirection: 'row' as const, gap: 10, marginTop: 4 },
    tonicChip: { minWidth: 44 },
    modeChip: { flex: 1 },
  }));

  return (
    <View style={styles.container}>
      <SectionTitle>Target key</SectionTitle>

      <View style={styles.row}>
        {KEY_TONICS.map((tonic) => (
          <Chip
            key={tonic}
            label={tonic}
            selected={value.tonic === tonic}
            onPress={() => onChange({ ...value, tonic })}
            disabled={disabled}
            style={styles.tonicChip}
          />
        ))}
      </View>

      <View style={styles.modeRow}>
        {(['major', 'minor'] as TargetMode[]).map((mode) => (
          <Chip
            key={mode}
            label={mode === 'major' ? 'Major' : 'Minor'}
            selected={value.mode === mode}
            onPress={() => onChange({ ...value, mode })}
            disabled={disabled}
            style={styles.modeChip}
          />
        ))}
      </View>
    </View>
  );
}
