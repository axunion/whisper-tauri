import type {
  NotionActionItem_Serialize,
  NotionPagePayload_Serialize,
  NotionPageRef_Serialize,
  NotionSettings_Serialize,
  NotionSummary_Serialize,
} from "~/bindings";

export type {
  NotionDatabaseInfo,
  NotionMetaField,
  NotionSummaryLabels,
} from "~/bindings";

export type NotionActionItem = NotionActionItem_Serialize;
export type NotionPagePayload = NotionPagePayload_Serialize;
export type NotionPageRef = NotionPageRef_Serialize;
export type NotionSettings = NotionSettings_Serialize;
export type NotionSummary = NotionSummary_Serialize;
