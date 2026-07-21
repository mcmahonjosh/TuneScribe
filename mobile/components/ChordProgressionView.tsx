import { Audio, AVPlaybackStatus } from 'expo-av';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui';
import { useThemedStyles } from '@/hooks/useThemedStyles';
import { ChordProgressionData, ChordSegment } from '@/types/project';

const COLUMNS = 4;
const PLAYBACK_UPDATE_MS = 100;

export type ChordPlaybackState = 'idle' | 'playing' | 'paused';

export interface ChordProgressionViewHandle {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  stop: () => Promise<void>;
  canPlay: () => boolean;
}

interface ChordProgressionViewProps {
  data: ChordProgressionData;
  previewUri?: string;
  onPlaybackStateChange?: (state: ChordPlaybackState) => void;
}

function chunkRows<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

function findActiveChordIndex(chords: ChordSegment[], positionSec: number): number {
  if (!chords.length) {
    return -1;
  }

  let active = -1;
  for (let index = 0; index < chords.length; index++) {
    const segment = chords[index];
    if (positionSec < segment.start) {
      break;
    }
    if (positionSec < segment.end) {
      return index;
    }
    active = index;
  }

  return active;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  if (rounded < 60) {
    return `${rounded}s`;
  }
  return formatTime(rounded);
}

