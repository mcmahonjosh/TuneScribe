from __future__ import annotations

import json
from pathlib import Path

from app.transcription.cleanup import cleanup_midi
from app.transcription.config import (
    MONOPHONIC_GRID_STEP,
    MONOPHONIC_MIN_NOTE_DURATION,
    POLYPHONIC_GRID_STEP,
    POLYPHONIC_MIN_NOTE_DURATION,
    is_polyphonic_mode,
    pitch_range_for_mode,
)
from app.transcription.midi_synth import midi_to_preview_wav
from app.transcription.midi_utils import load_notes, write_notes
from app.transcription.modes import get_mode_handler
from app.transcription.quantize import quantize_midi
from app.transcription.settings import TranscriptionSettings
from app.transcription.types import CleanupDebugReport, TranscriptionMode


def run_cleanup_pipeline(
    raw_midi_path: Path,
    output_dir: Path,
    *,
    mode: TranscriptionMode = TranscriptionMode.MONOPHONIC_MELODY,
    settings: TranscriptionSettings | None = None,
    min_pitch: int | None = None,
    max_pitch: int | None = None,
) -> tuple[Path, CleanupDebugReport]:
    output_dir.mkdir(parents=True, exist_ok=True)

    if min_pitch is None or max_pitch is None:
        mode_min, mode_max = pitch_range_for_mode(mode)
        min_pitch = mode_min if min_pitch is None else min_pitch
        max_pitch = mode_max if max_pitch is None else max_pitch

    polyphonic = is_polyphonic_mode(mode)
    grid_step = POLYPHONIC_GRID_STEP if polyphonic else MONOPHONIC_GRID_STEP
    min_note_duration = (
        POLYPHONIC_MIN_NOTE_DURATION if polyphonic else MONOPHONIC_MIN_NOTE_DURATION
    )

    raw_copy_path = output_dir / "output_raw.mid"
    cleaned_path = output_dir / "output_cleaned.mid"
    final_path = output_dir / "output.mid"
    debug_path = output_dir / "debug.json"

    raw_notes = load_notes(str(raw_midi_path))
    write_notes(raw_notes, str(raw_copy_path))

    handler = get_mode_handler(mode)
    cleaned_notes, report = handler.cleanup(
        raw_notes,
        min_pitch=min_pitch,
        max_pitch=max_pitch,
        min_velocity_ratio=settings.min_velocity_ratio if settings else None,
    )
    write_notes(cleaned_notes, str(cleaned_path))

    cleanup_midi(
        str(cleaned_path),
        str(cleaned_path),
        min_note_duration=min_note_duration,
    )
    quantize_midi(
        str(cleaned_path),
        str(final_path),
        grid_step=grid_step,
        min_duration=min_note_duration,
    )

    preview_wav_path = output_dir / "preview.wav"
    try:
        midi_to_preview_wav(final_path, preview_wav_path)
    except Exception:
        preview_wav_path = None

    debug_payload = report.to_dict()
    if settings:
        debug_payload["settings_used"] = settings.to_dict()
    debug_path.write_text(json.dumps(debug_payload, indent=2), encoding="utf-8")

    return final_path, report
