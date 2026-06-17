"""Optical Music Recognition (OMR) for PDF/image sheet music input."""

from __future__ import annotations

import os
import shutil
from argparse import Namespace
from pathlib import Path
from typing import Literal

import fitz  # pymupdf
from oemer import MODULE_PATH
from oemer.ete import CHECKPOINTS_URL, clear_data, download_file, extract

from app.config import OMR_ENGINE_DEFAULT
from app.transcription.audiveris_runner import (
    AudiverisError,
    audiveris_available,
    run_audiveris,
)

OmrEngine = Literal["auto", "oemer", "audiveris"]

OMR_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
OMR_PDF_EXTENSIONS = {".pdf"}
OMR_EXTENSIONS = OMR_IMAGE_EXTENSIONS | OMR_PDF_EXTENSIONS
MUSICXML_EXTENSIONS = {".musicxml", ".xml", ".mxl"}


class OmrError(RuntimeError):
    """Raised when OMR fails to produce MusicXML."""


def is_omr_input(path: Path) -> bool:
    return path.suffix.lower() in OMR_EXTENSIONS


def is_musicxml_input(path: Path) -> bool:
    return path.suffix.lower() in MUSICXML_EXTENSIONS


def resolve_omr_engine(
    requested: OmrEngine | None,
    input_path: Path,
) -> Literal["oemer", "audiveris"]:
    engine = (requested or OMR_ENGINE_DEFAULT or "auto").lower()
    suffix = input_path.suffix.lower()

    if engine == "oemer":
        return "oemer"
    if engine == "audiveris":
        return "audiveris"

    # auto: prefer Audiveris for PDF when installed; Oemer for photos.
    if suffix == ".pdf" and audiveris_available():
        return "audiveris"
    return "oemer"


def _ensure_oemer_checkpoints() -> None:
    checkpoint = os.path.join(MODULE_PATH, "checkpoints/unet_big/model.onnx")
    if os.path.exists(checkpoint):
        return

    for _index, (title, url) in enumerate(CHECKPOINTS_URL.items()):
        save_dir = "unet_big" if title.startswith("1st") else "seg_net"
        save_dir = os.path.join(MODULE_PATH, "checkpoints", save_dir)
        os.makedirs(save_dir, exist_ok=True)
        save_path = os.path.join(save_dir, title.split("_")[1])
        download_file(title, url, save_path)


def pdf_first_page_to_png(pdf_path: Path, output_dir: Path) -> Path:
    """Rasterize the first page of a PDF to PNG for OMR."""
    output_dir.mkdir(parents=True, exist_ok=True)
    png_path = output_dir / "omr_page.png"

    doc = fitz.open(str(pdf_path))
    try:
        if doc.page_count == 0:
            raise OmrError("PDF has no pages")
        page = doc.load_page(0)
        pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
        pix.save(str(png_path))
    finally:
        doc.close()

    return png_path


def _run_oemer(image_path: Path, output_dir: Path) -> Path:
    _ensure_oemer_checkpoints()
    clear_data()

    args = Namespace(
        img_path=str(image_path),
        output_path=str(output_dir),
        use_tf=False,
        save_cache=False,
        without_deskew=False,
    )

    try:
        result_path = Path(extract(args))
    except Exception as exc:
        raise OmrError(f"Oemer failed to read sheet music: {exc}") from exc

    target = output_dir / "omr.musicxml"
    if not result_path.exists():
        raise OmrError("Oemer did not produce a MusicXML file")

    if result_path.resolve() != target.resolve():
        shutil.copyfile(result_path, target)

    return target


def _run_omr_engine(
    input_path: Path,
    output_dir: Path,
    *,
    omr_engine: OmrEngine | None = None,
) -> tuple[Path, dict]:
    engine = resolve_omr_engine(omr_engine, input_path)
    meta: dict = {"omr_engine_requested": omr_engine or OMR_ENGINE_DEFAULT, "omr_engine_used": engine}

    if engine == "audiveris":
        try:
            path = run_audiveris(input_path, output_dir)
            meta["omr_engine_used"] = "audiveris"
            return path, meta
        except AudiverisError as exc:
            if (omr_engine or OMR_ENGINE_DEFAULT) == "auto":
                meta["audiveris_fallback_reason"] = str(exc)
                meta["omr_engine_used"] = "oemer"
            else:
                raise OmrError(str(exc)) from exc

    suffix = input_path.suffix.lower()
    if suffix == ".pdf":
        raster_path = pdf_first_page_to_png(input_path, output_dir)
        meta["raster_path"] = str(raster_path)
        return _run_oemer(raster_path, output_dir), meta

    return _run_oemer(input_path, output_dir), meta


def sheet_image_to_musicxml(image_path: Path, output_dir: Path) -> Path:
    """Convert a sheet music image to MusicXML via Oemer."""
    suffix = image_path.suffix.lower()
    if suffix not in OMR_IMAGE_EXTENSIONS:
        raise ValueError(f"Unsupported image format: {suffix}")
    path, _ = _run_omr_engine(image_path, output_dir, omr_engine="oemer")
    return path


def pdf_to_musicxml(pdf_path: Path, output_dir: Path, *, omr_engine: OmrEngine | None = None) -> Path:
    """Convert a PDF to MusicXML via Audiveris (preferred) or rasterize + Oemer."""
    path, _ = _run_omr_engine(pdf_path, output_dir, omr_engine=omr_engine)
    return path


def prepare_musicxml_input(
    input_path: Path,
    output_dir: Path,
    *,
    omr_engine: OmrEngine | None = None,
) -> tuple[Path, dict]:
    """Return a MusicXML path ready for transpose, running OMR when needed."""
    output_dir.mkdir(parents=True, exist_ok=True)
    suffix = input_path.suffix.lower()

    if suffix in MUSICXML_EXTENSIONS:
        return input_path, {"omr_used": False, "input_type": "musicxml"}

    omr_meta: dict = {"omr_used": True, "input_type": suffix.lstrip(".")}

    musicxml_path, engine_meta = _run_omr_engine(input_path, output_dir, omr_engine=omr_engine)
    omr_meta.update(engine_meta)
    omr_meta["omr_musicxml_path"] = str(musicxml_path)
    return musicxml_path, omr_meta
