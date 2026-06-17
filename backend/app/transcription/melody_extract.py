"""Backward-compatible wrapper around the monophonic melody mode."""

from __future__ import annotations

from app.transcription.midi_utils import load_notes, write_notes
from app.transcription.modes.monophonic_melody import MonophonicMelodyMode

DEFAULT_MIN_PITCH = 50
DEFAULT_MAX_PITCH = 84


def extract_melody(
    midi_path: str,
    output_path: str,
    min_pitch: int = DEFAULT_MIN_PITCH,
    max_pitch: int = DEFAULT_MAX_PITCH,
) -> str:
    notes = load_notes(midi_path)
    cleaned, _report = MonophonicMelodyMode().cleanup(
        notes,
        min_pitch=min_pitch,
        max_pitch=max_pitch,
    )
    write_notes(cleaned, output_path)
    return output_path
