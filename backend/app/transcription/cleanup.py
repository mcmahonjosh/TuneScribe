import pretty_midi

MIN_NOTE_DURATION = 0.12


def cleanup_midi(
    midi_path: str,
    output_path: str,
    *,
    min_note_duration: float = MIN_NOTE_DURATION,
) -> str:
    """Remove very short notes and normalize velocities."""
    midi = pretty_midi.PrettyMIDI(midi_path)

    for instrument in midi.instruments:
        cleaned_notes = []
        for note in instrument.notes:
            duration = note.end - note.start
            if duration < min_note_duration:
                continue
            note.velocity = max(40, min(127, note.velocity))
            cleaned_notes.append(note)
        instrument.notes = cleaned_notes

    midi.write(output_path)
    return output_path
