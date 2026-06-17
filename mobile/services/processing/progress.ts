import { type ProcessingProgress, type ProcessingStep } from '@/services/processing/types';

/** Overall 0–1 ranges for local transcription stages. */
export const LOCAL_TRANSCRIBE_RANGES: Record<
  | 'decoding_audio'
  | 'loading_model'
  | 'running_basic_pitch'
  | 'extracting_notes'
  | 'cleaning_midi'
  | 'exporting_musicxml'
  | 'extracting_chords',
  [number, number]
> = {
  decoding_audio: [0, 0.08],
  loading_model: [0.08, 0.12],
  running_basic_pitch: [0.12, 0.78],
  extracting_notes: [0.78, 0.86],
  cleaning_midi: [0.86, 0.91],
  exporting_musicxml: [0.91, 0.96],
  extracting_chords: [0.96, 1],
};

export function mapStageProgress(
  step: ProcessingStep,
  stageFraction: number,
  range: [number, number]
): ProcessingProgress {
  const [start, end] = range;
  const clamped = Math.min(1, Math.max(0, stageFraction));
  return {
    step,
    fraction: start + (end - start) * clamped,
  };
}

export async function yieldToUi(): Promise<void> {
  await new Promise<void>((resolve) => {
    const finish = () => resolve();
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => setTimeout(finish, 0));
      return;
    }
    setTimeout(finish, 0);
  });
}
