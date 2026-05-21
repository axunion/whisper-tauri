export interface NotionSettings {
  enabled: boolean;
  token: string | null;
  databaseId: string | null;
  titleProperty: string | null;
}

export interface NotionMetaField {
  label: string;
  value: string;
}

export interface NotionActionItem {
  what: string;
  due?: string;
}

export interface NotionSummaryLabels {
  tldr: string;
  keyPoints: string;
  actionItems: string;
  keywords: string;
  due: string;
}

export interface NotionSummary {
  headline: string;
  tldr: string;
  keyPoints: string[];
  actionItems: NotionActionItem[];
  keywords: string[];
  labels: NotionSummaryLabels;
}

export interface NotionPagePayload {
  title: string;
  meta: NotionMetaField[];
  summary: NotionSummary | null;
  bodyText: string;
}

export interface NotionPageRef {
  pageId: string;
  url: string;
  partial: boolean;
}

export interface NotionDatabaseInfo {
  id: string;
  title: string;
  titleProperty: string;
}
