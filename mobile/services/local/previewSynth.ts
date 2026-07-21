import { type MidiNote } from '@/services/local/midiTypes';
import { writeWavFile } from '@/services/local/wavUtils';
import { yieldToUi } from '@/services/processing/progress';

function noteToHz(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

/** Preview audio uses a lower rate so synthesis finishes quickly on-device. */
const PREVIEW_SAMPLE_RATE = 16000;

export async function writePreviewWav(
  uri: string,
  notes: MidiNote[],
  sampleRate = PREVIEW_SAMPLE_RATE,
  onProgress?: (fraction: number) => void
): Promise<void> {
  if (!notes.length) {
    const silence = new Float32Array(sampleRate);
    await writeWavFile(uri, silence, sampleRate);
    return;
  }

  const endTime = Math.max(0.5, ...notes.map((note) => note.end)) + 0.25;
  const audio = new Float32Array(Math.ceil(endTime * sampleRate));

  for (let noteIndex = 0; noteIndex < notes.length; noteIndex += 1) {
    const note = notes[noteIndex];
    const frequency = noteToHz(note.pitch);
    const startIndex = Math.floor(note.start * sampleRate);
    const duration = Math.max(0.08, note.end - note.start);
    const sampleCount = Math.floor(duration * sampleRate);
    const amplitude = (note.velocity / 127) * 0.35;
    const twoPiF = 2 * Math.PI * frequency;
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const envelope = Math.exp((-4 * t) / duration);
      const sample = Math.sin(twoPiF * t) * envelope * amplitude;
      const index = startIndex + i;
      if (index >= 0 && index < audio.length) {
        audio[index] += sample;
      }
    }
    if (noteIndex % 6 === 5) {
      onProgress?.((noteIndex + 1) / notes.length);
      await yieldToUi();
    }
  }

  let peak = 0;
  for (let i = 0; i < audio.length; i += 1) {
    peak = Math.max(peak, Math.abs(audio[i]));
  }
  if (peak > 0) {
    const scale = 0.92 / peak;
    for (let i = 0; i < audio.length; i += 1) {
      audio[i] *= scale;
    }
  }

  onProgress?.(1);
  await writeWavFile(uri, audio, sampleRate);
}

export async function writeChordPreviewWav(
  uri: string,
  segments: Array<{ start: number; end: number; pitches: number[] }>,
  sampleRate = PREVIEW_SAMPLE_RATE
): Promise<void> {
  if (!segments.length) {
    await writeWavFile(uri, new Float32Array(sampleRate), sampleRate);
    return;
  }

  const endTime = Math.max(0.5, ...segments.map((segment) => segment.end)) + 0.1;
  const audio = new Float32Array(Math.ceil(endTime * sampleRate));
  for (let segmentIndex = 0; segmentIndex < segments.length; segmentIndex += 1) {
    const segment = segments[segmentIndex];
    const duration = Math.max(0.08, segment.end - segment.start);
    const sampleCount = Math.floor(duration * sampleRate);
    const startIndex = Math.floor(segment.start * sampleRate);
    for (const pitch of segment.pitches) {
      const frequency = noteToHz(pitch);
      const twoPiF = 2 * Math.PI * frequency;
      for (let i = 0; i < sampleCount; i += 1) {
        const t = i / sampleRate;
        const envelope = Math.exp((-5 * t) / duration);
        const sample = Math.sin(twoPiF * t) * envelope * 0.18;
        const index = startIndex + i;
        if (index >= 0 && index < audio.length) audio[index] += sample;
      }
    }
    if (segmentIndex % 4 === 3) {
      await yieldToUi();
    }
  }
  let peak = 0;
  for (let i = 0; i < audio.length; i += 1) {
    peak = Math.max(peak, Math.abs(audio[i]));
  }
  if (peak > 0) {
    const scale = 0.9 / peak;
    for (let i = 0; i < audio.length; i += 1) {
      audio[i] *= scale;
    }
  }
  await writeWavFile(uri, audio, sampleRate);
}
