"""Mode-specific transcription tuning."""

from __future__ import annotations

from app.transcription.types import TranscriptionMode

# Pitch limits (MIDI note numbers).
PIANO_MIN_PITCH = 36  # C2
PIANO_MAX_PITCH = 96  # C7
MELODY_MIN_PITCH = 50  # D3
MELODY_MAX_PITCH = 84  # C6

# Basic Pitch frequency limits for piano (Hz).
PIANO_MIN_FREQUENCY = 27.5  # A0
PIANO_MAX_FREQUENCY = 4186.0  # C8

# Post-processing.
POLYPHONIC_GRID_STEP = 0.125
POLYPHONIC_MIN_NOTE_DURATION = 0.06
MONOPHONIC_GRID_STEP = 0.25
MONOPHONIC_MIN_NOTE_DURATION = 0.12


def pitch_range_for_mode(mode: TranscriptionMode) -> tuple[int, int]:
    if mode == TranscriptionMode.PIANO_POLYPHONIC:
        return PIANO_MIN_PITCH, PIANO_MAX_PITCH
    if mode == TranscriptionMode.PIANO_MELODY:
        return 48, PIANO_MAX_PITCH
    return MELODY_MIN_PITCH, MELODY_MAX_PITCH


def is_polyphonic_mode(mode: TranscriptionMode) -> bool:
    return mode == TranscriptionMode.PIANO_POLYPHONIC
