import { LazyStore } from "@tauri-apps/plugin-store";
import { createSignal } from "solid-js";
import type { AppSettings } from "~/types";
import { DEFAULT_SETTINGS } from "~/types";

export function createSettings() {
  const store = new LazyStore("settings.json");
  const [settings, setSettings] = createSignal<AppSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [isLoaded, setIsLoaded] = createSignal(false);

  async function load(): Promise<void> {
    const saved = await store.get<Partial<AppSettings>>("app_settings");
    setSettings({ ...DEFAULT_SETTINGS, ...saved });
    setIsLoaded(true);
  }

  async function update(partial: Partial<AppSettings>): Promise<void> {
    const updated = { ...settings(), ...partial };
    setSettings(updated);
    await store.set("app_settings", updated);
    await store.save();
  }

  const language = () => settings().language;
  const theme = () => settings().theme;
  const whisperLanguage = () => settings().whisperLanguage;

  return {
    settings,
    isLoaded,
    language,
    theme,
    whisperLanguage,
    load,
    update,
  };
}
