import { Audio, AVPlaybackStatus } from 'expo-av';

export interface SheetPlaybackCallbacks {
  onPosition: (seconds: number) => void;
  onEnded: () => void;
}

let sheetSound: Audio.Sound | null = null;

export async function stopSheetAudio(): Promise<void> {
  if (!sheetSound) return;
  try {
    await sheetSound.stopAsync();
    await sheetSound.unloadAsync();
  } catch {
    // Sound may already be stopped.
  }
  sheetSound = null;
}

function handleStatus(callbacks: SheetPlaybackCallbacks) {
  return (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;
    if (status.isPlaying) {
      callbacks.onPosition((status.positionMillis ?? 0) / 1000);
    }
    if (status.didJustFinish) {
      callbacks.onEnded();
      sheetSound = null;
    }
  };
}

export async function playSheetAudio(
  uri: string,
  callbacks: SheetPlaybackCallbacks
): Promise<void> {
  await stopSheetAudio();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    shouldDuckAndroid: true,
    playThroughEarpieceAndroid: false,
  });

  const { sound } = await Audio.Sound.createAsync(
    { uri },
    { shouldPlay: true, progressUpdateIntervalMillis: 50 },
    handleStatus(callbacks)
  ).catch((error: unknown) => {
    const message =
      error instanceof Error ? error.message : 'Could not play preview audio';
    if (message.includes('11800') || message.toLowerCase().includes('avfoundation')) {
      throw new Error(
        'Preview audio is missing or invalid. Re-transpose this sheet to regenerate it.'
      );
    }
    throw new Error(message);
  });
  sheetSound = sound;
}

export async function pauseSheetAudio(): Promise<void> {
  await sheetSound?.pauseAsync();
}

export async function resumeSheetAudio(): Promise<void> {
  await sheetSound?.playAsync();
}

export function isSheetAudioLoaded(): boolean {
  return sheetSound !== null;
}
