from __future__ import annotations

from abc import ABC, abstractmethod

import pretty_midi

from app.transcription.types import CleanupDebugReport


class TranscriptionModeHandler(ABC):
    @abstractmethod
    def cleanup(
        self,
        notes: list[pretty_midi.Note],
        *,
        min_pitch: int,
        max_pitch: int,
        min_velocity_ratio: float | None = None,
    ) -> tuple[list[pretty_midi.Note], CleanupDebugReport]:
        """Return cleaned notes and a debug report."""
