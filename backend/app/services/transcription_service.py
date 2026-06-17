import json
from pathlib import Path

from app.config import OUTPUTS_DIR
from app.services.midi_service import process_midi
from app.services.sheet_music_service import midi_to_musicxml, musicxml_to_pdf
from app.transcription.basic_pitch_runner import run_basic_pitch
from app.transcription.chord_progression_service import write_chord_progression
from app.transcription.config import PIANO_MAX_FREQUENCY, PIANO_MIN_FREQUENCY
from app.transcription.settings import TranscriptionSettings, resolve_settings
from app.transcription.types import CleanupDebugReport, PianoOutputFormat, TranscriptionMode


def _build_debug_summary(debug_report: CleanupDebugReport) -> dict:
    summary = {
        "raw_note_count": debug_report.raw_note_count,
        "final_note_count": debug_report.final_note_count,
        "removed_note_count": debug_report.removed_note_count,
    }
    if debug_report.max_simultaneous_notes is not None:
        summary["max_simultaneous_notes"] = debug_report.max_simultaneous_notes
    return summary


def _resolve_output_format(
    mode: TranscriptionMode,
    output_format: PianoOutputFormat,
) -> PianoOutputFormat:
    if mode != TranscriptionMode.PIANO_POLYPHONIC:
        return PianoOutputFormat.SHEET_MUSIC
    return output_format


def transcribe_audio(
    input_audio_path: Path,
    *,
    mode: TranscriptionMode = TranscriptionMode.MONOPHONIC_MELODY,
    settings: TranscriptionSettings | None = None,
    output_format: PianoOutputFormat = PianoOutputFormat.SHEET_MUSIC,
) -> dict:
    job_id = input_audio_path.parent.name
    output_dir = OUTPUTS_DIR / job_id
    output_dir.mkdir(parents=True, exist_ok=True)

    if settings is None:
        settings = resolve_settings(mode)

    effective_format = _resolve_output_format(mode, output_format)

    pitch_kwargs = {}
    if mode == TranscriptionMode.PIANO_POLYPHONIC:
        pitch_kwargs = {
            "minimum_frequency": PIANO_MIN_FREQUENCY,
            "maximum_frequency": PIANO_MAX_FREQUENCY,
        }

    raw_midi = run_basic_pitch(
        input_audio_path,
        output_dir,
        melodia_trick=settings.melodia_trick,
        onset_threshold=settings.onset_threshold,
        frame_threshold=settings.frame_threshold,
        minimum_note_length=settings.minimum_note_length,
        **pitch_kwargs,
    )

    midi_path, debug_report = process_midi(
        raw_midi, output_dir, mode=mode, settings=settings
    )

    musicxml_path = None
    pdf_path = None
    musicxml_error = None
    chords_path = None
    chords_preview_path = None
    detected_key = None
    polyphonic = mode == TranscriptionMode.PIANO_POLYPHONIC

    want_sheet = effective_format in (
        PianoOutputFormat.SHEET_MUSIC,
        PianoOutputFormat.BOTH,
    )
    want_chords = effective_format in (
        PianoOutputFormat.CHORDS,
        PianoOutputFormat.BOTH,
    )

    if want_chords:
        try:
            chords_path, chords_preview_path = write_chord_progression(midi_path, output_dir)
            chord_data = json.loads(chords_path.read_text(encoding="utf-8"))
            detected_key = chord_data.get("key")
        except Exception as exc:
            if effective_format == PianoOutputFormat.CHORDS:
                raise RuntimeError(f"Chord extraction failed: {exc}") from exc
            musicxml_error = f"Chord extraction failed: {exc}"

    if want_sheet:
        try:
            musicxml_path = midi_to_musicxml(midi_path, output_dir, polyphonic=polyphonic)
            pdf_path = musicxml_to_pdf(musicxml_path, output_dir)
        except Exception as exc:
            musicxml_error = str(exc)

    return {
        "job_id": job_id,
        "mode": mode.value,
        "output_format": effective_format.value,
        "settings_used": settings.to_dict(),
        "midi_path": str(midi_path),
        "raw_midi_path": str(output_dir / "output_raw.mid"),
        "cleaned_midi_path": str(output_dir / "output_cleaned.mid"),
        "debug_path": str(output_dir / "debug.json"),
        "musicxml_path": str(musicxml_path) if musicxml_path else None,
        "pdf_path": str(pdf_path) if pdf_path else None,
        "chords_path": str(chords_path) if chords_path else None,
        "chords_preview_wav_path": str(chords_preview_path) if chords_preview_path else None,
        "detected_key": detected_key,
        "preview_wav_path": str(output_dir / "preview.wav")
        if (output_dir / "preview.wav").exists()
        else None,
        "model_used": "basic-pitch",
        "musicxml_error": musicxml_error,
        "debug_summary": _build_debug_summary(debug_report),
    }
