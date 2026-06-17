import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';

import { ensureProjectDir } from './files';

let recording: Audio.Recording | null = null;
let activeSound: Audio.Sound | null = null;
let recordingPrefersWav = false;

// expo-av does not re-export IOSOutputFormat; values match RecordingConstants.ts.
const IOS_OUTPUT_FORMAT_LINEAR_PCM = 'lpcm';
const IOS_AUDIO_QUALITY_HIGH = 0x60;

function recordingOptions(preferWav: boolean) {
  if (!preferWav) {
    return Audio.RecordingOptionsPresets.HIGH_QUALITY;
  }

  return {
    isMeteringEnabled: true,
    android: Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    ios: {
      extension: '.wav',
      outputFormat: IOS_OUTPUT_FORMAT_LINEAR_PCM,
      audioQuality: IOS_AUDIO_QUALITY_HIGH,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: Audio.RecordingOptionsPresets.HIGH_QUALITY.web,
  };
}

export async function stopAudioPlayback(): Promise<void> {
  if (!activeSound) return;
  try {
    await activeSound.stopAsync();
    await activeSound.unloadAsync();
  } catch {
    // Sound may already be stopped.
  }
  activeSound = null;
}

export async function requestRecordingPermissions(): Promise<boolean> {
  const permission = await Audio.requestPermissionsAsync();
  return permission.granted;
}

export async function startRecording(
  _projectId: string,
  options?: { preferWav?: boolean }
): Promise<void> {
  recordingPrefersWav = options?.preferWav ?? false;

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const { recording: newRecording } = await Audio.Recording.createAsync(
    recordingOptions(recordingPrefersWav)
  );
  recording = newRecording;
}

export async function stopRecording(
  projectId: string,
  options?: { preferWav?: boolean }
): Promise<string> {
  if (!recording) {
    throw new Error('No active recording');
  }

  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  recording = null;

  if (!uri) {
    throw new Error('Recording URI missing');
  }

  const dir = await ensureProjectDir(projectId);
  const preferWav = options?.preferWav ?? recordingPrefersWav;
  const extension = preferWav ? 'wav' : 'm4a';
  const dest = `${dir}input.${extension}`;
  recordingPrefersWav = false;
  await FileSystem.copyAsync({ from: uri, to: dest });
  return dest;
}

export async function playAudio(uri: string): Promise<Audio.Sound> {
  await stopAudioPlayback();
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });

  const { sound } = await Audio.Sound.createAsync({ uri });
  activeSound = sound;
  sound.setOnPlaybackStatusUpdate((status) => {
    if (status.isLoaded && status.didJustFinish) {
      activeSound = null;
    }
  });
  await sound.playAsync();
  return sound;
}

export function isRecordingActive(): boolean {
  return recording !== null;
}
