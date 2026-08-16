import { memo } from 'react';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';

import { AXIS_TEXT_COLOR, CHART_BG, PRICE_AXIS_WIDTH, RIGHT_PADDING_CANDLES } from '@/components/CandlestickChart';
import { buildLinePath } from '@/lib/chartPath';

export const RsiChart = memo(function RsiChart({
  values,
  width = 320,
  height = 60,
}: {
  values: (number | null)[];
  width?: number;
  height?: number;
}) {
  const plotWidth = width - PRICE_AXIS_WIDTH;
  const toY = (value: number) => height - (value / 100) * height;
  // Slot-centered, matching CandlestickChart's x mapping so this panel's
  // line lines up with the candles above it.
  const stepX = plotWidth / (values.length + RIGHT_PADDING_CANDLES);
  const toX = (index: number) => index * stepX + stepX / 2;
  const y30 = toY(30);
  const y70 = toY(70);

  return (
    <Svg width={width} height={height}>
      <Rect x={0} y={0} width={width} height={height} fill={CHART_BG} />
      <Line x1={0} x2={plotWidth} y1={y70} y2={y70} stroke="#3f3f46" strokeWidth={1} strokeDasharray="2,2" />
      <Line x1={0} x2={plotWidth} y1={y30} y2={y30} stroke="#3f3f46" strokeWidth={1} strokeDasharray="2,2" />
      <SvgText x={plotWidth + 6} y={y70 + 3} fontSize={9} fill={AXIS_TEXT_COLOR}>
        70
      </SvgText>
      <SvgText x={plotWidth + 6} y={y30 + 3} fontSize={9} fill={AXIS_TEXT_COLOR}>
        30
      </SvgText>
      <Path d={buildLinePath(values, toX, toY)} stroke="#f59e0b" strokeWidth={1.5} fill="none" />
    </Svg>
  );
});
