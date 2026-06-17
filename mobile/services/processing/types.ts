export type ProcessingMode = 'backend' | 'local';

export type ProcessingModeUsed = 'local' | 'backend' | 'hybrid';

export type ProcessingStep =
  | 'idle'
  | 'decoding_audio'
  | 'loading_model'
  | 'running_basic_pitch'
  | 'extracting_notes'
  | 'cleaning_midi'
  | 'exporting_musicxml'
  | 'extracting_chords'
  | 'uploading'
  | 'server_transcribe'
  | 'server_omr'
  | 'server_transpose'
  | 'server_pdf'
  | 'downloading'
  | 'complete'
  | 'failed';

export interface ProcessingProgress {
  step: ProcessingStep;
  /** Overall job progress from 0 to 1. */
  fraction: number;
  /** Dev-only pipeline checkpoint for debugging stalls. */
  checkpoint?: string;
}

export type ProcessingProgressCallback = (progress: ProcessingProgress) => void;

export const PROCESSING_STEP_LABELS: Record<ProcessingStep, string> = {
  idle: 'Ready',
  decoding_audio: 'Decoding audio on device…',
  loading_model: 'Loading model on device…',
  running_basic_pitch: 'Running Basic Pitch on device…',
  extracting_notes: 'Extracting notes on device…',
  cleaning_midi: 'Cleaning MIDI on device…',
  exporting_musicxml: 'Building sheet music on device…',
  extracting_chords: 'Extracting chords on device…',
  uploading: 'Uploading to server…',
  server_transcribe: 'Transcribing on server…',
  server_omr: 'Reading sheet via server (OMR)…',
  server_transpose: 'Transposing on server…',
  server_pdf: 'Generating PDF on server…',
  downloading: 'Downloading results…',
  complete: 'Complete',
  failed: 'Failed',
};

export function isOmrInputFilename(filename: string): boolean {
  return /\.(pdf|jpe?g|png|webp)$/i.test(filename);
}

export function isMusicXmlFilename(filename: string): boolean {
  return /\.(musicxml|xml|mxl)$/i.test(filename);
}
