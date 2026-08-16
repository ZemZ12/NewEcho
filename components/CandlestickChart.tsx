import { Fragment, memo } from 'react';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { formatAxisDate } from '@/lib/chartAxis';
import { buildLinePath } from '@/lib/chartPath';
import type { StockCandle } from '@/lib/marketData';

export type SmaLine = { color: string; values: (number | null)[] };

// A trading-terminal look (TradingView-style) regardless of the app's own
// light/dark theme setting — a price chart reads better on a fixed dark
// canvas with a real axis than trying to adapt gridline contrast to both
// themes.
export const CHART_BG = '#0a0a0a';
const GRID_COLOR = '#27272a';
const AXIS_TEXT_COLOR = '#71717a';
export const PRICE_AXIS_WIDTH = 46;
export const DATE_AXIS_HEIGHT = 16;
// Empty candle-widths reserved at the right edge of whatever's currently
// visible, so the latest candle isn't flush against the axis.
export const RIGHT_PADDING_CANDLES = 3;
const PRICE_GRIDLINES = 4;
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';

// One <Path> per wick color and one per body color instead of a <Line> +
// <Rect> per candle — with 100+ candles that's ~4 SVG elements instead of
// 200+, which is what actually made pinch/pan choppy (every gesture-driven
// re-render was reconciling and re-issuing hundreds of native draw calls).
function buildWickPath(points: { x: number; yHigh: number; yLow: number }[]): string {
  return points.map(({ x, yHigh, yLow }) => `M${x.toFixed(1)},${yHigh.toFixed(1)} L${x.toFixed(1)},${yLow.toFixed(1)}`).join(' ');
}

function buildBodyPath(bodies: { x: number; top: number; height: number; width: number }[]): string {
  return bodies
    .map(({ x, top, height, width }) => {
      const left = (x - width / 2).toFixed(1);
      const right = (x + width / 2).toFixed(1);
      const bottom = (top + height).toFixed(1);
      const topStr = top.toFixed(1);
      return `M${left},${topStr} L${right},${topStr} L${right},${bottom} L${left},${bottom} Z`;
    })
    .join(' ');
}

