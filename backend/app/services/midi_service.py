from pathlib import Path

from app.transcription.pipeline import run_cleanup_pipeline
from app.transcription.settings import TranscriptionSettings
from app.transcription.types import CleanupDebugReport, TranscriptionMode


def process_midi(
    raw_midi_path: Path,
    output_dir: Path,
    *,
    mode: TranscriptionMode = TranscriptionMode.MONOPHONIC_MELODY,
    settings: TranscriptionSettings | None = None,
) -> tuple[Path, CleanupDebugReport]:
    return run_cleanup_pipeline(
        raw_midi_path,
        output_dir,
        mode=mode,
        settings=settings,
    )
