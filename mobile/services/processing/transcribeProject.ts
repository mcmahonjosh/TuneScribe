import {
  getFileDownloadUrl,
  transcribeAudio,
  type TranscriptionMode,
} from '@/services/api';
import { downloadFileToProject } from '@/services/files';
import { runLocalTranscription } from '@/services/local/localTranscribe';
import { ensureBackendAvailable } from '@/services/processing/backendFallback';
import {
  type ProcessingMode,
  type ProcessingProgressCallback,
  type ProcessingStep,
} from '@/services/processing/types';
import {
  formatDetectedKey,
  type PianoOutputFormat,
  type TranscribeResponse,
} from '@/types/project';
import { type TranscriptionSettings } from '@/types/transcriptionSettings';

export interface TranscribeProjectParams {
  processingMode: ProcessingMode;
  projectId: string;
  audioUri: string;
  filename?: string;
  transcriptionMode: TranscriptionMode;
  settings?: TranscriptionSettings;
  outputFormat: PianoOutputFormat;
  onStep?: (step: ProcessingStep) => void;
  onProgress?: ProcessingProgressCallback;
}

export interface TranscribeProjectResult {
  response: TranscribeResponse;
  processingModeUsed: 'local' | 'backend' | 'hybrid';
  midiPath?: string;
  musicxmlPath?: string;
  previewWavPath?: string;
  pdfPath?: string;
  chordsPath?: string;
  chordsPreviewWavPath?: string;
  detectedKey?: string;
  backendJobId?: string;
  errorMessage?: string;
}

async function transcribeViaBackend(
  params: TranscribeProjectParams
): Promise<TranscribeProjectResult> {
  params.onStep?.('uploading');
  const response = await transcribeAudio(
    params.audioUri,
    params.filename ?? 'recording.m4a',
    params.transcriptionMode,
    params.settings,
    params.outputFormat
  );

  params.onStep?.('downloading');
  const midiPath = response.files.midi
    ? await downloadFileToProject(params.projectId, 'output.mid', getFileDownloadUrl(response.files.midi))
    : undefined;
  const musicxmlPath = response.files.musicxml
    ? await downloadFileToProject(
        params.projectId,
        'output.musicxml',
        getFileDownloadUrl(response.files.musicxml)
      )
    : undefined;
  const pdfPath = response.files.pdf
    ? await downloadFileToProject(params.projectId, 'output.pdf', getFileDownloadUrl(response.files.pdf))
    : undefined;
  const previewWavPath = response.files.preview
    ? await downloadFileToProject(params.projectId, 'preview.wav', getFileDownloadUrl(response.files.preview))
    : undefined;
  const chordsPath = response.files.chords
    ? await downloadFileToProject(params.projectId, 'chords.json', getFileDownloadUrl(response.files.chords))
    : undefined;
  const chordsPreviewWavPath = response.files.chords_preview
    ? await downloadFileToProject(
        params.projectId,
        'chords_preview.wav',
        getFileDownloadUrl(response.files.chords_preview)
      )
    : undefined;

  return {
    response,
    processingModeUsed: 'backend',
    midiPath,
    musicxmlPath,
    previewWavPath,
    pdfPath,
    chordsPath,
    chordsPreviewWavPath,
    detectedKey: response.detected_key ? formatDetectedKey(response.detected_key) : undefined,
    backendJobId: response.job_id,
    errorMessage: response.musicxml_error ?? undefined,
  };
}

export async function transcribeProject(
  params: TranscribeProjectParams
): Promise<TranscribeProjectResult> {
  if (params.processingMode === 'backend') {
    params.onStep?.('server_transcribe');
    const healthy = await ensureBackendAvailable();
    if (!healthy) {
      throw new Error('Backend is unreachable. Check your network or switch to Local mode.');
    }
    return transcribeViaBackend(params);
  }

  try {
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
      backendJobId: local.response.job_id,
      errorMessage: local.response.musicxml_error ?? undefined,
    };
  } catch (localError) {
    const healthy = await ensureBackendAvailable();
    if (!healthy) {
      throw localError;
    }
    params.onProgress?.({ step: 'server_transcribe', fraction: 0.5 });
    params.onStep?.('server_transcribe');
    const backend = await transcribeViaBackend(params);
    return {
      ...backend,
      processingModeUsed: 'hybrid',
      errorMessage:
        (localError instanceof Error ? localError.message : 'Local transcription failed') +
        (backend.errorMessage ? ` | ${backend.errorMessage}` : ''),
    };
  }
}
