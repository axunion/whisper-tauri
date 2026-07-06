/** Format milliseconds as `Xm Ys` (e.g. "2m 34s"). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}m ${String(seconds)}s`;
}

/** Format milliseconds as colon-separated time (e.g. "3:24" or "1:03:24"). */
export function formatDurationColon(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/** Format milliseconds as `Xh Ym` or `Xm` — coarser granularity for aggregate stats. */
export function formatDurationShort(ms: number): string {
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${String(hours)}h ${String(minutes)}m`;
  return `${String(minutes)}m`;
}

function toBcp47(locale: string): string {
  return locale === "ja" ? "ja-JP" : "en-US";
}

/** Format ISO date string as localized date+time (e.g. "2024/01/15 14:30"). */
export function formatDate(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format ISO date string as localized date only (e.g. "2024/01/15"). */
export function formatDateShort(isoString: string, locale: string): string {
  return new Date(isoString).toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

/**
 * Renders a [`StructuredSummary`](../types/text-processing.ts) as Markdown-ish
 * plain text for clipboard copy and (future) Notion block fall-back. Empty
 * sections are skipped so the output never contains lonely headings.
 */
export function formatSummaryAsText(
  summary: import("~/types").StructuredSummary,
): string {
  const blocks: string[] = [];
  if (summary.headline) blocks.push(`# ${summary.headline}`);
  if (summary.tldr.length > 0) {
    blocks.push(`## TL;DR\n${summary.tldr}`);
  }
  if (summary.keyPoints.length > 0) {
    blocks.push(
      `## Key Points\n${summary.keyPoints.map((s) => `- ${s}`).join("\n")}`,
    );
  }
  if (summary.actionItems.length > 0) {
    const lines = summary.actionItems.map((item) =>
      item.due ? `- ${item.what} (due: ${item.due})` : `- ${item.what}`,
    );
    blocks.push(`## Action Items\n${lines.join("\n")}`);
  }
  if (summary.keywords.length > 0) {
    blocks.push(`## Keywords\n${summary.keywords.join(", ")}`);
  }
  return blocks.join("\n\n");
}

/**
 * Renders transcription segments as `[H:MM:SS] text` lines for clipboard copy
 * and Notion send from the timeline tab. Uses the same time formatter as
 * `formatDurationColon` so hours are preserved on long recordings.
 */
export function formatTimeline(
  segments: readonly import("~/types").TranscriptionSegment[],
): string {
  return segments
    .map((seg) => `[${formatDurationColon(seg.start)}] ${seg.text.trim()}`)
    .join("\n");
}

/** Sums `sizeBytes` over downloaded items only. */
export function sumDownloadedBytes<
  T extends { downloaded: boolean; sizeBytes: number },
>(items: readonly T[]): number {
  return items.reduce((sum, m) => (m.downloaded ? sum + m.sizeBytes : sum), 0);
}

const BYTE_UNITS = ["KB", "MB", "GB", "TB"] as const;
const BYTE_UNIT_BASE = 1024;

/**
 * Format a byte count as a human-readable string (e.g. "466 MB", "1.6 GB").
 *
 * Uses 1024-base steps with `KB`/`MB`/`GB`/`TB` labels to match the existing
 * Rust-side size strings shipped in `ModelInfo.size`. Values < 1 KB render as
 * `B`; values >= 100 in the chosen unit drop the decimal.
 */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < BYTE_UNIT_BASE) return `${Math.round(bytes)} B`;

  let value = bytes / BYTE_UNIT_BASE;
  let unitIndex = 0;
  while (value >= BYTE_UNIT_BASE && unitIndex < BYTE_UNITS.length - 1) {
    value /= BYTE_UNIT_BASE;
    unitIndex += 1;
  }
  const formatted =
    value >= 100 ? Math.round(value).toString() : value.toFixed(1);
  return `${formatted} ${BYTE_UNITS[unitIndex]}`;
}
