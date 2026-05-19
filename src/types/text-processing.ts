/**
 * Text processing model information.
 */
export interface TextModelInfo {
  /** Model identifier (e.g., "gemma-4-e2b", "qwen3.5-4b") */
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
 * Information about a legacy (retired) text model file present on disk.
 */
export interface LegacyTextModelInfo {
  /** Model identifier (the retired model ID) */
  id: string;
  /** Size in bytes */
  sizeBytes: number;
  /** Path to the model file */
  path: string;
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

/**
 * A single action item extracted from a transcription.
 *
 * Assignee inference is intentionally not supported — speaker identification
 * is unreliable from transcripts. `due` is populated only when explicitly
 * mentioned in the speech.
 */
export interface ActionItem {
  what: string;
  due?: string;
}

/**
 * Structured summary returned by `text_processing_summarize`.
 *
 * `tldr` is a 1–2 sentence overall recap; `keyPoints` is the sub-topic
 * bullet list. Arrays may be empty when the transcription does not yield
 * that kind of content (e.g. a monologue with no action items). Sections
 * backed by empty arrays / empty strings are hidden in the UI.
 */
export interface StructuredSummary {
  headline: string;
  tldr: string;
  keywords: string[];
  actionItems: ActionItem[];
  keyPoints: string[];
}
