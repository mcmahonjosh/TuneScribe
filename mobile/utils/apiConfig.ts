import Constants from 'expo-constants';
import { Platform } from 'react-native';

const DEFAULT_WEB_API = 'http://localhost:8000';

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/$/, '');
}

function readEnvApiUrl(): string | undefined {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return normalizeBaseUrl(fromEnv);
  }

  const fromExtra = Constants.expoConfig?.extra?.apiUrl;
  if (typeof fromExtra === 'string' && fromExtra.trim()) {
    return normalizeBaseUrl(fromExtra.trim());
  }

  return undefined;
}

export function getApiBaseUrl(): string {
  const configured = readEnvApiUrl();
  if (configured) {
    return configured;
  }

  if (Platform.OS === 'web') {
    return DEFAULT_WEB_API;
  }

  console.warn(
    '[TuneScribe] EXPO_PUBLIC_API_URL is not set. Transcription will fail on a physical phone. ' +
      'Set it in mobile/.env and restart Metro with: npm run start:dev'
  );
  return DEFAULT_WEB_API;
}

export function buildApiUrl(path: string): string {
  const base = getApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${normalizedPath}`;
}
