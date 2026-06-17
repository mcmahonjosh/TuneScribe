"""Tests for chord progression extraction."""

from __future__ import annotations

import json
import tempfile
from pathlib import Path
from unittest.mock import patch

from music21 import chord, meter, stream

from app.services.transcription_service import transcribe_audio
from app.transcription.chord_progression_service import (
    extract_chord_progression,
    write_chord_progression,
)
from app.transcription.types import PianoOutputFormat, TranscriptionMode


def _write_block_chord_midi(path: Path) -> None:
    score = stream.Score()
    part = stream.Part()
    part.append(meter.TimeSignature("4/4"))
    part.append(chord.Chord(["C4", "E4", "G4"], quarterLength=2))
    part.append(chord.Chord(["A3", "C4", "E4"], quarterLength=2))
    part.append(chord.Chord(["F3", "A3", "C4"], quarterLength=2))
    part.append(chord.Chord(["G3", "B3", "D4"], quarterLength=2))
    score.insert(0, part)
    score.write("midi", fp=str(path))


def test_extract_chord_progression_from_block_chords():
    with tempfile.TemporaryDirectory() as tmp:
        midi_path = Path(tmp) / "progression.mid"
        _write_block_chord_midi(midi_path)

        data = extract_chord_progression(midi_path)

        assert "key" in data
        assert data["key"]["tonic"]
        assert len(data["chords"]) >= 2
        symbols = [entry["symbol"] for entry in data["chords"]]
        assert any("C" in symbol for symbol in symbols)
        for index, entry in enumerate(data["chords"]):
            assert entry["end"] > entry["start"], entry
            if index > 0:
                assert entry["start"] >= data["chords"][index - 1]["start"]
            duration = entry["end"] - entry["start"]
            assert duration >= 0.4, entry


def test_write_chord_progression_creates_json():
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        midi_path = tmp_path / "progression.mid"
        _write_block_chord_midi(midi_path)

        out_path, preview_path = write_chord_progression(midi_path, tmp_path)

        assert out_path.name == "chords.json"
        payload = json.loads(out_path.read_text(encoding="utf-8"))
        assert payload["chords"]
        assert payload["chords"][0].get("pitches")
        assert preview_path is not None
        assert preview_path.name == "chords_preview.wav"


@patch("app.services.transcription_service.run_basic_pitch")
@patch("app.services.transcription_service.process_midi")
def test_transcribe_chords_only_skips_musicxml(mock_process, mock_basic_pitch):
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        job_dir = tmp_path / "job-1"
        job_dir.mkdir()
        audio_path = job_dir / "input.wav"
        audio_path.write_bytes(b"fake")

        midi_path = tmp_path / "chords.mid"
        _write_block_chord_midi(midi_path)

        from app.transcription.types import CleanupDebugReport

        mock_basic_pitch.return_value = midi_path
        mock_process.return_value = (
            midi_path,
            CleanupDebugReport(
                mode="piano_polyphonic",
                raw_note_count=10,
                final_note_count=10,
                removed_note_count=0,
            ),
        )

        with patch("app.services.transcription_service.OUTPUTS_DIR", tmp_path):
            result = transcribe_audio(
                audio_path,
                mode=TranscriptionMode.PIANO_POLYPHONIC,
                output_format=PianoOutputFormat.CHORDS,
            )

        assert result["chords_path"]
        assert result["musicxml_path"] is None
        assert result["output_format"] == "chords"
        assert result["detected_key"]


@patch("app.services.transcription_service.run_basic_pitch")
@patch("app.services.transcription_service.process_midi")
@patch("app.services.transcription_service.midi_to_musicxml")
@patch("app.services.transcription_service.musicxml_to_pdf")
def test_transcribe_both_returns_chords_and_musicxml(
    mock_pdf, mock_musicxml, mock_process, mock_basic_pitch
):
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        job_dir = tmp_path / "job-2"
        job_dir.mkdir()
        audio_path = job_dir / "input.wav"
        audio_path.write_bytes(b"fake")

        midi_path = tmp_path / "both.mid"
        _write_block_chord_midi(midi_path)
        musicxml_path = tmp_path / "output.musicxml"
        musicxml_path.write_text("<score></score>", encoding="utf-8")

        from app.transcription.types import CleanupDebugReport

        mock_basic_pitch.return_value = midi_path
        mock_process.return_value = (
            midi_path,
            CleanupDebugReport(
                mode="piano_polyphonic",
                raw_note_count=10,
                final_note_count=10,
                removed_note_count=0,
            ),
        )
        mock_musicxml.return_value = musicxml_path
        mock_pdf.return_value = None

        with patch("app.services.transcription_service.OUTPUTS_DIR", tmp_path):
            result = transcribe_audio(
                audio_path,
                mode=TranscriptionMode.PIANO_POLYPHONIC,
                output_format=PianoOutputFormat.BOTH,
            )

        assert result["chords_path"]
        assert result["musicxml_path"]
        assert result["output_format"] == "both"
