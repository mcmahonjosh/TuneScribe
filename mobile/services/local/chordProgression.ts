import * as FileSystem from 'expo-file-system/legacy';

import { type ChordKeyInfo, type ChordProgressionData, type ChordSegment } from '@/types/project';
import { type MidiNote } from '@/services/local/midiTypes';
import { writeChordPreviewWav } from '@/services/local/previewSynth';

const HARMONY_WINDOW = 1.0;
const MIN_PITCH_CLASSES = 2;

const CHORD_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function chordSymbolFromPitchClasses(pitchClasses: number[]): string {
  if (pitchClasses.length < MIN_PITCH_CLASSES) return '';
  const root = pitchClasses[0];
  const intervals = pitchClasses.map((pc) => (pc - root + 12) % 12).sort((a, b) => a - b);
  const rootName = CHORD_NAMES[root];
  if (intervals.includes(3) && intervals.includes(7)) return `${rootName}m`;
  if (intervals.includes(4) && intervals.includes(7)) return rootName;
  if (intervals.includes(3) && intervals.includes(6)) return `${rootName}dim`;
  if (intervals.includes(4) && intervals.includes(8)) return `${rootName}+`;
  return rootName;
}

function detectKeyFromNotes(notes: MidiNote[]): ChordKeyInfo {
  const histogram = new Array(12).fill(0);
  for (const note of notes) {
    histogram[note.pitch % 12] += note.end - note.start;
  }
  let bestMajor = { score: -Infinity, tonic: 'C' };
  let bestMinor = { score: -Infinity, tonic: 'A' };
  for (let tonic = 0; tonic < 12; tonic += 1) {
    let majorScore = 0;
    let minorScore = 0;
    for (let i = 0; i < 12; i += 1) {
      majorScore += histogram[(tonic + i) % 12] * MAJOR_PROFILE[i];
      minorScore += histogram[(tonic + i) % 12] * MINOR_PROFILE[i];
    }
    if (majorScore > bestMajor.score) bestMajor = { score: majorScore, tonic: CHORD_NAMES[tonic] };
    if (minorScore > bestMinor.score) bestMinor = { score: minorScore, tonic: CHORD_NAMES[tonic] };
  }
  return bestMinor.score > bestMajor.score
    ? { tonic: bestMinor.tonic, mode: 'minor' }
    : { tonic: bestMajor.tonic, mode: 'major' };
}

function pitchesInWindow(notes: MidiNote[], start: number, end: number): number[] {
  const pitches = new Set<number>();
  for (const note of notes) {
    if (note.start < end && note.end > start) pitches.add(note.pitch);
  }
  return [...pitches].sort((a, b) => a - b);
}

export async function writeChordProgression(
  projectDir: string,
  notes: MidiNote[]
): Promise<{
  chordsPath: string;
  chordsPreviewWavPath?: string;
  detectedKey: ChordKeyInfo;
  data: ChordProgressionData;
}> {
  const endTime = Math.max(0.5, ...notes.map((note) => note.end));
  const key = detectKeyFromNotes(notes);
  const segments: ChordSegment[] = [];
  const previewSegments: Array<{ start: number; end: number; pitches: number[] }> = [];

  for (let time = 0; time < endTime; time += HARMONY_WINDOW) {
    const windowEnd = Math.min(time + HARMONY_WINDOW, endTime);
    const pitches = pitchesInWindow(notes, time, windowEnd);
    const pitchClasses = [...new Set(pitches.map((pitch) => pitch % 12))].sort((a, b) => a - b);
    if (pitchClasses.length < MIN_PITCH_CLASSES) continue;
    const symbol = chordSymbolFromPitchClasses(pitchClasses);
    if (!symbol) continue;
    const last = segments[segments.length - 1];
    if (last && last.symbol === symbol) {
      last.end = windowEnd;
      previewSegments[previewSegments.length - 1].end = windowEnd;
      last.pitches = [...new Set([...(last.pitches ?? []), ...pitches])];
      previewSegments[previewSegments.length - 1].pitches = last.pitches ?? pitches;
    } else {
      segments.push({
        start: time,
        end: windowEnd,
        symbol,
        roman: null,
        pitches,
      });
      previewSegments.push({ start: time, end: windowEnd, pitches });
    }
  }

  const data: ChordProgressionData = { key, chords: segments };
  const chordsPath = `${projectDir}chords.json`;
  await FileSystem.writeAsStringAsync(chordsPath, JSON.stringify(data, null, 2));
  const chordsPreviewWavPath = `${projectDir}chords_preview.wav`;
  try {
    await writeChordPreviewWav(chordsPreviewWavPath, previewSegments);
    return { chordsPath, chordsPreviewWavPath, detectedKey: key, data };
  } catch {
    return { chordsPath, detectedKey: key, data };
  }
}
