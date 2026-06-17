export interface MidiNote {
  pitch: number;
  start: number;
  end: number;
  velocity: number;
}

export interface CleanupDebugSummary {
  raw_note_count: number;
  final_note_count: number;
  removed_note_count: number;
  max_simultaneous_notes?: number;
}

export function cloneNote(note: MidiNote): MidiNote {
  return { ...note };
}

export function sortNotes(notes: MidiNote[]): MidiNote[] {
  return [...notes].sort((a, b) => a.start - b.start || a.pitch - b.pitch);
}
