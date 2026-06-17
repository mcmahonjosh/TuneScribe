import { type CleanupDebugSummary, cloneNote, type MidiNote, sortNotes } from '@/services/local/midiTypes';

export type LocalTranscriptionMode = 'monophonic_melody' | 'piano_melody' | 'piano_polyphonic';

const MONOPHONIC_ONSET_CLUSTER = 0.12;
const MONOPHONIC_MAX_INTERVAL = 14;

function filterPitchRange(notes: MidiNote[], minPitch: number, maxPitch: number): MidiNote[] {
  return notes.filter((note) => note.pitch >= minPitch && note.pitch <= maxPitch);
}

function filterVelocity(notes: MidiNote[], minRatio: number): MidiNote[] {
  const maxVelocity = Math.max(...notes.map((note) => note.velocity), 1);
  const threshold = maxVelocity * minRatio;
  return notes.filter((note) => note.velocity >= threshold);
}

function filterShortNotes(notes: MidiNote[], minDuration: number): MidiNote[] {
  return notes.filter((note) => note.end - note.start >= minDuration);
}

function dedupeSamePitchOnsets(notes: MidiNote[], windowSec: number): MidiNote[] {
  const ordered = sortNotes(notes);
  if (windowSec <= 0) {
    const seen = new Set<string>();
    const kept: MidiNote[] = [];
    for (const note of ordered) {
      const key = `${note.pitch}:${note.start.toFixed(4)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      kept.push(cloneNote(note));
    }
    return kept;
  }

  const bucketSize = Math.max(windowSec, 0.001);
  const bestByBucket = new Map<string, MidiNote>();
  for (const note of ordered) {
    const bucket = Math.round(note.start / bucketSize);
    const key = `${note.pitch}:${bucket}`;
    const existing = bestByBucket.get(key);
    if (!existing || note.velocity > existing.velocity) {
      bestByBucket.set(key, cloneNote(note));
    }
  }
  return sortNotes([...bestByBucket.values()]);
}

function cleanupMonophonic(notes: MidiNote[], minVelocityRatio: number): MidiNote[] {
  let working = filterVelocity(notes, minVelocityRatio);
  working = sortNotes(working);
  const clusters: MidiNote[][] = [];
  for (const note of working) {
    if (!clusters.length || note.start - clusters[clusters.length - 1][0].start > MONOPHONIC_ONSET_CLUSTER) {
      clusters.push([note]);
    } else {
      clusters[clusters.length - 1].push(note);
    }
  }

  const medianPitch =
    working.length > 0
      ? working.map((note) => note.pitch).sort((a, b) => a - b)[Math.floor(working.length / 2)]
      : null;

  const selected: MidiNote[] = [];
  let previousPitch: number | null = null;
  for (const cluster of clusters) {
    const scored = cluster
      .map((note) => {
        const duration = Math.max(note.end - note.start, 0.01);
        const velocityScore = note.velocity / 127;
        const durationScore = Math.min(duration / 0.5, 1);
        const medianScore =
          medianPitch === null
            ? 1
            : Math.max(0, 1 - Math.abs(note.pitch - medianPitch) / MONOPHONIC_MAX_INTERVAL);
        const interval = previousPitch === null ? 0 : Math.abs(note.pitch - previousPitch);
        const continuityScore =
          previousPitch === null ? 1 : interval <= 7 ? 1 - interval * 0.03 : Math.max(0.2, 1 - interval * 0.05);
        const score =
          0.35 * velocityScore + 0.15 * durationScore + 0.2 * medianScore + 0.3 * continuityScore;
        return { note, score };
      })
      .sort((a, b) => b.score - a.score);
    const winner = scored[0]?.note;
    if (winner) {
      selected.push(cloneNote(winner));
      previousPitch = winner.pitch;
    }
  }
  return selected;
}

function cleanupPolyphonic(notes: MidiNote[], minVelocityRatio: number): MidiNote[] {
  let working = filterVelocity(notes, minVelocityRatio);
  working = filterShortNotes(working, 0.06);
  working = dedupeSamePitchOnsets(working, 0.04);
  return sortNotes(working);
}

export function cleanupNotesForMode(
  notes: MidiNote[],
  mode: LocalTranscriptionMode,
  options: { minPitch: number; maxPitch: number; minVelocityRatio: number }
): { notes: MidiNote[]; summary: CleanupDebugSummary } {
  const rawCount = notes.length;
  let working = filterPitchRange(notes, options.minPitch, options.maxPitch);
  if (mode === 'piano_polyphonic') {
    working = cleanupPolyphonic(working, options.minVelocityRatio);
  } else {
    working = cleanupMonophonic(working, options.minVelocityRatio);
  }
  return {
    notes: working,
    summary: {
      raw_note_count: rawCount,
      final_note_count: working.length,
      removed_note_count: Math.max(0, rawCount - working.length),
      max_simultaneous_notes:
        mode === 'piano_polyphonic' ? countMaxSimultaneous(working) : undefined,
    },
  };
}

function countMaxSimultaneous(notes: MidiNote[]): number {
  const events: Array<[number, number]> = [];
  for (const note of notes) {
    events.push([note.start, 1], [note.end, -1]);
  }
  events.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  let active = 0;
  let peak = 0;
  for (const [, delta] of events) {
    active += delta;
    peak = Math.max(peak, active);
  }
  return peak;
}

export function quantizeNotes(
  notes: MidiNote[],
  gridStep: number,
  minDuration: number
): MidiNote[] {
  const quantized = notes.map((note) => {
    const start = Math.round(note.start / gridStep) * gridStep;
    const duration = Math.max(minDuration, Math.round((note.end - note.start) / gridStep) * gridStep);
    return { ...note, start, end: start + duration };
  });
  return dedupeSamePitchOnsets(sortNotes(quantized), 0);
}

export function pitchRangeForMode(mode: LocalTranscriptionMode): { min: number; max: number } {
  if (mode === 'piano_polyphonic') return { min: 21, max: 96 };
  if (mode === 'piano_melody') return { min: 48, max: 84 };
  return { min: 48, max: 84 };
}
