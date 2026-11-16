import type { SettingsSection } from "~/types";

export const AUDIO_EXTENSIONS = [
  "wav",
  "mp3",
  "m4a",
  "flac",
  "ogg",
  "aac",
  "wma",
  "opus",
  "mp4",
  "mov",
  "webm",
  "avi",
  "mkv",
];

/** Extract filename from a file path (handles both Unix and Windows separators). */
export function extractFilename(filePath: string): string {
  return filePath.split(/[/\\]/).pop() ?? filePath;
}

/** Id of the history search box, which the search shortcut focuses. */
export const HISTORY_SEARCH_ID = "history-search";

/** Router state that makes the settings page open on `section`. */
export function settingsLink(section: SettingsSection): {
  section: SettingsSection;
} {
  return { section };
}
