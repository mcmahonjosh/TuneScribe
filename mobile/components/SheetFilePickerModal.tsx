import * as FileSystem from 'expo-file-system/legacy';
import { Modal, Pressable, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

function buildPickerHtml(background: string, text: string, primary: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, sans-serif;
      margin: 0;
      padding: 24px;
      background: ${background};
      color: ${text};
    }
    h1 { font-size: 20px; margin: 0 0 8px; }
    p { font-size: 14px; opacity: 0.75; line-height: 1.4; }
    label {
      display: block;
      margin-top: 20px;
      padding: 14px;
      border-radius: 10px;
      background: ${primary};
      color: #fff;
      text-align: center;
      font-weight: 600;
    }
    input { display: none; }
  </style>
</head>
<body>
  <h1>Choose sheet music</h1>
  <p>Select a MusicXML or MXL file (.musicxml, .xml, .mxl). MIDI is not supported.</p>
  <label for="sheet-input">Browse files</label>
  <input
    id="sheet-input"
    type="file"
    accept=".musicxml,.xml,.mxl,application/xml,text/xml,application/vnd.recordare.musicxml+xml,application/octet-stream,*/*"
  />
  <script>
    const input = document.getElementById('sheet-input');
    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = String(reader.result || '');
        const comma = result.indexOf(',');
        const base64 = comma >= 0 ? result.slice(comma + 1) : result;
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'picked',
          name: file.name,
          base64,
        }));
      };
      reader.onerror = () => {
        window.ReactNativeWebView.postMessage(JSON.stringify({
          type: 'error',
          message: 'Could not read the selected file.',
        }));
      };
      reader.readAsDataURL(file);
    });
    setTimeout(() => input.click(), 300);
  </script>
</body>
</html>`;
}

export interface PickedSheetFile {
  uri: string;
  name: string;
}

interface SheetFilePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (file: PickedSheetFile) => void;
  onError: (message: string) => void;
}

export default function SheetFilePickerModal({
  visible,
  onClose,
  onPick,
  onError,
}: SheetFilePickerModalProps) {
  const { theme, themeId } = useTheme();
  const styles = useThemedStyles((t) => ({
    container: { flex: 1, backgroundColor: t.background },
    header: {
      paddingTop: 56,
      paddingHorizontal: 20,
      paddingBottom: 12,
      flexDirection: 'row' as const,
      justifyContent: 'space-between' as const,
      alignItems: 'center' as const,
      borderBottomWidth: 1,
      borderBottomColor: t.border,
      backgroundColor: t.surface,
    },
    headerTitle: { fontSize: 18, fontWeight: '700' as const, color: t.text },
    cancelText: { color: t.primary, fontWeight: '600' as const, fontSize: 16 },
  }));

  async function handleMessage(event: WebViewMessageEvent) {
    try {
      const payload = JSON.parse(event.nativeEvent.data) as {
        type: string;
        name?: string;
        base64?: string;
        message?: string;
      };

      if (payload.type === 'error') {
        onError(payload.message ?? 'Could not read the selected file.');
        onClose();
        return;
      }

      if (payload.type !== 'picked' || !payload.name || !payload.base64) {
        return;
      }

      const safeName = payload.name.replace(/[^\w.\-() ]+/g, '_');
      const dest = `${FileSystem.cacheDirectory}picked_${Date.now()}_${safeName}`;
      await FileSystem.writeAsStringAsync(dest, payload.base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      onPick({ uri: dest, name: payload.name });
      onClose();
    } catch {
      onError('Could not process the selected file.');
      onClose();
    }
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Choose sheet music</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
        <WebView
          key={themeId}
          originWhitelist={['*']}
          source={{ html: buildPickerHtml(theme.background, theme.text, theme.primary) }}
          onMessage={handleMessage}
          javaScriptEnabled
        />
      </View>
    </Modal>
  );
}
