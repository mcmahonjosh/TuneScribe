import * as FileSystem from 'expo-file-system/legacy';

import { type MidiNote, sortNotes } from '@/services/local/midiTypes';
import { type TargetKey } from '@/types/transpose';

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const TEMPO_BPM = 120;
const BEATS_PER_MEASURE = 4;
/** Divisions per quarter note. */
const DIVISIONS = 4;
const MEASURE_DIVS = BEATS_PER_MEASURE * DIVISIONS;
/** Middle C and above → treble; below → bass. */
const SPLIT_MIDI = 60;
const ONSET_MERGE_BEATS = 0.12;

const TONIC_TO_SEMITONE: Record<string, number> = {
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

const MAJOR_FIFTHS = [0, 7, 2, -3, 4, -1, 6, 1, -4, 3, -2, 5];

function fifthsForKey(key?: TargetKey): { fifths: number; mode: string } {
  if (!key) {
    return { fifths: 0, mode: 'major' };
  }
  const semitone = TONIC_TO_SEMITONE[key.tonic] ?? 0;
  return { fifths: MAJOR_FIFTHS[semitone] ?? 0, mode: key.mode };
}

type StaffNumber = 1 | 2;

function pitchToStep(pitch: number): { step: string; octave: number; alter?: number } {
  const name = PITCH_NAMES[((pitch % 12) + 12) % 12];
  const octave = Math.floor(pitch / 12) - 1;
  if (name.includes('#')) {
    return { step: name[0], octave, alter: 1 };
  }
  return { step: name[0], octave };
}

function secondsToBeats(seconds: number): number {
  return (seconds * TEMPO_BPM) / 60;
}

function beatsToDivisions(beats: number): number {
  return Math.max(1, Math.round(beats * DIVISIONS));
}

function durationType(divisions: number): string {
  if (divisions >= DIVISIONS * 4) return 'whole';
  if (divisions >= DIVISIONS * 2) return 'half';
  if (divisions >= DIVISIONS) return 'quarter';
  if (divisions >= DIVISIONS / 2) return 'eighth';
  return '16th';
}

function noteXml(
  pitch: number,
  durationDivs: number,
  options: { chord?: boolean; rest?: boolean; staff: StaffNumber }
): string {
  const staffXml = `<staff>${options.staff}</staff>`;
  if (options.rest) {
    return `<note>
  <rest/>
  <duration>${durationDivs}</duration>
  <type>${durationType(durationDivs)}</type>
  ${staffXml}
</note>`;
  }
  const { step, octave, alter } = pitchToStep(pitch);
  const alterXml = alter ? `<alter>${alter}</alter>` : '';
  const chordXml = options.chord ? '<chord/>\n  ' : '';
  return `<note>
  ${chordXml}<pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch>
  <duration>${durationDivs}</duration>
  <type>${durationType(durationDivs)}</type>
  ${staffXml}
</note>`;
}

interface OnsetGroup {
  startBeat: number;
  endBeat: number;
  pitches: number[];
}

function groupOnsets(notes: MidiNote[]): OnsetGroup[] {
  const ordered = sortNotes(notes);
  const groups: OnsetGroup[] = [];

  for (const note of ordered) {
    const startBeat = secondsToBeats(note.start);
    const endBeat = Math.max(startBeat + 0.25, secondsToBeats(note.end));
    const last = groups[groups.length - 1];
    if (last && Math.abs(startBeat - last.startBeat) <= ONSET_MERGE_BEATS) {
      if (!last.pitches.includes(note.pitch)) {
        last.pitches.push(note.pitch);
      }
      last.endBeat = Math.max(last.endBeat, endBeat);
      continue;
    }
    groups.push({
      startBeat,
      endBeat,
      pitches: [note.pitch],
    });
  }

  for (const group of groups) {
    group.pitches.sort((a, b) => a - b);
  }
  return groups;
}

function splitDuration(totalDivs: number): number[] {
  const parts: number[] = [];
  let remaining = totalDivs;
  const units = [DIVISIONS * 4, DIVISIONS * 2, DIVISIONS, DIVISIONS / 2, 1].map((value) =>
    Math.max(1, Math.round(value))
  );
  for (const unit of units) {
    while (remaining >= unit) {
      parts.push(unit);
      remaining -= unit;
    }
  }
  if (remaining > 0) parts.push(remaining);
  return parts.length ? parts : [1];
}

function emitRest(divs: number, staff: StaffNumber): string {
  return splitDuration(divs)
    .map((part) => noteXml(0, part, { rest: true, staff }))
    .join('\n');
}

function emitChord(pitches: number[], divs: number, staff: StaffNumber): string {
  const duration = Math.max(1, divs);
  return pitches
    .map((pitch, pitchIndex) => noteXml(pitch, duration, { chord: pitchIndex > 0, staff }))
    .join('\n');
}

function filterGroupsForStaff(
  groups: OnsetGroup[],
  staff: StaffNumber
): OnsetGroup[] {
  const keep = (pitch: number) =>
    staff === 1 ? pitch >= SPLIT_MIDI : pitch < SPLIT_MIDI;

  return groups
    .map((group) => ({
      ...group,
      pitches: group.pitches.filter(keep),
    }))
    .filter((group) => group.pitches.length > 0);
}

function emitStaffTimeline(
  groups: OnsetGroup[],
  measureStart: number,
  measureEnd: number,
  staff: StaffNumber
): string {
  const inMeasure = filterGroupsForStaff(groups, staff).filter(
    (group) => group.startBeat < measureEnd && group.startBeat >= measureStart - 0.001
  );

  if (!inMeasure.length) {
    return emitRest(MEASURE_DIVS, staff);
  }

  const chunks: string[] = [];
  let cursor = measureStart;

  for (const group of inMeasure) {
    const onset = Math.max(group.startBeat, measureStart);
    if (onset > cursor + 1e-6) {
      chunks.push(emitRest(beatsToDivisions(onset - cursor), staff));
    }

    const nextOnset = inMeasure.find((candidate) => candidate.startBeat > group.startBeat + 1e-6);
    const naturalEnd = Math.min(group.endBeat, measureEnd);
    const cappedEnd = nextOnset ? Math.min(naturalEnd, nextOnset.startBeat) : naturalEnd;
    const durationBeats = Math.max(0.25, cappedEnd - onset);
    chunks.push(emitChord(group.pitches, beatsToDivisions(durationBeats), staff));
    cursor = onset + durationBeats;
  }

  if (cursor < measureEnd - 1e-6) {
    chunks.push(emitRest(beatsToDivisions(measureEnd - cursor), staff));
  }

  return chunks.join('\n');
}

function buildMeasures(groups: OnsetGroup[], key?: TargetKey): string[] {
  const { fifths, mode } = fifthsForKey(key);
  const endBeat = groups.length
    ? Math.max(...groups.map((group) => group.endBeat))
    : BEATS_PER_MEASURE;
  const measureCount = Math.max(1, Math.ceil(endBeat / BEATS_PER_MEASURE));
  const measures: string[] = [];

  for (let measureIndex = 0; measureIndex < measureCount; measureIndex += 1) {
    const measureStart = measureIndex * BEATS_PER_MEASURE;
    const measureEnd = measureStart + BEATS_PER_MEASURE;

    const attributes =
      measureIndex === 0
        ? `<attributes>
    <divisions>${DIVISIONS}</divisions>
    <key><fifths>${fifths}</fifths><mode>${mode}</mode></key>
    <time><beats>${BEATS_PER_MEASURE}</beats><beat-type>4</beat-type></time>
    <staves>2</staves>
    <clef number="1"><sign>G</sign><line>2</line></clef>
    <clef number="2"><sign>F</sign><line>4</line></clef>
  </attributes>
  `
        : '';

    const treble = emitStaffTimeline(groups, measureStart, measureEnd, 1);
    const bass = emitStaffTimeline(groups, measureStart, measureEnd, 2);
    const backup = `<backup><duration>${MEASURE_DIVS}</duration></backup>`;

    measures.push(`<measure number="${measureIndex + 1}">
  ${attributes}${treble}
  ${backup}
  ${bass}
</measure>`);
  }

  return measures;
}

export async function exportMusicXmlFromNotes(
  outputPath: string,
  notes: MidiNote[],
  title = 'TuneScribe Transcription',
  key?: TargetKey
): Promise<string> {
  const groups = groupOnsets(notes);
  const measures = buildMeasures(groups, key);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>${escapeXml(title)}</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    ${measures.join('\n')}
  </part>
</score-partwise>`;
  await FileSystem.writeAsStringAsync(outputPath, xml, {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return outputPath;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
