// Twelve Data returns "2024-06-01" for daily/weekly candles and
// "2024-06-01 09:30:00" for intraday ones — shorten either to something
// that fits an axis label.
export function formatAxisDate(date: string): string {
  const [datePart, timePart] = date.split(' ');
  if (timePart) return timePart.slice(0, 5);
  const parts = datePart.split('-');
  return parts.length === 3 ? `${parts[1]}/${parts[2]}` : datePart;
}
