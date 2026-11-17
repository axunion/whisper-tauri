import type { ModelInfo_Serialize } from "~/bindings";

export type {
  DownloadProgress,
  TranscriptionProgress,
  TranscriptionResult,
  TranscriptionSegment,
} from "~/bindings";

export type ModelInfo = ModelInfo_Serialize;

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
