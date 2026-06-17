"""Single-note melody cleanup for vocal or monophonic piano lines."""

from __future__ import annotations

import statistics

import pretty_midi

from app.transcription.midi_utils import clone_note, note_to_event
from app.transcription.modes.base import TranscriptionModeHandler
from app.transcription.types import CleanupDebugReport, RemovedNote, TranscriptionMode

MIN_VELOCITY_RATIO = 0.4
MAX_INTERVAL_FROM_MEDIAN = 14
ONSET_CLUSTER_SECONDS = 0.12
MIN_NOTE_END_GAP = 0.05
MERGE_OVERLAP_SECONDS = 0.05

# Scoring weights (no direction bias).
WEIGHT_VELOCITY = 0.35
WEIGHT_DURATION = 0.15
WEIGHT_MEDIAN_PROXIMITY = 0.20
WEIGHT_CONTINUITY = 0.30


def _score_note(
    note: pretty_midi.Note,
    *,
    previous_pitch: int | None,
    max_velocity: int,
    median_pitch: float | None,
) -> float:
    duration = max(note.end - note.start, 0.01)
    velocity_score = note.velocity / max(max_velocity, 1)
    duration_score = min(duration / 0.5, 1.0)

    if median_pitch is not None:
        interval_from_median = abs(note.pitch - median_pitch)
        median_score = max(0.0, 1.0 - interval_from_median / MAX_INTERVAL_FROM_MEDIAN)
    else:
        median_score = 1.0

    if previous_pitch is None:
        continuity_score = 1.0
    else:
        interval = abs(note.pitch - previous_pitch)
        if interval == 0:
            continuity_score = 0.95
        elif interval <= 7:
            continuity_score = 1.0 - interval * 0.03
        elif interval <= 12:
            continuity_score = 0.75
        else:
            continuity_score = max(0.2, 1.0 - interval * 0.05)

    return (
        WEIGHT_VELOCITY * velocity_score
        + WEIGHT_DURATION * duration_score
        + WEIGHT_MEDIAN_PROXIMITY * median_score
        + WEIGHT_CONTINUITY * continuity_score
    )


def _cluster_onsets(notes: list[pretty_midi.Note]) -> list[list[pretty_midi.Note]]:
    ordered = sorted(notes, key=lambda note: note.start)
    clusters: list[list[pretty_midi.Note]] = []

    for note in ordered:
        if not clusters or note.start - clusters[-1][0].start > ONSET_CLUSTER_SECONDS:
            clusters.append([note])
        else:
            clusters[-1].append(note)

    return clusters


class MonophonicMelodyMode(TranscriptionModeHandler):
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
        working, removed = self._filter_median_outliers(working, removed)
        working, removed = self._trim_leading_noise(working, removed)
        working, removed = self._pick_best_per_onset(working, removed)
        working = self._truncate_note_ends(working)
        working = [note for note in working if note.end > note.start + MIN_NOTE_END_GAP]
        working = self._merge_overlapping_duplicates(working)

        final_events = [note_to_event(note) for note in working]
        report = CleanupDebugReport(
            mode=TranscriptionMode.MONOPHONIC_MELODY.value,
            raw_note_count=len(raw_events),
            final_note_count=len(final_events),
            removed_note_count=len(removed),
            raw_notes=raw_events,
            removed_notes=removed,
            final_notes=final_events,
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
        min_velocity = max(20, int(max_velocity * min_velocity_ratio))
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

    def _filter_median_outliers(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        if len(notes) < 3:
            return notes, removed

        median_pitch = statistics.median(note.pitch for note in notes)
        kept: list[pretty_midi.Note] = []

        for note in notes:
            if abs(note.pitch - median_pitch) <= MAX_INTERVAL_FROM_MEDIAN:
                kept.append(note)
            else:
                removed.append(
                    RemovedNote(
                        note=note_to_event(note),
                        reason="far_from_median_pitch",
                        step="median_outlier_filter",
                    )
                )
        return kept, removed

    def _trim_leading_noise(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        if len(notes) < 2:
            return notes, removed

        ordered = sorted(notes, key=lambda note: note.start)
        strong_threshold = max(note.velocity for note in ordered) * 0.55

        for index, note in enumerate(ordered):
            if note.velocity >= strong_threshold:
                for dropped in ordered[:index]:
                    removed.append(
                        RemovedNote(
                            note=note_to_event(dropped),
                            reason="leading_noise",
                            step="trim_leading_noise",
                        )
                    )
                return ordered[index:], removed

        return ordered, removed

    def _pick_best_per_onset(
        self,
        notes: list[pretty_midi.Note],
        removed: list[RemovedNote],
    ) -> tuple[list[pretty_midi.Note], list[RemovedNote]]:
        if not notes:
            return notes, removed

        max_velocity = max(note.velocity for note in notes)
        median_pitch = statistics.median(note.pitch for note in notes)
        clusters = _cluster_onsets(notes)
        melody: list[pretty_midi.Note] = []
        previous_pitch: int | None = None

        for cluster in clusters:
            scored = [
                (
                    note,
                    _score_note(
                        note,
                        previous_pitch=previous_pitch,
                        max_velocity=max_velocity,
                        median_pitch=median_pitch,
                    ),
                )
                for note in cluster
            ]
            scored.sort(key=lambda item: item[1], reverse=True)
            winner, winner_score = scored[0]

            for candidate, candidate_score in scored[1:]:
                overlap = min(winner.end, candidate.end) - max(winner.start, candidate.start)
                if overlap > 0 and candidate_score > winner_score:
                    removed.append(
                        RemovedNote(
                            note=note_to_event(winner),
                            reason="weaker_than_overlapping_note",
                            step="onset_cluster_selection",
                        )
                    )
                    winner = candidate
                    winner_score = candidate_score
                else:
                    removed.append(
                        RemovedNote(
                            note=note_to_event(candidate),
                            reason="lower_score_in_onset_cluster",
                            step="onset_cluster_selection",
                        )
                    )

            chosen = clone_note(winner)
            if melody:
                chosen.start = max(chosen.start, melody[-1].start)
            melody.append(chosen)
            previous_pitch = chosen.pitch

        return melody, removed

    def _truncate_note_ends(self, notes: list[pretty_midi.Note]) -> list[pretty_midi.Note]:
        for index in range(len(notes) - 1):
            notes[index].end = min(notes[index].end, notes[index + 1].start)
            if notes[index].end <= notes[index].start:
                notes[index].end = notes[index].start + 0.1

        if notes:
            notes[-1].end = max(notes[-1].end, notes[-1].start + 0.25)

        return notes

    def _merge_overlapping_duplicates(
        self,
        notes: list[pretty_midi.Note],
    ) -> list[pretty_midi.Note]:
        """Merge only same-pitch overlaps (duplicate detections), not re-attacks."""
        if not notes:
            return []

        merged: list[pretty_midi.Note] = [clone_note(notes[0])]
        for note in notes[1:]:
            last = merged[-1]
            if note.pitch == last.pitch and note.start < last.end - MERGE_OVERLAP_SECONDS:
                last.end = max(last.end, note.end)
                last.velocity = max(last.velocity, note.velocity)
            else:
                merged.append(clone_note(note))

        return merged
