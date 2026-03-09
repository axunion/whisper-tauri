/**
 * Text processing model information.
 */
export interface TextModelInfo {
  /** Model identifier (e.g., "gemma-3-4b", "qwen3.5-4b") */
  id: string;
  /** Display name */
  name: string;
  /** Human-readable size (e.g., "2.7GB") */
  size: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Model description */
  description: string;
  /** Whether the model is downloaded */
  downloaded: boolean;
  /** Path to the model file (if downloaded) */
  path?: string;
}

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

/**
 * Summary generation options.
 */
export interface SummaryOptions {
  /** Desired summary length */
  length: SummaryLength;
  /** Whether to use bullet points */
  bulletPoints: boolean;
}

/**
 * Summary length options.
 */
export type SummaryLength = "short" | "medium" | "long";

/**
 * Server status information.
 */
export interface ServerStatus {
  /** Whether the server is running */
  running: boolean;
  /** The port the server is listening on */
  port?: number;
  /** The model ID loaded on the server */
  modelId?: string;
}
