import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import type { StockCandle } from '@/lib/marketData';

export function PriceChart({
  candles,
  width = 320,
  height = 160,
}: {
  candles: StockCandle[];
  width?: number;
  height?: number;
}) {
  if (candles.length < 2) return null;

  const closes = candles.map((candle) => candle.close);
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min || 1;
  const stepX = width / (closes.length - 1);

  const points = closes.map((close, index) => ({
    x: index * stepX,
    y: height - ((close - min) / range) * height,
  }));

  const linePath = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(' ');
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  const up = closes[closes.length - 1] >= closes[0];
  const color = up ? '#22c55e' : '#ef4444';

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="priceArea" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity={0.25} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Path d={areaPath} fill="url(#priceArea)" stroke="none" />
      <Path d={linePath} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}
