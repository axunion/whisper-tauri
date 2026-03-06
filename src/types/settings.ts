export interface AppSettings {
  language: "ja" | "en";
  outputFormat: "txt" | "srt" | "vtt";
  theme: "light" | "dark" | "system";
  whisperLanguage: string | null;
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "ja",
  outputFormat: "txt",
  theme: "system",
  whisperLanguage: null,
};
