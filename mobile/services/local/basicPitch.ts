import { Asset } from 'expo-asset';
import { Platform } from 'react-native';

import {
  ANNOTATIONS_FPS,
  AUDIO_N_SAMPLES,
  AUDIO_SAMPLE_RATE,
  FFT_HOP,
  N_OVERLAPPING_FRAMES,
} from '@/services/local/basicPitchConstants';
import { type MidiNote } from '@/services/local/midiTypes';
import { decodeAudioFileToMono22050 } from '@/services/local/audioDecode';
import { extractNotesMobileFast } from '@/services/local/extractNotesMobileFast';
import { noteEventsToMidiNotes, unwrapInferenceBatches } from '@/services/local/noteCreation';
import { LOCAL_TRANSCRIBE_RANGES, mapStageProgress, yieldToUi } from '@/services/processing/progress';
import { type ProcessingProgressCallback } from '@/services/processing/types';
import { agentDebugLog } from '@/utils/agentDebugLog';

const MODEL_ASSET = require('../../assets/models/nmp.onnx');

export interface BasicPitchOptions {
  onsetThreshold?: number;
  frameThreshold?: number;
  minimumNoteLengthMs?: number;
  minimumFrequency?: number | null;
  maximumFrequency?: number | null;
  melodiaTrick?: boolean;
  maxMelodiaIterations?: number;
  onExtractComplete?: () => void;
  onCheckpoint?: (checkpoint: string) => void;
  onProgress?: ProcessingProgressCallback;
}

/** Expected model output frames per inference window (~2 s of audio). */
const MAX_FRAMES_PER_BATCH = 256;

interface InferenceBatch {
  frames: number;
  bins: number;
  note: Float32Array;
  onset: Float32Array;
}

function windowAudio(audio: Float32Array, hopSize: number): Float32Array[] {
  const windows: Float32Array[] = [];
  for (let i = 0; i < audio.length; i += hopSize) {
    const slice = audio.slice(i, i + AUDIO_N_SAMPLES);
    const window = new Float32Array(AUDIO_N_SAMPLES);
    window.set(slice);
    windows.push(window);
  }
  return windows;
}

function disposeOrtValue(value: { dispose?: () => void } | undefined): void {
  try {
    value?.dispose?.();
  } catch {
    // Ignore dispose errors on older runtimes.
  }
}

async function loadOnnxSession() {
  if (Platform.OS === 'web') {
    throw new Error('Local Basic Pitch is not available on web.');
  }
  const { InferenceSession } = await import('onnxruntime-react-native');
  const asset = Asset.fromModule(MODEL_ASSET);
  await asset.downloadAsync();
  const modelUri = asset.localUri ?? asset.uri;
  return InferenceSession.create(modelUri);
}

export async function isLocalBasicPitchAvailable(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const session = await loadOnnxSession();
    await session.release();
    return true;
  } catch {
    return false;
  }
}

