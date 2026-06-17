import * as FileSystem from 'expo-file-system/legacy';

import { type MidiNote, sortNotes } from '@/services/local/midiTypes';

const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

function pitchToStep(pitch: number): { step: string; octave: number; alter?: number } {
  const name = PITCH_NAMES[pitch % 12];
  const octave = Math.floor(pitch / 12) - 1;
  if (name.includes('#')) {
    return { step: name[0], octave, alter: 1 };
  }
  if (name.includes('b')) {
    return { step: name[0], octave, alter: -1 };
  }
  return { step: name[0], octave };
}

function noteToXml(note: MidiNote, divisions: number): string {
  const duration = Math.max(1, Math.round((note.end - note.start) * divisions * 2));
  const { step, octave, alter } = pitchToStep(note.pitch);
  const alterXml = alter ? `<alter>${alter}</alter>` : '';
  return `<note>
  <pitch><step>${step}</step>${alterXml}<octave>${octave}</octave></pitch>
  <duration>${duration}</duration>
  <type>quarter</type>
</note>`;
}

export async function exportMusicXmlFromNotes(
  outputPath: string,
  notes: MidiNote[],
  title = 'TuneScribe Transcription'
): Promise<string> {
  const ordered = sortNotes(notes);
  const divisions = 1;
  const measureNotes = ordered.map((note) => noteToXml(note, divisions)).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 3.1 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">
<score-partwise version="3.1">
  <work><work-title>${escapeXml(title)}</work-title></work>
  <part-list>
    <score-part id="P1"><part-name>Piano</part-name></score-part>
  </part-list>
  <part id="P1">
    <measure number="1">
      <attributes>
        <divisions>${divisions}</divisions>
        <key><fifths>0</fifths></key>
        <time><beats>4</beats><beat-type>4</beat-type></time>
        <clef><sign>G</sign><line>2</line></clef>
      </attributes>
      ${measureNotes}
    </measure>
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
