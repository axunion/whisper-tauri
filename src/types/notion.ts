export interface NotionSettings {
  enabled: boolean;
  token: string | null;
  databaseId: string | null;
  titleProperty: string | null;
}

export interface NotionPagePayload {
  title: string;
  bodyText: string;
}

export interface NotionPageRef {
  pageId: string;
  url: string;
}

export interface NotionDatabaseInfo {
  id: string;
  title: string;
  titleProperty: string;
}
