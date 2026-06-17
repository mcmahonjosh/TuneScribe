import * as FileSystem from 'expo-file-system/legacy';

/** Return false when a cached preview file is missing or not a valid WAV. */
export async function isValidWavFile(uri: string | undefined): Promise<boolean> {
  if (!uri) return false;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || !info.size || info.size < 12) {
      return false;
    }

    const header = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 12,
      position: 0,
    });
    const bytes = atob(header);
    return bytes.startsWith('RIFF') && bytes.slice(8, 12) === 'WAVE';
  } catch {
    return false;
  }
}

export async function removeInvalidPreviewWav(uri: string | undefined): Promise<void> {
  if (!uri) return;
  const valid = await isValidWavFile(uri);
  if (!valid) {
    await FileSystem.deleteAsync(uri, { idempotent: true });
  }
}
