/**
 * A segment of transcribed text with timing information (for history storage).
 */
export interface HistorySegment {
  /** Start time in milliseconds */
  start: number;
  /** End time in milliseconds */
  end: number;
  /** Transcribed text */
  text: string;
}

/**
 * How the audio behind an entry entered the app. Persisted per entry so the UI
 * never has to infer it from the (user-editable) file name.
 */
export type HistorySource = "recording" | "file";

/**
 * Metadata for a history entry (used in list views, without full text/segments).
 */
export interface HistoryMeta {
  /** Unique identifier */
  id: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Original file name */
  fileName: string;
  /** Detected language code */
  language: string;
  /** Model used for transcription */
  modelId: string;
  /** Total duration in milliseconds */
  duration: number;
  /** Preview of the transcribed text */
  textPreview: string;
  vadEnabled: boolean | null;
  /** Where the audio came from */
  source: HistorySource;
}

/**
 * Full history entry including text and segments.
 */
export interface HistoryEntry {
  /** Unique identifier */
  id: string;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Original file name */
  fileName: string;
  /** Detected language code */
  language: string;
  /** Model used for transcription */
  modelId: string;
  /** Total duration in milliseconds */
  duration: number;
  /** Full transcribed text */
  text: string;
  /** Segments with timing information */
  segments: HistorySegment[];
  vadEnabled: boolean | null;
}

/**
 * Parameters for saving a new history entry.
 */
export interface HistorySaveParams {
  /** Original file name */
  fileName: string;
  /** Detected language code */
  language: string;
  /** Model used for transcription */
  modelId: string;
  /** Total duration in milliseconds */
  duration: number;
  /** Full transcribed text */
  text: string;
  /** Segments with timing information */
  segments: HistorySegment[];
  vadEnabled?: boolean;
  /** Where the audio came from */
  source: HistorySource;
}

/** Sort order for history listing. */
export type HistorySortBy = "date" | "duration" | "fileName";

/** Sort direction. */
export type SortOrder = "asc" | "desc";

/**
 * Filter for listing history entries.
 */
export interface HistoryFilter {
  /**
   * Inclusive lower bound, as a suffix-less UTC timestamp matching `createdAt`
   * (e.g. "2026-01-01T15:00:00"). Compared lexicographically in SQLite, so the
   * format has to match `createdAt` exactly — see `computeDateRange`.
   */
  dateFrom?: string;
  /** Exclusive upper bound, same format as `dateFrom` */
  dateTo?: string;
  /** Maximum number of entries to return */
  limit?: number;
  /** Sort by field */
  sortBy?: HistorySortBy;
  /** Sort direction */
  sortOrder?: SortOrder;
}

/**
 * Valid content types for AI-generated content.
 */
export type AiContentType = "summary" | "cleanText" | "title";

/**
 * AI-generated content associated with a history entry.
 */
export interface AiContent {
  /** Unique identifier */
  id: string;
  /** History entry this content belongs to */
  historyId: string;
  /** Type of content */
  contentType: AiContentType;
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** The generated text content */
  text: string;
  /** JSON string of options used for generation */
  optionsJson?: string;
  /** ID of the text model used for generation */
  textModelId: string;
}

/**
 * Parameters for saving AI-generated content.
 */
export interface AiContentSaveParams {
  /** History entry this content belongs to */
  historyId: string;
  /** Type of content */
  contentType: AiContentType;
  /** The generated text content */
  text: string;
  /** JSON string of options used for generation */
  optionsJson?: string;
  /** ID of the text model used for generation */
  textModelId: string;
}

/**
 * Parameters for full-text search of history entries.
 */
export interface HistorySearchParams {
  /** Search query (space-separated keywords for AND search) */
  query: string;
  /** Optional inclusive lower bound, same format as `HistoryFilter.dateFrom` */
  dateFrom?: string;
  /** Optional exclusive upper bound, same format as `dateFrom` */
  dateTo?: string;
  /** Maximum number of entries to return */
  limit?: number;
  /** Sort by field */
  sortBy?: HistorySortBy;
  /** Sort direction */
  sortOrder?: SortOrder;
}
