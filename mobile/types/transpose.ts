export type TargetMode = 'major' | 'minor';

export interface TargetKey {
  tonic: string;
  mode: TargetMode;
}

export interface TransposeKeyInfo {
  tonic: string;
  mode: string;
}

export type OmrEngine = 'oemer' | 'audiveris';

export interface TransposeResponse {
  job_id: string;
  status: string;
  omr_used?: boolean;
  omr_engine?: string;
  source_key: TransposeKeyInfo;
  target_key: TransposeKeyInfo;
    files: {
    input: string | null;
    omr_musicxml?: string | null;
    musicxml: string | null;
    pdf: string | null;
    preview?: string | null;
    preview_mid?: string | null;
    debug: string | null;
  };
  musicxml_error?: string | null;
}

export const KEY_TONICS = [
  'C',
  'C#',
  'Db',
  'D',
  'D#',
  'Eb',
  'E',
  'F',
  'F#',
  'Gb',
  'G',
  'G#',
  'Ab',
  'A',
  'A#',
  'Bb',
  'B',
] as const;

export const DEFAULT_TARGET_KEY: TargetKey = {
  tonic: 'G',
  mode: 'major',
};

export function formatKeyLabel(keyInfo: TransposeKeyInfo | TargetKey): string {
  return `${keyInfo.tonic} ${keyInfo.mode}`;
}
