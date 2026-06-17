"""Keep overlapping notes for piano with left-hand + right-hand texture."""

from __future__ import annotations

import pretty_midi

from app.transcription.midi_utils import clone_note, note_to_event
from app.transcription.modes.base import TranscriptionModeHandler
from app.transcription.types import CleanupDebugReport, RemovedNote, TranscriptionMode

MIN_NOTE_DURATION = 0.06
MIN_VELOCITY_RATIO = 0.28
DUPLICATE_ONSET_SECONDS = 0.04
HARMONIC_ONSET_SECONDS = 0.06
WEAKER_HARMONIC_VELOCITY_RATIO = 0.55


def _max_simultaneous_notes(notes: list[pretty_midi.Note]) -> int:
    if not notes:
        return 0
    events: list[tuple[float, int]] = []
    for note in notes:
        events.append((note.start, 1))
        events.append((note.end, -1))
    events.sort(key=lambda item: (item[0], -item[1]))
    active = 0
    peak = 0
    for _, delta in events:
        active += delta
        peak = max(peak, active)
    return peak


class PianoPolyphonicMode(TranscriptionModeHandler):
    def cleanup(
        self,
        notes: list[pretty_midi.Note],
        *,
        min_pitch: int,
        max_pitch: int,
        min_velocity_ratio: float | None = None,
    ) -> tuple[list[pretty_midi.Note], CleanupDebugReport]:
        velocity_ratio = (
            min_velocity_ratio if min_velocity_ratio is not None else MIN_VELOCITY_RATIO
        )
        raw_events = [note_to_event(note) for note in notes]
        removed: list[RemovedNote] = []
        working = [clone_note(note) for note in notes]

        working, removed = self._filter_pitch_range(
            working, removed, min_pitch, max_pitch
        )
        working, removed = self._filter_velocity(working, removed, velocity_ratio)
        working, removed = self._filter_short_notes(working, removed)
        working, removed = self._dedupe_same_pitch_onsets(working, removed)
        working, removed = self._drop_weaker_octave_doubles(working, removed)
        working = sorted(working, key=lambda note: (note.start, note.pitch))

        final_events = [note_to_event(note) for note in working]
        report = CleanupDebugReport(
            mode=TranscriptionMode.PIANO_POLYPHONIC.value,
            raw_note_count=len(raw_events),
            final_note_count=len(final_events),
            removed_note_count=len(removed),
            raw_notes=raw_events,
            removed_notes=removed,
            final_notes=final_events,
            max_simultaneous_notes=_max_simultaneous_notes(working),
        )
        return working, report

    def _filter_pitch_range(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
        min_pitch: int,
        max_pitch: int,
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        kept: list[pretty_midi.Note] = []
        for note in notes:
            if min_pitch <= note.pitch <= max_pitch:
                kept.append(note)
            else:
                removed.append(
                    RemovedNote(
                        note=note_to_event(note),
                        reason="outside_pitch_range",
                        step="pitch_range_filter",
                    )
                )
        return kept, removed

    def _filter_velocity(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
        min_velocity_ratio: float,
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        if not notes:
            return notes, removed

        max_velocity = max(note.velocity for note in notes)
        min_velocity = max(18, int(max_velocity * min_velocity_ratio))
        kept: list[pretty_midi.Note] = []

        for note in notes:
            if note.velocity >= min_velocity:
                kept.append(note)
            else:
                removed.append(
                    RemovedNote(
                        note=note_to_event(note),
                        reason="below_velocity_threshold",
                        step="velocity_filter",
                    )
                )
        return kept, removed

    def _filter_short_notes(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        kept: list[pretty_midi.Note] = []
        for note in notes:
            if note.end - note.start >= MIN_NOTE_DURATION:
                kept.append(note)
            else:
                removed.append(
                    RemovedNote(
                        note=note_to_event(note),
                        reason="note_too_short",
                        step="duration_filter",
                    )
                )
        return kept, removed

    def _dedupe_same_pitch_onsets(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        kept: list[pretty_midi.Note] = []
        for note in sorted(notes, key=lambda n: (n.pitch, n.start)):
            duplicate = next(
                (
                    existing
                    for existing in kept
                    if existing.pitch == note.pitch
                    and abs(existing.start - note.start) <= DUPLICATE_ONSET_SECONDS
                ),
                None,
            )
            if duplicate is None:
                kept.append(clone_note(note))
            elif note.velocity > duplicate.velocity:
                removed.append(
                    RemovedNote(
                        note=note_to_event(duplicate),
                        reason="duplicate_onset_lower_velocity",
                        step="duplicate_onset_filter",
                    )
                )
                kept[kept.index(duplicate)] = clone_note(note)
            else:
                removed.append(
                    RemovedNote(
                        note=note_to_event(note),
                        reason="duplicate_onset_lower_velocity",
                        step="duplicate_onset_filter",
                    )
                )
        return sorted(kept, key=lambda n: (n.start, n.pitch)), removed

    def _drop_weaker_octave_doubles(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        """Drop likely harmonic doubles (±12 semitones), not true chords."""
        kept: list[pretty_midi.Note] = []
        for note in notes:
            harmonic_match = next(
                (
                    existing
                    for existing in kept
                    if abs(existing.start - note.start) <= HARMONIC_ONSET_SECONDS
                    and abs(existing.pitch - note.pitch) in (12, 24)
                ),
                None,
            )
            if harmonic_match:
                if note.velocity < harmonic_match.velocity * WEAKER_HARMONIC_VELOCITY_RATIO:
                    removed.append(
                        RemovedNote(
                            note=note_to_event(note),
                            reason="weaker_octave_duplicate",
                            step="harmonic_dedupe",
                        )
                    )
                    continue
                if harmonic_match.velocity < note.velocity * WEAKER_HARMONIC_VELOCITY_RATIO:
                    index = kept.index(harmonic_match)
                    removed.append(
                        RemovedNote(
                            note=note_to_event(harmonic_match),
                            reason="weaker_octave_duplicate",
                            step="harmonic_dedupe",
                        )
                    )
                    kept[index] = clone_note(note)
                    continue

            kept.append(clone_note(note))

        return sorted(kept, key=lambda n: (n.start, n.pitch)), removed
