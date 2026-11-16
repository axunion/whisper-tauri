import type {
  ActionItem_Serialize,
  StructuredSummary_Serialize,
  TextModelInfo_Serialize,
} from "~/bindings";

export type ActionItem = ActionItem_Serialize;
export type StructuredSummary = StructuredSummary_Serialize;
export type TextModelInfo = TextModelInfo_Serialize;

/**
 * Text model download progress.
 */
export interface TextDownloadProgress {
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
 * Inference progress update (streaming tokens).
 */
export interface InferenceProgress {
  /** Task identifier */
  taskId: string;
  /** Latest token */
  token: string;
  /** Full accumulated text so far */
  accumulatedText: string;
  /** Whether inference is complete */
  done: boolean;
}
