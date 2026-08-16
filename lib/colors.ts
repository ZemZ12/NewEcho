// Single source of truth for the raw hex values components need outside
// NativeWind classNames (Ionicons' `color` prop, LinearGradient's `colors`
// array, `placeholderTextColor`, etc., none of which accept Tailwind
// classes). Must stay in sync with the `accent`/`surface` palette in
// tailwind.config.js — that file can't import this one (it runs outside the
// TS/Metro pipeline), so keep both in sync by hand.
export const ACCENT = '#6366f1'; // indigo-500
export const ACCENT_LIGHT = '#818cf8';
export const ACCENT_DARK = '#4f46e5';
export const MUTED_LIGHT = '#a1a1aa'; // zinc-400
export const MUTED_DARK = '#71717a'; // zinc-500
export const DANGER = '#ef4444';
