import type { ModelInfo_Serialize } from "~/bindings";

export type {
  TranscriptionResult,
  TranscriptionSegment,
} from "~/bindings";

export type ModelInfo = ModelInfo_Serialize;

/**
 * Transcription progress update.
 */
export interface TranscriptionProgress {
  /** Task identifier */
  taskId: string;
  /** Progress percentage (0-100) */
  progress: number;
  /** Elapsed time in milliseconds */
  elapsedMs: number;
}

/**
 * Model download progress.
 */
export interface DownloadProgress {
  /** Model identifier being downloaded */
  modelId: string;
  /** Downloaded bytes */
  downloadedBytes: number;
  /** Total bytes */
  totalBytes: number;
  /** Progress percentage (0-100) */
  progress: number;
}

/**
 * Audio file information.
 */
export interface FileInfo {
  /** Full file path */
  path: string;
  /** File name */
  name: string;
  /** File size in bytes */
  size: number;
  /** Duration in milliseconds (if known) */
  duration?: number;
}
