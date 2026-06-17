from app.transcription.modes.monophonic_melody import MonophonicMelodyMode
from app.transcription.modes.piano_melody import PianoMelodyMode
from app.transcription.modes.piano_polyphonic import PianoPolyphonicMode
from app.transcription.types import TranscriptionMode

MODE_HANDLERS = {
    TranscriptionMode.MONOPHONIC_MELODY: MonophonicMelodyMode(),
    TranscriptionMode.PIANO_MELODY: PianoMelodyMode(),
    TranscriptionMode.PIANO_POLYPHONIC: PianoPolyphonicMode(),
}


def get_mode_handler(mode: TranscriptionMode):
    return MODE_HANDLERS[mode]
