import { Alert } from 'react-native';

export const MUSICXML_EXTENSIONS = ['.musicxml', '.xml', '.mxl'] as const;
export const ALLOWED_SHEET_EXTENSIONS = [...MUSICXML_EXTENSIONS] as const;
const MIDI_EXTENSIONS = ['.mid', '.midi'] as const;

export interface PickedSheetFile {
  uri: string;
  name: string;
}

export type SheetPickResult =
  | { status: 'picked'; file: PickedSheetFile }
  | { status: 'canceled' }
  | { status: 'unavailable' };

function fileExtension(name: string): string {
  return name.includes('.') ? name.slice(name.lastIndexOf('.')).toLowerCase() : '';
}

export function isAllowedSheetName(name: string): boolean {
  const ext = fileExtension(name);
  return (ALLOWED_SHEET_EXTENSIONS as readonly string[]).includes(ext);
}

export function isMidiFilename(name: string): boolean {
  return (MIDI_EXTENSIONS as readonly string[]).includes(fileExtension(name));
}

export function validateSheetName(name: string): boolean {
  if (isAllowedSheetName(name)) {
    return true;
  }

  if (isMidiFilename(name)) {
    Alert.alert(
      'MIDI not supported here',
      'Transpose needs a MusicXML file (.musicxml, .xml, or .mxl). Export MusicXML from your project (not MIDI), save it to Files, then pick that file.'
    );
    return false;
  }

  Alert.alert(
    'Unsupported file',
    'Choose a MusicXML or MXL file (.musicxml, .xml, or .mxl). MIDI files cannot be transposed in offline v1.'
  );
  return false;
}

/** Uses expo-document-picker when the dev client includes it. */
export async function pickSheetWithDocumentPicker(): Promise<SheetPickResult> {
  try {
    const DocumentPicker = await import('expo-document-picker');
    // iOS often tags exported MusicXML as public.data / octet-stream, so MIME
    // filters hide them. Allow all files and validate by extension.
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
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
