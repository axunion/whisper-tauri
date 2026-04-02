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

/** Format ISO date string as localized date+time (e.g. "2024/01/15 14:30"). */
export function formatDate(isoString: string, locale: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Format ISO date string as localized date only (e.g. "2024/01/15"). */
export function formatDateShort(isoString: string, locale: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString(locale === "ja" ? "ja-JP" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}
