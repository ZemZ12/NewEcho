import firestore from '@react-native-firebase/firestore';

// Highest valid Unicode code point, used as a prefix-range upper bound for
// Firestore "starts with" queries (there's no native startsWith operator).
// Computed via code point rather than a literal character in source — a
// literal high-codepoint character got silently dropped once already when
// written directly into a file.
export const PREFIX_RANGE_END = String.fromCharCode(0xf8ff);

// Firestore has no native startsWith, so a "prefix search" is a range query
// bounded by PREFIX_RANGE_END. Shared by the community and user pickers so
// they can't drift apart on how that range is built.
export function searchByPrefix(collectionPath: string, field: string, query: string, limit: number) {
  return firestore()
    .collection(collectionPath)
    .where(field, '>=', query)
    .where(field, '<=', query + PREFIX_RANGE_END)
    .limit(limit)
    .get();
}
