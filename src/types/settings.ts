export interface AppSettings {
  language: "ja" | "en";
  theme: "light" | "dark" | "system";
  whisperLanguage: string | null;
  onboardingCompleted: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "ja",
  theme: "system",
  whisperLanguage: null,
  onboardingCompleted: false,
};
