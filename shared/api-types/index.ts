export type ProjectStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'failed';

export interface TranscribeResponse {
  job_id: string;
  status: string;
  model_used: string;
  files: {
    audio: string | null;
    midi: string | null;
    musicxml: string | null;
    pdf: string | null;
  };
  musicxml_error?: string | null;
}
