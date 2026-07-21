import { MIDI_OFFSET } from '@/services/local/basicPitchConstants';
import { type FlatModelMatrices } from '@/services/local/noteCreation';

const N_FREQS = 88;
const MAX_NOTES = 500;
const MAX_PEAKS = 2000;
const PEAK_BUFFER = MAX_PEAKS * 3;
/** ~4.6 s max note span — prevents huge inner loops on long sustained tones. */
const MAX_NOTE_SPAN_FRAMES = 400;

export interface MobileNoteExtractionOptions {
  onsetThresh: number;
  frameThresh: number;
  minNoteLen: number;
  minFreq?: number | null;
  maxFreq?: number | null;
}

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

function freqBounds(minFreq: number | null, maxFreq: number | null): { minF: number; maxF: number } {
  let minF = 0;
  let maxF = N_FREQS - 1;
  if (maxFreq !== null) {
    maxF = Math.min(N_FREQS - 1, Math.round(hzToMidi(maxFreq) - MIDI_OFFSET));
  }
  if (minFreq !== null) {
    minF = Math.max(0, Math.round(hzToMidi(minFreq) - MIDI_OFFSET));
  }
  return { minF, maxF };
}

function extendNoteEnd(
  frames: Float32Array,
  nFrames: number,
  startIdx: number,
  freqIdx: number,
  frameThresh: number
): number {
  const limit = Math.min(nFrames - 1, startIdx + MAX_NOTE_SPAN_FRAMES);
  let end = startIdx + 1;
  let below = 0;
  while (end < limit && below < 8) {
    if (frames[end * N_FREQS + freqIdx] < frameThresh) below += 1;
    else below = 0;
    end += 1;
  }
  return end - below;
}

function trimPeakBuffer(peaks: Array<{ t: number; f: number; strength: number }>): void {
  if (peaks.length <= PEAK_BUFFER) return;
  peaks.sort((a, b) => b.strength - a.strength || a.t - b.t);
  peaks.length = MAX_PEAKS;
}

function markUsedBand(used: Uint8Array, t: number, end: number, f: number): void {
  used[t * N_FREQS + f] = 1;
  for (let tt = t + 4; tt < end; tt += 4) {
    used[tt * N_FREQS + f] = 1;
  }
}

/**
 * Peak-based on-device note extraction. Runs synchronously so the Hermes event loop
 * cannot stall on thousands of interleaved await/yield calls.
 */
export function extractNotesMobileFast(
  matrix: FlatModelMatrices,
  options: MobileNoteExtractionOptions,
  onProgress?: (fraction: number) => void,
  onCheckpoint?: (checkpoint: string) => void
): Array<[number, number, number, number]> {
  const { nFrames, frames, onsets } = matrix;
  const { onsetThresh, frameThresh, minNoteLen, minFreq = null, maxFreq = null } = options;
  const { minF, maxF } = freqBounds(minFreq, maxFreq);

  onCheckpoint?.('extract:entry');
  onProgress?.(0.05);

  const peaks: Array<{ t: number; f: number; strength: number }> = [];
  for (let t = 1; t < nFrames - 1; t += 1) {
    const base = t * N_FREQS;
    for (let f = minF; f <= maxF; f += 1) {
      const value = onsets[base + f];
      if (value < onsetThresh) continue;
      if (
        value >= onsets[base - N_FREQS + f] &&
        value >= onsets[base + N_FREQS + f] &&
        value >= onsets[base + f - 1] &&
        value >= onsets[base + f + 1]
      ) {
        peaks.push({ t, f, strength: value });
        trimPeakBuffer(peaks);
      }
    }
    if (t % 600 === 0) {
      onCheckpoint?.(`extract:scan:${t}/${nFrames}`);
      onProgress?.(0.05 + (t / Math.max(1, nFrames - 2)) * 0.12);
    }
  }

  onCheckpoint?.('extract:sort');
  peaks.sort((a, b) => b.strength - a.strength || a.t - b.t);
  const capped = peaks.length > MAX_PEAKS ? peaks.slice(0, MAX_PEAKS) : peaks;

  onProgress?.(0.22);

  const used = new Uint8Array(nFrames * N_FREQS);
  const noteEvents: Array<[number, number, number, number]> = [];

  for (let i = 0; i < capped.length; i += 1) {
    const { t, f } = capped[i];
    const idx = t * N_FREQS + f;
    if (used[idx]) continue;

    const end = extendNoteEnd(frames, nFrames, t, f, frameThresh);
    if (end - t < minNoteLen) continue;

    markUsedBand(used, t, end, f);

    let amplitude = 0;
    for (let tt = t; tt < end; tt += 1) amplitude += frames[tt * N_FREQS + f];
    amplitude /= Math.max(1, end - t);
    noteEvents.push([t, end, f + MIDI_OFFSET, amplitude]);

    if (noteEvents.length >= MAX_NOTES) break;

    if (i > 0 && i % 80 === 0) {
      onCheckpoint?.(`extract:peaks:${i}/${capped.length}`);
      onProgress?.(0.22 + (i / Math.max(1, capped.length)) * 0.72);
    }
  }

  onCheckpoint?.('extract:done');
  onProgress?.(1);
  return noteEvents;
}
