import { AUDIO_EXTENSIONS } from "~/lib/constants";
import { formatDurationColon } from "~/lib/format";
import type { TranscriptionResult } from "~/types/whisper";

export type ExportFormat = "txt" | "md" | "srt" | "vtt" | "json";

export function formatTimestamp(ms: number, format: "srt" | "vtt"): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = ms % 1000;

  const sep = format === "srt" ? "," : ".";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}${sep}${String(milliseconds).padStart(3, "0")}`;
}

export function toTXT(result: TranscriptionResult): string {
  return result.text;
}

function formatCues(
  segments: TranscriptionResult["segments"],
  format: "srt" | "vtt",
): string {
  return segments
    .map((seg, i) => {
      const start = formatTimestamp(seg.start, format);
      const end = formatTimestamp(seg.end, format);
      const prefix = format === "srt" ? `${i + 1}\n` : "";
      return `${prefix}${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

export function toSRT(result: TranscriptionResult): string {
  return formatCues(result.segments, "srt");
}

export function toVTT(result: TranscriptionResult): string {
  return `WEBVTT\n\n${formatCues(result.segments, "vtt")}`;
}

/** Markdown with the title as a heading and one timestamped line per segment. */
export function toMarkdown(result: TranscriptionResult, title: string): string {
  const lines = result.segments.map(
    (seg) => `**[${formatDurationColon(seg.start)}]** ${seg.text.trim()}`,
  );
  // On one line: a title can carry a line break, which would end the heading.
  const heading = title.replace(/\s+/g, " ").trim();
  return `# ${heading}\n\n${lines.join("\n\n")}\n`;
}

/** The transcription as data, for other tools to read. */
export function toJSON(result: TranscriptionResult, title: string): string {
  return `${JSON.stringify(
    {
      title,
      language: result.language,
      durationMs: result.duration,
      text: result.text,
      segments: result.segments.map((seg) => ({
        startMs: seg.start,
        endMs: seg.end,
        text: seg.text.trim(),
      })),
    },
    null,
    2,
  )}\n`;
}

export function exportResult(
  result: TranscriptionResult,
  format: ExportFormat,
  title: string,
): string {
  switch (format) {
    case "txt":
      return toTXT(result);
    case "md":
      return toMarkdown(result, title);
    case "srt":
      return toSRT(result);
    case "vtt":
      return toVTT(result);
    case "json":
      return toJSON(result, title);
  }
}

export function getExtension(format: ExportFormat): string {
  return `.${format}`;
}

/**
 * Turns an entry title into a file name stem for the save dialog: `:` (as in
 * the time of a dated recording name) becomes `-`, other characters a file
 * system rejects become `_`, and a trailing audio extension is dropped so
 * "meeting.mp3" is offered as "meeting.txt", not "meeting.mp3.txt". A stem
 * that would start with a dot — a hidden file — falls back to a fixed name.
 */
export function toFileStem(title: string): string {
  let stem = title
    .replace(/:/g, "-")
    // biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what must be removed from a file name
    .replace(/[\u0000-\u001f/\\*?"<>|]/g, "_")
    .trim();
  const dot = stem.lastIndexOf(".");
  if (dot > 0 && AUDIO_EXTENSIONS.includes(stem.slice(dot + 1).toLowerCase())) {
    stem = stem.slice(0, dot).trim();
  }
  return stem && !stem.startsWith(".") ? stem : "transcription";
}
