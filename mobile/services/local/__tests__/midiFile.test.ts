import { describe, expect, it } from 'vitest';

import { notesToMidiBytes } from '@/services/local/midiFile';
import { type MidiNote } from '@/services/local/midiTypes';

describe('notesToMidiBytes', () => {
  it('writes a valid SMF header and track chunk', () => {
    const notes: MidiNote[] = [
      { pitch: 60, start: 0, end: 0.5, velocity: 90 },
      { pitch: 64, start: 0.5, end: 1, velocity: 80 },
    ];
    const bytes = notesToMidiBytes(notes, 120);
    expect(bytes.length).toBeGreaterThan(20);
    // MThd
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('MThd');
    // MTrk
    const trackIdx = bytes.findIndex(
      (_, i) =>
        bytes[i] === 0x4d &&
        bytes[i + 1] === 0x54 &&
        bytes[i + 2] === 0x72 &&
        bytes[i + 3] === 0x6b
    );
    expect(trackIdx).toBeGreaterThan(0);
  });

  it('includes note-on events for each pitch', () => {
    const notes: MidiNote[] = [{ pitch: 72, start: 0, end: 1, velocity: 100 }];
    const bytes = notesToMidiBytes(notes);
    const asArray = Array.from(bytes);
    const noteOn = asArray.some((b, i) => b === 0x90 && asArray[i + 1] === 72);
    expect(noteOn).toBe(true);
  });
});
