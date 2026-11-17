export interface HighlightPart {
  text: string;
  match: boolean;
}

/**
 * Splits `text` into runs that do and do not match any of `keywords`
 * (case-insensitive), in order, so a view can mark the matching runs.
 */
export function splitHighlights(
  text: string,
  keywords: string[],
): HighlightPart[] {
  // Longest first: alternation takes the first alternative that matches, so
  // "議" listed before "議事録" would otherwise mark only the first character.
  const escaped = keywords
    .filter((k) => k.length > 0)
    .sort((a, b) => b.length - a.length)
    .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  if (escaped.length === 0) return [{ text, match: false }];

  // A capturing split puts the matches at the odd indices.
  return text
    .split(new RegExp(`(${escaped.join("|")})`, "gi"))
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((part) => part.text.length > 0);
}
