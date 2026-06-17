import os
import platform
import re
import shutil
import subprocess
from pathlib import Path

from music21 import clef, converter, interval, key, meter, stream

from app.transcription.midi_synth import midi_to_preview_wav


def prepare_score_for_export(score: stream.Score) -> stream.Score:
    """Normalize score metadata so MusicXML export succeeds."""
    if not score.parts:
        part = stream.Part(id="Piano")
        part.append(score.flatten().notesAndRests)
        export_score = stream.Score()
        export_score.insert(0, part)
        score = export_score

    for index, part in enumerate(score.parts):
        if not part.id:
            part.id = "Treble" if index == 0 else f"Part{index + 1}"
        if not part.getElementsByClass(meter.TimeSignature):
            part.insert(0, meter.TimeSignature("4/4"))
        if not part.getElementsByClass(clef.Clef):
            part.insert(0, clef.TrebleClef())

    try:
        score.makeNotation(inPlace=True)
    except Exception:
        for part in score.parts:
            try:
                part.makeNotation(inPlace=True)
            except Exception:
                pass

    return score


def light_prepare_score_for_export(score: stream.Score) -> stream.Score:
    """Add missing clef/time signatures without re-notating (preserves rhythm/layout)."""
    if not score.parts:
        part = stream.Part(id="Piano")
        part.append(score.flatten().notesAndRests)
        export_score = stream.Score()
        export_score.insert(0, part)
        score = export_score

    for index, part in enumerate(score.parts):
        if not part.id:
            part.id = "Treble" if index == 0 else f"Part{index + 1}"
        if not part.getElementsByClass(meter.TimeSignature):
            part.insert(0, meter.TimeSignature("4/4"))
        if not part.getElementsByClass(clef.Clef):
            part.insert(0, clef.TrebleClef())

    return score


def normalize_musicxml_layout(path: Path) -> None:
    """Remove forced line/page breaks so viewers can lay out multiple measures per system."""
    text = path.read_text(encoding="utf-8")
    text = re.sub(r'\snew-system="yes"', "", text)
    text = re.sub(r'\snew-page="yes"', "", text)
    text = re.sub(r"<print[^>]*/>\s*", "", text)
    path.write_text(text, encoding="utf-8")


def parse_sheet_music(path: Path) -> stream.Score:
    """Parse MusicXML, XML, or MXL into a music21 Score."""
    score = converter.parse(str(path))
    if not isinstance(score, stream.Score):
        wrapped = stream.Score()
        if isinstance(score, stream.Part):
            wrapped.insert(0, score)
        else:
            part = stream.Part()
            part.append(score)
            wrapped.insert(0, part)
        return wrapped
    return score


def detect_key(score: stream.Score) -> key.Key:
    """Detect the key of a score, falling back to C major if ambiguous."""
    try:
        detected = score.analyze("key")
        if isinstance(detected, key.Key):
            return detected
    except Exception:
        pass
    return key.Key("C")


def transpose_to_key(score: stream.Score, target: key.Key) -> stream.Score:
    """Transpose a score to the target key."""
    source = detect_key(score)
    transpose_interval = interval.Interval(source.tonic, target.tonic)
    return score.transpose(transpose_interval)


def midi_to_musicxml(
    midi_path: Path,
    output_dir: Path,
    *,
    polyphonic: bool = False,
    bpm: float = 120.0,
) -> Path:
    """Convert MIDI to MusicXML via music21's MIDI parser (handles polyphony reliably)."""
    del polyphonic, bpm

    musicxml_path = output_dir / "output.musicxml"
    score = converter.parse(str(midi_path))
    score = prepare_score_for_export(score)
    score.write("musicxml", fp=str(musicxml_path))
    return musicxml_path


def musicxml_to_preview_wav(musicxml_path: Path, output_dir: Path) -> Path | None:
    """Synthesize a simple WAV preview from MusicXML for mobile playback."""
    try:
        output_dir.mkdir(parents=True, exist_ok=True)
        midi_path = output_dir / "preview.mid"
        score = converter.parse(str(musicxml_path))
        score.write("midi", fp=str(midi_path))
        preview_path = output_dir / "preview.wav"
        midi_to_preview_wav(midi_path, preview_path)
        return preview_path if preview_path.exists() else None
    except Exception:
        return None


def musescore_available() -> bool:
    return _find_musescore_bin() is not None


def _find_musescore_bin() -> str | None:
    env_bin = os.environ.get("MUSESCORE_BIN", "").strip()
    if env_bin and Path(env_bin).is_file():
        return env_bin

    for name in ("musescore3", "mscore", "MuseScore4", "musescore"):
        found = shutil.which(name)
        if found:
            return found

    home = Path.home()
    for path in (
        home / "musescore" / "mscore",
        Path("/usr/bin/musescore3"),
        Path("/usr/bin/mscore"),
    ):
        if path.is_file():
            return str(path)

    return None


def _musescore_argv(mscore: str, *args: str) -> list[str]:
    """Wrap MuseScore with xvfb-run on headless Linux (WSL/server)."""
    if platform.system() == "Linux" and not os.environ.get("DISPLAY") and shutil.which("xvfb-run"):
        return ["xvfb-run", "-a", mscore, *args]
    return [mscore, *args]


def musicxml_to_pdf(musicxml_path: Path, output_dir: Path) -> Path | None:
    """Generate PDF via MuseScore CLI if installed."""
    mscore = _find_musescore_bin()
    if not mscore:
        return None

    output_dir.mkdir(parents=True, exist_ok=True)
    pdf_path = output_dir / "output.pdf"
    try:
        subprocess.run(
            _musescore_argv(mscore, "-o", str(pdf_path), str(musicxml_path)),
            check=True,
            capture_output=True,
            timeout=120,
        )
    except (subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return None

    return pdf_path if pdf_path.exists() else None
