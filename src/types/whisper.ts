/**
 * Whisper model information.
 */
export interface ModelInfo {
  /** Model identifier (e.g., "small", "medium", "large-v3-turbo") */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable size (e.g., "142MB") */
  size: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Model description */
  description: string;
  /** Whether the model is downloaded */
  downloaded: boolean;
  /** Whether the model is bundled with the app */
  bundled: boolean;
  /** Whether the model is recommended for this system */
  recommended: boolean;
  /** Estimated processing speed for this hardware */
  speedNote: string;
  /** Estimated seconds to process 1 minute of audio (lower bound) */
  speedSecondsPerMinuteLow: number;
  /** Estimated seconds to process 1 minute of audio (upper bound) */
  speedSecondsPerMinuteHigh: number;
  /** Path to the model file (if downloaded) */
  path?: string;
}

/**
 * A segment of transcribed text with timing information.
 */
export interface TranscriptionSegment {
  /** Start time in milliseconds */
  start: number;
  /** End time in milliseconds */
  end: number;
  /** Transcribed text */
  text: string;
}

/**
 * Transcription result with full text and segments.
 */
export interface TranscriptionResult {
  /** Task identifier */
  taskId: string;
  /** Full transcribed text */
  text: string;
  /** Segments with timing information */
  segments: TranscriptionSegment[];
  /** Detected language code */
  language: string;
  /** Total duration in milliseconds */
  duration: number;
}

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
  /** Current segment being processed */
  currentSegment?: string;
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
