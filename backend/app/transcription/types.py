from __future__ import annotations

from dataclasses import asdict, dataclass, field
from enum import Enum
from typing import Any


class TranscriptionMode(str, Enum):
    MONOPHONIC_MELODY = "monophonic_melody"
    PIANO_MELODY = "piano_melody"
    PIANO_POLYPHONIC = "piano_polyphonic"


class PianoOutputFormat(str, Enum):
    SHEET_MUSIC = "sheet_music"
    CHORDS = "chords"
    BOTH = "both"


@dataclass
class NoteEvent:
    pitch: int
    start: float
    end: float
    velocity: int
    name: str = ""

    def to_dict(self) -> dict[str, Any]:
        data = asdict(self)
        if not data["name"]:
            data["name"] = _pitch_name(self.pitch)
        return data


@dataclass
class RemovedNote:
    note: NoteEvent
    reason: str
    step: str

    def to_dict(self) -> dict[str, Any]:
        return {
            "note": self.note.to_dict(),
            "reason": self.reason,
            "step": self.step,
        }


@dataclass
class CleanupDebugReport:
    mode: str
    raw_note_count: int
    final_note_count: int
    removed_note_count: int
    raw_notes: list[NoteEvent] = field(default_factory=list)
    removed_notes: list[RemovedNote] = field(default_factory=list)
    final_notes: list[NoteEvent] = field(default_factory=list)
    max_simultaneous_notes: int | None = None

    def to_dict(self) -> dict[str, Any]:
        data: dict[str, Any] = {
            "mode": self.mode,
            "raw_note_count": self.raw_note_count,
            "final_note_count": self.final_note_count,
            "removed_note_count": self.removed_note_count,
            "raw_notes": [note.to_dict() for note in self.raw_notes],
            "removed_notes": [entry.to_dict() for entry in self.removed_notes],
            "final_notes": [note.to_dict() for note in self.final_notes],
        }
        if self.max_simultaneous_notes is not None:
            data["max_simultaneous_notes"] = self.max_simultaneous_notes
        return data


def _pitch_name(pitch: int) -> str:
    names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
    octave = pitch // 12 - 1
    return f"{names[pitch % 12]}{octave}"
