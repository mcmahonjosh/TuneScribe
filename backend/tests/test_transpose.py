"""Tests for sheet music key transposition."""

from __future__ import annotations

import io
import tempfile
from pathlib import Path

from fastapi.testclient import TestClient
from music21 import key, note, stream

from app.main import app
from app.services.sheet_music_service import (
    detect_key,
    parse_sheet_music,
    prepare_score_for_export,
    transpose_to_key,
)
from app.transcription.transpose_service import build_target_key, transpose_sheet_music


def _write_f_major_score(path: Path) -> None:
    score = stream.Score()
    part = stream.Part()
    ks = key.Key("F")
    part.append(ks)
    for pitch in ["F4", "G4", "A4", "Bb4", "C5"]:
        part.append(note.Note(pitch, quarterLength=1))
    score.insert(0, part)
    score = prepare_score_for_export(score)
    score.write("musicxml", fp=str(path))


def test_parse_sheet_music():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "sample.musicxml"
        _write_f_major_score(path)
        score = parse_sheet_music(path)
        assert isinstance(score, stream.Score)
        assert score.parts


def test_detect_key_f_major():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "sample.musicxml"
        _write_f_major_score(path)
        score = parse_sheet_music(path)
        detected = detect_key(score)
        assert detected.tonic.name in {"F"}
        assert detected.mode in {"major", None}


def test_transpose_f_to_g_shifts_pitches():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "sample.musicxml"
        _write_f_major_score(path)
        score = parse_sheet_music(path)
        target = build_target_key("G", "major")
        transposed = transpose_to_key(score, target)
        pitches = [n.pitch.nameWithOctave for n in transposed.flatten().notes]
        assert pitches[0].startswith("G")
        assert pitches[-1].startswith("D")


def test_transpose_sheet_music_exports_musicxml():
    with tempfile.TemporaryDirectory() as tmp:
        input_path = Path(tmp) / "input.musicxml"
        output_dir = Path(tmp) / "outputs"
        _write_f_major_score(input_path)

        result = transpose_sheet_music(
            input_path,
            output_dir,
            target_tonic="G",
            target_mode="major",
        )

        musicxml_path = Path(result["musicxml_path"])
        debug_path = Path(result["debug_path"])
        assert musicxml_path.exists()
        assert debug_path.exists()
        assert result["source_key"]["tonic"] == "F"
        assert result["target_key"]["tonic"] == "G"

        reparsed = parse_sheet_music(musicxml_path)
        assert reparsed.parts


def test_transpose_api_endpoint():
    client = TestClient(app)
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "input.musicxml"
        _write_f_major_score(path)
        content = path.read_bytes()

        response = client.post(
            "/transpose",
            params={"target_key": "G", "target_mode": "major"},
            files={"file": ("input.musicxml", io.BytesIO(content), "application/xml")},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "complete"
    assert body["source_key"]["tonic"] == "F"
    assert body["target_key"]["tonic"] == "G"
    assert body["files"]["musicxml"].endswith("/output.musicxml")


def test_transpose_api_rejects_invalid_extension():
    client = TestClient(app)
    response = client.post(
        "/transpose",
        params={"target_key": "G", "target_mode": "major"},
        files={"file": ("score.txt", io.BytesIO(b"hello"), "text/plain")},
    )
    assert response.status_code == 400