export async function runBasicPitchOnAudio(
  audioUri: string,
  options: BasicPitchOptions = {}
): Promise<MidiNote[]> {
  const report = options.onProgress;

  report?.(mapStageProgress('decoding_audio', 0, LOCAL_TRANSCRIBE_RANGES.decoding_audio));
  const audio = await decodeAudioFileToMono22050(audioUri, (stageFraction) => {
    report?.(
      mapStageProgress('decoding_audio', stageFraction, LOCAL_TRANSCRIBE_RANGES.decoding_audio)
    );
  });

  const overlapLen = N_OVERLAPPING_FRAMES * FFT_HOP;
  const hopSize = AUDIO_N_SAMPLES - overlapLen;
  const padded = new Float32Array(audio.length + Math.floor(overlapLen / 2));
  padded.set(audio, Math.floor(overlapLen / 2));

  report?.(mapStageProgress('loading_model', 0, LOCAL_TRANSCRIBE_RANGES.loading_model));
  const session = await loadOnnxSession();
  report?.(mapStageProgress('loading_model', 1, LOCAL_TRANSCRIBE_RANGES.loading_model));

  const ort = await import('onnxruntime-react-native');
  const windows = windowAudio(padded, hopSize);
  const batches: InferenceBatch[] = [];

  try {
    for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
      const window = windows[windowIndex];
      const inputTensor = new ort.Tensor('float32', window, [1, AUDIO_N_SAMPLES, 1]);

      let outputs: Awaited<ReturnType<typeof session.run>>;
      try {
        outputs = await session.run({ 'serving_default_input_2:0': inputTensor });
      } finally {
        disposeOrtValue(inputTensor);
      }

      const noteTensor = outputs['StatefulPartitionedCall:1'];
      const onsetTensor = outputs['StatefulPartitionedCall:2'];
      const noteData = new Float32Array(noteTensor.data as ArrayLike<number>);
      const onsetData = new Float32Array(onsetTensor.data as ArrayLike<number>);
      const bins = 88;
      let frames = Math.floor(noteData.length / bins);
      if (frames > MAX_FRAMES_PER_BATCH || frames <= 0) {
        frames = Math.min(MAX_FRAMES_PER_BATCH, Math.max(1, frames));
      }

      batches.push({
        frames,
        bins,
        note: noteData.subarray(0, frames * bins),
        onset: onsetData.subarray(0, frames * bins),
      });

      disposeOrtValue(noteTensor);
      disposeOrtValue(onsetTensor);
      disposeOrtValue(outputs['StatefulPartitionedCall:0']);

      if (windowIndex % 3 === 2 || windowIndex === windows.length - 1) {
        report?.(
          mapStageProgress(
            'running_basic_pitch',
            (windowIndex + 1) / windows.length,
            LOCAL_TRANSCRIBE_RANGES.running_basic_pitch
          )
        );
        await yieldToUi();
      }
    }
  } finally {
    void session.release().catch(() => {});
  }

  options.onCheckpoint?.('basicpitch:post-inference');
  report?.(mapStageProgress('extracting_notes', 0, LOCAL_TRANSCRIBE_RANGES.extracting_notes));
  await yieldToUi();

  options.onCheckpoint?.('basicpitch:unwrap');
  const matrix = unwrapInferenceBatches(batches, audio.length, N_OVERLAPPING_FRAMES);
  // #region agent log
  agentDebugLog(
    'basicPitch.ts:unwrap',
    'matrix ready',
    {
      batchCount: batches.length,
      nFrames: matrix.nFrames,
      audioSamples: audio.length,
    },
    'E'
  );
  // #endregion
  const minNoteLen = Math.max(
    1,
    Math.round(((options.minimumNoteLengthMs ?? 150) / 1000) * ANNOTATIONS_FPS)
  );

  const events = extractNotesMobileFast(
    matrix,
    {
      onsetThresh: options.onsetThreshold ?? 0.5,
      frameThresh: options.frameThreshold ?? 0.3,
      minNoteLen,
      minFreq: options.minimumFrequency ?? null,
      maxFreq: options.maximumFrequency ?? null,
    },
    (stageFraction) => {
      report?.(
        mapStageProgress('extracting_notes', stageFraction, LOCAL_TRANSCRIBE_RANGES.extracting_notes)
      );
    },
    options.onCheckpoint
  );

  options.onCheckpoint?.('basicpitch:post-extract');
  options.onExtractComplete?.();
  await yieldToUi();
  // #region agent log
  agentDebugLog(
    'basicPitch.ts:preMidiNotes',
    'before noteEventsToMidiNotes',
    { eventCount: events.length },
    'C',
    'post-fix'
  );
  // #endregion
  const notes = noteEventsToMidiNotes(events, ANNOTATIONS_FPS);
  // #region agent log
  agentDebugLog(
    'basicPitch.ts:postMidiNotes',
    'basic pitch complete',
    { noteCount: notes.length },
    'C',
    'post-fix'
  );
  // #endregion
  return notes;
}
