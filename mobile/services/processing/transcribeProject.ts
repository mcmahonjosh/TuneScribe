import { runLocalTranscription } from '@/services/local/localTranscribe';
import { type LocalTranscriptionMode } from '@/services/local/modeHandlers';
import {
  type ProcessingProgressCallback,
  type ProcessingStep,
} from '@/services/processing/types';
import {
  type PianoOutputFormat,
  type TranscribeResponse,
} from '@/types/project';
import { type TranscriptionSettings } from '@/types/transcriptionSettings';

export interface TranscribeProjectParams {
  projectId: string;
  audioUri: string;
  filename?: string;
  transcriptionMode: LocalTranscriptionMode;
  settings?: TranscriptionSettings;
  outputFormat: PianoOutputFormat;
  onStep?: (step: ProcessingStep) => void;
  onProgress?: ProcessingProgressCallback;
}

export interface TranscribeProjectResult {
  response: TranscribeResponse;
  processingModeUsed: 'local';
  midiPath?: string;
  musicxmlPath?: string;
  previewWavPath?: string;
  pdfPath?: string;
  chordsPath?: string;
  chordsPreviewWavPath?: string;
  detectedKey?: string;
  errorMessage?: string;
}

export async function transcribeProject(
  params: TranscribeProjectParams
): Promise<TranscribeProjectResult> {
  params.onStep?.('running_basic_pitch');
  const local = await runLocalTranscription({
    projectId: params.projectId,
    audioUri: params.audioUri,
    mode: params.transcriptionMode,
    outputFormat: params.outputFormat,
    settings: params.settings,
    onStep: params.onStep,
    onProgress: params.onProgress,
  });

  return {
    response: local.response,
    processingModeUsed: 'local',
    ...local.files,
    errorMessage: local.response.musicxml_error ?? undefined,
  };
}
