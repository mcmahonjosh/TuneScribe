"""Sheet music key transposition using music21."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from music21 import interval, key, stream

from app.services.sheet_music_service import (
    detect_key,
    light_prepare_score_for_export,
    musicxml_to_pdf,
    musicxml_to_preview_wav,
    normalize_musicxml_layout,
    parse_sheet_music,
    prepare_score_for_export,
    transpose_to_key,
)


@dataclass
class KeyInfo:
    tonic: str
    mode: str

    def to_dict(self) -> dict:
        return {"tonic": self.tonic, "mode": self.mode}

    @classmethod
    def from_key(cls, music_key: key.Key) -> KeyInfo:
        tonic = music_key.tonic.name
        mode = music_key.mode if music_key.mode else "major"
        return cls(tonic=tonic, mode=mode)

    def label(self) -> str:
        return f"{self.tonic} {self.mode}"


def build_target_key(tonic: str, mode: str) -> key.Key:
    normalized_mode = mode.lower()
    if normalized_mode not in {"major", "minor"}:
        raise ValueError(f"Unsupported mode: {mode}")
    return key.Key(tonic, normalized_mode)


def transpose_sheet_music(
    input_path: Path,
    output_dir: Path,
    *,
    target_tonic: str,
    target_mode: str,
    omr_meta: dict | None = None,
) -> dict:
    output_dir.mkdir(parents=True, exist_ok=True)

    score = parse_sheet_music(input_path)
    source_key = detect_key(score)
    target_key_obj = build_target_key(target_tonic, target_mode)

    source_info = KeyInfo.from_key(source_key)
    target_info = KeyInfo.from_key(target_key_obj)

    transpose_interval = interval.Interval(source_key.tonic, target_key_obj.tonic)
    transposed = transpose_to_key(score, target_key_obj)
    omr_used = bool(omr_meta and omr_meta.get("omr_used"))
    if omr_used:
        transposed = prepare_score_for_export(transposed)
    else:
        transposed = light_prepare_score_for_export(transposed)

    musicxml_path = output_dir / "output.musicxml"
    transposed.write("musicxml", fp=str(musicxml_path))
    normalize_musicxml_layout(musicxml_path)

    preview_wav_path = musicxml_to_preview_wav(musicxml_path, output_dir)
    preview_mid_path = output_dir / "preview.mid"

    pdf_path = None
    pdf_error = None
    try:
        pdf_path = musicxml_to_pdf(musicxml_path, output_dir)
    except Exception as exc:
        pdf_error = str(exc)

    flat = transposed.flatten()
    note_count = len(flat.notes)
    measure_count = len(transposed.parts[0].getElementsByClass("Measure")) if transposed.parts else 0

    warnings: list[str] = []
    if source_info.tonic == "C" and source_info.mode == "major":
        try:
            analyzed = score.analyze("key")
            if not isinstance(analyzed, key.Key):
                warnings.append("Could not confidently detect source key; used C major fallback")
        except Exception:
            warnings.append("Could not confidently detect source key; used C major fallback")

    debug_path = output_dir / "transpose_debug.json"
    debug_payload = {
        "source_key_detected": source_info.to_dict(),
        "target_key": target_info.to_dict(),
        "interval": str(transpose_interval),
        "measure_count": measure_count,
        "note_count": note_count,
        "warnings": warnings,
        "omr": omr_meta or {"omr_used": False},
    }
    debug_path.write_text(json.dumps(debug_payload, indent=2), encoding="utf-8")

    return {
        "source_key": source_info.to_dict(),
        "target_key": target_info.to_dict(),
        "musicxml_path": str(musicxml_path),
        "pdf_path": str(pdf_path) if pdf_path else None,
        "preview_wav_path": str(preview_wav_path) if preview_wav_path else None,
        "preview_mid_path": str(preview_mid_path) if preview_mid_path.exists() else None,
        "debug_path": str(debug_path),
        "pdf_error": pdf_error,
        "omr_used": omr_used,
    }
