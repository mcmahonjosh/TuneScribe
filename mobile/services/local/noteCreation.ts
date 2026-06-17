import {
  ANNOTATIONS_FPS,
  ANNOT_N_FRAMES,
  AUDIO_N_SAMPLES,
  AUDIO_SAMPLE_RATE,
  FFT_HOP,
  MAX_FREQ_IDX,
  MIDI_OFFSET,
} from '@/services/local/basicPitchConstants';
import { type MidiNote } from '@/services/local/midiTypes';
import { yieldToUi } from '@/services/processing/progress';

const N_FREQS = 88;

export interface FlatModelMatrices {
  frames: Float32Array;
  onsets: Float32Array;
  nFrames: number;
}

export interface NoteExtractionOptions {
  onsetThresh: number;
  frameThresh: number;
  minNoteLen: number;
  inferOnsets?: boolean;
  minFreq?: number | null;
  maxFreq?: number | null;
  melodiaTrick?: boolean;
  energyTol?: number;
  /** Mobile safety cap — melodia can scan the full matrix thousands of times. */
  maxMelodiaIterations?: number;
}

function hzToMidi(hz: number): number {
  return 69 + 12 * Math.log2(hz / 440);
}

function constrainFrequencyFlat(
  frames: Float32Array,
  onsets: Float32Array,
  nFrames: number,
  maxFreq: number | null,
  minFreq: number | null
): { frames: Float32Array; onsets: Float32Array } {
  const nextFrames = new Float32Array(frames);
  const nextOnsets = new Float32Array(onsets);

  if (maxFreq !== null) {
    const maxIdx = Math.round(hzToMidi(maxFreq) - MIDI_OFFSET);
    for (let t = 0; t < nFrames; t += 1) {
      const base = t * N_FREQS;
      for (let f = maxIdx; f < N_FREQS; f += 1) {
        nextOnsets[base + f] = 0;
        nextFrames[base + f] = 0;
      }
    }
  }
  if (minFreq !== null) {
    const minIdx = Math.round(hzToMidi(minFreq) - MIDI_OFFSET);
    for (let t = 0; t < nFrames; t += 1) {
      const base = t * N_FREQS;
      for (let f = 0; f < minIdx; f += 1) {
        nextOnsets[base + f] = 0;
        nextFrames[base + f] = 0;
      }
    }
  }

  return { frames: nextFrames, onsets: nextOnsets };
}

function getInferredOnsetsFlat(
  onsets: Float32Array,
  frames: Float32Array,
  nFrames: number,
  nDiff = 2
): Float32Array {
  const result = new Float32Array(onsets);
  const frameDiff = new Float32Array(frames.length);

  for (let n = 1; n <= nDiff; n += 1) {
    for (let t = 0; t < nFrames; t += 1) {
      const base = t * N_FREQS;
      const prevBase = t >= n ? (t - n) * N_FREQS : -1;
      for (let f = 0; f < N_FREQS; f += 1) {
        const diff = prevBase >= 0 ? frames[base + f] - frames[prevBase + f] : 0;
        frameDiff[base + f] = Math.min(frameDiff[base + f], diff);
      }
    }
  }

  let maxOnset = 0;
  for (let i = 0; i < onsets.length; i += 1) {
    maxOnset = Math.max(maxOnset, onsets[i]);
  }

  let maxDiff = 0;
  for (let t = nDiff; t < nFrames; t += 1) {
    const base = t * N_FREQS;
    for (let f = 0; f < N_FREQS; f += 1) {
      const positive = Math.max(0, -frameDiff[base + f]);
      frameDiff[base + f] = positive;
      maxDiff = Math.max(maxDiff, positive);
    }
  }

  const scale = maxDiff > 0 ? maxOnset / maxDiff : 0;
  for (let i = 0; i < result.length; i += 1) {
    result[i] = Math.max(result[i], frameDiff[i] * scale);
  }
  return result;
}

function clearPitchBand(
  energy: Float32Array,
  freqIdx: number,
  fromFrame: number,
  toFrame: number
): void {
  for (let frame = fromFrame; frame < toFrame; frame += 1) {
    const row = frame * N_FREQS;
    energy[row + freqIdx] = 0;
    if (freqIdx < MAX_FREQ_IDX) energy[row + freqIdx + 1] = 0;
    if (freqIdx > 0) energy[row + freqIdx - 1] = 0;
  }
}

