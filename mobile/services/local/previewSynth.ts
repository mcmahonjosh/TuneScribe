import { type MidiNote } from '@/services/local/midiTypes';
import { writeWavFile } from '@/services/local/wavUtils';

function noteToHz(pitch: number): number {
  return 440 * 2 ** ((pitch - 69) / 12);
}

export async function writePreviewWav(uri: string, notes: MidiNote[], sampleRate = 22050): Promise<void> {
  const endTime = Math.max(0.5, ...notes.map((note) => note.end)) + 0.35;
  const audio = new Float32Array(Math.ceil(endTime * sampleRate));

  for (const note of notes) {
    const frequency = noteToHz(note.pitch);
    const startIndex = Math.floor(note.start * sampleRate);
    const duration = Math.max(0.08, note.end - note.start);
    const sampleCount = Math.floor(duration * sampleRate);
    const amplitude = (note.velocity / 127) * 0.35;
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const envelope = Math.exp((-4 * t) / duration);
      const sample =
        (Math.sin(2 * Math.PI * frequency * t) +
          0.25 * Math.sin(2 * Math.PI * frequency * 2 * t)) *
        envelope *
        amplitude;
      const index = startIndex + i;
      if (index >= 0 && index < audio.length) {
        audio[index] += sample;
      }
    }
  }

  let peak = 0;
  for (const sample of audio) peak = Math.max(peak, Math.abs(sample));
  const normalized =
    peak > 0 ? audio.map((sample) => (sample / peak) * 0.92) : audio;
  await writeWavFile(uri, normalized, sampleRate);
}

export async function writeChordPreviewWav(
  uri: string,
  segments: Array<{ start: number; end: number; pitches: number[] }>,
  sampleRate = 22050
): Promise<void> {
  const endTime = Math.max(0.5, ...segments.map((segment) => segment.end)) + 0.1;
  const audio = new Float32Array(Math.ceil(endTime * sampleRate));
  for (const segment of segments) {
    const duration = Math.max(0.08, segment.end - segment.start);
    const sampleCount = Math.floor(duration * sampleRate);
    const startIndex = Math.floor(segment.start * sampleRate);
    for (const pitch of segment.pitches) {
      const frequency = noteToHz(pitch);
      for (let i = 0; i < sampleCount; i += 1) {
        const t = i / sampleRate;
        const envelope = Math.exp((-5 * t) / duration);
        const sample = Math.sin(2 * Math.PI * frequency * t) * envelope * 0.18;
        const index = startIndex + i;
        if (index >= 0 && index < audio.length) audio[index] += sample;
      }
    }
  }
  let peak = 0;
  for (const sample of audio) peak = Math.max(peak, Math.abs(sample));
  const normalized =
    peak > 0 ? audio.map((sample) => (sample / peak) * 0.9) : audio;
  await writeWavFile(uri, normalized, sampleRate);
}
