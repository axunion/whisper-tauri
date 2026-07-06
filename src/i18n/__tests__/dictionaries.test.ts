import { describe, expect, it } from "vitest";
import { en } from "../dictionaries/en";
import { ja } from "../dictionaries/ja";
import type { Dictionary } from "../types";

function getAllKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      keys.push(...getAllKeys(value as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function assertAllNonEmpty(dict: Dictionary, name: string) {
  const keys = getAllKeys(dict as unknown as Record<string, unknown>);
  for (const key of keys) {
    const parts = key.split(".");
    let current: unknown = dict;
    for (const part of parts) {
      current = (current as Record<string, unknown>)[part];
    }
    expect(current, `${name}.${key} should be a non-empty string`).toBeTruthy();
    expect(typeof current, `${name}.${key} should be a string`).toBe("string");
  }
}

function getValue(dict: Dictionary, key: string): string {
  let current: unknown = dict;
  for (const part of key.split(".")) {
    current = (current as Record<string, unknown>)[part];
  }
  return current as string;
}

function getPlaceholders(value: string): string[] {
  return [...value.matchAll(/\{[a-zA-Z0-9_]+\}/g)].map((m) => m[0]).sort();
}

describe("dictionaries", () => {
  it("ja dictionary has all non-empty string values", () => {
    assertAllNonEmpty(ja, "ja");
  });

  it("en dictionary has all non-empty string values", () => {
    assertAllNonEmpty(en, "en");
  });

  it("ja and en have the same key structure", () => {
    const jaKeys = getAllKeys(ja as unknown as Record<string, unknown>).sort();
    const enKeys = getAllKeys(en as unknown as Record<string, unknown>).sort();
    expect(jaKeys).toEqual(enKeys);
  });

  it("ja and en have matching placeholders for every key", () => {
    const keys = getAllKeys(ja as unknown as Record<string, unknown>);
    for (const key of keys) {
      expect(
        getPlaceholders(getValue(ja, key)),
        `placeholders of "${key}" should match across locales`,
      ).toEqual(getPlaceholders(getValue(en, key)));
    }
  });
});
