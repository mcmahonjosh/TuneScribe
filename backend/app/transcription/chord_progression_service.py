"""Extract chord progressions from transcribed piano MIDI."""

from __future__ import annotations

import json
from pathlib import Path

import pretty_midi
from music21 import chord, converter, roman, stream

from app.services.sheet_music_service import detect_key
from app.transcription.midi_synth import midi_to_preview_wav

MIN_CHORD_PITCHES = 2
MIN_PITCH_CLASSES = 2
MIN_CHORD_DURATION = 0.4
HARMONY_WINDOW = 1.0
BAD_CHORD_NAME_PARTS = (
    "above",
    "Perfect",
    "trichord",
    "tetrachord",
    "tetramirror",
    "quartal",
    "mirror",
    "octave",
    "incomplete",
    "enharmonic",
    "doubling",
    "Twelfth",
    "Seventeenth",
    "eleventh",
)


def _is_recognized_chord_name(name: str) -> bool:
    return bool(name) and not any(part in name for part in BAD_CHORD_NAME_PARTS)


def _shorten_chord_name(name: str) -> str:
    replacements = {
        " minor-seventh chord": "m7",
        " major-seventh chord": "maj7",
        " dominant-seventh chord": "7",
        "-major-seventh chord": "maj7",
        "-minor-seventh chord": "m7",
        "-dominant-seventh chord": "7",
        "-major triad": "",
        " major triad": "",
        "-minor triad": "m",
        " minor triad": "m",
        "-diminished triad": "dim",
        " diminished triad": "dim",
        "-augmented triad": "+",
        " augmented triad": "+",
        "-major": "",
        " major": "",
        "-minor": "m",
        " minor": "m",
        " seventh chord": "7",
    }
    result = name
    for old, new in replacements.items():
        if old in result:
            result = result.replace(old, new)
            break
    return result.strip() or name


def _chord_symbol_from_pitches(pitches: list[int]) -> str:
    if len(pitches) < MIN_CHORD_PITCHES:
        return ""
    try:
        ch = chord.Chord(pitches)
        if len(ch.pitches) < MIN_CHORD_PITCHES:
            return ""
        name = ch.pitchedCommonName
        if name and _is_recognized_chord_name(name):
            return _shorten_chord_name(name)
        root = ch.root()
        if root is None:
            return ""
        quality = ch.quality
        root_name = root.name
        if quality == "major":
            return root_name
        if quality == "minor":
            return f"{root_name}m"
        if quality == "diminished":
            return f"{root_name}dim"
        if quality == "augmented":
            return f"{root_name}+"
        return root_name
    except Exception:
        return ""


def _roman_symbol(pitches: list[int], key_obj) -> str | None:
    if len(pitches) < MIN_CHORD_PITCHES:
        return None
    try:
        ch = chord.Chord(pitches)
        if len(ch.pitches) < MIN_CHORD_PITCHES:
            return None
        rn = roman.romanNumeralFromChord(ch, key_obj)
        return rn.figure
    except Exception:
        return None


def _collect_notes(pm: pretty_midi.PrettyMIDI) -> list[pretty_midi.Note]:
    notes: list[pretty_midi.Note] = []
    for instrument in pm.instruments:
        notes.extend(instrument.notes)
    return notes


def _pitches_in_window(
    notes: list[pretty_midi.Note],
    window_start: float,
    window_end: float,
) -> list[int]:
    return sorted(
        {
            note.pitch
            for note in notes
            if note.start < window_end and note.end > window_start
        }
    )


def _pitch_class_count(pitches: list[int]) -> int:
    return len({pitch % 12 for pitch in pitches})


def _segment_harmony(
    notes: list[pretty_midi.Note],
    end_time: float,
) -> list[tuple[float, float, str, list[int]]]:
    """Build chord segments from non-overlapping harmonic windows."""
    if not notes:
        return []

    segments: list[tuple[float, float, str, list[int]]] = []
    time_sec = 0.0
    while time_sec < end_time:
        window_end = min(time_sec + HARMONY_WINDOW, end_time)
        pitches = _pitches_in_window(notes, time_sec, window_end)
        if _pitch_class_count(pitches) >= MIN_PITCH_CLASSES:
            symbol = _chord_symbol_from_pitches(pitches)
            if symbol:
                if segments and symbol == segments[-1][2]:
                    previous_start, _, previous_symbol, previous_pitches = segments[-1]
                    merged_pitches = sorted(set(previous_pitches) | set(pitches))
                    segments[-1] = (previous_start, window_end, previous_symbol, merged_pitches)
                else:
                    segments.append((time_sec, window_end, symbol, pitches))
        time_sec += HARMONY_WINDOW

    return segments


