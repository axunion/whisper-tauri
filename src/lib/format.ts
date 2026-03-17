/** Format milliseconds as `Xm Ys` (e.g. "2m 34s"). */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes)}m ${String(seconds)}s`;
}
