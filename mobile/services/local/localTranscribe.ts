import { LOCAL_PIPELINE_BUILD } from '@/constants/localPipelineBuild';
import { ensureProjectDir } from '@/services/files';
import { runBasicPitchOnAudio } from '@/services/local/basicPitch';
import { writeChordProgression } from '@/services/local/chordProgression';
import { exportMusicXmlFromNotes } from '@/services/local/musicxmlExport';
import { runMidiPipeline } from '@/services/local/midiPipeline';
import { type LocalTranscriptionMode } from '@/services/local/modeHandlers';
import { readMidiNotes } from '@/services/local/midiFile';
import {
  formatDetectedKey,
  type ChordKeyInfo,
  type PianoOutputFormat,
  type TranscribeResponse,
} from '@/types/project';
import { type TranscriptionSettings } from '@/types/transcriptionSettings';
import { LOCAL_TRANSCRIBE_RANGES, mapStageProgress, yieldToUi } from '@/services/processing/progress';
import {
  type ProcessingProgressCallback,
  type ProcessingStep,
} from '@/services/processing/types';
import { agentDebugLog, setAgentDebugProjectDir } from '@/utils/agentDebugLog';

export interface LocalTranscribeParams {
  projectId: string;
  audioUri: string;
  mode: LocalTranscriptionMode;
  outputFormat: PianoOutputFormat;
  settings?: TranscriptionSettings;
  onStep?: (step: ProcessingStep) => void;
  onProgress?: ProcessingProgressCallback;
}

export interface LocalTranscribeFiles {
  midiPath?: string;
  musicxmlPath?: string;
  previewWavPath?: string;
  chordsPath?: string;
  chordsPreviewWavPath?: string;
  detectedKey?: string;
}

const STALL_TIMEOUT_MS = 60_000;

function formatCheckpoint(checkpoint: string): string {
  return `${LOCAL_PIPELINE_BUILD} · ${checkpoint}`;
}

async function runWithStallGuard<T>(
  getCheckpoint: () => string,
  getUpdatedAt: () => number,
  work: () => Promise<T>
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setInterval(() => {
      if (Date.now() - getUpdatedAt() > STALL_TIMEOUT_MS) {
        clearInterval(timer);
        reject(
          new Error(
            `Local transcription stalled (>${STALL_TIMEOUT_MS / 1000}s) at ${getCheckpoint()}`
          )
        );
      }
    }, 3000);

    work()
      .then((value) => {
        clearInterval(timer);
        resolve(value);
      })
      .catch((error) => {
        clearInterval(timer);
        reject(error);
      });
  });
}

