import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.config import ALLOWED_AUDIO_EXTENSIONS
from app.services.file_service import get_output_file, save_upload
from app.services.transcription_service import transcribe_audio
from app.transcription.settings import resolve_settings, settings_schema_for_mode
from app.transcription.types import PianoOutputFormat, TranscriptionMode

router = APIRouter()


@router.get("/transcribe/settings")
async def get_transcription_settings(
    mode: TranscriptionMode = Query(
        default=TranscriptionMode.PIANO_POLYPHONIC,
        description="Transcription mode to load defaults for",
    ),
):
    return settings_schema_for_mode(mode)


@router.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    mode: TranscriptionMode = Query(
        default=TranscriptionMode.MONOPHONIC_MELODY,
        description="Transcription cleanup mode",
    ),
    onset_threshold: float | None = Query(
        default=None,
        ge=0.30,
        le=0.70,
        description="Basic Pitch onset threshold",
    ),
    frame_threshold: float | None = Query(
        default=None,
        ge=0.20,
        le=0.45,
        description="Basic Pitch frame/sustain threshold",
    ),
    minimum_note_length: float | None = Query(
        default=None,
        ge=50.0,
        le=180.0,
        description="Minimum detected note length in milliseconds",
    ),
    min_velocity_ratio: float | None = Query(
        default=None,
        ge=0.15,
        le=0.50,
        description="Cleanup velocity floor as ratio of peak velocity",
    ),
    output_format: PianoOutputFormat = Query(
        default=PianoOutputFormat.SHEET_MUSIC,
        description="Piano output: sheet_music, chords, or both (ignored for vocal)",
    ),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix not in ALLOWED_AUDIO_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported audio format. Allowed: {', '.join(sorted(ALLOWED_AUDIO_EXTENSIONS))}",
        )

    job_id = str(uuid.uuid4())
    audio_path = save_upload(job_id, file)
    settings = resolve_settings(
        mode,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=minimum_note_length,
        min_velocity_ratio=min_velocity_ratio,
    )

    try:
        result = transcribe_audio(
            audio_path,
            mode=mode,
            settings=settings,
            output_format=output_format,
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc

    return {
        "job_id": result["job_id"],
        "status": "complete",
        "model_used": result["model_used"],
        "mode": result["mode"],
        "output_format": result.get("output_format"),
        "detected_key": result.get("detected_key"),
        "settings_used": result.get("settings_used"),
        "debug_summary": result.get("debug_summary"),
        "files": {
            "audio": f"/files/{result['job_id']}/input{audio_path.suffix}",
            "midi": f"/files/{result['job_id']}/output.mid",
            "midi_raw": f"/files/{result['job_id']}/output_raw.mid",
            "midi_cleaned": f"/files/{result['job_id']}/output_cleaned.mid",
            "musicxml": (
                f"/files/{result['job_id']}/output.musicxml"
                if result["musicxml_path"]
                else None
            ),
            "pdf": (
                f"/files/{result['job_id']}/output.pdf"
                if result["pdf_path"]
                else None
            ),
            "debug": f"/files/{result['job_id']}/debug.json",
            "preview": (
                f"/files/{result['job_id']}/preview.wav"
                if result.get("preview_wav_path")
                else None
            ),
            "chords": (
                f"/files/{result['job_id']}/chords.json"
                if result.get("chords_path")
                else None
            ),
            "chords_preview": (
                f"/files/{result['job_id']}/chords_preview.wav"
                if result.get("chords_preview_wav_path")
                else None
            ),
        },
        "musicxml_error": result.get("musicxml_error"),
    }


@router.get("/files/{job_id}/{filename}")
def download_file(job_id: str, filename: str):
    path = get_output_file(job_id, filename)
    if not path:
        upload_path = Path(__file__).resolve().parent.parent.parent / "uploads" / job_id / filename
        if upload_path.exists():
            path = upload_path
        else:
            raise HTTPException(status_code=404, detail="File not found")

    media_types = {
        ".mid": "audio/midi",
        ".json": "application/json",
        ".musicxml": "application/vnd.recordare.musicxml+xml",
        ".pdf": "application/pdf",
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
    }
    media_type = media_types.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type, filename=path.name)
