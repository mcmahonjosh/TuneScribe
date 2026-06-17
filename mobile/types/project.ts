export type ProjectStatus =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'processing'
  | 'complete'
  | 'failed';

export type PianoOutputFormat = 'sheet_music' | 'chords' | 'both';

export type ProcessingModeUsed = 'local' | 'backend' | 'hybrid';

export interface ChordKeyInfo {
  tonic: string;
  mode: string;
}

export interface ChordSegment {
  start: number;
  end: number;
  symbol: string;
  roman?: string | null;
  pitches?: number[];
}

export interface ChordProgressionData {
  key: ChordKeyInfo;
  chords: ChordSegment[];
}

export interface Project {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  status: ProjectStatus;
  inputType?: 'piano' | 'vocal' | 'sheet';
  audioPath?: string;
  midiPath?: string;
  musicxmlPath?: string;
  previewWavPath?: string;
  pdfPath?: string;
  durationSeconds?: number;
  modelUsed?: string;
  errorMessage?: string;
  backendJobId?: string;
  transcriptionMode?: string;
  pianoOutputFormat?: PianoOutputFormat;
  chordsPath?: string;
  chordsPreviewWavPath?: string;
  detectedKey?: string;
  sourceKeyDetected?: string;
  targetKey?: string;
  sourceSheetPath?: string;
  processingModeUsed?: ProcessingModeUsed;
}

export interface TranscribeResponse {
  job_id: string;
  status: string;
  model_used: string;
  mode?: string;
  output_format?: PianoOutputFormat;
  detected_key?: ChordKeyInfo;
  debug_summary?: {
    raw_note_count?: number;
    final_note_count?: number;
    removed_note_count?: number;
    max_simultaneous_notes?: number;
  };
  files: {
    audio: string | null;
    midi: string | null;
    musicxml: string | null;
    pdf: string | null;
    preview?: string | null;
    chords?: string | null;
    chords_preview?: string | null;
  };
  musicxml_error?: string | null;
}

export function formatDetectedKey(keyInfo: ChordKeyInfo): string {
  return `${keyInfo.tonic} ${keyInfo.mode}`;
}