const ChordProgressionView = forwardRef<ChordProgressionViewHandle, ChordProgressionViewProps>(
  function ChordProgressionView({ data, previewUri, onPlaybackStateChange }, ref) {
    const soundRef = useRef<Audio.Sound | null>(null);
    const activeIndexRef = useRef(-1);
    const [playbackState, setPlaybackState] = useState<ChordPlaybackState>('idle');
    const [activeIndex, setActiveIndex] = useState(-1);
    const styles = useThemedStyles((t) => ({
      container: { gap: 12 },
      headerRow: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        gap: 12,
        flexWrap: 'wrap' as const,
      },
      keyLabel: { fontSize: 15, fontWeight: '600' as const, color: t.text },
      previewMissing: { fontSize: 12, color: t.warning, flexShrink: 1 },
      controls: { flexDirection: 'row' as const, gap: 8 },
      controlBtn: { paddingVertical: 8, paddingHorizontal: 12 },
      grid: { gap: 10 },
      gridRow: { flexDirection: 'row' as const, gap: 8 },
      cell: {
        flex: 1,
        backgroundColor: t.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: t.border,
        paddingVertical: 12,
        paddingHorizontal: 6,
        alignItems: 'center' as const,
        gap: 4,
        minHeight: 88,
        justifyContent: 'center' as const,
      },
      cellActive: {
        backgroundColor: t.primary,
        borderColor: t.primaryMuted,
      },
      cellFiller: { flex: 1 },
      symbol: { fontSize: 17, fontWeight: '700' as const, color: t.text, textAlign: 'center' as const },
      symbolActive: { color: t.primaryText },
      roman: { fontSize: 12, color: t.textMuted, fontWeight: '600' as const },
      romanActive: { color: t.primaryText, opacity: 0.9 },
      time: { fontSize: 10, color: t.textSubtle, marginTop: 2, textAlign: 'center' as const },
      timeActive: { color: t.primaryText, opacity: 0.85 },
      empty: { fontSize: 13, color: t.textMuted, lineHeight: 18 },
    }));

    const keyLabel = `${data.key.tonic} ${data.key.mode}`;
    const rows = chunkRows(data.chords, COLUMNS);
    const canPlay = Boolean(previewUri) && data.chords.length > 0;

    const updatePlaybackState = useCallback(
      (state: ChordPlaybackState) => {
        setPlaybackState(state);
        onPlaybackStateChange?.(state);
      },
      [onPlaybackStateChange]
    );

    const setActiveChordIndex = useCallback((index: number) => {
      if (index === activeIndexRef.current) {
        return;
      }
      activeIndexRef.current = index;
      setActiveIndex(index);
    }, []);

    const unloadSound = useCallback(async () => {
      if (!soundRef.current) {
        return;
      }
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch {
        // Sound may already be stopped.
      }
      soundRef.current = null;
    }, []);

    useEffect(() => {
      activeIndexRef.current = -1;
      setActiveIndex(-1);
    }, [data.chords, previewUri]);

    useEffect(() => {
      return () => {
        void unloadSound();
      };
    }, [unloadSound]);

    const onPlaybackStatusUpdate = useCallback(
      (status: AVPlaybackStatus) => {
        if (!status.isLoaded) {
          return;
        }
        if (status.didJustFinish) {
          updatePlaybackState('idle');
          setActiveChordIndex(-1);
          return;
        }
        const positionSec = (status.positionMillis ?? 0) / 1000;
        setActiveChordIndex(findActiveChordIndex(data.chords, positionSec));
        updatePlaybackState(status.isPlaying ? 'playing' : 'paused');
      },
      [data.chords, setActiveChordIndex, updatePlaybackState]
    );

    const ensureSound = useCallback(async (): Promise<Audio.Sound | null> => {
      if (!previewUri) {
        return null;
      }
      if (soundRef.current) {
        return soundRef.current;
      }
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });
      const { sound } = await Audio.Sound.createAsync(
        { uri: previewUri },
        { progressUpdateIntervalMillis: PLAYBACK_UPDATE_MS }
      );
      sound.setOnPlaybackStatusUpdate(onPlaybackStatusUpdate);
      soundRef.current = sound;
      return sound;
    }, [onPlaybackStatusUpdate, previewUri]);

    const handlePlay = useCallback(async () => {
      if (!canPlay) {
        return;
      }
      const sound = await ensureSound();
      if (!sound) {
        return;
      }
      const status = await sound.getStatusAsync();
      if (status.isLoaded && status.isPlaying) {
        await sound.pauseAsync();
        updatePlaybackState('paused');
        return;
      }
      if (status.isLoaded && status.positionMillis > 0 && !status.didJustFinish) {
        await sound.playAsync();
        updatePlaybackState('playing');
        return;
      }
      await sound.setPositionAsync(0);
      await sound.playAsync();
      updatePlaybackState('playing');
      setActiveChordIndex(data.chords.length > 0 ? 0 : -1);
    }, [canPlay, data.chords.length, ensureSound, setActiveChordIndex, updatePlaybackState]);

    const handlePause = useCallback(async () => {
      if (!soundRef.current) {
        return;
      }
      await soundRef.current.pauseAsync();
      updatePlaybackState('paused');
    }, [updatePlaybackState]);

    const handleResume = useCallback(async () => {
      if (!soundRef.current) {
        await handlePlay();
        return;
      }
      await soundRef.current.playAsync();
      updatePlaybackState('playing');
    }, [handlePlay, updatePlaybackState]);

    const handleStop = useCallback(async () => {
      await unloadSound();
      updatePlaybackState('idle');
      setActiveChordIndex(-1);
    }, [setActiveChordIndex, unloadSound, updatePlaybackState]);

    useImperativeHandle(
      ref,
      () => ({
        play: handlePlay,
        pause: handlePause,
        resume: handleResume,
        stop: handleStop,
        canPlay: () => canPlay,
      }),
      [canPlay, handlePause, handlePlay, handleResume, handleStop]
    );

    const isPlaying = playbackState === 'playing';

    return (
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <Text style={styles.keyLabel}>Key: {keyLabel}</Text>
          {canPlay ? (
            <View style={styles.controls}>
              <Button
                label={isPlaying ? 'Pause' : 'Play'}
                onPress={() => void handlePlay()}
                style={styles.controlBtn}
              />
              <Button
                label="Stop"
                variant="secondary"
                onPress={() => void handleStop()}
                style={styles.controlBtn}
              />
            </View>
          ) : data.chords.length > 0 ? (
            <Text style={styles.previewMissing}>Chord preview audio is not available for this project.</Text>
          ) : null}
        </View>

        {data.chords.length === 0 ? (
          <Text style={styles.empty}>
            No chords detected. Try a clearer piano recording or use sheet music mode.
          </Text>
        ) : (
          <View style={styles.grid}>
            {rows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={styles.gridRow}>
                {row.map((segment, columnIndex) => {
                  const chordIndex = rowIndex * COLUMNS + columnIndex;
                  const isActive = chordIndex === activeIndex;
                  const durationSec = Math.max(segment.end - segment.start, 0);
                  return (
                    <View
                      key={`${segment.start}-${segment.symbol}-${chordIndex}`}
                      style={[styles.cell, isActive && styles.cellActive]}
                    >
                      <Text style={[styles.symbol, isActive && styles.symbolActive]}>
                        {segment.symbol}
                      </Text>
                      {segment.roman ? (
                        <Text style={[styles.roman, isActive && styles.romanActive]}>
                          {segment.roman}
                        </Text>
                      ) : null}
                      <Text style={[styles.time, isActive && styles.timeActive]}>
                        {formatTime(segment.start)} · {formatDuration(durationSec)}
                      </Text>
                    </View>
                  );
                })}
                {row.length < COLUMNS
                  ? Array.from({ length: COLUMNS - row.length }).map((_, fillerIndex) => (
                      <View key={`filler-${rowIndex}-${fillerIndex}`} style={styles.cellFiller} />
                    ))
                  : null}
              </View>
            ))}
          </View>
        )}
      </View>
    );
  }
);

export default ChordProgressionView;
