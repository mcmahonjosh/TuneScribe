import shutil
import uuid
from pathlib import Path

from fastapi import UploadFile

from app.config import ALLOWED_AUDIO_EXTENSIONS, OUTPUTS_DIR, UPLOADS_DIR
from app.services.sheet_music_service import musicxml_to_pdf


def create_job_dirs(job_id: str) -> tuple[Path, Path]:
    upload_dir = UPLOADS_DIR / job_id
    output_dir = OUTPUTS_DIR / job_id
    upload_dir.mkdir(parents=True, exist_ok=True)
    output_dir.mkdir(parents=True, exist_ok=True)
    return upload_dir, output_dir


def save_upload(job_id: str, upload: UploadFile) -> Path:
    upload_dir, _ = create_job_dirs(job_id)
    suffix = Path(upload.filename or "audio.wav").suffix.lower()
    if suffix not in ALLOWED_AUDIO_EXTENSIONS:
        suffix = ".wav"

    audio_path = upload_dir / f"input{suffix}"
    with audio_path.open("wb") as buffer:
        shutil.copyfileobj(upload.file, buffer)

    return audio_path


def get_output_file(job_id: str, filename: str) -> Path | None:
    output_dir = OUTPUTS_DIR / job_id
    path = output_dir / filename
    if path.exists():
        return path

    if filename == "output.pdf":
        musicxml_path = output_dir / "output.musicxml"
        if musicxml_path.exists():
            generated = musicxml_to_pdf(musicxml_path, output_dir)
            if generated:
                return generated

    return None
