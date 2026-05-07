import { invoke } from "@tauri-apps/api/core";
import { createRoot, createSignal } from "solid-js";
import type { NotionDatabaseInfo, NotionSettings } from "~/types";

const DEFAULT_NOTION_SETTINGS: NotionSettings = {
  enabled: false,
  token: null,
  databaseId: null,
  titleProperty: null,
};

const { settings, setSettings, isLoaded, setIsLoaded } = createRoot(() => {
  const [settings, setSettings] = createSignal<NotionSettings>({
    ...DEFAULT_NOTION_SETTINGS,
  });
  const [isLoaded, setIsLoaded] = createSignal(false);
  return { settings, setSettings, isLoaded, setIsLoaded };
});

let loadPromise: Promise<void> | null = null;

async function load(): Promise<void> {
  if (isLoaded()) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const fetched = await invoke<NotionSettings>("notion_get_settings");
    setSettings({ ...DEFAULT_NOTION_SETTINGS, ...fetched });
    setIsLoaded(true);
  })();
  return loadPromise;
}

async function update(partial: Partial<NotionSettings>): Promise<void> {
  const merged: NotionSettings = { ...settings(), ...partial };
  setSettings(merged);
  await invoke("notion_set_settings", { settings: merged });
}

async function testConnection(
  token: string,
  databaseId: string,
): Promise<NotionDatabaseInfo> {
  const info = await invoke<NotionDatabaseInfo>("notion_test_connection", {
    token,
    databaseId,
  });
  setSettings({ ...settings(), titleProperty: info.titleProperty });
  return info;
}

const enabled = () => settings().enabled;
const token = () => settings().token;
const databaseId = () => settings().databaseId;
const titleProperty = () => settings().titleProperty;
const isConfigured = () =>
  settings().enabled &&
  !!settings().token &&
  !!settings().databaseId &&
  !!settings().titleProperty;

const notionSettingsInstance = {
  settings,
  isLoaded,
  enabled,
  token,
  databaseId,
  titleProperty,
  isConfigured,
  load,
  update,
  testConnection,
};

export function createNotionSettings() {
  return notionSettingsInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetNotionSettingsForTesting(
  overrides?: Partial<NotionSettings> & { loaded?: boolean },
): void {
  setSettings({ ...DEFAULT_NOTION_SETTINGS, ...overrides });
  setIsLoaded(overrides?.loaded ?? false);
  loadPromise = null;
}
