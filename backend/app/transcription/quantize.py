import pretty_midi

GRID_STEP = 0.25  # default for simple monophonic melodies
POLYPHONIC_GRID_STEP = 0.125  # finer grid for piano with chords


def quantize_midi(
    midi_path: str,
    output_path: str,
    *,
    grid_step: float = GRID_STEP,
    min_duration: float | None = None,
) -> str:
    """Snap note starts and ends to a rhythmic grid."""
    if min_duration is None:
        min_duration = max(grid_step / 2, 0.05)

    midi = pretty_midi.PrettyMIDI(midi_path)

    for instrument in midi.instruments:
        for note in instrument.notes:
            note.start = round(note.start / grid_step) * grid_step
            duration = note.end - note.start
            snapped_duration = max(min_duration, round(duration / grid_step) * grid_step)
            note.end = note.start + snapped_duration

        instrument.notes = _dedupe_exact_pitch_duplicates(instrument.notes)

    midi.write(output_path)
    return output_path


def _dedupe_exact_pitch_duplicates(notes: list) -> list:
    """Remove only same-pitch duplicates at the same onset (keep chords)."""
    if not notes:
        return []

    ordered = sorted(notes, key=lambda note: (note.start, note.pitch))
    deduped = [ordered[0]]
    for note in ordered[1:]:
        last = deduped[-1]
        if note.start == last.start and note.pitch == last.pitch:
            if note.velocity > last.velocity:
                deduped[-1] = note
            continue
        deduped.append(note)
    return deduped
