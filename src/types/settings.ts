export interface AppSettings {
  language: "ja" | "en";
  theme: "light" | "dark" | "system";
  whisperLanguage: string | null;
  whisperModelId: string | null;
  textModelId: string | null;
  onboardingCompleted: boolean;
  vadEnabled: boolean;
  notifyOnComplete: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "ja",
  theme: "system",
  whisperLanguage: null,
  whisperModelId: null,
  textModelId: null,
  onboardingCompleted: false,
  vadEnabled: true,
  notifyOnComplete: true,
};

/** Sections of the settings page a link can land on, by element id. */
export type SettingsSection =
  | "settings-models"
  | "settings-ai"
  | "settings-ffmpeg"
  | "settings-notion";
