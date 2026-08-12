import { invoke } from "@tauri-apps/api/core";
import { createRoot, createSignal } from "solid-js";
import { parseError } from "~/lib/errors";
import type { NotionDatabaseInfo, NotionSettings } from "~/types";
import type { AppError } from "~/types/errors";

const DEFAULT_NOTION_SETTINGS: NotionSettings = {
  enabled: false,
  token: null,
  databaseId: null,
  titleProperty: null,
};

const { settings, setSettings, isLoaded, setIsLoaded, error, setError } =
  createRoot(() => {
    const [settings, setSettings] = createSignal<NotionSettings>({
      ...DEFAULT_NOTION_SETTINGS,
    });
    const [isLoaded, setIsLoaded] = createSignal(false);
    const [error, setError] = createSignal<AppError | null>(null);
    return { settings, setSettings, isLoaded, setIsLoaded, error, setError };
  });

let loadPromise: Promise<void> | null = null;

/**
 * Loads the persisted Notion settings once. Failures surface through `error`
 * rather than rejecting: callers fire this without awaiting, and a rejected
 * promise held in `loadPromise` would be handed to every later caller,
 * disabling Notion sharing for the rest of the session.
 */
async function load(): Promise<void> {
  if (isLoaded()) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const fetched = await invoke<NotionSettings>("notion_get_settings");
      setSettings({ ...DEFAULT_NOTION_SETTINGS, ...fetched });
      setIsLoaded(true);
    } catch (e) {
      setError(parseError(e));
    } finally {
      loadPromise = null;
    }
  })();
  return loadPromise;
}

/** Persists a partial update, reporting failure through `error` and the return value. */
async function update(partial: Partial<NotionSettings>): Promise<boolean> {
  const merged: NotionSettings = { ...settings(), ...partial };
  setSettings(merged);
  try {
    await invoke("notion_set_settings", { settings: merged });
    return true;
  } catch (e) {
    setError(parseError(e));
    return false;
  }
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

function clearError(): void {
  setError(null);
}

const notionSettingsInstance = {
  settings,
  isLoaded,
  enabled,
  token,
  databaseId,
  titleProperty,
  isConfigured,
  error,
  load,
  update,
  testConnection,
  clearError,
};

export function createNotionSettings() {
  return notionSettingsInstance;
}
