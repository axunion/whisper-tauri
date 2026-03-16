import type { TranscriptionResult } from "~/types/whisper";

export type ExportFormat = "txt" | "srt" | "vtt";

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

export function toSRT(result: TranscriptionResult): string {
  return result.segments
    .map((seg, i) => {
      const start = formatTimestamp(seg.start, "srt");
      const end = formatTimestamp(seg.end, "srt");
      return `${i + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");
}

export function toVTT(result: TranscriptionResult): string {
  const cues = result.segments
    .map((seg) => {
      const start = formatTimestamp(seg.start, "vtt");
      const end = formatTimestamp(seg.end, "vtt");
      return `${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join("\n");
  return `WEBVTT\n\n${cues}`;
}

export function exportResult(
  result: TranscriptionResult,
  format: ExportFormat,
): string {
  switch (format) {
    case "txt":
      return toTXT(result);
    case "srt":
      return toSRT(result);
    case "vtt":
      return toVTT(result);
  }
}

export function getExtension(format: ExportFormat): string {
  return `.${format}`;
}
