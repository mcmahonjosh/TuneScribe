import {
  getFileDownloadUrl,
  transposeSheet,
} from '@/services/api';
import { downloadFileToProject, downloadFileToProjectIfOk, ensureProjectDir } from '@/services/files';
import { transposeMusicXmlFile } from '@/services/local/transposeMusicXml';
import { ensureBackendAvailable } from '@/services/processing/backendFallback';
import {
  isMusicXmlFilename,
  isOmrInputFilename,
  type ProcessingMode,
  type ProcessingStep,
} from '@/services/processing/types';
import { formatKeyLabel, type OmrEngine, type TargetKey, type TransposeResponse } from '@/types/transpose';

export interface TransposeProjectParams {
  processingMode: ProcessingMode;
  projectId: string;
  sheetUri: string;
  sheetName: string;
  targetKey: TargetKey;
  omrEngine: OmrEngine;
  onStep?: (step: ProcessingStep) => void;
}

export interface TransposeProjectResult {
  response: TransposeResponse;
  processingModeUsed: 'local' | 'backend' | 'hybrid';
  musicxmlPath?: string;
  pdfPath?: string;
  previewWavPath?: string;
  midiPath?: string;
  sourceKeyDetected?: string;
  targetKeyLabel?: string;
  backendJobId?: string;
  omrUsed: boolean;
  errorMessage?: string;
}

async function transposeViaBackend(
  params: TransposeProjectParams
): Promise<TransposeProjectResult> {
  params.onStep?.(isOmrInputFilename(params.sheetName) ? 'server_omr' : 'server_transpose');
  const response = await transposeSheet(
    params.sheetUri,
    params.sheetName,
    params.targetKey,
    params.omrEngine
  );

  params.onStep?.('downloading');
  const musicxmlPath = response.files.musicxml
    ? await downloadFileToProject(
        params.projectId,
        'output.musicxml',
        getFileDownloadUrl(response.files.musicxml)
      )
    : undefined;
  const pdfPath = response.files.pdf
    ? await downloadFileToProject(
        params.projectId,
        'output.pdf',
        getFileDownloadUrl(response.files.pdf)
      )
    : undefined;
  const previewWavPath = response.files.preview
    ? await downloadFileToProjectIfOk(
        params.projectId,
        'preview.wav',
        getFileDownloadUrl(response.files.preview)
      )
    : undefined;
  const midiPath = response.files.preview_mid
    ? await downloadFileToProjectIfOk(
        params.projectId,
        'preview.mid',
        getFileDownloadUrl(response.files.preview_mid)
      )
    : undefined;

  return {
    response,
    processingModeUsed: 'backend',
    musicxmlPath,
    pdfPath,
    previewWavPath,
    midiPath,
    sourceKeyDetected: formatKeyLabel(response.source_key),
    targetKeyLabel: formatKeyLabel(response.target_key),
    backendJobId: response.job_id,
    omrUsed: Boolean(response.omr_used),
    errorMessage: response.musicxml_error ?? undefined,
  };
}

export async function transposeProject(
  params: TransposeProjectParams
): Promise<TransposeProjectResult> {
  if (params.processingMode === 'backend') {
    const healthy = await ensureBackendAvailable();
    if (!healthy) {
      throw new Error('Backend is unreachable.');
    }
    return transposeViaBackend(params);
  }

  const needsServer = isOmrInputFilename(params.sheetName);
  if (needsServer) {
    const healthy = await ensureBackendAvailable();
    if (!healthy) {
      throw new Error(
        'PDF and photo sheet music require the backend in Local mode. Connect to your PC or use a MusicXML file.'
      );
    }
    const backend = await transposeViaBackend(params);
    return { ...backend, processingModeUsed: 'hybrid' };
  }

  if (!isMusicXmlFilename(params.sheetName)) {
    throw new Error('Unsupported sheet format for local transpose.');
  }

  try {
    params.onStep?.('exporting_musicxml');
    const projectDir = await ensureProjectDir(params.projectId);
    const outputPath = `${projectDir}output.musicxml`;
    const { sourceKey } = await transposeMusicXmlFile(params.sheetUri, outputPath, params.targetKey);
    const response: TransposeResponse = {
      job_id: `local_${params.projectId}`,
      status: 'complete',
      source_key: sourceKey,
      target_key: params.targetKey,
      omr_used: false,
      files: {
        input: params.sheetUri,
        musicxml: outputPath,
        pdf: null,
        preview: null,
        preview_mid: null,
        debug: null,
      },
      musicxml_error: null,
    };
    return {
      response,
      processingModeUsed: 'local',
      musicxmlPath: outputPath,
      sourceKeyDetected: formatKeyLabel(sourceKey),
      targetKeyLabel: formatKeyLabel(params.targetKey),
      backendJobId: response.job_id,
      omrUsed: false,
    };
  } catch (localError) {
    const healthy = await ensureBackendAvailable();
    if (!healthy) throw localError;
    const backend = await transposeViaBackend(params);
    return {
      ...backend,
      processingModeUsed: 'hybrid',
      errorMessage:
        (localError instanceof Error ? localError.message : 'Local transpose failed') +
        (backend.errorMessage ? ` | ${backend.errorMessage}` : ''),
    };
  }
}
