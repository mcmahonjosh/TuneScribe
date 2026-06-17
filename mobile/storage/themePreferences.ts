import * as FileSystem from 'expo-file-system/legacy';

import { type ThemeId } from '@/constants/theme';

const THEME_FILE = `${FileSystem.documentDirectory}tunescribe-theme.json`;

function isThemeId(value: unknown): value is ThemeId {
  return value === 'violet' || value === 'amber';
}

export async function loadThemeId(): Promise<ThemeId | null> {
  try {
    const info = await FileSystem.getInfoAsync(THEME_FILE);
    if (!info.exists) {
      return null;
    }
    const raw = await FileSystem.readAsStringAsync(THEME_FILE);
    const parsed: unknown = JSON.parse(raw);
    return isThemeId(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function saveThemeId(id: ThemeId): Promise<void> {
  try {
    await FileSystem.writeAsStringAsync(THEME_FILE, JSON.stringify(id));
  } catch {
    // Preference is optional; in-memory theme still works.
  }
}
