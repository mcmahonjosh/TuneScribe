import * as FileSystem from 'expo-file-system/legacy';
import { Midi } from '@tonejs/midi';

import { type MidiNote } from '@/services/local/midiTypes';
import { yieldToUi } from '@/services/processing/progress';

const TICKS_PER_QUARTER = 480;

function writeUint32(bytes: number[], value: number): void {
  bytes.push((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
}

function writeUint16(bytes: number[], value: number): void {
  bytes.push((value >>> 8) & 0xff, value & 0xff);
}

function writeVarLen(bytes: number[], value: number): void {
  let v = value;
  const stack: number[] = [v & 0x7f];
  while ((v >>= 7) > 0) {
    stack.push((v & 0x7f) | 0x80);
  }
  for (let i = stack.length - 1; i >= 0; i -= 1) {
    bytes.push(stack[i]);
  }
}

/** Lightweight SMF writer — avoids @tonejs/midi on the hot transcription path. */
export function notesToMidiBytes(notes: MidiNote[], tempo = 120): Uint8Array {
  const microsecondsPerQuarter = Math.round(60_000_000 / tempo);
  const secondsPerTick = 60 / tempo / TICKS_PER_QUARTER;

  type MidiEvent = { tick: number; order: number; data: number[] };
  const events: MidiEvent[] = [];

  // Tempo meta event at tick 0
  events.push({
    tick: 0,
    order: 0,
    data: [0xff, 0x51, 0x03, (microsecondsPerQuarter >> 16) & 0xff, (microsecondsPerQuarter >> 8) & 0xff, microsecondsPerQuarter & 0xff],
  });

  for (const note of notes) {
    const startTick = Math.max(0, Math.round(note.start / secondsPerTick));
    const durationTicks = Math.max(1, Math.round(Math.max(0.05, note.end - note.start) / secondsPerTick));
    const velocity = Math.max(1, Math.min(127, Math.round(note.velocity)));
    const pitch = Math.max(0, Math.min(127, Math.round(note.pitch)));
    events.push({
      tick: startTick,
      order: 1,
      data: [0x90, pitch, velocity],
    });
    events.push({
      tick: startTick + durationTicks,
      order: 2,
      data: [0x80, pitch, 0],
    });
  }

  // End of track
  events.push({ tick: events.reduce((max, event) => Math.max(max, event.tick), 0), order: 3, data: [0xff, 0x2f, 0x00] });
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track: number[] = [];
  let lastTick = 0;
  for (const event of events) {
    writeVarLen(track, event.tick - lastTick);
    track.push(...event.data);
    lastTick = event.tick;
  }

  const bytes: number[] = [];
  // Header chunk
  bytes.push(0x4d, 0x54, 0x68, 0x64); // MThd
  writeUint32(bytes, 6);
  writeUint16(bytes, 0); // format 0
  writeUint16(bytes, 1); // one track
  writeUint16(bytes, TICKS_PER_QUARTER);
  // Track chunk
  bytes.push(0x4d, 0x54, 0x72, 0x6b); // MTrk
  writeUint32(bytes, track.length);
  bytes.push(...track);

  return Uint8Array.from(bytes);
}

export function notesToMidiArrayBuffer(notes: MidiNote[], tempo = 120): ArrayBuffer {
  const bytes = notesToMidiBytes(notes, tempo);
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function writeMidiNotes(uri: string, notes: MidiNote[]): Promise<void> {
  const bytes = notesToMidiBytes(notes);
  await yieldToUi();

  // Build base64 without spreading huge typed arrays into String.fromCharCode.
  const chunkSize = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j += 1) {
      binary += String.fromCharCode(bytes[j]);
    }
    if (i > 0 && i % (chunkSize * 4) === 0) {
      await yieldToUi();
    }
  }

  await FileSystem.writeAsStringAsync(uri, btoa(binary), {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export async function readMidiNotes(uri: string): Promise<MidiNote[]> {
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  const midi = new Midi(bytes.buffer);
  const notes: MidiNote[] = [];
  for (const track of midi.tracks) {
    for (const note of track.notes) {
      notes.push({
        pitch: note.midi,
        start: note.time,
        end: note.time + note.duration,
        velocity: Math.round(note.velocity * 127),
      });
    }
  }
  return notes.sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
