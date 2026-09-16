import { describe, expect, it } from 'vitest';

import {
  cleanupNotesForMode,
  pitchRangeForMode,
  quantizeNotes,
} from '@/services/local/modeHandlers';
import { type MidiNote } from '@/services/local/midiTypes';

describe('quantizeNotes', () => {
  it('snaps starts and durations to the grid', () => {
    const notes: MidiNote[] = [
      { pitch: 60, start: 0.11, end: 0.39, velocity: 90 },
      { pitch: 62, start: 0.26, end: 0.51, velocity: 80 },
    ];
    const quantized = quantizeNotes(notes, 0.25, 0.25);
    expect(quantized[0].start).toBe(0);
    expect(quantized[0].end - quantized[0].start).toBeGreaterThanOrEqual(0.25);
    expect(quantized.every((n) => Math.abs(n.start / 0.25 - Math.round(n.start / 0.25)) < 1e-9)).toBe(
      true
    );
  });

  it('dedupes identical pitch onsets after quantize', () => {
    const notes: MidiNote[] = [
      { pitch: 60, start: 0.01, end: 0.3, velocity: 40 },
      { pitch: 60, start: 0.02, end: 0.35, velocity: 90 },
    ];
    const quantized = quantizeNotes(notes, 0.25, 0.25);
    expect(quantized.filter((n) => n.pitch === 60 && n.start === 0)).toHaveLength(1);
  });
});

describe('cleanupNotesForMode', () => {
  it('keeps multiple pitches in polyphonic mode', () => {
    const notes: MidiNote[] = [
      { pitch: 60, start: 0, end: 0.5, velocity: 90 },
      { pitch: 64, start: 0, end: 0.5, velocity: 88 },
      { pitch: 67, start: 0, end: 0.5, velocity: 85 },
    ];
    const { notes: cleaned, summary } = cleanupNotesForMode(notes, 'piano_polyphonic', {
      minPitch: 21,
      maxPitch: 96,
      minVelocityRatio: 0.2,
    });
    expect(cleaned.length).toBe(3);
    expect(summary.max_simultaneous_notes).toBe(3);
  });

  it('reduces to one note per onset cluster in monophonic mode', () => {
    const notes: MidiNote[] = [
      { pitch: 60, start: 0, end: 0.4, velocity: 50 },
      { pitch: 72, start: 0.02, end: 0.4, velocity: 95 },
      { pitch: 64, start: 0.5, end: 0.9, velocity: 80 },
    ];
    const { notes: cleaned } = cleanupNotesForMode(notes, 'monophonic_melody', {
      minPitch: 48,
      maxPitch: 84,
      minVelocityRatio: 0.2,
    });
    expect(cleaned.length).toBe(2);
  });

  it('filters pitches outside the mode range', () => {
    const notes: MidiNote[] = [
      { pitch: 30, start: 0, end: 0.5, velocity: 90 },
      { pitch: 60, start: 0.5, end: 1, velocity: 90 },
    ];
    const { notes: cleaned } = cleanupNotesForMode(notes, 'piano_melody', {
      minPitch: 48,
      maxPitch: 84,
      minVelocityRatio: 0.2,
    });
    expect(cleaned.every((n) => n.pitch >= 48 && n.pitch <= 84)).toBe(true);
  });
});

describe('pitchRangeForMode', () => {
  it('returns wider range for polyphonic piano', () => {
    expect(pitchRangeForMode('piano_polyphonic')).toEqual({ min: 21, max: 96 });
    expect(pitchRangeForMode('piano_melody')).toEqual({ min: 48, max: 84 });
  });
});
