import { describe, expect, it } from 'vitest';

import { buildMusicXmlFromNotes } from '@/services/local/musicxmlExport';
import { parseMusicXmlToMidiNotes } from '@/services/local/musicxmlParse';
import { type MidiNote } from '@/services/local/midiTypes';

const MEASURE_DIVS = 16;

function staffDurations(measureXml: string): { treble: number; bass: number } {
  const backup = measureXml.indexOf('<backup>');
  const trebleXml = backup >= 0 ? measureXml.slice(0, backup) : measureXml;
  const bassXml = backup >= 0 ? measureXml.slice(backup) : '';

  const sum = (xml: string) => {
    let total = 0;
    const noteRe = /<note\b[\s\S]*?<\/note>/g;
    let match: RegExpExecArray | null;
    while ((match = noteRe.exec(xml)) !== null) {
      const token = match[0];
      if (/<chord\s*\/>/.test(token) || /<chord><\/chord>/.test(token)) continue;
      const duration = Number(token.match(/<duration>(\d+)<\/duration>/)?.[1] ?? 0);
      total += duration;
    }
    return total;
  };

  return { treble: sum(trebleXml), bass: sum(bassXml) };
}

describe('buildMusicXmlFromNotes', () => {
  it('fills each staff to exactly 4 beats (16 divisions)', () => {
    const notes: MidiNote[] = [
      { pitch: 60, start: 0, end: 0.5, velocity: 90 },
      { pitch: 48, start: 0, end: 1, velocity: 80 },
      { pitch: 62, start: 0.5, end: 1, velocity: 85 },
    ];
    const xml = buildMusicXmlFromNotes(notes);
    const measures = [...xml.matchAll(/<measure number="(\d+)">([\s\S]*?)<\/measure>/g)];
    expect(measures.length).toBeGreaterThanOrEqual(1);
    for (const [, , body] of measures) {
      const { treble, bass } = staffDurations(body);
      expect(treble).toBe(MEASURE_DIVS);
      expect(bass).toBe(MEASURE_DIVS);
    }
  });

  it('writes grand staff with backup and time signature', () => {
    const xml = buildMusicXmlFromNotes([{ pitch: 64, start: 0, end: 2, velocity: 90 }]);
    expect(xml).toContain('<staves>2</staves>');
    expect(xml).toContain('<backup><duration>16</duration></backup>');
    expect(xml).toContain('<beats>4</beats>');
    expect(xml).toContain('<clef number="1"><sign>G</sign>');
    expect(xml).toContain('<clef number="2"><sign>F</sign>');
  });

  it('emits chords with chord tags for simultaneous pitches', () => {
    const notes: MidiNote[] = [
      { pitch: 60, start: 0, end: 1, velocity: 90 },
      { pitch: 64, start: 0, end: 1, velocity: 90 },
      { pitch: 67, start: 0, end: 1, velocity: 90 },
    ];
    const xml = buildMusicXmlFromNotes(notes);
    expect(xml).toContain('<chord/>');
  });

  it('uses dotted and tied note types for non-power-of-two spans', () => {
    // 0.75s at 120bpm = 1.5 beats = 6 divisions = dotted quarter
    const notes: MidiNote[] = [{ pitch: 60, start: 0, end: 0.75, velocity: 90 }];
    const xml = buildMusicXmlFromNotes(notes);
    expect(xml).toMatch(/<type>quarter<\/type>\s*<dot\/>/);
  });
});

describe('export/parse round-trip', () => {
  it('preserves pitches and approximate onsets across grand staff', () => {
    const notes: MidiNote[] = [
      { pitch: 72, start: 0, end: 0.5, velocity: 90 },
      { pitch: 76, start: 0, end: 0.5, velocity: 88 },
      { pitch: 48, start: 0, end: 1, velocity: 70 },
      { pitch: 55, start: 1, end: 1.5, velocity: 75 },
      { pitch: 67, start: 1, end: 1.5, velocity: 80 },
    ];
    const xml = buildMusicXmlFromNotes(notes);
    const parsed = parseMusicXmlToMidiNotes(xml, 120);
    const pitches = parsed.map((n) => n.pitch).sort((a, b) => a - b);
    expect(pitches).toEqual([48, 55, 67, 72, 76]);
    expect(parsed.some((n) => Math.abs(n.start - 0) < 0.01 && n.pitch === 72)).toBe(true);
    expect(parsed.some((n) => Math.abs(n.start - 1) < 0.01 && n.pitch === 67)).toBe(true);
  });
});