export const CandlestickChart = memo(function CandlestickChart({
  candles,
  smaLines,
  width = 320,
  height = 160,
  hideCandles = false,
  lastPrice,
  yZoomFactor = 1,
  priceRange,
}: {
  candles: StockCandle[];
  smaLines?: SmaLine[];
  width?: number;
  height?: number;
  // Set by AnnotatedChart when it's overlaying LiveCandleLayer on top —
  // this component still owns the background/gridlines/axis labels, but
  // the actual candle/SMA drawing comes from the worklet-driven layer
  // instead, so it isn't duplicated.
  hideCandles?: boolean;
  // The live quote price, highlighted with a dashed line + axis label —
  // only drawn while it actually falls within the currently visible price
  // range, so it doesn't float off-screen while scrolled through history.
  lastPrice?: { value: number; up: boolean };
  // >1 narrows the auto-fit price range (candles grow taller), <1 widens
  // it (candles shrink) — set from dragging the price axis in AnnotatedChart.
  yZoomFactor?: number;
  // When AnnotatedChart is driving a separate live candle layer, it passes
  // its own already-computed (SMA-inclusive) range here so the axis stays
  // in sync with where the candles actually get drawn — computing it again
  // independently here (without the smaLines this component isn't even
  // rendering in that mode) was drifting out of sync with the real range.
  priceRange?: { min: number; max: number };
}) {
  if (candles.length < 2) return null;

  const plotWidth = width - PRICE_AXIS_WIDTH;
  const plotHeight = height - DATE_AXIS_HEIGHT;

  const smaValues = (smaLines ?? []).flatMap((line) => line.values).filter((v): v is number => v !== null);
  const rawMin = priceRange ? priceRange.min : Math.min(...candles.map((candle) => candle.low), ...smaValues);
  const rawMax = priceRange ? priceRange.max : Math.max(...candles.map((candle) => candle.high), ...smaValues);
  const mid = (rawMin + rawMax) / 2;
  const halfRange = (rawMax - rawMin || 1) / 2 / yZoomFactor;
  const min = mid - halfRange;
  const max = mid + halfRange;
  const range = max - min || 1;
  const toY = (value: number) => plotHeight - ((value - min) / range) * plotHeight;

  const stepX = plotWidth / (candles.length + RIGHT_PADDING_CANDLES);
  const bodyWidth = stepX * 0.6;
  const toX = (index: number) => index * stepX + stepX / 2;

  const priceLabels = Array.from({ length: PRICE_GRIDLINES + 1 }, (_, i) => min + (range * i) / PRICE_GRIDLINES);
  const dateIndices = Array.from({ length: 4 }, (_, i) => Math.round((i * (candles.length - 1)) / 3));

  const upWicks: { x: number; yHigh: number; yLow: number }[] = [];
  const downWicks: { x: number; yHigh: number; yLow: number }[] = [];
  const upBodies: { x: number; top: number; height: number; width: number }[] = [];
  const downBodies: { x: number; top: number; height: number; width: number }[] = [];

  if (!hideCandles) {
    candles.forEach((candle, index) => {
      const xCenter = toX(index);
      const bullish = candle.close >= candle.open;
      const yOpen = toY(candle.open);
      const yClose = toY(candle.close);
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
      const wick = { x: xCenter, yHigh: toY(candle.high), yLow: toY(candle.low) };
      const body = { x: xCenter, top: bodyTop, height: bodyHeight, width: bodyWidth };
      if (bullish) {
        upWicks.push(wick);
        upBodies.push(body);
      } else {
        downWicks.push(wick);
        downBodies.push(body);
      }
    });
  }

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={CHART_BG} />

      {priceLabels.map((price) => {
        const y = toY(price);
        return (
          <Fragment key={price}>
            <Line x1={0} x2={plotWidth} y1={y} y2={y} stroke={GRID_COLOR} strokeWidth={1} />
            <SvgText x={plotWidth + 6} y={y + 3} fontSize={10} fill={AXIS_TEXT_COLOR}>
              {price.toFixed(2)}
            </SvgText>
          </Fragment>
        );
      })}

      {dateIndices.map((index) => (
        <SvgText key={index} x={toX(index)} y={plotHeight + 12} fontSize={10} fill={AXIS_TEXT_COLOR} textAnchor="middle">
          {formatAxisDate(candles[index].date)}
        </SvgText>
      ))}

      {!hideCandles ? (
        <>
          <Path d={buildWickPath(upWicks)} stroke={UP_COLOR} strokeWidth={1} />
          <Path d={buildWickPath(downWicks)} stroke={DOWN_COLOR} strokeWidth={1} />
          <Path d={buildBodyPath(upBodies)} fill={UP_COLOR} />
          <Path d={buildBodyPath(downBodies)} fill={DOWN_COLOR} />
          {(smaLines ?? []).map((line, index) => (
            <Path key={index} d={buildLinePath(line.values, toX, toY)} stroke={line.color} strokeWidth={1.5} fill="none" />
          ))}
        </>
      ) : null}

      {lastPrice && lastPrice.value >= min && lastPrice.value <= max
        ? (() => {
            const y = toY(lastPrice.value);
            const color = lastPrice.up ? UP_COLOR : DOWN_COLOR;
            return (
              <Fragment>
                <Line x1={0} x2={plotWidth} y1={y} y2={y} stroke={color} strokeWidth={1} strokeDasharray="3,3" />
                <Rect x={plotWidth} y={y - 7} width={PRICE_AXIS_WIDTH} height={14} fill={color} />
                <SvgText x={plotWidth + 4} y={y + 4} fontSize={10} fontWeight="bold" fill="#000">
                  {lastPrice.value.toFixed(2)}
                </SvgText>
              </Fragment>
            );
          })()
        : null}
    </Svg>
  );
});
