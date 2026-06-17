import { checkHealth, checkHealthDetailed } from '@/services/api';

export async function ensureBackendAvailable(): Promise<boolean> {
  return checkHealth();
}

export async function getBackendHealthMessage(): Promise<string> {
  const result = await checkHealthDetailed();
  if (result.ok) {
    return `Backend OK (${result.status})`;
  }
  return result.error ?? 'Backend unreachable';
}
