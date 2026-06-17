"""Tests for polyphonic piano cleanup."""

from __future__ import annotations

import pretty_midi

from app.transcription.modes.piano_polyphonic import PianoPolyphonicMode


def _note(pitch: int, start: float, duration: float, velocity: int = 80) -> pretty_midi.Note:
    return pretty_midi.Note(
        velocity=velocity,
        pitch=pitch,
        start=start,
        end=start + duration,
    )


def test_keeps_simultaneous_chord_notes():
    notes = [
        _note(60, 0.0, 0.5, 90),
        _note(64, 0.0, 0.5, 85),
        _note(67, 0.0, 0.5, 80),
        _note(72, 1.0, 0.5, 88),
    ]
    cleaned, report = PianoPolyphonicMode().cleanup(notes, min_pitch=50, max_pitch=84)
    assert len(cleaned) == 4
    assert report.max_simultaneous_notes == 3


def test_monophonic_line_still_works():
    notes = [
        _note(60, 0.0, 0.4, 90),
        _note(62, 0.5, 0.4, 88),
        _note(64, 1.0, 0.4, 86),
    ]
    cleaned, report = PianoPolyphonicMode().cleanup(notes, min_pitch=50, max_pitch=84)
    pitches = [note.pitch for note in cleaned]
    assert pitches == [60, 62, 64]
    assert report.max_simultaneous_notes == 1
