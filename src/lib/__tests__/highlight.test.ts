import { describe, expect, it } from "vitest";
import { splitHighlights } from "../highlight";

describe("splitHighlights", () => {
  it("returns the whole text unmatched when there are no keywords", () => {
    expect(splitHighlights("会議の議事録", [])).toEqual([
      { text: "会議の議事録", match: false },
    ]);
  });

  it("marks every occurrence of every keyword", () => {
    expect(splitHighlights("会議の議事録と会議室", ["会議", "議事録"])).toEqual(
      [
        { text: "会議", match: true },
        { text: "の", match: false },
        { text: "議事録", match: true },
        { text: "と", match: false },
        { text: "会議", match: true },
        { text: "室", match: false },
      ],
    );
  });

  it("matches case-insensitively and keeps the original casing", () => {
    expect(splitHighlights("The Budget review", ["budget"])).toEqual([
      { text: "The ", match: false },
      { text: "Budget", match: true },
      { text: " review", match: false },
    ]);
  });

  it("treats regex metacharacters in keywords literally", () => {
    expect(splitHighlights("a.b axb (c)", [".", "(c)"])).toEqual([
      { text: "a", match: false },
      { text: ".", match: true },
      { text: "b axb ", match: false },
      { text: "(c)", match: true },
    ]);
  });

  it("treats a backslash in a keyword literally", () => {
    expect(splitHighlights("C:\\temp", ["\\"])).toEqual([
      { text: "C:", match: false },
      { text: "\\", match: true },
      { text: "temp", match: false },
    ]);
  });

  it("gives the same result for duplicate keywords", () => {
    expect(splitHighlights("会議と会議", ["会議", "会議"])).toEqual(
      splitHighlights("会議と会議", ["会議"]),
    );
  });

  it("keeps every character of the text when keywords overlap", () => {
    const parts = splitHighlights("会議の議事録", ["議", "議事録"]);
    expect(parts.map((part) => part.text).join("")).toBe("会議の議事録");
    expect(parts.filter((part) => part.match).length).toBeGreaterThan(0);
  });

  it("prefers the longest keyword when keywords overlap", () => {
    expect(splitHighlights("会議の議事録", ["議", "議事録"])).toEqual([
      { text: "会", match: false },
      { text: "議", match: true },
      { text: "の", match: false },
      { text: "議事録", match: true },
    ]);
  });
});