def _normalize_segment_times(segments: list[dict]) -> list[dict]:
    if not segments:
        return []

    segments.sort(key=lambda segment: segment["start"])
    normalized: list[dict] = []
    for index, segment in enumerate(segments):
        start = float(segment["start"])
        if index + 1 < len(segments):
            end = float(segments[index + 1]["start"])
        else:
            end = max(float(segment["end"]), start + MIN_CHORD_DURATION)
        if end <= start:
            end = start + MIN_CHORD_DURATION
        normalized.append(
            {
                **segment,
                "start": round(start, 3),
                "end": round(end, 3),
            }
        )
    return normalized


def _detect_key_from_midi(midi_path: Path):
    score = converter.parse(str(midi_path))
    if not isinstance(score, stream.Score):
        wrapped = stream.Score()
        if isinstance(score, stream.Part):
            wrapped.insert(0, score)
        else:
            part = stream.Part()
            part.append(score)
            wrapped.insert(0, part)
        score = wrapped
    return detect_key(score)


def extract_chord_progression(midi_path: Path) -> dict:
    """Analyze MIDI note timings (seconds) and return a chord progression."""
    pm = pretty_midi.PrettyMIDI(str(midi_path))
    notes = _collect_notes(pm)
    end_time = max(pm.get_end_time(), 0.0)
    key_obj = _detect_key_from_midi(midi_path)
    key_info = {
        "tonic": key_obj.tonic.name,
        "mode": key_obj.mode,
    }

    segments: list[dict] = []
    for start, end, symbol, pitches in _segment_harmony(notes, end_time):
        segments.append(
            {
                "start": round(start, 3),
                "end": round(end, 3),
                "symbol": symbol,
                "roman": _roman_symbol(pitches, key_obj),
                "pitches": pitches,
            }
        )

    segments = _merge_adjacent_chords(_normalize_segment_times(segments))

    return {
        "key": key_info,
        "chords": segments,
    }


def _merge_adjacent_chords(segments: list[dict]) -> list[dict]:
    if not segments:
        return []

    merged: list[dict] = []
    current = dict(segments[0])

    for segment in segments[1:]:
        same_symbol = segment["symbol"] == current["symbol"]
        same_roman = segment["roman"] == current["roman"]
        if same_symbol and same_roman:
            current["end"] = max(float(current["end"]), float(segment["end"]))
            current_pitches = sorted(
                set(current.get("pitches") or []) | set(segment.get("pitches") or [])
            )
            current["pitches"] = current_pitches
            continue
        merged.append(current)
        current = dict(segment)

    merged.append(current)
    return merged


def write_chords_preview_wav(chords: list[dict], output_path: Path) -> Path | None:
    """Synthesize block-chord preview audio from progression segments."""
    if not chords:
        return None

    midi = pretty_midi.PrettyMIDI()
    instrument = pretty_midi.Instrument(program=0)
    for segment in chords:
        pitches = segment.get("pitches") or []
        if len(pitches) < MIN_CHORD_PITCHES:
            continue
        start = float(segment["start"])
        end = max(float(segment["end"]), start + MIN_CHORD_DURATION)
        for pitch in pitches:
            instrument.notes.append(
                pretty_midi.Note(
                    velocity=76,
                    pitch=int(pitch),
                    start=start,
                    end=end,
                )
            )

    if not instrument.notes:
        return None

    midi.instruments.append(instrument)
    temp_midi = output_path.with_suffix(".chords.mid")
    midi.write(str(temp_midi))
    try:
        return midi_to_preview_wav(temp_midi, output_path)
    finally:
        temp_midi.unlink(missing_ok=True)


def write_chord_progression(midi_path: Path, output_dir: Path) -> tuple[Path, Path | None]:
    """Extract chords from MIDI and write chords.json plus block-chord preview wav."""
    data = extract_chord_progression(midi_path)
    output_dir.mkdir(parents=True, exist_ok=True)
    out_path = output_dir / "chords.json"
    out_path.write_text(json.dumps(data, indent=2), encoding="utf-8")

    preview_path = output_dir / "chords_preview.wav"
    preview = write_chords_preview_wav(data["chords"], preview_path)
    return out_path, preview
