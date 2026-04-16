import { describe, expect, it } from "vitest";
import { createI18n } from "../index";

describe("createI18n", () => {
  it("creates i18n with default locale ja", () => {
    const i18n = createI18n();
    expect(i18n.locale()).toBe("ja");
  });

  it("creates i18n with specified locale", () => {
    const i18n = createI18n("en");
    expect(i18n.locale()).toBe("en");
  });
});

describe("t()", () => {
  it("resolves a simple key", () => {
    const i18n = createI18n("ja");
    expect(i18n.t("common.cancel")).toBe("キャンセル");
  });

  it("resolves a nested key", () => {
    const i18n = createI18n("en");
    expect(i18n.t("settings.title")).toBe("Settings");
  });

  it("returns the key itself for a non-existent key", () => {
    const i18n = createI18n("ja");
    // @ts-expect-error Testing invalid key behavior
    expect(i18n.t("nonexistent.key")).toBe("nonexistent.key");
  });

  it("interpolates parameters", () => {
    const i18n = createI18n("ja");
    const result = i18n.t("history.deleteCount", { count: 5 });
    expect(result).toBe("削除 (5)");
  });

  it("interpolates multiple parameters", () => {
    const i18n = createI18n("en");
    const result = i18n.t("settings.deleteModelConfirmation", {
      name: "large-v3",
    });
    expect(result).toBe(
      "large-v3 will be deleted. This action cannot be undone.",
    );
  });
});

describe("setLocale()", () => {
  it("changes the locale", () => {
    const i18n = createI18n("ja");
    expect(i18n.locale()).toBe("ja");
    i18n.setLocale("en");
    expect(i18n.locale()).toBe("en");
  });

  it("changes the dictionary", () => {
    const i18n = createI18n("ja");
    expect(i18n.t("settings.title")).toBe("設定");
    i18n.setLocale("en");
    expect(i18n.t("settings.title")).toBe("Settings");
  });
});
