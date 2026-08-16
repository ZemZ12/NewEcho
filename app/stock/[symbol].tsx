import { Ionicons } from '@expo/vector-icons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnnotatedChart, type ChartZoom, type DrawMode } from '@/components/AnnotatedChart';
import { CandlestickChart, type SmaLine } from '@/components/CandlestickChart';
import type { SmaKey } from '@/components/LiveCandleLayer';
import { MacdChart } from '@/components/MacdChart';
import { RsiChart } from '@/components/RsiChart';
import { VolumeChart } from '@/components/VolumeChart';
import { useAuth } from '@/hooks/useAuth';
import { deleteChartShape, subscribeToChartShapes, type ChartShape } from '@/lib/chartAnnotations';
import { fetchStockChartData, fetchStockQuote, type StockChartData, type StockQuote, type StockRange } from '@/lib/marketData';

const MODES: { value: DrawMode; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'view', icon: 'eye-outline' },
  { value: 'line', icon: 'trending-up-outline' },
  { value: 'note', icon: 'chatbubble-ellipses-outline' },
];

const RANGES: StockRange[] = ['5m', '1H', '1D', '1W', '1M', '3M', '1Y'];

const SMA_PERIODS: { key: SmaKey; label: string; color: string }[] = [
  { key: 'sma10', label: '10', color: '#f472b6' },
  { key: 'sma50', label: '50', color: '#60a5fa' },
  { key: 'sma100', label: '100', color: '#facc15' },
  { key: 'sma200', label: '200', color: '#a78bfa' },
];

const SMA_COLORS = Object.fromEntries(SMA_PERIODS.map((period) => [period.key, period.color])) as Record<
  SmaKey,
  string
>;

const RSI_HEIGHT = 60;
const MACD_HEIGHT = 70;
const VOLUME_HEIGHT = 50;
const PANEL_GAP = 8;
const MIN_MAIN_CHART_HEIGHT = 140;

function slice<T>(arr: T[], offset: number, count: number): T[] {
  return arr.slice(offset, offset + count);
}

