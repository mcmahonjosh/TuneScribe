from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parent.parent
UPLOADS_DIR = BASE_DIR / "uploads"
OUTPUTS_DIR = BASE_DIR / "outputs"

UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_AUDIO_EXTENSIONS = {".wav", ".mp3", ".m4a", ".ogg", ".flac", ".webm", ".aac"}
ALLOWED_SHEET_EXTENSIONS = {
    ".musicxml",
    ".xml",
    ".mxl",
    ".pdf",
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
}

# OMR engine: auto | oemer | audiveris
OMR_ENGINE_DEFAULT = os.environ.get("OMR_ENGINE", "auto").lower()
AUDIVERIS_BIN = os.environ.get("AUDIVERIS_BIN", "").strip()
AUDIVERIS_TIMEOUT_SECONDS = int(os.environ.get("AUDIVERIS_TIMEOUT_SECONDS", "600"))
