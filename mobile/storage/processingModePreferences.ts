import * as FileSystem from 'expo-file-system/legacy';

import { type ProcessingMode } from '@/services/processing/types';

const MODE_FILE = `${FileSystem.documentDirectory}tunescribe-processing-mode.json`;

function isProcessingMode(value: unknown): value is ProcessingMode {
  return value === 'backend' || value === 'local';
}

export async function loadProcessingMode(): Promise<ProcessingMode | null> {
  try {
    const info = await FileSystem.getInfoAsync(MODE_FILE);
    if (!info.exists) {
      return null;
    }
    const raw = await FileSystem.readAsStringAsync(MODE_FILE);
    const parsed: unknown = JSON.parse(raw);
    return isProcessingMode(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveProcessingMode(mode: ProcessingMode): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(MODE_FILE, JSON.stringify(mode));
  } catch {
    // Optional preference.
  }
}
