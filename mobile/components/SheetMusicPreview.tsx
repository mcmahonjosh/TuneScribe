import { View } from 'react-native';
import { WebView } from 'react-native-webview';

import { OSMD_LAYOUT_SETUP } from '@/components/osmdLayout';
import { themes, type ThemeId } from '@/constants/theme';
import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';

interface SheetMusicPreviewProps {
  musicxmlContent: string;
}

function buildOsmdHtml(musicxml: string, themeId: ThemeId): string {
  const theme = themes[themeId];
  const escaped = musicxml
    .replace(/\\/g, '\\\\')
    .replace(/`/g, '\\`')
    .replace(/\$/g, '\\$');

  return `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://unpkg.com/opensheetmusicdisplay@1.8.9/build/opensheetmusicdisplay.min.js"></script>
  <style>
    body { margin: 0; padding: 8px; background: ${theme.sheetBackground}; }
    #score { width: 100%; }
  </style>
</head>
<body>
  <div id="score"></div>
  <script>
    ${OSMD_LAYOUT_SETUP}
    const musicXml = \`${escaped}\`;
    const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay('score', {
      autoResize: true,
      drawTitle: false,
      backend: 'svg',
    });
    osmd.load(musicXml).then(() => {
      configureOsmdLayout(osmd);
      osmd.render();
    });
    window.addEventListener('resize', () => {
      configureOsmdLayout(osmd);
      osmd.render();
    });
  </script>
</body>
</html>`;
}

export default function SheetMusicPreview({ musicxmlContent }: SheetMusicPreviewProps) {
  const { themeId } = useTheme();
  const styles = useThemedStyles((t) => ({
    container: {
      height: 320,
      borderRadius: 12,
      overflow: 'hidden' as const,
      borderWidth: 1,
      borderColor: t.border,
      backgroundColor: t.sheetBackground,
    },
    webview: { flex: 1, backgroundColor: t.sheetBackground },
  }));

  return (
    <View style={styles.container}>
      <WebView
        key={themeId}
        originWhitelist={['*']}
        source={{ html: buildOsmdHtml(musicxmlContent, themeId) }}
        style={styles.webview}
        scrollEnabled
      />
    </View>
  );
}
