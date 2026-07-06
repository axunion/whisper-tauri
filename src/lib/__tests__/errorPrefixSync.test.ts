import { describe, expect, it } from "vitest";
import { PREFIX_MAP } from "../errors";

// Guards the sync contract in .claude/rules/error-handling.md: every Rust
// error prefix must have a PREFIX_MAP entry, and every PREFIX_MAP entry must
// correspond to a real Rust error message.

const rustSources = import.meta.glob("/src-tauri/src/**/*.rs", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

// DownloadError variants are always wrapped into module errors
// ("Download failed: {0}") before crossing the IPC boundary, so this raw
// message never reaches the frontend.
const NEVER_REACHES_FRONTEND = new Set(["HTTP {0} for {1}"]);

function collectRustErrorMessages(): string[] {
  const messages: string[] = [];
  for (const source of Object.values(rustSources)) {
    for (const match of source.matchAll(/#\[error\("([^"]+)"\)\]/g)) {
      messages.push(match[1] ?? "");
    }
  }
  return messages.filter(Boolean);
}

// "Notion API error ({status}): {message}" -> "Notion API error (x): x"
function renderSample(message: string): string {
  return message.replace(/\{[^}]*\}/g, "x");
}

describe("Rust error prefix / PREFIX_MAP sync", () => {
  const messages = collectRustErrorMessages();

  it("finds error messages in the Rust sources", () => {
    expect(messages.length).toBeGreaterThan(30);
  });

  it("maps every frontend-reachable Rust error message in PREFIX_MAP", () => {
    const unmapped = messages
      .filter((message) => !NEVER_REACHES_FRONTEND.has(message))
      .filter(
        (message) =>
          !PREFIX_MAP.some(([prefix]) =>
            renderSample(message).startsWith(prefix),
          ),
      );
    expect(
      unmapped,
      "Rust error messages without a PREFIX_MAP entry (falls back to UNKNOWN_ERROR); see .claude/rules/error-handling.md",
    ).toEqual([]);
  });

  it("has no PREFIX_MAP entry without a matching Rust error message", () => {
    const samples = messages.map(renderSample);
    const dead = PREFIX_MAP.map(([prefix]) => prefix).filter(
      (prefix) => !samples.some((sample) => sample.startsWith(prefix)),
    );
    expect(
      dead,
      "PREFIX_MAP entries with no corresponding Rust #[error] message",
    ).toEqual([]);
  });
});
