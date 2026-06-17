from app.transcription.settings import resolve_settings
from app.transcription.types import TranscriptionMode


def test_resolve_settings_uses_mode_defaults():
    settings = resolve_settings(TranscriptionMode.PIANO_POLYPHONIC)
    assert settings.onset_threshold == 0.43
    assert settings.melodia_trick is False


def test_resolve_settings_clamps_overrides():
    settings = resolve_settings(
        TranscriptionMode.PIANO_POLYPHONIC,
        onset_threshold=0.99,
        frame_threshold=0.01,
    )
    assert settings.onset_threshold == 0.70
    assert settings.frame_threshold == 0.20
