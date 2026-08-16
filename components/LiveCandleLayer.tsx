import { useEffect } from 'react';
import Animated, { useAnimatedProps, useDerivedValue, useSharedValue, type SharedValue } from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { RIGHT_PADDING_CANDLES } from '@/components/CandlestickChart';
import type { StockCandle } from '@/lib/marketData';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';

export type SmaKey = 'sma10' | 'sma50' | 'sma100' | 'sma200';
type Columns = { opens: number[]; highs: number[]; lows: number[]; closes: number[] };

function toColumns(candles: StockCandle[]): Columns {
  const opens: number[] = new Array(candles.length);
  const highs: number[] = new Array(candles.length);
  const lows: number[] = new Array(candles.length);
  const closes: number[] = new Array(candles.length);
  for (let i = 0; i < candles.length; i++) {
    opens[i] = candles[i].open;
    highs[i] = candles[i].high;
    lows[i] = candles[i].low;
    closes[i] = candles[i].close;
  }
  return { opens, highs, lows, closes };
}

// Draws the candles + SMA lines entirely from Reanimated shared values via
// useAnimatedProps, so pinch/pan can move them every single gesture frame
// without ever touching React state or re-rendering — the actual
// re-rendered React tree (axis labels, gridlines, RSI/MACD) only needs to
// catch up at a throttled rate, since it's not what your eye is tracking
// during the gesture.
export function LiveCandleLayer({
  allCandles,
  allSma,
  enabledSma,
  smaColors,
  offsetShared,
  countShared,
  yZoomShared,
  min,
  max,
  width,
  height,
}: {
  allCandles: StockCandle[];
  allSma: Record<SmaKey, (number | null)[]>;
  enabledSma: Set<SmaKey>;
  smaColors: Record<SmaKey, string>;
  offsetShared: SharedValue<number>;
  countShared: SharedValue<number>;
  // >1 narrows the price range (candles grow taller), <1 widens it
  // (candles shrink) — driven live by dragging the price axis.
  yZoomShared: SharedValue<number>;
  min: number;
  max: number;
  width: number;
  height: number;
}) {
  const columns = useSharedValue<Columns>(toColumns(allCandles));
  useEffect(() => {
    columns.value = toColumns(allCandles);
  }, [allCandles, columns]);

  const sma10 = useSharedValue<(number | null)[]>(allSma.sma10);
  const sma50 = useSharedValue<(number | null)[]>(allSma.sma50);
  const sma100 = useSharedValue<(number | null)[]>(allSma.sma100);
  const sma200 = useSharedValue<(number | null)[]>(allSma.sma200);
  useEffect(() => {
    sma10.value = allSma.sma10;
  }, [allSma.sma10, sma10]);
  useEffect(() => {
    sma50.value = allSma.sma50;
  }, [allSma.sma50, sma50]);
  useEffect(() => {
    sma100.value = allSma.sma100;
  }, [allSma.sma100, sma100]);
  useEffect(() => {
    sma200.value = allSma.sma200;
  }, [allSma.sma200, sma200]);

  const mid = (min + max) / 2;
  const halfRange = (max - min || 1) / 2;
  const showSma10 = enabledSma.has('sma10');
  const showSma50 = enabledSma.has('sma50');
  const showSma100 = enabledSma.has('sma100');
  const showSma200 = enabledSma.has('sma200');

  const geometry = useDerivedValue(() => {
    const offset = Math.round(offsetShared.value);
    const count = Math.max(1, Math.round(countShared.value));
    const { opens, highs, lows, closes } = columns.value;
    const stepX = width / (count + RIGHT_PADDING_CANDLES);
    const bodyWidth = stepX * 0.6;
    const effectiveHalf = halfRange / yZoomShared.value;
    const effectiveMin = mid - effectiveHalf;
    const effectiveRange = effectiveHalf * 2 || 1;
    const toY = (value: number) => height - ((value - effectiveMin) / effectiveRange) * height;

    let upWicks = '';
    let downWicks = '';
    let upBodies = '';
    let downBodies = '';

    for (let i = 0; i < count; i++) {
      const idx = offset + i;
      if (idx < 0 || idx >= opens.length) continue;
      const x = i * stepX + stepX / 2;
      const bullish = closes[idx] >= opens[idx];
      const yOpen = toY(opens[idx]);
      const yClose = toY(closes[idx]);
      const top = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
      const wick = `M${x.toFixed(1)},${toY(highs[idx]).toFixed(1)} L${x.toFixed(1)},${toY(lows[idx]).toFixed(1)} `;
      const body = `M${(x - bodyWidth / 2).toFixed(1)},${top.toFixed(1)} L${(x + bodyWidth / 2).toFixed(1)},${top.toFixed(1)} L${(x + bodyWidth / 2).toFixed(1)},${(top + bodyHeight).toFixed(1)} L${(x - bodyWidth / 2).toFixed(1)},${(top + bodyHeight).toFixed(1)} Z `;
      if (bullish) {
        upWicks += wick;
        upBodies += body;
      } else {
        downWicks += wick;
        downBodies += body;
      }
    }

    function smaPath(values: (number | null)[]): string {
      let d = '';
      let drawing = false;
      for (let i = 0; i < count; i++) {
        const idx = offset + i;
        const value = idx >= 0 && idx < values.length ? values[idx] : null;
        if (value === null || value === undefined) {
          drawing = false;
          continue;
        }
        const x = i * stepX + stepX / 2;
        const y = toY(value);
        d += drawing ? `L${x.toFixed(1)},${y.toFixed(1)} ` : `M${x.toFixed(1)},${y.toFixed(1)} `;
        drawing = true;
      }
      return d;
    }

    return {
      upWicks,
      downWicks,
      upBodies,
      downBodies,
      sma10: showSma10 ? smaPath(sma10.value) : '',
      sma50: showSma50 ? smaPath(sma50.value) : '',
      sma100: showSma100 ? smaPath(sma100.value) : '',
      sma200: showSma200 ? smaPath(sma200.value) : '',
    };
  });

  const upWicksProps = useAnimatedProps(() => ({ d: geometry.value.upWicks }));
  const downWicksProps = useAnimatedProps(() => ({ d: geometry.value.downWicks }));
  const upBodiesProps = useAnimatedProps(() => ({ d: geometry.value.upBodies }));
  const downBodiesProps = useAnimatedProps(() => ({ d: geometry.value.downBodies }));
  const sma10Props = useAnimatedProps(() => ({ d: geometry.value.sma10 }));
  const sma50Props = useAnimatedProps(() => ({ d: geometry.value.sma50 }));
  const sma100Props = useAnimatedProps(() => ({ d: geometry.value.sma100 }));
  const sma200Props = useAnimatedProps(() => ({ d: geometry.value.sma200 }));

  return (
    <Svg width={width} height={height} style={{ position: 'absolute', top: 0, left: 0 }}>
      <AnimatedPath animatedProps={upWicksProps} stroke={UP_COLOR} strokeWidth={1} />
      <AnimatedPath animatedProps={downWicksProps} stroke={DOWN_COLOR} strokeWidth={1} />
      <AnimatedPath animatedProps={upBodiesProps} fill={UP_COLOR} />
      <AnimatedPath animatedProps={downBodiesProps} fill={DOWN_COLOR} />
      <AnimatedPath animatedProps={sma10Props} stroke={smaColors.sma10} strokeWidth={1.5} fill="none" />
      <AnimatedPath animatedProps={sma50Props} stroke={smaColors.sma50} strokeWidth={1.5} fill="none" />
      <AnimatedPath animatedProps={sma100Props} stroke={smaColors.sma100} strokeWidth={1.5} fill="none" />
      <AnimatedPath animatedProps={sma200Props} stroke={smaColors.sma200} strokeWidth={1.5} fill="none" />
    </Svg>
  );
}
