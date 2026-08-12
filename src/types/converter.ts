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
