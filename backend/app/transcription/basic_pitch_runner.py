from pathlib import Path

from basic_pitch.inference import predict_and_save
from basic_pitch import ICASSP_2022_MODEL_PATH


def run_basic_pitch(
    input_audio_path: Path,
    output_dir: Path,
    *,
    melodia_trick: bool = True,
    onset_threshold: float = 0.55,
    frame_threshold: float = 0.35,
    minimum_note_length: float = 150.0,
    minimum_frequency: float | None = None,
    maximum_frequency: float | None = None,
) -> Path:
    """Run Basic Pitch on an audio file and return the generated MIDI path."""
    output_dir.mkdir(parents=True, exist_ok=True)

    predict_and_save(
        [str(input_audio_path)],
        str(output_dir),
        save_midi=True,
        sonify_midi=False,
        save_model_outputs=False,
        save_notes=False,
        model_or_model_path=ICASSP_2022_MODEL_PATH,
        onset_threshold=onset_threshold,
        frame_threshold=frame_threshold,
        minimum_note_length=minimum_note_length,
        minimum_frequency=minimum_frequency,
        maximum_frequency=maximum_frequency,
        melodia_trick=melodia_trick,
    )

    stem = input_audio_path.stem
    midi_path = output_dir / f"{stem}_basic_pitch.mid"
    if midi_path.exists():
        return midi_path

    midi_candidates = sorted(output_dir.glob("*.mid"))
    if not midi_candidates:
        raise FileNotFoundError(f"No MIDI file generated in {output_dir}")

    return midi_candidates[0]
