import { PianoOutputFormat, TranscribeResponse } from '@/types/project';
import { TranscriptionSettings } from '@/types/transcriptionSettings';
import { TargetKey, TransposeResponse, OmrEngine } from '@/types/transpose';
import { buildApiUrl } from '@/utils/apiConfig';

export interface HealthCheckResult {
  ok: boolean;
  url: string;
  status?: number;
  body?: string;
  error?: string;
}

export async function checkHealthDetailed(): Promise<HealthCheckResult> {
  const url = buildApiUrl('/health');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const body = await response.text();

    return {
      ok: response.ok,
      url,
      status: response.status,
      body: body.slice(0, 200),
    };
  } catch (error) {
    return {
      ok: false,
      url,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function checkHealth(): Promise<boolean> {
  const result = await checkHealthDetailed();
  if (!result.ok) {
    console.warn('[TuneScribe] health check failed:', result);
  }
  return result.ok;
}

export type TranscriptionMode =
  | 'monophonic_melody'
  | 'piano_melody'
  | 'piano_polyphonic';

export async function transcribeAudio(
  audioUri: string,
  filename = 'recording.wav',
  mode: TranscriptionMode = 'monophonic_melody',
  settings?: TranscriptionSettings,
  outputFormat: PianoOutputFormat = 'sheet_music'
): Promise<TranscribeResponse> {
  const formData = new FormData();

  formData.append('file', {
    uri: audioUri,
    name: filename,
    type: 'audio/wav',
  } as unknown as Blob);

  const params = new URLSearchParams({ mode, output_format: outputFormat });
  if (settings) {
    params.set('onset_threshold', settings.onset_threshold.toFixed(2));
    params.set('frame_threshold', settings.frame_threshold.toFixed(2));
    params.set('minimum_note_length', String(Math.round(settings.minimum_note_length)));
    params.set('min_velocity_ratio', settings.min_velocity_ratio.toFixed(2));
  }

  const response = await fetch(buildApiUrl(`/transcribe?${params.toString()}`), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Transcription failed (${response.status})`);
  }

  return response.json();
}

export function getFileDownloadUrl(path: string): string {
  return buildApiUrl(path);
}

export interface TransposeSettings {
  audiveris_available: boolean;
  omr_engines: string[];
}

export async function getTransposeSettings(): Promise<TransposeSettings> {
  const response = await fetch(buildApiUrl('/transpose/settings'));
  if (!response.ok) {
    throw new Error(`Failed to load transpose settings (${response.status})`);
  }
  return response.json();
}

export async function transposeSheet(
  fileUri: string,
  filename: string,
  target: TargetKey,
  omrEngine: OmrEngine = 'audiveris'
): Promise<TransposeResponse> {
  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: filename,
    type: 'application/xml',
  } as unknown as Blob);

  const params = new URLSearchParams({
    target_key: target.tonic,
    target_mode: target.mode,
    omr_engine: omrEngine,
  });

  const response = await fetch(buildApiUrl(`/transpose?${params.toString()}`), {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(errorBody || `Transpose failed (${response.status})`);
  }

  return response.json();
}
