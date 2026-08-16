const TICKER_PATTERN = /\$([A-Z]{1,5})\b/g;

// Returns unique ticker symbols (without the leading $) mentioned in text,
// in first-seen order.
export function extractTickers(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(TICKER_PATTERN)) {
    seen.add(match[1]);
  }
  return [...seen];
}
