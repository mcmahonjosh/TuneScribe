"""Tests for Audiveris OMR integration."""

from __future__ import annotations

import tempfile
from pathlib import Path
from unittest.mock import patch

import fitz

from app.transcription.audiveris_runner import (
    AudiverisError,
    _audiveris_failure_message,
    run_audiveris,
)
from app.transcription.omr_runner import prepare_musicxml_input, resolve_omr_engine


def _write_minimal_pdf(path: Path) -> None:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), "Test")
    doc.save(str(path))
    doc.close()


def test_resolve_omr_engine_auto_pdf_prefers_audiveris_when_available():
    with patch("app.transcription.omr_runner.audiveris_available", return_value=True):
        assert resolve_omr_engine("auto", Path("score.pdf")) == "audiveris"


def test_resolve_omr_engine_auto_image_uses_oemer():
    with patch("app.transcription.omr_runner.audiveris_available", return_value=True):
        assert resolve_omr_engine("auto", Path("photo.jpg")) == "oemer"


@patch("app.transcription.audiveris_runner.resolve_audiveris_bin")
@patch("app.transcription.audiveris_runner.subprocess.run")
def test_run_audiveris_finds_export(mock_run, mock_bin):
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        input_pdf = tmp_path / "score.pdf"
        output_dir = tmp_path / "outputs"
        _write_minimal_pdf(input_pdf)

        mock_bin.return_value = Path("/usr/bin/Audiveris")
        mock_run.return_value.returncode = 0

        work_dir = output_dir / "audiveris_out"
        export_dir = work_dir / "score"
        export_dir.mkdir(parents=True)
        (export_dir / "score.mxl").write_bytes(b"fake-mxl")

        result = run_audiveris(input_pdf, output_dir)

        assert result.name == "omr.mxl"
        assert result.exists()
        mock_run.assert_called_once()


def test_audiveris_failure_message_for_invalid_photo(tmp_path):
    work_dir = tmp_path / "audiveris_out"
    work_dir.mkdir()
    (work_dir / "input.log").write_text(
        "Sheet input flagged as invalid.\n"
        "With a too low interline value of 2 pixels\n"
        "Could not export since transcription did not complete successfully\n"
    )

    message = _audiveris_failure_message(work_dir, input_was_photo=True)

    assert "could not detect staff lines" in message.lower()
    assert "faster model" in message.lower()


@patch("app.transcription.omr_runner._run_oemer")
@patch("app.transcription.omr_runner.run_audiveris")
def test_prepare_musicxml_pdf_audiveris(mock_audiveris, mock_oemer):
    with tempfile.TemporaryDirectory() as tmp:
        pdf_path = Path(tmp) / "score.pdf"
        output_dir = Path(tmp) / "outputs"
        _write_minimal_pdf(pdf_path)

        fake = output_dir / "omr.mxl"
        output_dir.mkdir(parents=True)
        fake.write_bytes(b"x")
        mock_audiveris.return_value = fake

        path, meta = prepare_musicxml_input(pdf_path, output_dir, omr_engine="audiveris")

        assert path == fake
        assert meta["omr_engine_used"] == "audiveris"
        mock_oemer.assert_not_called()
