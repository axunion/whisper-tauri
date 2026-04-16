import { LazyStore } from "@tauri-apps/plugin-store";
import { createRoot, createSignal } from "solid-js";
import type { AppSettings } from "~/types";
import { DEFAULT_SETTINGS } from "~/types";

// Module-level singleton state — all consumers share the same signals and store.
const store = new LazyStore("settings.json");
const { settings, setSettings, isLoaded, setIsLoaded } = createRoot(() => {
  const [settings, setSettings] = createSignal<AppSettings>({
    ...DEFAULT_SETTINGS,
  });
  const [isLoaded, setIsLoaded] = createSignal(false);
  return { settings, setSettings, isLoaded, setIsLoaded };
});

let loadPromise: Promise<void> | null = null;

async function load(): Promise<void> {
  if (isLoaded()) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    const saved = await store.get<Partial<AppSettings>>("app_settings");
    setSettings({ ...DEFAULT_SETTINGS, ...saved });
    setIsLoaded(true);
  })();
  return loadPromise;
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
const whisperModelId = () => settings().whisperModelId;
const textModelId = () => settings().textModelId;
const onboardingCompleted = () => settings().onboardingCompleted;
const vadEnabled = () => settings().vadEnabled;

async function completeOnboarding(): Promise<void> {
  await update({ onboardingCompleted: true });
}

const settingsInstance = {
  settings,
  isLoaded,
  language,
  theme,
  whisperLanguage,
  whisperModelId,
  textModelId,
  onboardingCompleted,
  vadEnabled,
  load,
  update,
  completeOnboarding,
};

export function createSettings() {
  return settingsInstance;
}

/** @internal Reset singleton state for testing only. */
export function _resetSettingsForTesting(
  overrides?: Partial<AppSettings> & { loaded?: boolean },
): void {
  setSettings({ ...DEFAULT_SETTINGS, ...overrides });
  setIsLoaded(overrides?.loaded ?? false);
  loadPromise = null;
}
