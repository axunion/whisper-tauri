export type { ConversionResult } from "~/bindings";

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
