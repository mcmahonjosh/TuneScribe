"""User-tunable transcription parameters with mode defaults."""

from __future__ import annotations

from dataclasses import asdict, dataclass

from app.transcription.types import TranscriptionMode


@dataclass(frozen=True)
class SettingSpec:
    key: str
    label: str
    description: str
    min_value: float
    max_value: float
    step: float
    default: float


@dataclass
class TranscriptionSettings:
    onset_threshold: float
    frame_threshold: float
    minimum_note_length: float
    min_velocity_ratio: float
    melodia_trick: bool

    def to_dict(self) -> dict:
        return asdict(self)


SETTING_SPECS: list[SettingSpec] = [
    SettingSpec(
        key="onset_threshold",
        label="Onset sensitivity",
        description="Lower = detect more note starts (may add noise). Higher = fewer, cleaner onsets.",
        min_value=0.30,
        max_value=0.70,
        step=0.01,
        default=0.43,
    ),
    SettingSpec(
        key="frame_threshold",
        label="Sustain sensitivity",
        description="Lower = keep quieter / shorter sustained notes. Higher = stricter sustain detection.",
        min_value=0.20,
        max_value=0.45,
        step=0.01,
        default=0.29,
    ),
    SettingSpec(
        key="minimum_note_length",
        label="Minimum note length (ms)",
        description="Shorter = keep fast notes. Longer = drop brief blips and noise.",
        min_value=50.0,
        max_value=180.0,
        step=5.0,
        default=65.0,
    ),
    SettingSpec(
        key="min_velocity_ratio",
        label="Velocity floor",
        description="Lower = keep quieter notes (helps left hand). Higher = drop weak detections.",
        min_value=0.15,
        max_value=0.50,
        step=0.01,
        default=0.28,
    ),
]


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def defaults_for_mode(mode: TranscriptionMode) -> TranscriptionSettings:
    if mode == TranscriptionMode.PIANO_POLYPHONIC:
        return TranscriptionSettings(
            onset_threshold=0.43,
            frame_threshold=0.29,
            minimum_note_length=65.0,
            min_velocity_ratio=0.28,
            melodia_trick=False,
        )
    if mode == TranscriptionMode.PIANO_MELODY:
        return TranscriptionSettings(
            onset_threshold=0.52,
            frame_threshold=0.34,
            minimum_note_length=120.0,
            min_velocity_ratio=0.35,
            melodia_trick=True,
        )
    return TranscriptionSettings(
        onset_threshold=0.55,
        frame_threshold=0.35,
        minimum_note_length=150.0,
        min_velocity_ratio=0.40,
        melodia_trick=True,
    )


def resolve_settings(
    mode: TranscriptionMode,
    *,
    onset_threshold: float | None = None,
    frame_threshold: float | None = None,
    minimum_note_length: float | None = None,
    min_velocity_ratio: float | None = None,
) -> TranscriptionSettings:
    base = defaults_for_mode(mode)
    specs = {spec.key: spec for spec in SETTING_SPECS}

    def pick(key: str, value: float | None, fallback: float) -> float:
        spec = specs[key]
        if value is None:
            return fallback
        return _clamp(value, spec.min_value, spec.max_value)

    return TranscriptionSettings(
        onset_threshold=pick("onset_threshold", onset_threshold, base.onset_threshold),
        frame_threshold=pick("frame_threshold", frame_threshold, base.frame_threshold),
        minimum_note_length=pick(
            "minimum_note_length", minimum_note_length, base.minimum_note_length
        ),
        min_velocity_ratio=pick(
            "min_velocity_ratio", min_velocity_ratio, base.min_velocity_ratio
        ),
        melodia_trick=base.melodia_trick,
    )


def settings_schema_for_mode(mode: TranscriptionMode) -> dict:
    defaults = defaults_for_mode(mode)
    return {
        "mode": mode.value,
        "defaults": defaults.to_dict(),
        "settings": [
            {
                **asdict(spec),
                "default": getattr(defaults, spec.key),
            }
            for spec in SETTING_SPECS
        ],
    }
