import { Alert } from 'react-native';

export const MUSICXML_EXTENSIONS = ['.musicxml', '.xml', '.mxl'] as const;
export const OMR_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png', '.webp'] as const;
export const ALLOWED_SHEET_EXTENSIONS = [...MUSICXML_EXTENSIONS, ...OMR_EXTENSIONS] as const;

export interface PickedSheetFile {
  uri: string;
  name: string;
}

export type SheetPickResult =
  | { status: 'picked'; file: PickedSheetFile }
  | { status: 'canceled' }
  | { status: 'unavailable' };

export function isOmrSheetName(name: string): boolean {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  return (OMR_EXTENSIONS as readonly string[]).includes(ext);
}

export function isAllowedSheetName(name: string): boolean {
  const ext = name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
  return !ext || (ALLOWED_SHEET_EXTENSIONS as readonly string[]).includes(ext);
}

export function validateSheetName(name: string): boolean {
  if (isAllowedSheetName(name)) {
    return true;
  }

  Alert.alert(
    'Unsupported file',
    'Choose MusicXML/MXL, PDF, or an image (JPG/PNG) of sheet music.'
  );
  return false;
}

/** Uses expo-document-picker when the dev client includes it. */
export async function pickSheetWithDocumentPicker(): Promise<SheetPickResult> {
  try {
    const DocumentPicker = await import('expo-document-picker');
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/xml',
        'text/xml',
        'application/vnd.recordare.musicxml+xml',
        'application/zip',
        'application/pdf',
        'image/*',
      ],
      copyToCacheDirectory: true,
    });

    if (result.canceled || !result.assets?.[0]) {
      return { status: 'canceled' };
    }

    const asset = result.assets[0];
    const name = asset.name ?? 'sheet.musicxml';
    if (!validateSheetName(name)) {
      return { status: 'canceled' };
    }

    return { status: 'picked', file: { uri: asset.uri, name } };
  } catch {
    return { status: 'unavailable' };
  }
}
