import * as FileSystem from 'expo-file-system/legacy';

export async function readFileAsBase64(path: string): Promise<string> {
  return FileSystem.readAsStringAsync(path, {
    encoding: FileSystem.EncodingType.Base64,
  });
}
