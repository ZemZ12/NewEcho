import { memo } from 'react';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AXIS_TEXT_COLOR, CHART_BG, DOWN_COLOR, PRICE_AXIS_WIDTH, RIGHT_PADDING_CANDLES, UP_COLOR } from '@/components/CandlestickChart';
import { buildLinePath } from '@/lib/chartPath';

export const MacdChart = memo(function MacdChart({
  line,
  signal,
  histogram,
  width = 320,
  height = 70,
}: {
  line: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
  width?: number;
  height?: number;
}) {
  const plotWidth = width - PRICE_AXIS_WIDTH;
  const all = [...line, ...signal, ...histogram].filter((v): v is number => v !== null);
  const max = Math.max(...all, 0.01);
  const min = Math.min(...all, -0.01);
  const range = max - min || 1;
  const toY = (value: number) => height - ((value - min) / range) * height;
  const zeroY = toY(0);

  // Slot-centered, matching CandlestickChart's x mapping.
  const stepX = plotWidth / (histogram.length + RIGHT_PADDING_CANDLES);
  const toX = (index: number) => index * stepX + stepX / 2;
  const barWidth = stepX * 0.6;

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={CHART_BG} />
      <Line x1={0} x2={plotWidth} y1={zeroY} y2={zeroY} stroke="#3f3f46" strokeWidth={1} />
      <SvgText x={plotWidth + 6} y={zeroY + 3} fontSize={9} fill={AXIS_TEXT_COLOR}>
        0
      </SvgText>
      {histogram.map((value, index) => {
        if (value === null) return null;
        const xCenter = toX(index);
        const y = toY(value);
        const top = Math.min(y, zeroY);
        const barHeight = Math.max(Math.abs(y - zeroY), 1);
        return (
          <Rect
            key={index}
            x={xCenter - barWidth / 2}
            y={top}
            width={barWidth}
            height={barHeight}
            fill={value >= 0 ? UP_COLOR : DOWN_COLOR}
          />
        );
      })}
      <Path d={buildLinePath(line, toX, toY)} stroke="#6366f1" strokeWidth={1.5} fill="none" />
      <Path d={buildLinePath(signal, toX, toY)} stroke="#f59e0b" strokeWidth={1.5} fill="none" />
    </Svg>
  );
});
