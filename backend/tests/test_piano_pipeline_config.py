"""Pipeline uses piano-wide pitch range for polyphonic mode."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pretty_midi

from app.transcription.config import PIANO_MIN_PITCH, PIANO_MAX_PITCH
from app.transcription.pipeline import run_cleanup_pipeline
from app.transcription.types import TranscriptionMode


def test_polyphonic_keeps_low_bass_note():
    midi = pretty_midi.PrettyMIDI()
    instrument = pretty_midi.Instrument(program=0)
    instrument.notes.append(
        pretty_midi.Note(velocity=70, pitch=PIANO_MIN_PITCH, start=0.0, end=0.5)
    )
    instrument.notes.append(
        pretty_midi.Note(velocity=75, pitch=69, start=0.0, end=0.5)
    )
    midi.instruments.append(instrument)

    with tempfile.TemporaryDirectory() as tmp:
        raw_path = Path(tmp) / "raw.mid"
        midi.write(str(raw_path))
        final_path, report = run_cleanup_pipeline(
            raw_path,
            Path(tmp),
            mode=TranscriptionMode.PIANO_POLYPHONIC,
        )
        assert report.final_note_count == 2
        result = pretty_midi.PrettyMIDI(str(final_path))
        pitches = {note.pitch for note in result.instruments[0].notes}
        assert PIANO_MIN_PITCH in pitches
        assert 69 in pitches