function findArgmaxAboveThreshold(data: Float32Array, threshold: number): number {
  let bestIdx = -1;
  let bestValue = threshold;
  for (let i = 0; i < data.length; i += 1) {
    const value = data[i];
    if (value > bestValue) {
      bestValue = value;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function collectOnsetPeaks(
  onsets: Float32Array,
  nFrames: number,
  onsetThresh: number
): Array<{ t: number; f: number }> {
  const peaks: Array<{ t: number; f: number; value: number }> = [];
  for (let t = 1; t < nFrames - 1; t += 1) {
    const base = t * N_FREQS;
    for (let f = 1; f < N_FREQS - 1; f += 1) {
      const value = onsets[base + f];
      if (
        value >= onsetThresh &&
        value >= onsets[base - N_FREQS + f] &&
        value >= onsets[base + N_FREQS + f] &&
        value >= onsets[base + f - 1] &&
        value >= onsets[base + f + 1]
      ) {
        peaks.push({ t, f, value });
      }
    }
  }
  peaks.sort((a, b) => b.t - a.t || b.f - a.f);
  return peaks;
}

function extendNoteEnd(
  energy: Float32Array,
  nFrames: number,
  startIdx: number,
  freqIdx: number,
  frameThresh: number,
  energyTol: number
): number {
  let i = startIdx + 1;
  let k = 0;
  while (i < nFrames - 1 && k < energyTol) {
    if (energy[i * N_FREQS + freqIdx] < frameThresh) k += 1;
    else k = 0;
    i += 1;
  }
  return i - k;
}

export function modelFramesToTime(nFrames: number): number[] {
  const windowOffset =
    (FFT_HOP / AUDIO_SAMPLE_RATE) * (ANNOT_N_FRAMES - AUDIO_N_SAMPLES / FFT_HOP) + 0.0018;
  const times: number[] = [];
  for (let i = 0; i < nFrames; i += 1) {
    const original = (i * FFT_HOP) / AUDIO_SAMPLE_RATE;
    const windowNumber = Math.floor(i / ANNOT_N_FRAMES);
    times.push(original - windowOffset * windowNumber);
  }
  return times;
}

export function unwrapInferenceBatches(
  batches: Array<{ frames: number; bins: number; note: Float32Array; onset: Float32Array }>,
  audioOriginalLength: number,
  nOverlappingFrames: number
): FlatModelMatrices {
  const nOlap = Math.floor(nOverlappingFrames / 2);
  const targetFrames = Math.floor(audioOriginalLength * (ANNOTATIONS_FPS / AUDIO_SAMPLE_RATE));

  let totalFrames = 0;
  for (const batch of batches) {
    const start = nOlap;
    const end = Math.max(nOlap, batch.frames - nOlap);
    totalFrames += Math.max(0, end - start);
  }

  const nFrames = Math.min(totalFrames, targetFrames);
  const frames = new Float32Array(nFrames * N_FREQS);
  const onsets = new Float32Array(nFrames * N_FREQS);
  let writeFrame = 0;

  for (const batch of batches) {
    const start = nOlap;
    const end = Math.max(nOlap, batch.frames - nOlap);
    for (let t = start; t < end && writeFrame < nFrames; t += 1) {
      const offset = t * batch.bins;
      frames.set(batch.note.subarray(offset, offset + batch.bins), writeFrame * N_FREQS);
      onsets.set(batch.onset.subarray(offset, offset + batch.bins), writeFrame * N_FREQS);
      writeFrame += 1;
    }
  }

  return { frames, onsets, nFrames };
}

export async function outputToNotesPolyphonicAsync(
  matrix: FlatModelMatrices,
  options: NoteExtractionOptions,
  onProgress?: (fraction: number) => void
): Promise<Array<[number, number, number, number]>> {
  const {
    onsetThresh,
    frameThresh,
    minNoteLen,
    inferOnsets = true,
    minFreq = null,
    maxFreq = null,
    melodiaTrick = true,
    energyTol = 11,
  } = options;

  const { nFrames } = matrix;
  let { frames, onsets } = constrainFrequencyFlat(
    matrix.frames,
    matrix.onsets,
    nFrames,
    maxFreq,
    minFreq
  );

  if (inferOnsets) {
    onsets = getInferredOnsetsFlat(onsets, frames, nFrames);
  }

  onProgress?.(0.1);
  await yieldToUi();

  const remainingEnergy = new Float32Array(frames);
  const noteEvents: Array<[number, number, number, number]> = [];
  const peaks = collectOnsetPeaks(onsets, nFrames, onsetThresh);

  onProgress?.(0.25);
  await yieldToUi();

  for (let peakIndex = 0; peakIndex < peaks.length; peakIndex += 1) {
    const peak = peaks[peakIndex];
    const noteStartIdx = peak.t;
    const freqIdx = peak.f;
    if (noteStartIdx >= nFrames - 1) continue;

    const endIdx = extendNoteEnd(
      remainingEnergy,
      nFrames,
      noteStartIdx,
      freqIdx,
      frameThresh,
      energyTol
    );
    if (endIdx - noteStartIdx <= minNoteLen) continue;

    clearPitchBand(remainingEnergy, freqIdx, noteStartIdx, endIdx);

    let amplitude = 0;
    for (let t = noteStartIdx; t < endIdx; t += 1) amplitude += frames[t * N_FREQS + freqIdx];
    amplitude /= Math.max(1, endIdx - noteStartIdx);
    noteEvents.push([noteStartIdx, endIdx, freqIdx + MIDI_OFFSET, amplitude]);

    if (peakIndex % 48 === 47) {
      onProgress?.(0.25 + ((peakIndex + 1) / Math.max(1, peaks.length)) * 0.15);
      await yieldToUi();
    }
  }

  onProgress?.(0.4);
  await yieldToUi();

  if (melodiaTrick) {
    const maxMelodiaIterations = options.maxMelodiaIterations ?? 60;
    for (let iteration = 0; iteration < maxMelodiaIterations; iteration += 1) {
      const flatIdx = findArgmaxAboveThreshold(remainingEnergy, frameThresh);
      if (flatIdx < 0) break;

      const bestT = Math.floor(flatIdx / N_FREQS);
      const bestF = flatIdx % N_FREQS;
      remainingEnergy[flatIdx] = 0;

      let iEnd = bestT + 1;
      let k = 0;
      while (iEnd < nFrames - 1 && k < energyTol) {
        if (remainingEnergy[iEnd * N_FREQS + bestF] < frameThresh) k += 1;
        else k = 0;
        clearPitchBand(remainingEnergy, bestF, iEnd, iEnd + 1);
        iEnd += 1;
      }
      iEnd -= 1 + k;

      let iStart = bestT - 1;
      k = 0;
      while (iStart > 0 && k < energyTol) {
        if (remainingEnergy[iStart * N_FREQS + bestF] < frameThresh) k += 1;
        else k = 0;
        clearPitchBand(remainingEnergy, bestF, iStart, iStart + 1);
        iStart -= 1;
      }
      iStart += 1 + k;

      if (iEnd - iStart > minNoteLen) {
        let amplitude = 0;
        for (let t = iStart; t < iEnd; t += 1) amplitude += frames[t * N_FREQS + bestF];
        amplitude /= Math.max(1, iEnd - iStart);
        noteEvents.push([iStart, iEnd, bestF + MIDI_OFFSET, amplitude]);
      }

      onProgress?.(0.4 + ((iteration + 1) / maxMelodiaIterations) * 0.55);
      await yieldToUi();
    }
  }

  onProgress?.(1);
  return noteEvents;
}

export function noteEventsToMidiNotes(
  events: Array<[number, number, number, number]>,
  annotationsFps: number = ANNOTATIONS_FPS
): MidiNote[] {
  return events.map(([startIdx, endIdx, pitch, amplitude]) => {
    const start = Math.max(0, startIdx / annotationsFps);
    const end = Math.max(start + 0.05, endIdx / annotationsFps);
    return {
      pitch,
      start,
      end,
      velocity: Math.max(40, Math.min(127, Math.round(127 * amplitude))),
    };
  });
}
