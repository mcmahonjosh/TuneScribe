import * as FileSystem from 'expo-file-system/legacy';
import { Midi } from '@tonejs/midi';

import { type MidiNote } from '@/services/local/midiTypes';

export function notesToMidiArrayBuffer(notes: MidiNote[], tempo = 120): ArrayBuffer {
  const midi = new Midi();
  midi.header.tempos = [{ ticks: 0, bpm: tempo }];
  const track = midi.addTrack();
  for (const note of notes) {
    track.addNote({
      midi: note.pitch,
      time: note.start,
      duration: Math.max(0.05, note.end - note.start),
      velocity: note.velocity / 127,
    });
  }
  return Uint8Array.from(midi.toArray()).buffer;
}

export async function writeMidiNotes(uri: string, notes: MidiNote[]): Promise<void> {
  const buffer = notesToMidiArrayBuffer(notes);
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode(...slice);
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
