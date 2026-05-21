import { describe, expect, it } from "vitest";
import type { DictionaryKey } from "~/i18n";
import {
  buildNotionPagePayload,
  type NotionMetaContext,
  summaryToNotionPayload,
} from "../notion";

// Identity translator: returns the key itself so tests can assert label
// placement without depending on the dictionary content. Casts via unknown
// because vitest passes through the actual i18n key type.
const tIdentity = (key: DictionaryKey) => key as unknown as string;

const expectedLabels = {
  tldr: "textProcessing.summaryTldr",
  keyPoints: "textProcessing.summaryKeyPoints",
  actionItems: "textProcessing.summaryActionItems",
  keywords: "textProcessing.summaryKeywords",
  due: "textProcessing.summaryActionDue",
};

describe("summaryToNotionPayload", () => {
  it("returns null for null input", () => {
    expect(summaryToNotionPayload(null, tIdentity)).toBeNull();
  });

  it("returns null when every section is empty", () => {
    expect(
      summaryToNotionPayload(
        {
          headline: "   ",
          tldr: "   ",
          keyPoints: [],
          actionItems: [],
          keywords: [],
        },
        tIdentity,
      ),
    ).toBeNull();
  });

  it("preserves trimmed headline alongside trimmed tldr", () => {
    const out = summaryToNotionPayload(
      {
        headline: "  The Headline  ",
        tldr: "  lead.  ",
        keyPoints: ["point a"],
        actionItems: [],
        keywords: [],
      },
      tIdentity,
    );
    expect(out).toEqual({
      headline: "The Headline",
      tldr: "lead.",
      keyPoints: ["point a"],
      actionItems: [],
      keywords: [],
      labels: expectedLabels,
    });
  });

  it("preserves action items with and without due dates", () => {
    const out = summaryToNotionPayload(
      {
        headline: "x",
        tldr: "lead",
        keyPoints: [],
        actionItems: [
          { what: "do x", due: "2026-06-01" },
          { what: "follow up" },
        ],
        keywords: [],
      },
      tIdentity,
    );
    expect(out?.actionItems).toEqual([
      { what: "do x", due: "2026-06-01" },
      { what: "follow up" },
    ]);
  });
});

describe("buildNotionPagePayload", () => {
  function base(
    overrides: Partial<Parameters<typeof buildNotionPagePayload>[0]> = {},
  ) {
    return buildNotionPagePayload({
      title: "My Page",
      body: "body content",
      meta: {} as NotionMetaContext,
      summary: null,
      t: tIdentity,
      locale: "en",
      ...overrides,
    });
  }

  it("falls back to the localized untitled label when title is blank", () => {
    expect(base({ title: "   " }).title).toBe("notionShare.titleUntitled");
  });

  it("emits no meta fields when every metaContext field is undefined", () => {
    expect(base().meta).toEqual([]);
  });

  it("emits labeled fields only for defined meta entries", () => {
    const payload = base({
      meta: {
        createdAt: "2026-05-21T10:00:00Z",
        modelId: "large-v3-turbo",
        duration: 65_000,
        fileName: "memo.wav",
        vadEnabled: true,
      },
    });
    const labels = payload.meta.map((f) => f.label);
    expect(labels).toEqual([
      "notionShare.metaCreatedAt",
      "notionShare.metaFileName",
      "notionShare.metaModel",
      "notionShare.metaAudioLength",
      "notionShare.metaVadEnabled",
    ]);
    expect(
      payload.meta.find((f) => f.label === "notionShare.metaModel")?.value,
    ).toBe("large-v3-turbo");
  });

  it("renders VAD off as the OFF label when vadEnabled is false", () => {
    const payload = base({ meta: { vadEnabled: false } });
    expect(payload.meta).toEqual([
      { label: "notionShare.metaVadEnabled", value: "notionShare.metaVadOff" },
    ]);
  });

  it("skips VAD entirely when vadEnabled is null", () => {
    const payload = base({ meta: { vadEnabled: null } });
    expect(payload.meta).toEqual([]);
  });

  it("skips duration and processingMs when zero or negative", () => {
    const payload = base({
      meta: { duration: 0, processingMs: 0 },
    });
    expect(payload.meta).toEqual([]);
  });

  it("includes processingMs when positive", () => {
    const payload = base({ meta: { processingMs: 42_000 } });
    expect(payload.meta[0]?.label).toBe("notionShare.metaProcessingTime");
  });

  it("passes through bodyText verbatim", () => {
    expect(base({ body: "line1\n\nline2" }).bodyText).toBe("line1\n\nline2");
  });

  it("converts a populated summary to a Notion summary payload", () => {
    const payload = base({
      summary: {
        headline: "h",
        tldr: "lead",
        keyPoints: ["k1"],
        actionItems: [{ what: "do" }],
        keywords: ["a", "b"],
      },
    });
    expect(payload.summary).toEqual({
      headline: "h",
      tldr: "lead",
      keyPoints: ["k1"],
      actionItems: [{ what: "do" }],
      keywords: ["a", "b"],
      labels: expectedLabels,
    });
  });

  it("yields a null summary when the structured summary is fully empty", () => {
    const payload = base({
      summary: {
        headline: "",
        tldr: "",
        keyPoints: [],
        actionItems: [],
        keywords: [],
      },
    });
    expect(payload.summary).toBeNull();
  });

  it("emits a summary with only headline when other sections are empty", () => {
    const payload = base({
      summary: {
        headline: "h",
        tldr: "",
        keyPoints: [],
        actionItems: [],
        keywords: [],
      },
    });
    expect(payload.summary?.headline).toBe("h");
    expect(payload.summary?.tldr).toBe("");
  });
});
