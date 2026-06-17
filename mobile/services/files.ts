import * as FileSystem from 'expo-file-system/legacy';

const PROJECTS_ROOT = `${FileSystem.documentDirectory}projects/`;

export function getProjectsRoot(): string {
  return PROJECTS_ROOT;
}

export async function ensureProjectDir(projectId: string): Promise<string> {
  const dir = `${PROJECTS_ROOT}${projectId}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  return dir;
}

export async function saveFileToProject(
  projectId: string,
  filename: string,
  sourceUri: string
): Promise<string> {
  const dir = await ensureProjectDir(projectId);
  const dest = `${dir}${filename}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

export async function downloadFileToProject(
  projectId: string,
  filename: string,
  url: string
): Promise<string> {
  const dir = await ensureProjectDir(projectId);
  const dest = `${dir}${filename}`;
  const result = await FileSystem.downloadAsync(url, dest);
  if (result.status < 200 || result.status >= 300) {
    await FileSystem.deleteAsync(dest, { idempotent: true });
    throw new Error(`Download failed (${result.status})`);
  }
  return result.uri;
}

export async function downloadFileToProjectIfOk(
  projectId: string,
  filename: string,
  url: string
): Promise<string | undefined> {
  try {
    return await downloadFileToProject(projectId, filename, url);
  } catch {
    return undefined;
  }
}

export async function deleteProjectFiles(projectId: string): Promise<void> {
  const dir = `${PROJECTS_ROOT}${projectId}/`;
  const info = await FileSystem.getInfoAsync(dir);
  if (info.exists) {
    await FileSystem.deleteAsync(dir, { idempotent: true });
  }
}
