import type { DictionaryKey, I18n } from "~/i18n";

const modelIdToKey: Record<string, DictionaryKey> = {
  "large-v3-turbo": "models.whisper.largeV3Turbo.description",
  small: "models.whisper.small.description",
  "gemma-4-e2b": "models.text.gemma4_e2b.description",
  "qwen3.5-4b": "models.text.qwen35_4b.description",
};

export function getModelDescription(
  t: I18n["t"],
  modelId: string,
  fallback: string,
): string {
  const key = modelIdToKey[modelId];
  if (!key) return fallback;
  const value = t(key);
  return value === key ? fallback : value;
}
