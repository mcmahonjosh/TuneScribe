"""Tests for OMR and transpose integration."""

from __future__ import annotations

import io
import tempfile
from pathlib import Path
from unittest.mock import patch

import fitz
from fastapi.testclient import TestClient
from music21 import key, note, stream

from app.main import app
from app.services.sheet_music_service import prepare_score_for_export
from app.transcription.omr_runner import (
    is_omr_input,
    pdf_first_page_to_png,
    prepare_musicxml_input,
)


def _write_f_major_score(path: Path) -> None:
    score = stream.Score()
    part = stream.Part()
    part.append(key.Key("F"))
    for pitch in ["F4", "G4", "A4", "Bb4", "C5"]:
        part.append(note.Note(pitch, quarterLength=1))
    score.insert(0, part)
    score = prepare_score_for_export(score)
    score.write("musicxml", fp=str(path))


def _write_minimal_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Test sheet")
    doc.save(str(path))
    doc.close()


def test_is_omr_input():
    assert is_omr_input(Path("scan.png"))
    assert is_omr_input(Path("sheet.pdf"))
    assert not is_omr_input(Path("score.musicxml"))


def test_prepare_musicxml_input_skips_omr_for_musicxml():
    with tempfile.TemporaryDirectory() as tmp:
        input_path = Path(tmp) / "input.musicxml"
        output_dir = Path(tmp) / "outputs"
        _write_f_major_score(input_path)

        musicxml_path, meta = prepare_musicxml_input(input_path, output_dir)

        assert musicxml_path == input_path
        assert meta["omr_used"] is False


def test_pdf_first_page_to_png():
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / "sheet.pdf"
        output_dir = Path(tmp) / "outputs"
        _write_minimal_pdf(pdf_path)

        png_path = pdf_first_page_to_png(pdf_path, output_dir)

        assert png_path.exists()
        assert png_path.suffix == ".png"


@patch("app.transcription.omr_runner._run_oemer")
def test_prepare_musicxml_input_runs_omr_for_pdf(mock_run_oemer):
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / "sheet.pdf"
        output_dir = Path(tmp) / "outputs"
        _write_minimal_pdf(pdf_path)

        fake_musicxml = output_dir / "omr.musicxml"
        output_dir.mkdir(parents=True, exist_ok=True)
        _write_f_major_score(fake_musicxml)
        mock_run_oemer.return_value = fake_musicxml

        musicxml_path, meta = prepare_musicxml_input(pdf_path, output_dir)

        assert musicxml_path == fake_musicxml
        assert meta["omr_used"] is True
        assert meta["input_type"] == "pdf"
        mock_run_oemer.assert_called_once()


@patch("app.services.transpose_job_service.prepare_musicxml_input")
def test_transpose_api_accepts_pdf(mock_prepare):
    client = TestClient(app)
    with tempfile.TemporaryDirectory() as tmp:
        musicxml_path = Path(tmp) / "omr.musicxml"
        _write_f_major_score(musicxml_path)
        mock_prepare.return_value = (musicxml_path, {"omr_used": True, "input_type": "pdf"})

        response = client.post(
            "/transpose",
            params={"target_key": "G", "target_mode": "major"},
            files={"file": ("sheet.pdf", io.BytesIO(b"%PDF-1.4 fake"), "application/pdf")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["omr_used"] is True
    assert body["files"]["musicxml"].endswith("/output.musicxml")


def test_transpose_api_rejects_invalid_extension():
    client = TestClient(app)
    response = client.post(
        "/transpose",
        params={"target_key": "G", "target_mode": "major"},
        files={"file": ("score.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert response.status_code == 400
