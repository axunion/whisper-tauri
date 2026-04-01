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
