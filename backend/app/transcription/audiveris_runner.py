"""Audiveris OMR integration (Java CLI, batch export to MusicXML/MXL)."""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from pathlib import Path

import fitz
from PIL import Image

from app.config import AUDIVERIS_BIN, AUDIVERIS_TIMEOUT_SECONDS

OMR_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".tif", ".tiff"}
OMR_PDF_EXTENSIONS = {".pdf"}

# Audiveris rejects images above ~20 megapixels.
AUDIVERIS_MAX_PIXELS = 20_000_000
AUDIVERIS_TARGET_MIN_WIDTH = 2800
AUDIVERIS_PDF_RENDER_SCALE = 4.0


class AudiverisError(RuntimeError):
    """Raised when Audiveris is unavailable or fails."""


def resolve_audiveris_bin() -> Path | None:
    candidates: list[str] = []
    if AUDIVERIS_BIN:
        candidates.append(AUDIVERIS_BIN)
    candidates.extend(["Audiveris", "audiveris"])

    for name in candidates:
        found = shutil.which(name)
        if found:
            return Path(found)

    for path in (
        Path("/opt/audiveris/bin/Audiveris"),
        Path.home() / "audiveris" / "bin" / "Audiveris",
    ):
        if path.is_file() and os.access(path, os.X_OK):
            return path

    return None


def resolve_java_home() -> str | None:
    configured = os.environ.get("JAVA_HOME", "").strip()
    if configured and Path(configured, "bin", "java").is_file():
        return configured

    portable = Path.home() / ".local" / "share" / "temurin-jre-17"
    if (portable / "bin" / "java").is_file():
        return str(portable)

    return None


def audiveris_env() -> dict[str, str]:
    env = os.environ.copy()
    java_home = resolve_java_home()
    if java_home:
        env["JAVA_HOME"] = java_home
        env["PATH"] = f"{java_home}/bin:{env.get('PATH', '')}"
    return env


def audiveris_available() -> bool:
    binary = resolve_audiveris_bin()
    if not binary:
        return False
    java_home = resolve_java_home()
    if java_home or shutil.which("java"):
        return True
    return False


