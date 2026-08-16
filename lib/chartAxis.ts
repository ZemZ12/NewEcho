// Twelve Data returns "2024-06-01" for daily/weekly candles and
// "2024-06-01 09:30:00" for intraday ones — shorten either to something
// that fits an axis label.
export function formatAxisDate(date: string): string {
  const [datePart, timePart] = date.split(' ');
  if (timePart) return timePart.slice(0, 5);
  const parts = datePart.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : datePart;
}

// Shared by CandlestickChart, LiveCandleLayer, and AnnotatedChart's
// crosshair so a zoomed price axis always agrees with where candles and
// price readouts actually land — these three used to each reimplement this
// independently and drifted out of sync (wrong crosshair/candle prices).
// Marked as a worklet so it can also be called from useDerivedValue on the
// UI thread in LiveCandleLayer.
export function computeEffectiveRange(rawMin: number, rawMax: number, yZoomFactor: number): { min: number; max: number } {
  'worklet';
  const mid = (rawMin + rawMax) / 2;
  const halfRange = (rawMax - rawMin || 1) / 2 / yZoomFactor;
  return { min: mid - halfRange, max: mid + halfRange };
}
