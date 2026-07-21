import { type CleanupDebugSummary, type MidiNote } from '@/services/local/midiTypes';
import {
  cleanupNotesForMode,
  pitchRangeForMode,
  quantizeNotes,
  type LocalTranscriptionMode,
} from '@/services/local/modeHandlers';
import { writeMidiNotes } from '@/services/local/midiFile';
import { writePreviewWav } from '@/services/local/previewSynth';
import { yieldToUi } from '@/services/processing/progress';

export interface MidiPipelineOptions {
  mode: LocalTranscriptionMode;
  minVelocityRatio?: number;
  onProgress?: (fraction: number) => void;
}

export interface MidiPipelineResult {
  outputMidPath: string;
  notes: MidiNote[];
  previewWavPath?: string;
  summary: CleanupDebugSummary;
}

export async function runMidiPipeline(
  projectDir: string,
  rawNotes: MidiNote[],
  options: MidiPipelineOptions
): Promise<MidiPipelineResult> {
  const report = options.onProgress;
  report?.(0.05);
  await yieldToUi();

  const { min, max } = pitchRangeForMode(options.mode);
  const { notes, summary } = cleanupNotesForMode(rawNotes, options.mode, {
    minPitch: min,
    maxPitch: max,
    minVelocityRatio: options.minVelocityRatio ?? 0.35,
  });
  report?.(0.25);
  await yieldToUi();

  const gridStep = options.mode === 'piano_polyphonic' ? 0.125 : 0.25;
  const minDuration = options.mode === 'piano_polyphonic' ? 0.12 : 0.12;
  const quantized = quantizeNotes(notes, gridStep, minDuration);
  report?.(0.4);
  await yieldToUi();

  const outputMidPath = `${projectDir}output.mid`;
  await writeMidiNotes(outputMidPath, quantized);
  report?.(0.55);
  await yieldToUi();

  // Await preview so the saved project path always points at a real WAV.
  const previewTarget = `${projectDir}preview.wav`;
  let previewWavPath: string | undefined;
  try {
    await writePreviewWav(previewTarget, quantized, undefined, (fraction) => {
      report?.(0.55 + fraction * 0.4);
    });
    previewWavPath = previewTarget;
  } catch {
    previewWavPath = undefined;
  }
  report?.(1);
  await yieldToUi();

  return {
    outputMidPath,
    notes: quantized,
    previewWavPath,
    summary,
  };
}
