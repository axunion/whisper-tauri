import {
  type Accessor,
  createContext,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  useContext,
} from "solid-js";
import { en } from "./dictionaries/en";
import { ja } from "./dictionaries/ja";
import type { Dictionary, DictionaryKey, Locale } from "./types";

export type { Dictionary, DictionaryKey, Locale } from "./types";

const dictionaries: Record<Locale, Dictionary> = { ja, en };

function resolve(dict: Dictionary, key: string): string {
  const parts = key.split(".");
  let current: unknown = dict;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return key;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : key;
}

export interface I18n {
  locale: Accessor<Locale>;
  setLocale: (locale: Locale) => void;
  t: (key: DictionaryKey, params?: Record<string, string | number>) => string;
  dict: Accessor<Dictionary>;
}

export function createI18n(initialLocale: Locale = "ja"): I18n {
  const [locale, setLocale] = createSignal<Locale>(initialLocale);
  const dict = createMemo(() => dictionaries[locale()]);

  function t(
    key: DictionaryKey,
    params?: Record<string, string | number>,
  ): string {
    let value = resolve(dict(), key);
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        value = value.replace(`{${k}}`, String(v));
      }
    }
    return value;
  }

  return { locale, setLocale, t, dict };
}

const I18nContext = createContext<I18n>();

export function I18nProvider(props: { locale: Locale; children: JSX.Element }) {
  const i18n = createI18n(props.locale);

  // Sync only when the parent prop changes (e.g. after settings.load()),
  // not when i18n.locale() changes (e.g. from Settings page setLocale).
  // defer: true skips the initial run since createI18n already handles it.
  createEffect(
    on(
      () => props.locale,
      (l) => i18n.setLocale(l),
      { defer: true },
    ),
  );

  return (
    <I18nContext.Provider value={i18n}>{props.children}</I18nContext.Provider>
  );
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error("useI18n must be used within an I18nProvider");
  }
  return ctx;
}
