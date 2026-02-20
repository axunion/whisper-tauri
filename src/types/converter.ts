/**
 * Supported audio/video format information.
 */
export interface SupportedFormat {
  /** File extension (e.g., "mp3", "wav") */
  extension: string;
  /** Human-readable description */
  description: string;
  /** Whether this format requires conversion to WAV */
  needsConversion: boolean;
}

/**
 * Result of an audio file conversion.
 */
export interface ConversionResult {
  /** Path to the converted WAV file */
  outputPath: string;
  /** Original file path */
  originalPath: string;
}

/**
 * FFmpeg download progress event payload.
 */
export interface FfmpegDownloadProgress {
  /** Downloaded bytes */
  downloadedBytes: number;
  /** Total bytes */
  totalBytes: number;
  /** Progress percentage (0-100) */
  progress: number;
}
