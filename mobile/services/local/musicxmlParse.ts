import { type MidiNote } from '@/services/local/midiTypes';

const STEP_SEMITONES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

const DEFAULT_TEMPO_BPM = 120;
const DEFAULT_DIVISIONS = 4;

function pitchXmlToMidi(pitchXml: string): number | null {
  const step = pitchXml.match(/<step>([A-G])<\/step>/)?.[1];
  const octave = pitchXml.match(/<octave>(-?\d+)<\/octave>/)?.[1];
  if (!step || octave === undefined) return null;
  const alter = Number(pitchXml.match(/<alter>(-?\d+)<\/alter>/)?.[1] ?? 0);
  return (Number(octave) + 1) * 12 + (STEP_SEMITONES[step] ?? 0) + alter;
}

/**
 * Convert MusicXML note events into MidiNote timings (seconds at assumed tempo).
 * Handles chords and `<backup>` for grand-staff scores.
 */
export function parseMusicXmlToMidiNotes(
  xml: string,
  tempoBpm = DEFAULT_TEMPO_BPM
): MidiNote[] {
  const divisionsMatch = xml.match(/<divisions>(\d+)<\/divisions>/);
  const divisions = Math.max(1, Number(divisionsMatch?.[1] ?? DEFAULT_DIVISIONS));
  const secondsPerDivision = 60 / tempoBpm / divisions;

  const notes: MidiNote[] = [];
  let cursor = 0;
  let lastOnset = 0;

  const noteRegex = /<note\b[\s\S]*?<\/note>|<backup>\s*<duration>(\d+)<\/duration>\s*<\/backup>/g;
  let match: RegExpExecArray | null;
  while ((match = noteRegex.exec(xml)) !== null) {
    const token = match[0];
    if (token.startsWith('<backup>')) {
      const backupDivs = Number(match[1] ?? 0);
      cursor = Math.max(0, cursor - backupDivs);
      continue;
    }

    const isChord = /<chord\s*\/>/.test(token) || /<chord><\/chord>/.test(token);
    const isRest = /<rest\b/.test(token);
    const durationMatch = token.match(/<duration>(\d+)<\/duration>/);
    const durationDivs = Math.max(1, Number(durationMatch?.[1] ?? divisions));

    if (!isChord) {
      lastOnset = cursor;
    }

    if (!isRest) {
      const pitchMatch = token.match(/<pitch>[\s\S]*?<\/pitch>/);
      const midi = pitchMatch ? pitchXmlToMidi(pitchMatch[0]) : null;
      if (midi !== null) {
        const start = lastOnset * secondsPerDivision;
        const end = start + durationDivs * secondsPerDivision;
        notes.push({
          pitch: midi,
          start,
          end: Math.max(start + 0.05, end),
          velocity: 90,
        });
      }
    }

    if (!isChord) {
      cursor += durationDivs;
    }
  }

  return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
