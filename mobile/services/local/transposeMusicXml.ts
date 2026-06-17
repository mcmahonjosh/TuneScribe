import * as FileSystem from 'expo-file-system/legacy';
import { unzipSync, strFromU8 } from 'fflate';

import { type TargetKey } from '@/types/transpose';

const STEP_ORDER = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const STEP_SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const TARGET_SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

async function readMusicXmlContent(uri: string): Promise<string> {
  if (uri.toLowerCase().endsWith('.mxl')) {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    const entries = unzipSync(bytes);
    const container = entries['META-INF/container.xml'];
    if (container) {
      const match = strFromU8(container).match(/full-path="([^"]+)"/);
      const target = match?.[1];
      if (target && entries[target]) {
        return strFromU8(entries[target]);
      }
    }
    const xmlEntry = Object.entries(entries).find(
      ([name]) =>
        (name.endsWith('.xml') || name.endsWith('.musicxml')) &&
        !name.startsWith('META-INF/')
    )?.[1];
    if (!xmlEntry) throw new Error('MXL archive did not contain MusicXML.');
    return strFromU8(xmlEntry);
  }
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

function parseFifths(xml: string): number | null {
  const match = xml.match(/<key>\s*<fifths>(-?\d+)<\/fifths>/);
  return match ? Number(match[1]) : null;
}

function fifthsToTonic(fifths: number, mode: 'major' | 'minor'): string {
  const majorCircle = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F'];
  const minorCircle = ['A', 'E', 'B', 'F#', 'C#', 'G#', 'D#', 'A#', 'F', 'C', 'G', 'D'];
  const index = ((fifths % 12) + 12) % 12;
  return mode === 'minor' ? minorCircle[index] : majorCircle[index];
}

function pitchToMidi(step: string, octave: number, alter = 0): number {
  return (octave + 1) * 12 + (STEP_SEMITONES[step] ?? 0) + alter;
}

function midiToPitch(midi: number): { step: string; octave: number; alter: number } {
  const pitchClass = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  const stepIndex = STEP_ORDER.findIndex((step) => STEP_SEMITONES[step] === pitchClass);
  if (stepIndex >= 0) {
    return { step: STEP_ORDER[stepIndex], octave, alter: 0 };
  }
  const lower = STEP_ORDER.findLastIndex((step) => STEP_SEMITONES[step] < pitchClass);
  const step = STEP_ORDER[Math.max(0, lower)];
  return { step, octave, alter: pitchClass - (STEP_SEMITONES[step] ?? 0) };
}

function transposePitchXml(pitchXml: string, semitones: number): string {
  const stepMatch = pitchXml.match(/<step>([A-G])<\/step>/);
  const octaveMatch = pitchXml.match(/<octave>(-?\d+)<\/octave>/);
  const alterMatch = pitchXml.match(/<alter>(-?\d+)<\/alter>/);
  if (!stepMatch || !octaveMatch) return pitchXml;
  const midi = pitchToMidi(stepMatch[1], Number(octaveMatch[1]), alterMatch ? Number(alterMatch[1]) : 0);
  const transposed = midiToPitch(midi + semitones);
  const alterTag =
    transposed.alter !== 0 ? `<alter>${transposed.alter}</alter>` : '';
  return `<pitch><step>${transposed.step}</step>${alterTag}<octave>${transposed.octave}</octave></pitch>`;
}

export async function transposeMusicXmlFile(
  inputUri: string,
  outputUri: string,
  target: TargetKey
): Promise<{ sourceKey: TargetKey; outputXml: string }> {
  const xml = await readMusicXmlContent(inputUri);
  const fifths = parseFifths(xml);
  const sourceMode = /<mode>minor<\/mode>/.test(xml) ? 'minor' : 'major';
  const sourceTonic = fifths !== null ? fifthsToTonic(fifths, sourceMode) : 'C';
  const sourceKey: TargetKey = { tonic: sourceTonic, mode: sourceMode };
  const sourceSemitone = TARGET_SEMITONES[sourceTonic] ?? 0;
  const targetSemitone = TARGET_SEMITONES[target.tonic] ?? 0;
  const interval = targetSemitone - sourceSemitone;

  const transposed = xml.replace(/<pitch>[\s\S]*?<\/pitch>/g, (pitchXml) =>
    transposePitchXml(pitchXml, interval)
  );
  const targetFifths =
    target.mode === 'major'
      ? [0, 7, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5][TARGET_SEMITONES[target.tonic] ?? 0]
      : [0, 7, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5][TARGET_SEMITONES[target.tonic] ?? 0];

  const withKey = transposed.replace(
    /<key>\s*<fifths>-?\d+<\/fifths>(?:\s*<mode>(?:major|minor)<\/mode>)?\s*<\/key>/,
    `<key><fifths>${targetFifths}</fifths><mode>${target.mode}</mode></key>`
  );

  await FileSystem.writeAsStringAsync(outputUri, withKey, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return { sourceKey, outputXml: withKey };
}
