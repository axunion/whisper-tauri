/**
 * Minimal semver-style comparison for release tags like "v0.1.0".
 * Intentionally ignores prerelease precedence (full semver is overkill here):
 * "0.2.0-dev" compares as "0.2.0".
 */
function parseVersion(version: string): [number, number, number] {
  const core = version.trim().replace(/^v/, "").split("-")[0] ?? "";
  const parts = core.split(".");
  const segment = (index: number): number => {
    const n = Number(parts[index]);
    return Number.isFinite(n) ? n : 0;
  };
  return [segment(0), segment(1), segment(2)];
}

/** Returns true only when `latest` is strictly newer than `current`. */
export function isNewerVersion(current: string, latest: string): boolean {
  const c = parseVersion(current);
  const l = parseVersion(latest);
  for (let i = 0; i < 3; i++) {
    if ((l[i] ?? 0) !== (c[i] ?? 0)) {
      return (l[i] ?? 0) > (c[i] ?? 0);
    }
  }
  return false;
}