export default function StockScreen() {
  const { symbol, channelId } = useLocalSearchParams<{ symbol: string; channelId?: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  const [quote, setQuote] = useState<StockQuote | null>(null);
  const [chartData, setChartData] = useState<StockChartData | null>(null);
  const [range, setRange] = useState<StockRange>('1M');
  const [loading, setLoading] = useState(true);
  const [candlesLoading, setCandlesLoading] = useState(false);
  const [error, setError] = useState(false);
  const [shapes, setShapes] = useState<ChartShape[]>([]);
  const [mode, setMode] = useState<DrawMode>('view');
  const [enabledSma, setEnabledSma] = useState<Set<SmaKey>>(new Set(['sma10', 'sma50', 'sma100', 'sma200']));
  const [showVolume, setShowVolume] = useState(true);
  const [showRsi, setShowRsi] = useState(false);
  const [showMacd, setShowMacd] = useState(false);
  const [chartAreaHeight, setChartAreaHeight] = useState(0);
  const [rangeSheetOpen, setRangeSheetOpen] = useState(false);
  const [indicatorsSheetOpen, setIndicatorsSheetOpen] = useState(false);
  // Which window of the fetched candles is currently visible — pinch/pan on
  // the chart change this without re-fetching anything.
  const [visibleOffset, setVisibleOffset] = useState(0);
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchStockQuote(symbol)
      .then((result) => {
        if (!cancelled) setQuote(result);
      })
      .catch((err) => {
        console.warn('Could not load stock quote:', err);
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    if (!symbol) return;
    let cancelled = false;
    setCandlesLoading(true);

    fetchStockChartData(symbol, range)
      .then((result) => {
        if (cancelled) return;
        setChartData(result);
        // Default to just the trailing "outputsize" window — the rest of
        // the returned candles is real history included so panning left
        // has somewhere to go instead of hitting a dead stop.
        const defaultCount = Math.min(result.defaultVisibleCount, result.candles.length);
        setVisibleOffset(Math.max(0, result.candles.length - defaultCount));
        setVisibleCount(defaultCount);
      })
      .catch((err) => console.warn('Could not load stock history:', err))
      .finally(() => {
        if (!cancelled) setCandlesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

  useEffect(() => {
    if (!symbol || !channelId) return;
    return subscribeToChartShapes(channelId, symbol, range, setShapes, (err) =>
      console.warn('Could not load chart notes:', err),
    );
  }, [symbol, channelId, range]);

  // Most recent first, so Undo pops one shape per press and repeated presses
  // walk back through everything the user has added to this chart.
  const myShapes = useMemo(
    () =>
      shapes
        .filter((shape) => shape.createdBy === user?.uid)
        .sort((a, b) => (b.createdAt?.toMillis() ?? Date.now()) - (a.createdAt?.toMillis() ?? Date.now())),
    [shapes, user],
  );

  function handleUndo() {
    const last = myShapes[0];
    if (!last) return;
    deleteChartShape(last.id).catch((err) => console.warn('Could not undo:', err));
  }

  function toggleSma(key: SmaKey) {
    setEnabledSma((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const visibleCandles = chartData ? slice(chartData.candles, visibleOffset, visibleCount) : [];
  const activeSmaPeriods = SMA_PERIODS.filter((period) => enabledSma.has(period.key));
  const smaLines: SmaLine[] | undefined =
    chartData && activeSmaPeriods.length > 0
      ? activeSmaPeriods.map((period) => ({
          color: period.color,
          values: slice(chartData[period.key], visibleOffset, visibleCount),
        }))
      : undefined;

  const up = (quote?.change ?? 0) >= 0;
  const chartWidth = windowWidth;
  const canDraw = !!(channelId && user);
  const zoom: ChartZoom = { offset: visibleOffset, count: visibleCount, total: chartData?.candles.length ?? 0 };
  const hasChart = !!chartData && visibleCandles.length >= 2;

  // The main candlestick chart fills whatever's left in the flexible area
  // after the volume/RSI/MACD panels (if shown) take their fixed slice —
  // the whole stack fits the screen instead of scrolling, TradingView-style.
  const panelsHeight =
    (showVolume ? VOLUME_HEIGHT + PANEL_GAP : 0) +
    (showRsi ? RSI_HEIGHT + PANEL_GAP : 0) +
    (showMacd ? MACD_HEIGHT + PANEL_GAP : 0);
  const mainChartHeight = Math.max(MIN_MAIN_CHART_HEIGHT, chartAreaHeight - panelsHeight);

  return (
    <SafeAreaView className="flex-1 bg-black">
      <Stack.Screen
        options={{
          title: `$${symbol}`,
          presentation: 'modal',
          headerStyle: { backgroundColor: '#000' },
          headerTintColor: '#fff',
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Ionicons name="close" size={24} color="#a1a1aa" />
            </Pressable>
          ),
        }}
      />

      {loading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color="#fff" />
        </View>
      ) : error || !quote ? (
        <View className="flex-1 items-center justify-center gap-3 px-10">
          <Text className="text-center text-base text-zinc-500">Could not load data for ${symbol}.</Text>
        </View>
      ) : (
        <View className="flex-1">
          <View className="flex-1" onLayout={(event) => setChartAreaHeight(event.nativeEvent.layout.height)}>
            {candlesLoading || !chartAreaHeight ? (
              <View className="flex-1 items-center justify-center">
                <ActivityIndicator color="#fff" />
              </View>
            ) : hasChart ? (
              <>
                <View style={{ width: chartWidth, height: mainChartHeight }}>
                  {canDraw ? (
                    <AnnotatedChart
                      allCandles={chartData.candles}
                      allSma={{
                        sma10: chartData.sma10,
                        sma50: chartData.sma50,
                        sma100: chartData.sma100,
                        sma200: chartData.sma200,
                      }}
                      enabledSma={enabledSma}
                      smaColors={SMA_COLORS}
                      shapes={shapes}
                      channelId={channelId}
                      symbol={symbol}
                      range={range}
                      userId={user.uid}
                      mode={mode}
                      zoom={zoom}
                      onZoomChange={(offset, count) => {
                        setVisibleOffset(offset);
                        setVisibleCount(count);
                      }}
                      lastPrice={{ value: quote.price, up }}
                      width={chartWidth}
                      height={mainChartHeight}
                    />
                  ) : (
                    <CandlestickChart
                      candles={visibleCandles}
                      smaLines={smaLines}
                      lastPrice={{ value: quote.price, up }}
                      width={chartWidth}
                      height={mainChartHeight}
                    />
                  )}

                  {/* Ticker badge overlay, TradingView-style, instead of a
                      separate fixed header — keeps the chart itself as big
                      as possible. */}
                  <View className="absolute right-2 top-2 items-end rounded-lg bg-black/70 px-2.5 py-1.5">
                    <Text className="text-sm font-semibold text-white">${quote.symbol}</Text>
                    <Text className="text-lg font-bold text-white">${quote.price.toFixed(2)}</Text>
                    <Text className={`text-xs font-medium ${up ? 'text-green-400' : 'text-red-400'}`}>
                      {up ? '+' : ''}
                      {quote.change.toFixed(2)} ({up ? '+' : ''}
                      {quote.percentChange.toFixed(2)}%)
                    </Text>
                  </View>

                  {canDraw ? (
                    <View className="absolute left-2 top-2 gap-2 rounded-xl bg-black/70 p-1.5">
                      {MODES.map((option) => (
                        <Pressable
                          key={option.value}
                          onPress={() => setMode(option.value)}
                          className={`h-8 w-8 items-center justify-center rounded-lg ${
                            mode === option.value ? 'bg-accent' : ''
                          }`}>
                          <Ionicons name={option.icon} size={18} color="#fff" />
                        </Pressable>
                      ))}
                      <View className="h-px bg-white/20" />
                      <Pressable
                        onPress={handleUndo}
                        disabled={myShapes.length === 0}
                        className="h-8 w-8 items-center justify-center rounded-lg disabled:opacity-30">
                        <Ionicons name="arrow-undo-outline" size={18} color="#fff" />
                      </Pressable>
                    </View>
                  ) : null}

                  {mode !== 'view' && canDraw ? (
                    <View pointerEvents="none" className="absolute bottom-2 left-0 right-0 items-center">
                      <View className="rounded-full bg-black/70 px-3 py-1">
                        <Text className="text-xs text-zinc-300">
                          {mode === 'line' ? 'Drag to draw a trend line' : 'Tap to drop a note'}
                        </Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {showVolume ? (
                  <View style={{ marginTop: PANEL_GAP }}>
                    <VolumeChart candles={visibleCandles} width={chartWidth} height={VOLUME_HEIGHT} />
                  </View>
                ) : null}

                {showRsi ? (
                  <View style={{ marginTop: PANEL_GAP }}>
                    <RsiChart
                      values={slice(chartData.rsi14, visibleOffset, visibleCount)}
                      width={chartWidth}
                      height={RSI_HEIGHT}
                    />
                  </View>
                ) : null}

                {showMacd ? (
                  <View style={{ marginTop: PANEL_GAP }}>
                    <MacdChart
                      line={slice(chartData.macd.line, visibleOffset, visibleCount)}
                      signal={slice(chartData.macd.signal, visibleOffset, visibleCount)}
                      histogram={slice(chartData.macd.histogram, visibleOffset, visibleCount)}
                      width={chartWidth}
                      height={MACD_HEIGHT}
                    />
                  </View>
                ) : null}
              </>
            ) : (
              <View className="flex-1 items-center justify-center">
                <Text className="text-sm text-zinc-500">Not enough history for a chart yet.</Text>
              </View>
            )}
          </View>

          {hasChart ? (
            <View className="flex-row items-center justify-between border-t border-zinc-800 px-4 py-2.5">
              <Pressable onPress={() => setRangeSheetOpen(true)} className="flex-row items-center gap-1">
                <Text className="text-sm font-semibold text-white">${symbol}</Text>
                <Text className="text-sm text-zinc-400">{range}</Text>
                <Ionicons name="chevron-down" size={12} color="#71717a" />
              </Pressable>
              <Pressable onPress={() => setIndicatorsSheetOpen(true)} hitSlop={8}>
                <Ionicons name="stats-chart-outline" size={20} color="#fff" />
              </Pressable>
            </View>
          ) : null}
        </View>
      )}

      <Modal visible={rangeSheetOpen} transparent animationType="slide" onRequestClose={() => setRangeSheetOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setRangeSheetOpen(false)}>
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={['bottom']} className="rounded-t-2xl bg-zinc-900">
              <View className="items-center pt-2">
                <View className="h-1 w-10 rounded-full bg-zinc-700" />
              </View>
              {RANGES.map((option) => (
                <Pressable
                  key={option}
                  onPress={() => {
                    setRange(option);
                    setRangeSheetOpen(false);
                  }}
                  className="flex-row items-center justify-between px-5 py-3">
                  <Text className="text-base text-white">{option}</Text>
                  {range === option ? <Ionicons name="checkmark" size={18} color="#6366f1" /> : null}
                </Pressable>
              ))}
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={indicatorsSheetOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIndicatorsSheetOpen(false)}>
        <Pressable className="flex-1 justify-end bg-black/60" onPress={() => setIndicatorsSheetOpen(false)}>
          <Pressable onPress={() => {}}>
            <SafeAreaView edges={['bottom']} className="rounded-t-2xl bg-zinc-900">
              <View className="items-center pt-2">
                <View className="h-1 w-10 rounded-full bg-zinc-700" />
              </View>
              <Text className="px-5 pb-1 pt-2 text-xs uppercase tracking-wide text-zinc-500">Moving averages</Text>
              {SMA_PERIODS.map((period) => (
                <Pressable
                  key={period.key}
                  onPress={() => toggleSma(period.key)}
                  className="flex-row items-center justify-between px-5 py-3">
                  <View className="flex-row items-center gap-2">
                    <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: period.color }} />
                    <Text className="text-base text-white">SMA {period.label}</Text>
                  </View>
                  {enabledSma.has(period.key) ? <Ionicons name="checkmark" size={18} color="#6366f1" /> : null}
                </Pressable>
              ))}
              <Text className="px-5 pb-1 pt-2 text-xs uppercase tracking-wide text-zinc-500">Volume</Text>
              <Pressable
                onPress={() => setShowVolume((value) => !value)}
                className="flex-row items-center justify-between px-5 py-3">
                <Text className="text-base text-white">Volume</Text>
                {showVolume ? <Ionicons name="checkmark" size={18} color="#6366f1" /> : null}
              </Pressable>
              <Text className="px-5 pb-1 pt-2 text-xs uppercase tracking-wide text-zinc-500">Oscillators</Text>
              <Pressable
                onPress={() => setShowRsi((value) => !value)}
                className="flex-row items-center justify-between px-5 py-3">
                <Text className="text-base text-white">RSI (14)</Text>
                {showRsi ? <Ionicons name="checkmark" size={18} color="#6366f1" /> : null}
              </Pressable>
              <Pressable
                onPress={() => setShowMacd((value) => !value)}
                className="flex-row items-center justify-between px-5 py-3">
                <Text className="text-base text-white">MACD (12, 26, 9)</Text>
                {showMacd ? <Ionicons name="checkmark" size={18} color="#6366f1" /> : null}
              </Pressable>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
