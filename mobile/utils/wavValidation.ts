import * as FileSystem from 'expo-file-system/legacy';

/** Return false when a cached preview file is missing or not a valid WAV. */
export async function isValidWavFile(uri: string | undefined): Promise<boolean> {
  if (!uri) return false;

  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || !info.size || info.size < 44) {
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

/** Poll briefly for a WAV that may still be finishing a write. */
export async function waitForValidWavFile(
  uri: string | undefined,
  timeoutMs = 6000
): Promise<boolean> {
  if (!uri) return false;
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await isValidWavFile(uri)) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

export async function removeInvalidPreviewWav(uri: string | undefined): Promise<void> {
  if (!uri) return;
  // Only delete after it is clearly not becoming valid (avoids races with writers).
  const valid = await waitForValidWavFile(uri, 1500);
  if (!valid) {
    const stillMissing = !(await isValidWavFile(uri));
    if (stillMissing) {
      await FileSystem.deleteAsync(uri, { idempotent: true });
      await FileSystem.deleteAsync(`${uri}.partial`, { idempotent: true });
    }
  }
}
