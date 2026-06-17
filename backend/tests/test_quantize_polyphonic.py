"""Quantization must preserve chords at the same onset."""

from __future__ import annotations

import tempfile
from pathlib import Path

import pretty_midi

from app.transcription.quantize import quantize_midi


def _write_chord_midi(path: Path) -> None:
    midi = pretty_midi.PrettyMIDI()
    instrument = pretty_midi.Instrument(program=0)
    start = 1.02
    for pitch in (60, 64, 67):
        instrument.notes.append(
            pretty_midi.Note(velocity=80, pitch=pitch, start=start, end=start + 0.48)
        )
    midi.instruments.append(instrument)
    midi.write(str(path))


def test_quantize_keeps_chord_notes():
    with tempfile.TemporaryDirectory() as tmp:
        source = Path(tmp) / "in.mid"
        output = Path(tmp) / "out.mid"
        _write_chord_midi(source)
        quantize_midi(str(source), str(output), grid_step=0.125)

        result = pretty_midi.PrettyMIDI(str(output))
        pitches = sorted(note.pitch for note in result.instruments[0].notes)
        assert pitches == [60, 64, 67]
