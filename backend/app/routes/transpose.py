import uuid
from pathlib import Path

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from app.config import ALLOWED_SHEET_EXTENSIONS
from app.services.transpose_job_service import run_transpose_job, save_sheet_upload
from app.services.sheet_music_service import musescore_available
from app.transcription.audiveris_runner import audiveris_available
from app.transcription.omr_runner import OmrError

OmrEngineParam = str  # auto | oemer | audiveris

router = APIRouter()


@router.get("/transpose/settings")
async def get_transpose_settings():
    return {
        "allowed_extensions": sorted(ALLOWED_SHEET_EXTENSIONS),
        "target_modes": ["major", "minor"],
        "target_keys": ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"],
        "omr_engines": ["auto", "oemer", "audiveris"],
        "audiveris_available": audiveris_available(),
        "musescore_available": musescore_available(),
        "omr_engine_default": "auto",
    }


@router.post("/transpose")
async def transpose(
    file: UploadFile = File(...),
    target_key: str = Query(..., description="Target tonic, e.g. G, F#, Bb"),
    target_mode: str = Query(..., description="major or minor"),
    omr_engine: OmrEngineParam = Query(
        default="auto",
        description="OMR engine for PDF/image: auto, oemer (fast), audiveris (accurate PDFs)",
    ),
):
    suffix = Path(file.filename or "").suffix.lower()
    if suffix and suffix not in ALLOWED_SHEET_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported sheet format. Allowed: {', '.join(sorted(ALLOWED_SHEET_EXTENSIONS))}",
        )

    normalized_mode = target_mode.lower()
    if normalized_mode not in {"major", "minor"}:
        raise HTTPException(status_code=400, detail="target_mode must be 'major' or 'minor'")

    normalized_omr = omr_engine.lower()
    if normalized_omr not in {"auto", "oemer", "audiveris"}:
        raise HTTPException(status_code=400, detail="omr_engine must be auto, oemer, or audiveris")

    job_id = str(uuid.uuid4())
    try:
        sheet_path = save_sheet_upload(job_id, file)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    try:
        result = run_transpose_job(
            sheet_path,
            target_tonic=target_key,
            target_mode=normalized_mode,
            omr_engine=normalized_omr,
        )
    except OmrError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Transpose failed: {exc}") from exc

    input_filename = f"input{sheet_path.suffix}"
    omr_used = bool(result.get("omr_used"))
    omr_files = result.get("omr") or {}
    return {
        "job_id": result["job_id"],
        "status": "complete",
        "omr_used": omr_used,
        "omr_engine": omr_files.get("omr_engine_used"),
        "source_key": result["source_key"],
        "target_key": result["target_key"],
        "files": {
            "input": f"/files/{result['job_id']}/{input_filename}",
            "omr_musicxml": (
                f"/files/{result['job_id']}/omr.musicxml"
                if omr_files.get("omr_musicxml_path")
                else None
            ),
            "musicxml": f"/files/{result['job_id']}/output.musicxml",
            "pdf": f"/files/{result['job_id']}/output.pdf" if result["pdf_path"] else None,
            "preview": (
                f"/files/{result['job_id']}/preview.wav"
                if result.get("preview_wav_path")
                else None
            ),
            "preview_mid": (
                f"/files/{result['job_id']}/preview.mid"
                if result.get("preview_mid_path")
                else None
            ),
            "debug": f"/files/{result['job_id']}/transpose_debug.json",
        },
        "musicxml_error": result.get("pdf_error"),
    }
