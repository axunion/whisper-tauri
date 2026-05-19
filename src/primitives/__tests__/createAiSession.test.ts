import { describe, expect, it } from "vitest";
import { parseSummaryContent } from "../createAiSession";

describe("parseSummaryContent", () => {
  it("parses a fully-populated JSON summary", () => {
    const json = JSON.stringify({
      headline: "Headline",
      tldr: "Single sentence recap.",
      keywords: ["k1"],
      actionItems: [{ what: "Do thing", due: "Friday" }],
      keyPoints: ["point"],
    });
    const parsed = parseSummaryContent(json);
    expect(parsed.headline).toBe("Headline");
    expect(parsed.tldr).toBe("Single sentence recap.");
    expect(parsed.actionItems[0]).toEqual({
      what: "Do thing",
      due: "Friday",
    });
  });

  it("fills missing fields with safe defaults", () => {
    const json = JSON.stringify({ headline: "Only headline" });
    const parsed = parseSummaryContent(json);
    expect(parsed.headline).toBe("Only headline");
    expect(parsed.tldr).toBe("");
    expect(parsed.keywords).toEqual([]);
    expect(parsed.actionItems).toEqual([]);
    expect(parsed.keyPoints).toEqual([]);
  });

  it("tolerates legacy entries where tldr was an array", () => {
    const json = JSON.stringify({ tldr: ["one", "two"] });
    const parsed = parseSummaryContent(json);
    expect(parsed.tldr).toBe("one two");
  });

  it("falls back to plain-text TL;DR when JSON parsing fails", () => {
    const parsed = parseSummaryContent("legacy plain-text summary");
    expect(parsed.headline).toBe("");
    expect(parsed.tldr).toBe("legacy plain-text summary");
    expect(parsed.keywords).toEqual([]);
    expect(parsed.actionItems).toEqual([]);
    expect(parsed.keyPoints).toEqual([]);
  });

  it("falls back when the JSON value is not an object", () => {
    const parsed = parseSummaryContent(JSON.stringify(["not", "an", "object"]));
    expect(parsed.tldr).toBe(`["not","an","object"]`);
  });

  it("returns empty fields when input is empty", () => {
    const parsed = parseSummaryContent("");
    expect(parsed.headline).toBe("");
    expect(parsed.tldr).toBe("");
  });
});
