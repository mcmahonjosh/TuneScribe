import { ensureProjectDir } from '@/services/files';
import { writeMidiNotes } from '@/services/local/midiFile';
import { exportMusicXmlFromNotes } from '@/services/local/musicxmlExport';
import { parseMusicXmlToMidiNotes } from '@/services/local/musicxmlParse';
import { writePreviewWav } from '@/services/local/previewSynth';
import { transposeMusicXmlFile } from '@/services/local/transposeMusicXml';
import {
  isMusicXmlFilename,
  type ProcessingStep,
} from '@/services/processing/types';
import { formatKeyLabel, type TargetKey, type TransposeResponse } from '@/types/transpose';
import * as FileSystem from 'expo-file-system/legacy';
export interface TransposeProjectParams {
  projectId: string;
  sheetUri: string;
  sheetName: string;
  targetKey: TargetKey;
  onStep?: (step: ProcessingStep) => void;
}

export interface TransposeProjectResult {
  response: TransposeResponse;
  processingModeUsed: 'local';
  musicxmlPath?: string;
  previewWavPath?: string;
  midiPath?: string;
  sourceKeyDetected?: string;
  targetKeyLabel?: string;
  omrUsed: boolean;
  errorMessage?: string;
}

export async function transposeProject(
  params: TransposeProjectParams
): Promise<TransposeProjectResult> {
  if (!isMusicXmlFilename(params.sheetName)) {
    throw new Error('Offline v1 only supports MusicXML (.musicxml, .xml, .mxl) files.');
  }

  params.onStep?.('exporting_musicxml');
  const projectDir = await ensureProjectDir(params.projectId);
  const rawPath = `${projectDir}transposed_raw.musicxml`;
  const outputPath = `${projectDir}output.musicxml`;
  const { sourceKey, outputXml } = await transposeMusicXmlFile(
    params.sheetUri,
    rawPath,
    params.targetKey
  );

  const midiPath = `${projectDir}output.mid`;
  const previewWavPath = `${projectDir}preview.wav`;
  let previewPath: string | undefined;
  let midiOut: string | undefined;
  let musicxmlError: string | null = null;

  try {
    const notes = parseMusicXmlToMidiNotes(outputXml);
    if (notes.length === 0) {
      throw new Error('No notes found after transpose.');
    }
    // Re-layout as grand staff (treble + bass), same as Record transcription.
    await exportMusicXmlFromNotes(
      outputPath,
      notes,
      `Transpose ${params.sheetName}`,
      params.targetKey
    );
    await writeMidiNotes(midiPath, notes);
    midiOut = midiPath;
    await writePreviewWav(previewWavPath, notes);
    previewPath = previewWavPath;
  } catch (error) {
    musicxmlError = error instanceof Error ? error.message : 'Grand staff export failed';
    // Fall back to pitch-only transposed XML if re-layout fails.
    await FileSystem.writeAsStringAsync(outputPath, outputXml, {
      encoding: FileSystem.EncodingType.UTF8,
    });
  }

  const response: TransposeResponse = {
    job_id: `local_${params.projectId}`,
    status: 'complete',
    source_key: sourceKey,
    target_key: params.targetKey,
    omr_used: false,
    files: {
      input: params.sheetUri,
      musicxml: outputPath,
      pdf: null,
      preview: previewPath ?? null,
      preview_mid: midiOut ?? null,
      debug: null,
    },
    musicxml_error: musicxmlError,
  };

  return {
    response,
    processingModeUsed: 'local',
    musicxmlPath: outputPath,
    previewWavPath: previewPath,
    midiPath: midiOut,
    sourceKeyDetected: formatKeyLabel(sourceKey),
    targetKeyLabel: formatKeyLabel(params.targetKey),
    omrUsed: false,
    errorMessage: musicxmlError ?? undefined,
  };
}
