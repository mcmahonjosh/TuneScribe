from __future__ import annotations

import pretty_midi

from app.transcription.types import NoteEvent


def clone_note(note: pretty_midi.Note) -> pretty_midi.Note:
    return pretty_midi.Note(
        velocity=note.velocity,
        pitch=note.pitch,
        start=note.start,
        end=note.end,
    )


def note_to_event(note: pretty_midi.Note) -> NoteEvent:
    return NoteEvent(
        pitch=note.pitch,
        start=round(note.start, 4),
        end=round(note.end, 4),
        velocity=note.velocity,
    )


def event_to_note(event: NoteEvent) -> pretty_midi.Note:
    return pretty_midi.Note(
        velocity=event.velocity,
        pitch=event.pitch,
        start=event.start,
        end=event.end,
    )


def load_notes(midi_path: str) -> list[pretty_midi.Note]:
    midi = pretty_midi.PrettyMIDI(midi_path)
    notes: list[pretty_midi.Note] = []
    for instrument in midi.instruments:
        notes.extend(instrument.notes)
    return sorted(notes, key=lambda note: (note.start, note.pitch))


def write_notes(notes: list[pretty_midi.Note], output_path: str) -> str:
    midi = pretty_midi.PrettyMIDI()
    instrument = pretty_midi.Instrument(program=0)
    instrument.notes = [clone_note(note) for note in notes]
    midi.instruments.append(instrument)
    midi.write(output_path)
    return output_path
