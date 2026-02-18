export interface AppSettings {
  language: "ja" | "en";
  outputFormat: "txt" | "srt" | "vtt";
  theme: "light" | "dark" | "system";
}

export const DEFAULT_SETTINGS: AppSettings = {
  language: "ja",
  outputFormat: "txt",
  theme: "system",
};
