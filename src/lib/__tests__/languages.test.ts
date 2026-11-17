import { describe, expect, it } from "vitest";
import { whisperLanguageOptions } from "../languages";

describe("whisperLanguageOptions", () => {
  it("names the languages in the UI locale", () => {
    const ja = whisperLanguageOptions("ja");
    const en = whisperLanguageOptions("en");

    expect(ja.find((o) => o.value === "en")?.label).toBe("英語");
    expect(en.find((o) => o.value === "ja")?.label).toBe("Japanese");
  });

  it("puts the pinned languages first, in a fixed order", () => {
    const pinned = ["ja", "en", "zh", "ko", "fr", "de", "es"];

    for (const locale of ["ja", "en"]) {
      expect(
        whisperLanguageOptions(locale)
          .slice(0, pinned.length)
          .map((o) => o.value),
      ).toEqual(pinned);
    }
  });

  it("sorts the remaining languages by their name", () => {
    const rest = whisperLanguageOptions("en")
      .slice(7)
      .map((o) => o.label);

    expect(rest).toEqual([...rest].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("lists every language once", () => {
    const values = whisperLanguageOptions("en").map((o) => o.value);

    expect(values).toHaveLength(100);
    expect(new Set(values).size).toBe(100);
  });

  it("gives every language a real name rather than its code", () => {
    for (const option of whisperLanguageOptions("en")) {
      expect(option.label).not.toBe(option.value);
    }
  });
});
