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

function durationParts(totalDivs: number): { divs: number; type: string; dots: number }[] {
  const units = [
    { divs: 16, type: 'whole', dots: 0 },
    { divs: 12, type: 'half', dots: 1 },
    { divs: 8, type: 'half', dots: 0 },
    { divs: 6, type: 'quarter', dots: 1 },
    { divs: 4, type: 'quarter', dots: 0 },
    { divs: 3, type: 'eighth', dots: 1 },
    { divs: 2, type: 'eighth', dots: 0 },
    { divs: 1, type: '16th', dots: 0 },
  ];
  const parts: { divs: number; type: string; dots: number }[] = [];
  let remaining = Math.max(1, Math.round(totalDivs));
  for (const unit of units) {
    while (remaining >= unit.divs) {
      parts.push(unit);
      remaining -= unit.divs;
    }
  }
  return parts.length ? parts : [{ divs: 1, type: '16th', dots: 0 }];
}

function noteXml(
  pitch: number,
  part: { divs: number; type: string; dots: number },
  options: {
    chord?: boolean;
    rest?: boolean;
    staff: StaffNumber;
    tie?: 'start' | 'stop' | 'continue';
  }
): string {
  const staffXml = `<staff>${options.staff}</staff>`;
  const dotXml = part.dots ? '<dot/>' : '';
  const tieXml =
    options.tie === 'start'
      ? '<tie type="start"/>'
      : options.tie === 'stop'
        ? '<tie type="stop"/>'
        : options.tie === 'continue'
          ? '<tie type="stop"/><tie type="start"/>'
          : '';
  const notationsXml =
    options.tie === 'start'
      ? '<notations><tied type="start"/></notations>'
      : options.tie === 'stop'
        ? '<notations><tied type="stop"/></notations>'
        : options.tie === 'continue'
          ? '<notations><tied type="stop"/><tied type="start"/></notations>'
          : '';
  if (options.rest) {
    return `<note>
  <rest/>
  <duration>${part.divs}</duration>
  <type>${part.type}</type>
  ${dotXml}
  ${staffXml}
</note>`;
  }
  const { step, octave, alter } = pitchToStep(pitch);
  const alterXml = alter ? `<alter>${alter}</alter>` : '';
  const chordXml = options.chord ? '<chord/>\n  ' : '';
  return `<note>
  ${chordXml}<pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch>
  <duration>${part.divs}</duration>
  <type>${part.type}</type>
  ${dotXml}
  ${tieXml}
  ${staffXml}
  ${notationsXml}
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

function emitRest(divs: number, staff: StaffNumber): string {
  return durationParts(divs)
    .map((part) => noteXml(0, part, { rest: true, staff }))
    .join('\n');
}

function emitChord(pitches: number[], divs: number, staff: StaffNumber): string {
  const parts = durationParts(Math.max(1, divs));
  return parts
    .map((part, partIndex) => {
      let tie: 'start' | 'stop' | 'continue' | undefined;
      if (parts.length > 1) {
        if (partIndex === 0) tie = 'start';
        else if (partIndex === parts.length - 1) tie = 'stop';
        else tie = 'continue';
      }
      return pitches
        .map((pitch, pitchIndex) =>
          noteXml(pitch, part, { chord: pitchIndex > 0, staff, tie })
        )
        .join('\n');
    })
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
  const inMeasure = filterGroupsForStaff(groups, staff)
    .filter((group) => group.startBeat < measureEnd && group.startBeat >= measureStart - 0.001)
    .map((group) => {
      const startDiv = Math.max(
        0,
        Math.min(MEASURE_DIVS - 1, Math.round((group.startBeat - measureStart) * DIVISIONS))
      );
      const endDiv = Math.max(
        startDiv + 1,
        Math.min(MEASURE_DIVS, Math.round((group.endBeat - measureStart) * DIVISIONS))
      );
      return { startDiv, endDiv, pitches: group.pitches };
    })
    .sort((a, b) => a.startDiv - b.startDiv);

  if (!inMeasure.length) {
    return emitRest(MEASURE_DIVS, staff);
  }

  const chunks: string[] = [];
  let cursor = 0;

  for (let i = 0; i < inMeasure.length; i += 1) {
    if (cursor >= MEASURE_DIVS) break;
    const group = inMeasure[i];
    const startDiv = Math.max(cursor, group.startDiv);
    if (startDiv > cursor) {
      chunks.push(emitRest(startDiv - cursor, staff));
      cursor = startDiv;
    }
    const nextStart = inMeasure[i + 1]?.startDiv ?? MEASURE_DIVS;
    const duration = Math.max(1, Math.min(group.endDiv, nextStart, MEASURE_DIVS) - cursor);
    if (duration <= 0) continue;
    chunks.push(emitChord(group.pitches, duration, staff));
    cursor += duration;
  }

  if (cursor < MEASURE_DIVS) {
    chunks.push(emitRest(MEASURE_DIVS - cursor, staff));
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

export function buildMusicXmlFromNotes(
  notes: MidiNote[],
  title = 'TuneScribe Transcription',
  key?: TargetKey
): string {
  const groups = groupOnsets(notes);
  const measures = buildMeasures(groups, key);
  return `<?xml version="1.0" encoding="UTF-8"?>
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
}

export async function exportMusicXmlFromNotes(
  outputPath: string,
  notes: MidiNote[],
  title = 'TuneScribe Transcription',
  key?: TargetKey
): Promise<string> {
  const xml = buildMusicXmlFromNotes(notes, title, key);
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
