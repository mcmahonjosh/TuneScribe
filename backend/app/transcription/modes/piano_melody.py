"""Simple piano melody mode (initially shares monophonic logic)."""

from __future__ import annotations

import pretty_midi

from app.transcription.modes.base import TranscriptionModeHandler
from app.transcription.modes.monophonic_melody import MonophonicMelodyMode
from app.transcription.types import CleanupDebugReport, TranscriptionMode


class PianoMelodyMode(TranscriptionModeHandler):
    def __init__(self) -> None:
        self._monophonic = MonophonicMelodyMode()

    def cleanup(
        self,
        notes: list[pretty_midi.Note],
        *,
        min_pitch: int,
        max_pitch: int,
        min_velocity_ratio: float | None = None,
    ) -> tuple[list[pretty_midi.Note], CleanupDebugReport]:
        cleaned, report = self._monophonic.cleanup(
            notes,
            min_pitch=min_pitch,
            max_pitch=max_pitch,
            min_velocity_ratio=min_velocity_ratio,
        )
        report.mode = TranscriptionMode.PIANO_MELODY.value
        return cleaned, report
