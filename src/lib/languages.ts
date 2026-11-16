/**
 * Language codes the Whisper models accept (whisper.cpp's language table).
 */
const WHISPER_LANGUAGES = [
  "en",
  "zh",
  "de",
  "es",
  "ru",
  "ko",
  "fr",
  "ja",
  "pt",
  "tr",
  "pl",
  "ca",
  "nl",
  "ar",
  "sv",
  "it",
  "id",
  "hi",
  "fi",
  "vi",
  "he",
  "uk",
  "el",
  "ms",
  "cs",
  "ro",
  "da",
  "hu",
  "ta",
  "no",
  "th",
  "ur",
  "hr",
  "bg",
  "lt",
  "la",
  "mi",
  "ml",
  "cy",
  "sk",
  "te",
  "fa",
  "lv",
  "bn",
  "sr",
  "az",
  "sl",
  "kn",
  "et",
  "mk",
  "br",
  "eu",
  "is",
  "hy",
  "ne",
  "mn",
  "bs",
  "kk",
  "sq",
  "sw",
  "gl",
  "mr",
  "pa",
  "si",
  "km",
  "sn",
  "yo",
  "so",
  "af",
  "oc",
  "ka",
  "be",
  "tg",
  "sd",
  "gu",
  "am",
  "yi",
  "lo",
  "uz",
  "fo",
  "ht",
  "ps",
  "tk",
  "nn",
  "mt",
  "sa",
  "lb",
  "my",
  "bo",
  "tl",
  "mg",
  "as",
  "tt",
  "haw",
  "ln",
  "ha",
  "ba",
  "jw",
  "su",
  "yue",
];

/** Shown first, in this order: the languages most users of this app pick. */
const PINNED = ["ja", "en", "zh", "ko", "fr", "de", "es"];

/** Whisper's code that differs from the one `Intl` knows the language by. */
const INTL_CODE: Record<string, string> = { jw: "jv" };

export interface LanguageOption {
  /** Whisper language code */
  value: string;
  /** Language name in the UI locale */
  label: string;
}

/**
 * Whisper's languages named in `locale`: the pinned ones first, the rest
 * sorted by name. Names come from `Intl.DisplayNames`, so no dictionary has
 * to carry a hundred language names per UI locale.
 */
export function whisperLanguageOptions(locale: string): LanguageOption[] {
  const names = new Intl.DisplayNames([locale], { type: "language" });
  const option = (code: string): LanguageOption => ({
    value: code,
    label: names.of(INTL_CODE[code] ?? code) ?? code,
  });

  const rest = WHISPER_LANGUAGES.filter((code) => !PINNED.includes(code))
    .map(option)
    .sort((a, b) => a.label.localeCompare(b.label, locale));
  return [...PINNED.map(option), ...rest];
}
