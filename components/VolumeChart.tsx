import { memo } from 'react';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { CHART_BG, RIGHT_PADDING_CANDLES } from '@/components/CandlestickChart';
import type { StockCandle } from '@/lib/marketData';

const AXIS_TEXT_COLOR = '#71717a';
const PRICE_AXIS_WIDTH = 46;
const UP_COLOR = '#22c55e';
const DOWN_COLOR = '#ef4444';

export function formatVolume(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${Math.round(value)}`;
}

export const VolumeChart = memo(function VolumeChart({
  candles,
  width = 320,
  height = 60,
}: {
  candles: StockCandle[];
  width?: number;
  height?: number;
}) {
  if (candles.length < 2) return null;

  const plotWidth = width - PRICE_AXIS_WIDTH;
  const max = Math.max(...candles.map((candle) => candle.volume), 1);
  const stepX = plotWidth / (candles.length + RIGHT_PADDING_CANDLES);
  const barWidth = stepX * 0.6;
  const toX = (index: number) => index * stepX + stepX / 2;
  const toY = (value: number) => height - (value / max) * height;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={CHART_BG} />
      {candles.map((candle, index) => {
        const x = toX(index);
        const y = toY(candle.volume);
        const bullish = candle.close >= candle.open;
        return (
          <Rect
            key={candle.date}
            x={x - barWidth / 2}
            y={y}
            width={barWidth}
            height={Math.max(height - y, 1)}
            fill={bullish ? UP_COLOR : DOWN_COLOR}
          />
        );
      })}
      <SvgText x={plotWidth + 6} y={11} fontSize={9} fill={AXIS_TEXT_COLOR}>
        {formatVolume(max)}
      </SvgText>
      <SvgText x={plotWidth + 6} y={height - 3} fontSize={9} fill={AXIS_TEXT_COLOR}>
        0
      </SvgText>
    </Svg>
  );
});
