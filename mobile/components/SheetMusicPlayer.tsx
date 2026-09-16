import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { type StyleProp, type ViewStyle, useWindowDimensions } from 'react-native';
import { ActivityIndicator, Text, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';

import { buildSheetMusicPlayerHtml, type SheetPlayerVariant } from '@/components/sheetMusicPlayerHtml';
import { Button } from '@/components/ui';
import { useTheme } from '@/context/ThemeContext';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { stopAudioPlayback } from '@/services/audio';
import {
  pauseSheetAudio,
  playSheetAudio,
  resumeSheetAudio,
  stopSheetAudio,
} from '@/services/sheetPlayback';

export type SheetPlaybackState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'stopped'
  | 'ended'
  | 'error';

export interface SheetMusicPlayerHandle {
  play: () => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export interface SheetNoteTiming {
  midi?: number;
  start: number;
  end: number;
  duration?: number;
}

interface SheetMusicPlayerProps {
  musicxmlContent: string;
  midiBase64?: string | null;
  previewWavUri?: string | null;
  onPlaybackStateChange?: (state: SheetPlaybackState) => void;
  variant?: SheetPlayerVariant;
  style?: StyleProp<ViewStyle>;
}

const PAPER = '#f7f4ea';

const SheetMusicPlayer = forwardRef<SheetMusicPlayerHandle, SheetMusicPlayerProps>(
  function SheetMusicPlayer(
    {
      musicxmlContent,
      midiBase64,
      previewWavUri,
      onPlaybackStateChange,
      variant = 'fullscreen',
      style,
    },
    ref
  ) {
    const compact = variant === 'compact';
    const { themeId, theme } = useTheme();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const webViewRef = useRef<WebView>(null);
    const timingsRef = useRef<SheetNoteTiming[]>([]);
    const [playbackState, setPlaybackState] = useState<SheetPlaybackState>('idle');
    const [statusText, setStatusText] = useState('Loading score...');
    const styles = useThemedStyles((t) => ({
      container: {
        borderRadius: compact ? 14 : 0,
        overflow: 'hidden' as const,
        borderWidth: compact ? 1 : 0,
        borderColor: t.border,
        backgroundColor: PAPER,
        flex: compact ? undefined : 1,
      },
      controls: {
        flexDirection: 'row' as const,
        gap: 8,
        padding: 10,
        backgroundColor: t.surfaceElevated,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      },
      controlBtn: { flex: 1, paddingVertical: 10 },
      status: { fontSize: 12, color: t.textMuted, padding: 10 },
      warning: { fontSize: 12, color: t.warning, paddingHorizontal: 10, paddingBottom: 8 },
      webview: compact
        ? { height: 196, backgroundColor: PAPER }
        : { flex: 1, backgroundColor: PAPER },
      playingBadge: {
        fontSize: 12,
        color: t.success,
        fontWeight: '600' as const,
        padding: 10,
        textAlign: 'center' as const,
      },
    }));
    const playerHtml = buildSheetMusicPlayerHtml(
      musicxmlContent,
      midiBase64 ?? null,
      themeId,
      variant
    );

    const updateState = useCallback(
      (state: SheetPlaybackState) => {
        setPlaybackState(state);
        onPlaybackStateChange?.(state);
      },
      [onPlaybackStateChange]
    );

    const setWebPlaybackMode = useCallback((mode: 'stopped' | 'playing' | 'paused') => {
      webViewRef.current?.injectJavaScript(
        `window.tunescribeSetPlaybackMode && window.tunescribeSetPlaybackMode('${mode}'); true;`
      );
    }, []);

    const syncCursor = useCallback((seconds: number) => {
      const rounded = Math.round(seconds * 1000) / 1000;
      webViewRef.current?.injectJavaScript(
        `window.tunescribeSyncTime && window.tunescribeSyncTime(${rounded}); true;`
      );
    }, []);

    const resetCursor = useCallback(() => {
      webViewRef.current?.injectJavaScript(
        `window.tunescribeResetCursor && window.tunescribeResetCursor(); true;`
      );
    }, []);

    useEffect(() => {
      if (compact) return;
      webViewRef.current?.injectJavaScript('window.dispatchEvent(new Event("resize")); true;');
    }, [compact, windowWidth, windowHeight]);

    const handleWebViewLayout = useCallback(
      (event: { nativeEvent: { layout: { width: number; height: number } } }) => {
        if (compact) return;
        const { width, height } = event.nativeEvent.layout;
        if (width < 40 || height < 40) return;
        setTimeout(() => {
          webViewRef.current?.injectJavaScript('window.dispatchEvent(new Event("resize")); true;');
        }, 80);
      },
      [compact]
    );

    const stopPlayback = useCallback(async () => {
      await stopSheetAudio();
      resetCursor();
      setWebPlaybackMode('stopped');
      updateState('stopped');
      setStatusText('Stopped');
    }, [resetCursor, setWebPlaybackMode, updateState]);

    const startPlayback = useCallback(async () => {
      if (!previewWavUri) {
        updateState('error');
        setStatusText('No preview audio for this project');
        return;
      }
      if (!timingsRef.current.length) {
        updateState('error');
        setStatusText('No notes found in score');
        return;
      }

      try {
        updateState('loading');
        setStatusText('Starting playback...');
        await stopAudioPlayback();
        await stopSheetAudio();
        await playSheetAudio(previewWavUri, {
          onPosition: (seconds) => syncCursor(seconds),
          onEnded: async () => {
            await stopSheetAudio();
            resetCursor();
            setWebPlaybackMode('stopped');
            updateState('ended');
            setStatusText('Finished');
          },
        });

        setWebPlaybackMode('playing');
        updateState('playing');
        setStatusText(`Playing ${timingsRef.current.length} notes`);
        syncCursor(0);
      } catch (error) {
        await stopSheetAudio();
        resetCursor();
        setWebPlaybackMode('stopped');
        updateState('error');
        setStatusText(error instanceof Error ? error.message : 'Playback failed');
      }
    }, [
      previewWavUri,
      resetCursor,
      setWebPlaybackMode,
      syncCursor,
      updateState,
    ]);

    const pausePlayback = useCallback(async () => {
      await pauseSheetAudio();
      setWebPlaybackMode('paused');
      updateState('paused');
      setStatusText('Paused');
    }, [setWebPlaybackMode, updateState]);

    const resumePlayback = useCallback(async () => {
      await resumeSheetAudio();
      setWebPlaybackMode('playing');
      updateState('playing');
      setStatusText(`Playing ${timingsRef.current.length} notes`);
    }, [setWebPlaybackMode, updateState]);

    useImperativeHandle(
      ref,
      () => ({
        play: () => {
          void startPlayback();
        },
        pause: () => {
          void pausePlayback();
        },
        resume: () => {
          void resumePlayback();
        },
        stop: () => {
          void stopPlayback();
        },
      }),
      [pausePlayback, resumePlayback, startPlayback, stopPlayback]
    );

    function handleMessage(event: WebViewMessageEvent) {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          action?: string;
          noteCount?: number;
          maxSimultaneous?: number;
          timings?: SheetNoteTiming[];
          message?: string;
        };

        if (data.type === 'ready') {
          timingsRef.current = (data.timings ?? []) as SheetNoteTiming[];
          const polyHint =
            data.maxSimultaneous && data.maxSimultaneous > 1
              ? ` · up to ${data.maxSimultaneous} notes together`
              : '';
          setStatusText(
            previewWavUri
              ? `Ready (${data.noteCount ?? 0} notes${polyHint})`
              : `Ready — preview audio unavailable (${data.noteCount ?? 0} notes${polyHint})`
          );
          updateState('ready');
          return;
        }

        if (data.type === 'error') {
          setStatusText(data.message ?? 'Failed to load score');
          updateState('error');
          return;
        }

        if (data.type === 'command') {
          if (data.action === 'play') void startPlayback();
          if (data.action === 'resume') void resumePlayback();
          if (data.action === 'pause') void pausePlayback();
          if (data.action === 'stop') void stopPlayback();
        }
      } catch {
        // Ignore malformed messages from the WebView.
      }
    }

    useEffect(() => {
      return () => {
        void stopSheetAudio();
      };
    }, []);

    const isPlaying = playbackState === 'playing';
    const isPaused = playbackState === 'paused';
    const isLoading = playbackState === 'loading';
    const canStart =
      !!previewWavUri &&
      (playbackState === 'ready' ||
        playbackState === 'stopped' ||
        playbackState === 'ended' ||
        playbackState === 'error');

    return (
      <View style={[styles.container, style]}>
        {!compact ? (
          <View style={styles.controls}>
            {isLoading ? (
              <View style={[styles.controlBtn, { alignItems: 'center', justifyContent: 'center' }]}>
                <ActivityIndicator color={theme.primary} size="small" />
              </View>
            ) : (
              <Button
                label={isPlaying ? '▶ Playing' : isPaused ? '▶ Resume' : '▶ Play'}
                variant="success"
                onPress={() => (isPaused ? void resumePlayback() : void startPlayback())}
                disabled={!canStart || isLoading}
                style={styles.controlBtn}
              />
            )}
            <Button
              label="⏸ Pause"
              variant="warning"
              onPress={() => void pausePlayback()}
              disabled={!isPlaying}
              style={styles.controlBtn}
            />
            <Button
              label="■ Stop"
              variant="secondary"
              onPress={() => void stopPlayback()}
              disabled={playbackState === 'stopped'}
              style={styles.controlBtn}
            />
          </View>
        ) : null}
        {!compact ? <Text style={styles.status}>{statusText}</Text> : null}
        {!compact && !previewWavUri ? (
          <Text style={styles.warning}>
            Sheet music is ready. Preview audio was not generated for this project — export MusicXML
            still works.
          </Text>
        ) : null}
        <WebView
          key={`${themeId}-${variant}`}
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: playerHtml }}
          style={styles.webview}
          scrollEnabled={!compact}
          nestedScrollEnabled
          scalesPageToFit={!compact}
          setBuiltInZoomControls={!compact}
          setDisplayZoomControls={false}
          onMessage={handleMessage}
          onLayout={handleWebViewLayout}
          javaScriptEnabled
          domStorageEnabled
        />
        {!compact && isPlaying ? (
          <Text style={styles.playingBadge}>● Playing with note highlights</Text>
        ) : null}
      </View>
    );
  }
);

export default SheetMusicPlayer;
