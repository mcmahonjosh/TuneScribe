import { TranscriptionMode } from '@/services/api';

export interface TranscriptionSettings {
  onset_threshold: number;
  frame_threshold: number;
  minimum_note_length: number;
  min_velocity_ratio: number;
}

export interface SettingSpec {
  key: keyof TranscriptionSettings;
  label: string;
  description: string;
  min_value: number;
  max_value: number;
  step: number;
  default: number;
}

export const SETTING_SPECS: SettingSpec[] = [
  {
    key: 'onset_threshold',
    label: 'Onset sensitivity',
    description:
      'Lower = detect more note starts (may add noise). Higher = fewer, cleaner onsets.',
    min_value: 0.3,
    max_value: 0.7,
    step: 0.01,
    default: 0.43,
  },
  {
    key: 'frame_threshold',
    label: 'Sustain sensitivity',
    description:
      'Lower = keep quieter or shorter sustained notes. Higher = stricter sustain detection.',
    min_value: 0.2,
    max_value: 0.45,
    step: 0.01,
    default: 0.29,
  },
  {
    key: 'minimum_note_length',
    label: 'Minimum note length (ms)',
    description: 'Shorter = keep fast notes. Longer = drop brief blips and noise.',
    min_value: 50,
    max_value: 180,
    step: 5,
    default: 65,
  },
  {
    key: 'min_velocity_ratio',
    label: 'Velocity floor',
    description:
      'Lower = keep quieter notes (helps left hand). Higher = drop weak detections.',
    min_value: 0.15,
    max_value: 0.5,
    step: 0.01,
    default: 0.28,
  },
];

const MODE_DEFAULTS: Record<TranscriptionMode, TranscriptionSettings> = {
  piano_polyphonic: {
    onset_threshold: 0.43,
    frame_threshold: 0.29,
    minimum_note_length: 65,
    min_velocity_ratio: 0.28,
  },
  piano_melody: {
    onset_threshold: 0.52,
    frame_threshold: 0.34,
    minimum_note_length: 120,
    min_velocity_ratio: 0.35,
  },
  monophonic_melody: {
    onset_threshold: 0.55,
    frame_threshold: 0.35,
    minimum_note_length: 150,
    min_velocity_ratio: 0.4,
  },
};

export function modeForInputType(inputType: 'piano' | 'vocal'): TranscriptionMode {
  return inputType === 'piano' ? 'piano_polyphonic' : 'monophonic_melody';
}

export function defaultSettingsForInputType(
  inputType: 'piano' | 'vocal'
): TranscriptionSettings {
  return { ...MODE_DEFAULTS[modeForInputType(inputType)] };
}

export function formatSettingValue(key: keyof TranscriptionSettings, value: number): string {
  if (key === 'minimum_note_length') {
    return `${Math.round(value)} ms`;
  }
  return value.toFixed(2);
}
