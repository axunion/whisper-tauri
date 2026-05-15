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
}

/** Sort order for history listing. */
export type HistorySortBy = "date" | "duration" | "fileName";

/** Sort direction. */
export type SortOrder = "asc" | "desc";

/**
 * Filter for listing history entries.
 */
export interface HistoryFilter {
  /** Start date (ISO 8601 date string, e.g. "2026-01-01") */
  dateFrom?: string;
  /** End date (ISO 8601 date string, e.g. "2026-12-31") */
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
  optionsJson?: string | undefined;
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
  optionsJson?: string | undefined;
  /** ID of the text model used for generation */
  textModelId: string;
}

/**
 * Parameters for full-text search of history entries.
 */
export interface HistorySearchParams {
  /** Search query (space-separated keywords for AND search) */
  query: string;
  /** Optional start date filter (ISO 8601 date string) */
  dateFrom?: string;
  /** Optional end date filter (ISO 8601 date string) */
  dateTo?: string;
  /** Maximum number of entries to return */
  limit?: number;
  /** Sort by field */
  sortBy?: HistorySortBy;
  /** Sort direction */
  sortOrder?: SortOrder;
}