export async function runLocalTranscription(
  params: LocalTranscribeParams
): Promise<{ response: TranscribeResponse; files: LocalTranscribeFiles }> {
  const projectDir = await ensureProjectDir(params.projectId);
  setAgentDebugProjectDir(projectDir);

  let lastProgress = mapStageProgress('decoding_audio', 0, LOCAL_TRANSCRIBE_RANGES.decoding_audio);
  let pipelineCheckpoint = formatCheckpoint('init');
  let pipelineCheckpointAt = Date.now();

  const report = (progress: ReturnType<typeof mapStageProgress>, checkpoint?: string) => {
    lastProgress = progress;
    if (checkpoint) {
      pipelineCheckpoint = checkpoint;
      pipelineCheckpointAt = Date.now();
    }
    params.onStep?.(progress.step);
    params.onProgress?.({
      ...progress,
      checkpoint: checkpoint ?? pipelineCheckpoint,
    });
  };

  const markCheckpoint = (checkpoint: string) => {
    pipelineCheckpoint = formatCheckpoint(checkpoint);
    pipelineCheckpointAt = Date.now();
    report(lastProgress, pipelineCheckpoint);
  };

  markCheckpoint('pipeline:start');

  const rawNotes = await runWithStallGuard(
    () => pipelineCheckpoint,
    () => pipelineCheckpointAt,
    () =>
      runBasicPitchOnAudio(params.audioUri, {
        onsetThreshold: params.settings?.onset_threshold,
        frameThreshold: params.settings?.frame_threshold,
        minimumNoteLengthMs: params.settings?.minimum_note_length,
        minimumFrequency: params.mode === 'piano_polyphonic' ? 27.5 : undefined,
        maximumFrequency: params.mode === 'piano_polyphonic' ? 4186 : undefined,
        onExtractComplete: () => {
          report(
            mapStageProgress('cleaning_midi', 0.15, LOCAL_TRANSCRIBE_RANGES.cleaning_midi),
            formatCheckpoint('pipeline:cleaning')
          );
        },
        onCheckpoint: markCheckpoint,
        onProgress: (progress) => report(progress),
      })
  );

  // #region agent log
  agentDebugLog(
    'localTranscribe.ts:postBasicPitch',
    'basic pitch returned',
    { rawNoteCount: rawNotes.length, build: LOCAL_PIPELINE_BUILD },
    'D',
    'post-fix'
  );
  // #endregion

  markCheckpoint('pipeline:post-basic-pitch');
  await yieldToUi();
  report(
    mapStageProgress('cleaning_midi', 0.1, LOCAL_TRANSCRIBE_RANGES.cleaning_midi),
    formatCheckpoint('pipeline:midi-start')
  );
  const pipeline = await runWithStallGuard(
    () => pipelineCheckpoint,
    () => pipelineCheckpointAt,
    async () => {
      markCheckpoint('pipeline:midi-run');
      return runMidiPipeline(projectDir, rawNotes, {
        mode: params.mode,
        minVelocityRatio: params.settings?.min_velocity_ratio,
      });
    }
  );
  // #region agent log
  agentDebugLog(
    'localTranscribe.ts:postPipeline',
    'midi pipeline complete',
    { outputMidPath: pipeline.outputMidPath },
    'D',
    'post-fix'
  );
  // #endregion
  const finalNotes = await readMidiNotes(pipeline.outputMidPath);
  report(mapStageProgress('cleaning_midi', 1, LOCAL_TRANSCRIBE_RANGES.cleaning_midi));

  let musicxmlPath: string | undefined;
  let musicxmlError: string | null = null;
  if (params.outputFormat === 'sheet_music' || params.outputFormat === 'both') {
    report(
      mapStageProgress('exporting_musicxml', 0, LOCAL_TRANSCRIBE_RANGES.exporting_musicxml),
      formatCheckpoint('pipeline:musicxml')
    );
    params.onStep?.('exporting_musicxml');
    try {
      musicxmlPath = `${projectDir}output.musicxml`;
      await exportMusicXmlFromNotes(musicxmlPath, finalNotes);
      report(mapStageProgress('exporting_musicxml', 1, LOCAL_TRANSCRIBE_RANGES.exporting_musicxml));
    } catch (error) {
      musicxmlError = error instanceof Error ? error.message : 'MusicXML export failed';
    }
  }

  let chordsPath: string | undefined;
  let chordsPreviewWavPath: string | undefined;
  let detectedKey: ChordKeyInfo | undefined;
  if (params.outputFormat === 'chords' || params.outputFormat === 'both') {
    report(
      mapStageProgress('extracting_chords', 0, LOCAL_TRANSCRIBE_RANGES.extracting_chords),
      formatCheckpoint('pipeline:chords')
    );
    params.onStep?.('extracting_chords');
    const chordResult = await writeChordProgression(projectDir, finalNotes);
    report(mapStageProgress('extracting_chords', 1, LOCAL_TRANSCRIBE_RANGES.extracting_chords));
    chordsPath = chordResult.chordsPath;
    chordsPreviewWavPath = chordResult.chordsPreviewWavPath;
    detectedKey = chordResult.detectedKey;
  }

  markCheckpoint('pipeline:done');

  const response: TranscribeResponse = {
    job_id: `local_${params.projectId}`,
    status: 'complete',
    model_used: 'basic-pitch-local',
    mode: params.mode,
    output_format: params.outputFormat,
    detected_key: detectedKey,
    debug_summary: pipeline.summary,
    files: {
      audio: null,
      midi: pipeline.outputMidPath,
      musicxml: musicxmlPath ?? null,
      pdf: null,
      preview: pipeline.previewWavPath ?? null,
      chords: chordsPath ?? null,
      chords_preview: chordsPreviewWavPath ?? null,
    },
    musicxml_error: musicxmlError,
  };

  return {
    response,
    files: {
      midiPath: pipeline.outputMidPath,
      musicxmlPath,
      previewWavPath: pipeline.previewWavPath,
      chordsPath,
      chordsPreviewWavPath,
      detectedKey: detectedKey ? formatDetectedKey(detectedKey) : undefined,
    },
  };
}
