from __future__ import annotations

import shutil
from pathlib import Path

from fastapi import UploadFile

from app.config import ALLOWED_SHEET_EXTENSIONS, OUTPUTS_DIR, UPLOADS_DIR
from app.transcription.omr_runner import prepare_musicxml_input
from app.transcription.transpose_service import transpose_sheet_music


def create_transpose_job_dirs(job_id: str) -> tuple[Path, Path]:
    upload_dir = UPLOADS_DIR / job_id
    output_dir = OUTPUTS_DIR / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir, output_dir


def save_sheet_upload(job_id: str, upload: UploadFile) -> Path:
    upload_dir, _ = create_transpose_job_dirs(job_id)
    suffix = Path(upload.filename or "input.musicxml").suffix.lower()
    if suffix not in ALLOWED_SHEET_EXTENSIONS:
        raise ValueError(
            f"Unsupported sheet format. Allowed: {', '.join(sorted(ALLOWED_SHEET_EXTENSIONS))}"
        )

    sheet_path = upload_dir / f"input{suffix}"
    with sheet_path.open("wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)

    return sheet_path


def run_transpose_job(
    input_sheet_path: Path,
    *,
    target_tonic: str,
    target_mode: str,
    omr_engine: str | None = None,
) -> dict:
    job_id = input_sheet_path.parent.name
    output_dir = OUTPUTS_DIR / job_id

    musicxml_input, omr_meta = prepare_musicxml_input(
        input_sheet_path,
        output_dir,
        omr_engine=omr_engine,  # type: ignore[arg-type]
    )

    result = transpose_sheet_music(
        musicxml_input,
        output_dir,
        target_tonic=target_tonic,
        target_mode=target_mode,
        omr_meta=omr_meta,
    )

    return {
        "job_id": job_id,
        "omr": omr_meta,
        **result,
    }
