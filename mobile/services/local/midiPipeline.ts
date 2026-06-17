import { type CleanupDebugSummary, type MidiNote } from '@/services/local/midiTypes';
import {
  cleanupNotesForMode,
  pitchRangeForMode,
  quantizeNotes,
  type LocalTranscriptionMode,
} from '@/services/local/modeHandlers';
import { writeMidiNotes } from '@/services/local/midiFile';
import { writePreviewWav } from '@/services/local/previewSynth';
import { agentDebugLog } from '@/utils/agentDebugLog';

export interface MidiPipelineOptions {
  mode: LocalTranscriptionMode;
  minVelocityRatio?: number;
}

export interface MidiPipelineResult {
  outputMidPath: string;
  previewWavPath?: string;
  summary: CleanupDebugSummary;
}

export async function runMidiPipeline(
  projectDir: string,
  rawNotes: MidiNote[],
  options: MidiPipelineOptions
): Promise<MidiPipelineResult> {
  // #region agent log
  agentDebugLog(
    'midiPipeline.ts:entry',
    'midi pipeline start',
    { rawNoteCount: rawNotes.length, mode: options.mode },
    'D',
    'post-fix'
  );
  // #endregion
  const { min, max } = pitchRangeForMode(options.mode);
  const { notes, summary } = cleanupNotesForMode(rawNotes, options.mode, {
    minPitch: min,
    maxPitch: max,
    minVelocityRatio: options.minVelocityRatio ?? 0.35,
  });

  const gridStep = options.mode === 'piano_polyphonic' ? 0.125 : 0.25;
  const minDuration = options.mode === 'piano_polyphonic' ? 0.12 : 0.12;
  const quantized = quantizeNotes(notes, gridStep, minDuration);

  const outputMidPath = `${projectDir}output.mid`;
  await writeMidiNotes(outputMidPath, quantized);

  let previewWavPath: string | undefined;
  const previewTarget = `${projectDir}preview.wav`;
  void writePreviewWav(previewTarget, quantized)
    .then(() => {
      previewWavPath = previewTarget;
    })
    .catch(() => {});

  // #region agent log
  agentDebugLog(
    'midiPipeline.ts:done',
    'midi pipeline complete',
    { finalNoteCount: quantized.length, outputMidPath },
    'D',
    'post-fix'
  );
  // #endregion
  return { outputMidPath, previewWavPath, summary };
}
