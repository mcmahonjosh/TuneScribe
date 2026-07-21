import * as FileSystem from 'expo-file-system/legacy';

import { yieldToUi } from '@/services/processing/progress';

function readAscii(view: DataView, offset: number, length: number): string {
  let value = '';
  for (let i = 0; i < length; i += 1) {
    value += String.fromCharCode(view.getUint8(offset + i));
  }
  return value;
}

export async function decodeAudioFileToMono22050(
  uri: string,
  onStageProgress?: (fraction: number) => void
): Promise<Float32Array> {
  onStageProgress?.(0);
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  onStageProgress?.(0.25);
  await yieldToUi();

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  const chunkSize = 262144;
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
    if (i > 0 && i % chunkSize === 0) {
      onStageProgress?.(0.25 + (0.35 * i) / binary.length);
      await yieldToUi();
    }
  }
  onStageProgress?.(0.6);
  await yieldToUi();

  const view = new DataView(bytes.buffer);
  const header = readAscii(view, 0, 4);
  if (header === 'RIFF') {
    const pcm = decodeWavPcm(bytes);
    onStageProgress?.(1);
    return pcm;
  }

  if (header === 'caff') {
    throw new Error(
      'Local mode received CAF audio instead of WAV. Stop the recording and transcribe again with the latest app.'
    );
  }

  if (bytes.length >= 8 && readAscii(view, 4, 4) === 'ftyp') {
    throw new Error(
      'Received compressed audio (M4A) instead of WAV. Re-record in WAV format.'
    );
  }

  throw new Error('WAV recordings are required. Re-record in WAV format.');
}

function decodeWavPcm(bytes: Uint8Array): Float32Array {
  const view = new DataView(bytes.buffer);
  if (readAscii(view, 0, 4) !== 'RIFF' || readAscii(view, 8, 4) !== 'WAVE') {
    throw new Error('Unsupported WAV file.');
  }

  let offset = 12;
  let sampleRate = 44100;
  let channels = 1;
  let bitsPerSample = 16;
  let dataOffset = 0;
  let dataSize = 0;

  while (offset + 8 <= bytes.length) {
    const chunkId = readAscii(view, offset, 4);
    const chunkSize = view.getUint32(offset + 4, true);
    const chunkStart = offset + 8;
    if (chunkId === 'fmt ') {
      channels = view.getUint16(chunkStart + 2, true);
      sampleRate = view.getUint32(chunkStart + 4, true);
      bitsPerSample = view.getUint16(chunkStart + 14, true);
    } else if (chunkId === 'data') {
      dataOffset = chunkStart;
      dataSize = chunkSize;
      break;
    }
    offset = chunkStart + chunkSize + (chunkSize % 2);
  }

  if (!dataSize) {
    throw new Error('WAV data chunk missing.');
  }

  const frameCount = dataSize / (channels * (bitsPerSample / 8));
  const mono = new Float32Array(frameCount);
  let writeIndex = 0;
  for (let i = 0; i < frameCount; i += 1) {
    let sample = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      const sampleOffset = dataOffset + (i * channels + channel) * (bitsPerSample / 8);
      if (bitsPerSample === 16) {
        sample += view.getInt16(sampleOffset, true) / 32768;
      } else if (bitsPerSample === 32) {
        sample += view.getFloat32(sampleOffset, true);
      } else {
        throw new Error(`Unsupported WAV bit depth: ${bitsPerSample}`);
      }
    }
    mono[writeIndex] = sample / channels;
    writeIndex += 1;
  }

  if (sampleRate === 22050) {
    return mono;
  }
  return resampleLinear(mono, sampleRate, 22050);
}

function resampleLinear(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) {
    return input;
  }
  const outputLength = Math.max(1, Math.round((input.length * toRate) / fromRate));
  const output = new Float32Array(outputLength);
  const ratio = input.length / outputLength;
  for (let i = 0; i < outputLength; i += 1) {
    const position = i * ratio;
    const index = Math.floor(position);
    const frac = position - index;
    const a = input[index] ?? 0;
    const b = input[Math.min(index + 1, input.length - 1)] ?? a;
    output[i] = a + (b - a) * frac;
  }
  return output;
}

export function encodeWavMono16(samples: Float32Array, sampleRate = 22050): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, Math.round(clamped * 32767), true);
    offset += 2;
  }

  return new Uint8Array(buffer);
}

export async function writeWavFile(uri: string, samples: Float32Array, sampleRate = 22050): Promise<void> {
  const bytes = encodeWavMono16(samples, sampleRate);
  const chunkSize = 0x2000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const end = Math.min(i + chunkSize, bytes.length);
    for (let j = i; j < end; j += 1) {
      binary += String.fromCharCode(bytes[j]);
    }
  }

  // Write to a temp path first so validators never see a half-written WAV.
  const tempUri = `${uri}.partial`;
  await FileSystem.writeAsStringAsync(tempUri, btoa(binary), {
    encoding: FileSystem.EncodingType.Base64,
  });
  await FileSystem.deleteAsync(uri, { idempotent: true });
  await FileSystem.moveAsync({ from: tempUri, to: uri });
}
