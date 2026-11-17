import type {
  AiContent_Serialize,
  AiContentSaveParams_Serialize,
  HistoryEntry_Serialize,
  HistoryFilter_Serialize,
  HistoryMeta_Serialize,
  HistorySaveParams_Serialize,
  HistorySearchParams_Serialize,
} from "~/bindings";

export type {
  HistorySegment,
  HistorySortBy,
  HistorySource,
  SegmentUpdate,
  SortOrder,
  StorageStats,
} from "~/bindings";

export type AiContentSaveParams = AiContentSaveParams_Serialize;
export type HistoryEntry = HistoryEntry_Serialize;
export type HistoryFilter = HistoryFilter_Serialize;
export type HistoryMeta = HistoryMeta_Serialize;
export type HistorySaveParams = HistorySaveParams_Serialize;
export type HistorySearchParams = HistorySearchParams_Serialize;

/**
 * Valid content types for AI-generated content.
 */
export type AiContentType = "summary" | "cleanText" | "title";

/**
 * AI-generated content associated with a history entry. The backend stores
 * the content type as free text; the frontend only ever writes these three.
 */
export type AiContent = Omit<AiContent_Serialize, "contentType"> & {
  contentType: AiContentType;
};
