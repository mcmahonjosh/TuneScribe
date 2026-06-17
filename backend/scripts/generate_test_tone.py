"""Generate a simple test WAV (C major arpeggio) for pipeline testing."""
import math
import struct
import wave
from pathlib import Path

SAMPLE_RATE = 22050
DURATION = 2.0
NOTES = [261.63, 329.63, 392.00, 523.25]  # C4 E4 G4 C5


def main():
    samples = []
    note_duration = int(SAMPLE_RATE * DURATION / len(NOTES))
    for freq in NOTES:
        for i in range(note_duration):
            t = i / SAMPLE_RATE
            value = 0.4 * math.sin(2 * math.pi * freq * t)
            samples.append(int(value * 32767))

    out = Path(__file__).resolve().parent.parent / "uploads" / "test_tone.wav"
    out.parent.mkdir(parents=True, exist_ok=True)

    with wave.open(str(out), "w") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(SAMPLE_RATE)
        wav.writeframes(struct.pack(f"<{len(samples)}h", *samples))

    print(f"Wrote {out}")


if __name__ == "__main__":
    main()
