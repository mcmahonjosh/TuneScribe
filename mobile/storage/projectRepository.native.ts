import * as SQLite from 'expo-sqlite';

import { Project, ProjectStatus } from '@/types/project';

interface ProjectRow {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  status: string;
  input_type: string | null;
  audio_path: string | null;
  midi_path: string | null;
  musicxml_path: string | null;
  preview_wav_path: string | null;
  pdf_path: string | null;
  duration_seconds: number | null;
  model_used: string | null;
  error_message: string | null;
  backend_job_id: string | null;
  transcription_mode: string | null;
  source_key: string | null;
  target_key: string | null;
  source_sheet_path: string | null;
  piano_output_format: string | null;
  chords_path: string | null;
  chords_preview_wav_path: string | null;
  detected_key: string | null;
}

let database: SQLite.SQLiteDatabase | null = null;

async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!database) {
    database = await SQLite.openDatabaseAsync('tunescribe.db');
    await database.execAsync(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        status TEXT NOT NULL,
        input_type TEXT,
        audio_path TEXT,
        midi_path TEXT,
        musicxml_path TEXT,
        pdf_path TEXT,
        duration_seconds REAL,
        model_used TEXT,
        error_message TEXT,
        backend_job_id TEXT,
        preview_wav_path TEXT
      );
    `);
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN preview_wav_path TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN transcription_mode TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN source_key TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN target_key TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN source_sheet_path TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN piano_output_format TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN chords_path TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN detected_key TEXT;');
    } catch {
      // Column already exists.
    }
    try {
      await database.execAsync('ALTER TABLE projects ADD COLUMN chords_preview_wav_path TEXT;');
    } catch {
      // Column already exists.
    }
  }
  return database;
}

function mapRow(row: ProjectRow): Project {
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    status: row.status as ProjectStatus,
    inputType: row.input_type as Project['inputType'],
    audioPath: row.audio_path ?? undefined,
    midiPath: row.midi_path ?? undefined,
    musicxmlPath: row.musicxml_path ?? undefined,
    previewWavPath: row.preview_wav_path ?? undefined,
    pdfPath: row.pdf_path ?? undefined,
    durationSeconds: row.duration_seconds ?? undefined,
    modelUsed: row.model_used ?? undefined,
    errorMessage: row.error_message ?? undefined,
    backendJobId: row.backend_job_id ?? undefined,
    transcriptionMode: row.transcription_mode ?? undefined,
    pianoOutputFormat: row.piano_output_format as Project['pianoOutputFormat'],
    chordsPath: row.chords_path ?? undefined,
    chordsPreviewWavPath: row.chords_preview_wav_path ?? undefined,
    detectedKey: row.detected_key ?? undefined,
    sourceKeyDetected: row.source_key ?? undefined,
    targetKey: row.target_key ?? undefined,
    sourceSheetPath: row.source_sheet_path ?? undefined,
  };
}

export async function listProjects(): Promise<Project[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ProjectRow>(
    'SELECT * FROM projects ORDER BY created_at DESC'
  );
  return rows.map(mapRow);
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ProjectRow>(
    'SELECT * FROM projects WHERE id = ?',
    [id]
  );
  return row ? mapRow(row) : null;
}

export async function saveProject(project: Project): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT OR REPLACE INTO projects (
      id, title, created_at, updated_at, status, input_type,
      audio_path, midi_path, musicxml_path, preview_wav_path, pdf_path,
      duration_seconds, model_used, error_message, backend_job_id, transcription_mode,
      source_key, target_key, source_sheet_path, piano_output_format, chords_path,
      chords_preview_wav_path, detected_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      project.id,
      project.title,
      project.createdAt,
      project.updatedAt,
      project.status,
      project.inputType ?? null,
      project.audioPath ?? null,
      project.midiPath ?? null,
      project.musicxmlPath ?? null,
      project.previewWavPath ?? null,
      project.pdfPath ?? null,
      project.durationSeconds ?? null,
      project.modelUsed ?? null,
      project.errorMessage ?? null,
      project.backendJobId ?? null,
      project.transcriptionMode ?? null,
      project.sourceKeyDetected ?? null,
      project.targetKey ?? null,
      project.sourceSheetPath ?? null,
      project.pianoOutputFormat ?? null,
      project.chordsPath ?? null,
      project.chordsPreviewWavPath ?? null,
      project.detectedKey ?? null,
    ]
  );
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM projects WHERE id = ?', [id]);
}

export async function updateProjectStatus(
  id: string,
  status: ProjectStatus,
  errorMessage?: string
): Promise<void> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.runAsync(
    'UPDATE projects SET status = ?, updated_at = ?, error_message = ? WHERE id = ?',
    [status, now, errorMessage ?? null, id]
  );
}
