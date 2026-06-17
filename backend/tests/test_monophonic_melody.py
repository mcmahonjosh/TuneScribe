"""Synthetic MIDI tests for monophonic melody cleanup."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pretty_midi
from app.transcription.midi_utils import write_notes
from app.transcription.modes.monophonic_melody import MonophonicMelodyMode


def _make_midi(
    melody: list[tuple[int, float, float, int]],
    *,
    ghosts: bool = True,
) -> list[pretty_midi.Note]:
    """Build notes: (pitch, start, duration, velocity). Optional harmonic ghosts."""
    notes: list[pretty_midi.Note] = []
    for pitch, start, duration, velocity in melody:
        notes.append(
            pretty_midi.Note(
                velocity=velocity,
                pitch=pitch,
                start=start,
                end=start + duration,
            )
        )
        if ghosts:
            notes.append(
                pretty_midi.Note(
                    velocity=max(25, velocity - 35),
                    pitch=min(pitch + 12, 127),
                    start=start + 0.02,
                    end=start + duration * 0.6,
                )
            )
            if pitch >= 60:
                notes.append(
                    pretty_midi.Note(
                        velocity=max(20, velocity - 45),
                        pitch=pitch - 12,
                        start=start + 0.01,
                        end=start + duration * 0.4,
                    )
                )
    return notes


def _run_cleanup(notes: list[pretty_midi.Note]) -> list[int]:
    mode = MonophonicMelodyMode()
    cleaned, report = mode.cleanup(notes, min_pitch=50, max_pitch=84)
    pitches = [note.pitch for note in cleaned]
    assert report.final_note_count == len(pitches)
    return pitches


def test_descending_scale():
    # E4 down to F3
    melody = [
        (64, 0.0, 0.45, 90),
        (62, 0.5, 0.45, 88),
        (60, 1.0, 0.45, 87),
        (59, 1.5, 0.45, 86),
        (57, 2.0, 0.45, 85),
        (55, 2.5, 0.45, 84),
        (53, 3.0, 0.45, 83),
    ]
    pitches = _run_cleanup(_make_midi(melody))
    assert pitches == [64, 62, 60, 59, 57, 55, 53]


def test_ascending_scale():
    melody = [
        (53, 0.0, 0.45, 83),
        (55, 0.5, 0.45, 84),
        (57, 1.0, 0.45, 85),
        (59, 1.5, 0.45, 86),
        (60, 2.0, 0.45, 87),
        (62, 2.5, 0.45, 88),
        (64, 3.0, 0.45, 90),
    ]
    pitches = _run_cleanup(_make_midi(melody))
    assert pitches == [53, 55, 57, 59, 60, 62, 64]


def test_repeated_notes():
    melody = [
        (60, 0.0, 0.4, 85),
        (60, 0.55, 0.4, 84),
        (60, 1.1, 0.4, 83),
        (60, 1.65, 0.4, 82),
    ]
    pitches = _run_cleanup(_make_midi(melody))
    assert pitches == [60, 60, 60, 60]


def test_simple_skips():
    melody = [
        (60, 0.0, 0.5, 90),
        (64, 0.6, 0.5, 88),
        (67, 1.2, 0.5, 86),
    ]
    pitches = _run_cleanup(_make_midi(melody))
    assert pitches == [60, 64, 67]


def test_two_note_intervals():
    melody = [
        (60, 0.0, 0.5, 90),
        (64, 0.6, 0.5, 88),
        (55, 1.3, 0.5, 87),
        (59, 1.9, 0.5, 85),
    ]
    pitches = _run_cleanup(_make_midi(melody))
    assert pitches == [60, 64, 55, 59]


def test_vocal_range_melody():
    """Narrower velocities, mid-range humming-like line with ghosts."""
    melody = [
        (62, 0.0, 0.55, 72),
        (64, 0.65, 0.5, 70),
        (65, 1.25, 0.55, 68),
        (67, 1.9, 0.5, 71),
        (65, 2.55, 0.6, 69),
    ]
    pitches = _run_cleanup(_make_midi(melody, ghosts=True))
    assert pitches == [62, 64, 65, 67, 65]


def test_debug_report_written():
    notes = _make_midi([(60, 0.0, 0.5, 90), (62, 0.6, 0.5, 88)], ghosts=True)
    with tempfile.TemporaryDirectory() as tmp:
        raw_path = Path(tmp) / "raw.mid"
        write_notes(notes, str(raw_path))

        from app.transcription.pipeline import run_cleanup_pipeline
        from app.transcription.types import TranscriptionMode

        final_path, report = run_cleanup_pipeline(
            raw_path,
            Path(tmp),
            mode=TranscriptionMode.MONOPHONIC_MELODY,
        )
        assert final_path.exists()
        assert (Path(tmp) / "output_raw.mid").exists()
        assert (Path(tmp) / "output_cleaned.mid").exists()
        assert (Path(tmp) / "debug.json").exists()
        assert report.raw_note_count > report.final_note_count
