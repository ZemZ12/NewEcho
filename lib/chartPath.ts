// Builds an SVG path `d` string from a series that may contain `null` gaps
// (not enough history yet for that point) — each gap starts a fresh "M"
// move instead of drawing a line straight across it.
export function buildLinePath(values: (number | null)[], toX: (index: number) => number, toY: (value: number) => number): string {
  let d = '';
  let drawing = false;
  values.forEach((value, index) => {
    if (value === null) {
      drawing = false;
      return;
    }
    const x = toX(index);
    const y = toY(value);
    d += `${drawing ? ' L' : `${d ? ' ' : ''}M`}${x.toFixed(1)},${y.toFixed(1)}`;
    drawing = true;
  });
  return d;
}
