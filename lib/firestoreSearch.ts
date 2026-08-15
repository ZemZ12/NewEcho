// Highest valid Unicode code point, used as a prefix-range upper bound for
// Firestore "starts with" queries (there's no native startsWith operator).
// Computed via code point rather than a literal character in source — a
// literal high-codepoint character got silently dropped once already when
// written directly into a file.
export const PREFIX_RANGE_END = String.fromCharCode(0xf8ff);
