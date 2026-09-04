import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { SymbolView } from 'expo-symbols';

import { Button, Card, MutedText } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import {
  defaultSettingsForInputType,
  formatSettingValue,
  SETTING_SPECS,
  TranscriptionSettings,
} from '@/types/transcriptionSettings';

interface TranscriptionSettingsPanelProps {
  inputType: 'piano' | 'vocal';
  settings: TranscriptionSettings;
  onChange: (settings: TranscriptionSettings) => void;
  disabled?: boolean;
}

export default function TranscriptionSettingsPanel({
  inputType,
  settings,
  onChange,
  disabled = false,
}: TranscriptionSettingsPanelProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const styles = useThemedStyles((t) => ({
    header: {
      flexDirection: 'row' as const,
      alignItems: 'center' as const,
      gap: 12,
    },
    iconWrap: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
      backgroundColor: t.banner,
    },
    textBlock: { flex: 1, gap: 2 },
    headerTitle: { fontSize: 15, fontWeight: '700' as const, color: t.text },
    summary: { fontSize: 12, color: t.textMuted, lineHeight: 17 },
    headerHint: { fontSize: 13, color: t.primary, fontWeight: '600' as const },
    panel: { gap: 14, marginTop: 14 },
    sliderBlock: { gap: 4 },
    sliderHeader: {
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
    },
    sliderLabel: { fontSize: 14, fontWeight: '600' as const, color: t.text, flex: 1 },
    sliderValue: { fontSize: 13, fontWeight: '700' as const, color: t.primary, marginLeft: 8 },
    slider: { width: '100%' as const, height: 36 },
  }));

  function updateSetting(key: keyof TranscriptionSettings, value: number) {
    onChange({ ...settings, [key]: value });
  }

  function handleReset() {
    onChange(defaultSettingsForInputType(inputType));
  }

  return (
    <Card>
      <Pressable
        style={styles.header}
        onPress={() => setExpanded((value) => !value)}
        disabled={disabled}
      >
        <View style={styles.iconWrap}>
          <SymbolView
            name={'slider.horizontal.3' as 'slider.horizontal.3'}
            tintColor={theme.primary}
            size={18}
          />
        </View>
        <View style={styles.textBlock}>
          <Text style={styles.headerTitle}>Advanced tuning</Text>
          {!expanded ? (
            <Text style={styles.summary}>
              Onset {settings.onset_threshold.toFixed(2)} · Sustain{' '}
              {settings.frame_threshold.toFixed(2)} · Min length{' '}
              {String(Math.round(settings.minimum_note_length))} ms
            </Text>
          ) : null}
        </View>
        <Text style={styles.headerHint}>{expanded ? 'Hide' : 'Show sliders >'}</Text>
      </Pressable>

      {expanded && (
        <View style={styles.panel}>
          <MutedText>
            Tune Basic Pitch detection for your recording. Lower onset sensitivity helps catch
            more notes in dense piano passages.
          </MutedText>

          {SETTING_SPECS.map((spec) => (
            <View key={spec.key} style={styles.sliderBlock}>
              <View style={styles.sliderHeader}>
                <Text style={styles.sliderLabel}>{spec.label}</Text>
                <Text style={styles.sliderValue}>
                  {formatSettingValue(spec.key, settings[spec.key])}
                </Text>
              </View>
              <MutedText subtle>{spec.description}</MutedText>
              <Slider
                style={styles.slider}
                minimumValue={spec.min_value}
                maximumValue={spec.max_value}
                step={spec.step}
                value={settings[spec.key]}
                onValueChange={(value) => updateSetting(spec.key, value)}
                minimumTrackTintColor={theme.primary}
                maximumTrackTintColor={theme.border}
                thumbTintColor={theme.primaryMuted}
                disabled={disabled}
              />
            </View>
          ))}

          <Button
            label="Reset to defaults"
            variant="secondary"
            onPress={handleReset}
            disabled={disabled}
          />
        </View>
      )}
    </Card>
  );
}
