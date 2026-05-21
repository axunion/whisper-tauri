import { describe, expect, it } from "vitest";
import type { StructuredSummary, TranscriptionSegment } from "~/types";
import { formatBytes, formatSummaryAsText, formatTimeline } from "../format";

describe("formatBytes", () => {
  it("returns 0 B for zero", () => {
    expect(formatBytes(0)).toBe("0 B");
  });

  it("returns 0 B for negative or non-finite values", () => {
    expect(formatBytes(-1)).toBe("0 B");
    expect(formatBytes(Number.NaN)).toBe("0 B");
    expect(formatBytes(Number.POSITIVE_INFINITY)).toBe("0 B");
  });

  it("formats bytes under 1 KB as B", () => {
    expect(formatBytes(1)).toBe("1 B");
    expect(formatBytes(1023)).toBe("1023 B");
  });

  it("formats KB with one decimal", () => {
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
  });

  it("formats MB with one decimal under 100 MB", () => {
    // 5 MiB
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("drops the decimal when the value reaches 100 in the chosen unit", () => {
    // 466 MiB (small model)
    expect(formatBytes(488_636_416)).toBe("466 MB");
  });

  it("formats GB with one decimal", () => {
    // 1.6 GiB (large-v3-turbo model)
    expect(formatBytes(1_739_587_584)).toBe("1.6 GB");
  });

  it("steps into TB for very large values", () => {
    expect(formatBytes(2 * 1024 ** 4)).toBe("2.0 TB");
  });
});

describe("formatSummaryAsText", () => {
  const fullSummary: StructuredSummary = {
    headline: "Weekly sync",
    tldr: "Discussed backend progress and frontend review timing.",
    keywords: ["backend", "frontend"],
    actionItems: [
      { what: "Finalize design", due: "Friday" },
      { what: "Send notes" },
    ],
    keyPoints: ["API completed"],
  };

  it("includes all populated sections in order", () => {
    const out = formatSummaryAsText(fullSummary);
    expect(out).toContain("# Weekly sync");
    expect(out).toContain(
      "## TL;DR\nDiscussed backend progress and frontend review timing.",
    );
    expect(out.indexOf("## TL;DR")).toBeLessThan(out.indexOf("## Key Points"));
    expect(out.indexOf("## Key Points")).toBeLessThan(
      out.indexOf("## Action Items"),
    );
    expect(out.indexOf("## Action Items")).toBeLessThan(
      out.indexOf("## Keywords"),
    );
    expect(out).toContain("- Finalize design (due: Friday)");
    expect(out).toContain("- Send notes");
    expect(out).toContain("backend, frontend");
  });

  it("omits sections backed by empty content", () => {
    const out = formatSummaryAsText({
      headline: "",
      tldr: "",
      keywords: [],
      actionItems: [],
      keyPoints: ["only this"],
    });
    expect(out).toBe("## Key Points\n- only this");
  });

  it("returns empty string when nothing is populated", () => {
    expect(
      formatSummaryAsText({
        headline: "",
        tldr: "",
        keywords: [],
        actionItems: [],
        keyPoints: [],
      }),
    ).toBe("");
  });
});

describe("formatTimeline", () => {
  function seg(start: number, text: string): TranscriptionSegment {
    return { start, end: start + 1000, text };
  }

  it("returns empty string for empty segments", () => {
    expect(formatTimeline([])).toBe("");
  });

  it("formats short-form MM:SS for segments under one hour", () => {
    const out = formatTimeline([seg(0, "hello"), seg(5_000, "world")]);
    expect(out).toBe("[0:00] hello\n[0:05] world");
  });

  it("includes hours when the start time crosses one hour", () => {
    const out = formatTimeline([seg(3_725_000, "hour two")]);
    expect(out).toBe("[1:02:05] hour two");
  });

  it("trims whitespace from segment text", () => {
    const out = formatTimeline([seg(0, "  padded  ")]);
    expect(out).toBe("[0:00] padded");
  });
});
