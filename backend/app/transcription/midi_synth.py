"""Simple offline MIDI preview synthesis (no FluidSynth required)."""

from __future__ import annotations

from pathlib import Path

import numpy as np
import pretty_midi
import soundfile as sf


def midi_to_preview_wav(midi_path: Path, output_path: Path, sample_rate: int = 22050) -> Path:
    midi = pretty_midi.PrettyMIDI(str(midi_path))
    end_time = max(midi.get_end_time() + 0.35, 0.5)
    audio = np.zeros(int(end_time * sample_rate), dtype=np.float32)

    for instrument in midi.instruments:
        for note in instrument.notes:
            frequency = pretty_midi.note_number_to_hz(note.pitch)
            start_index = int(note.start * sample_rate)
            duration = max(note.end - note.start, 0.08)
            sample_count = int(duration * sample_rate)
            if sample_count <= 0:
                continue

            time_axis = np.arange(sample_count, dtype=np.float32) / sample_rate
            envelope = np.exp(-4.0 * time_axis / duration)
            fundamental = np.sin(2.0 * np.pi * frequency * time_axis)
            harmonic = 0.25 * np.sin(2.0 * np.pi * frequency * 2.0 * time_axis)
            wave = (fundamental + harmonic) * envelope
            amplitude = (note.velocity / 127.0) * 0.35
            end_index = min(start_index + sample_count, len(audio))
            audio[start_index:end_index] += wave[: end_index - start_index] * amplitude

    peak = float(np.max(np.abs(audio)))
    if peak > 0:
        audio = audio / peak * 0.92

    sf.write(str(output_path), audio, sample_rate)
    return output_path
