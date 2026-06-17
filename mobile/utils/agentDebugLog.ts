import * as FileSystem from 'expo-file-system/legacy';

import { buildApiUrl } from '@/utils/apiConfig';

const SESSION = 'fc4923';
const LOG_FILE = 'debug-fc4923.log';

let projectLogPath: string | null = null;

function ingestUrl(): string {
  try {
    const host = new URL(buildApiUrl('/health')).hostname;
    return `http://${host}:7409/ingest/479933c6-2247-47e6-90f5-7e16c4fffbc2`;
  } catch {
    return 'http://127.0.0.1:7409/ingest/479933c6-2247-47e6-90f5-7e16c4fffbc2';
  }
}

export function setAgentDebugProjectDir(projectDir: string): void {
  projectLogPath = `${projectDir}${LOG_FILE}`;
}

async function appendProjectLog(line: string): Promise<void> {
  if (!projectLogPath) return;
  try {
    const info = await FileSystem.getInfoAsync(projectLogPath);
    if (info.exists) {
      const existing = await FileSystem.readAsStringAsync(projectLogPath);
      await FileSystem.writeAsStringAsync(projectLogPath, `${existing}${line}\n`);
    } else {
      await FileSystem.writeAsStringAsync(projectLogPath, `${line}\n`);
    }
  } catch {
    // Ignore project log write failures.
  }
}

export function agentDebugLog(
  location: string,
  message: string,
  data: Record<string, unknown>,
  hypothesisId: string,
  runId = 'post-fix'
): void {
  const payload = {
    sessionId: SESSION,
    location,
    message,
    data,
    hypothesisId,
    timestamp: Date.now(),
    runId,
  };
  const line = JSON.stringify(payload);
  console.warn(`[DEBUG ${SESSION}] ${line}`);
  // #region agent log
  void appendProjectLog(line);
  fetch(buildApiUrl('/debug/agent-log'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: line,
  }).catch(() => {});
  fetch(ingestUrl(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': SESSION },
    body: line,
  }).catch(() => {});
  // #endregion
}

export function getAgentDebugLogPath(): string {
  return LOG_FILE;
}