def _pdf_first_page_to_png(pdf_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    png_path = output_dir / "audiveris_input.png"

    doc = fitz.open(str(pdf_path))
    try:
        if doc.page_count == 0:
            raise AudiverisError("PDF has no pages")
        page = doc.load_page(0)
        matrix = fitz.Matrix(AUDIVERIS_PDF_RENDER_SCALE, AUDIVERIS_PDF_RENDER_SCALE)
        pix = page.get_pixmap(matrix=matrix)
        pix.save(str(png_path))
    finally:
        doc.close()

    return png_path


def _normalize_image_for_audiveris(image_path: Path, output_dir: Path) -> Path:
    output_dir.mkdir(parents=True, exist_ok=True)
    png_path = output_dir / "audiveris_input.png"

    with Image.open(image_path) as image:
        rgb = image.convert("RGB")
        width, height = rgb.size
        pixels = width * height

        max_scale = (AUDIVERIS_MAX_PIXELS / pixels) ** 0.5
        target_scale = max(1.0, min(max_scale, AUDIVERIS_TARGET_MIN_WIDTH / width))
        if target_scale > 1.05:
            new_width = int(width * target_scale)
            new_height = int(height * target_scale)
            if new_width * new_height > AUDIVERIS_MAX_PIXELS:
                target_scale = (AUDIVERIS_MAX_PIXELS / pixels) ** 0.5
                new_width = int(width * target_scale)
                new_height = int(height * target_scale)
            rgb = rgb.resize((new_width, new_height), Image.Resampling.LANCZOS)

        rgb.save(png_path, format="PNG")

    return png_path


def prepare_audiveris_input(input_path: Path, output_dir: Path) -> tuple[Path, dict]:
    """Normalize PDFs/images into a single PNG sheet for Audiveris."""
    suffix = input_path.suffix.lower()
    meta: dict = {"audiveris_input_kind": suffix.lstrip(".")}

    if suffix in OMR_PDF_EXTENSIONS:
        prepared = _pdf_first_page_to_png(input_path, output_dir)
        meta["audiveris_prepared_from"] = "pdf"
        return prepared, meta

    if suffix in OMR_IMAGE_EXTENSIONS:
        prepared = _normalize_image_for_audiveris(input_path, output_dir)
        meta["audiveris_prepared_from"] = "image"
        return prepared, meta

    raise AudiverisError(f"Unsupported Audiveris input format: {suffix}")


def _audiveris_failure_message(work_dir: Path, *, input_was_photo: bool) -> str:
    reasons: list[str] = []

    for log_path in sorted(work_dir.rglob("*.log")):
        text = log_path.read_text(errors="replace")
        if "Cannot find a loader" in text:
            reasons.append("Audiveris could not open the input file.")
        if "Too large image" in text:
            reasons.append("The sheet image is too large for Audiveris.")
        if re.search(r"too low interline", text, re.IGNORECASE) or "flagged as invalid" in text:
            reasons.append("Audiveris could not detect staff lines in the sheet.")
        if "Could not export since transcription did not complete successfully" in text:
            reasons.append("Audiveris transcription did not complete successfully.")

    if reasons:
        message = " ".join(dict.fromkeys(reasons))
        if input_was_photo:
            message += (
                " The slower model works best on clean PDF scans; "
                "for phone photos, use the faster model."
            )
        return message

    return "Audiveris finished but no MusicXML/MXL export was found."


def _find_exported_score(output_dir: Path) -> Path | None:
    candidates: list[Path] = []
    for pattern in ("*.mxl", "*.musicxml", "*.xml"):
        candidates.extend(output_dir.rglob(pattern))

    if not candidates:
        return None

    candidates.sort(key=lambda path: path.stat().st_size, reverse=True)
    return candidates[0]


def run_audiveris(input_path: Path, output_dir: Path, *, first_page_only: bool = True) -> Path:
    """Run Audiveris batch export and return the exported score path."""
    binary = resolve_audiveris_bin()
    if not binary:
        raise AudiverisError(
            "Audiveris is not installed. Install Java 17+ and Audiveris, then set "
            "AUDIVERIS_BIN or add Audiveris to PATH. See scripts/install-audiveris-wsl.sh"
        )

    output_dir.mkdir(parents=True, exist_ok=True)
    work_dir = output_dir / "audiveris_out"
    work_dir.mkdir(parents=True, exist_ok=True)

    prepared_path, _ = prepare_audiveris_input(input_path, work_dir)
    input_was_photo = input_path.suffix.lower() in OMR_IMAGE_EXTENSIONS

    cmd = [
        str(binary),
        "-batch",
        "-transcribe",
        "-export",
        "-output",
        str(work_dir),
        "-option",
        "org.audiveris.omr.sheet.BookManager.useSeparateBookFolders=false",
    ]
    if first_page_only:
        cmd.extend(["-sheets", "1"])

    cmd.extend(["--", str(prepared_path)])

    try:
        completed = subprocess.run(
            cmd,
            check=False,
            capture_output=True,
            text=True,
            timeout=AUDIVERIS_TIMEOUT_SECONDS,
            env=audiveris_env(),
        )
    except subprocess.TimeoutExpired as exc:
        raise AudiverisError(
            f"Audiveris timed out after {AUDIVERIS_TIMEOUT_SECONDS}s. "
            "Try a smaller PDF or increase AUDIVERIS_TIMEOUT_SECONDS."
        ) from exc

    if completed.returncode != 0:
        detail = (completed.stderr or completed.stdout or "").strip()
        detail = detail[-800:] if detail else "unknown error"
        raise AudiverisError(f"Audiveris failed (exit {completed.returncode}): {detail}")

    exported = _find_exported_score(work_dir)
    if exported is None:
        raise AudiverisError(_audiveris_failure_message(work_dir, input_was_photo=input_was_photo))

    suffix = exported.suffix.lower()
    target = output_dir / f"omr{suffix if suffix in {'.mxl', '.musicxml', '.xml'} else '.musicxml'}"
    shutil.copyfile(exported, target)
    return target
