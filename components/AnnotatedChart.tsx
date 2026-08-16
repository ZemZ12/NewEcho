import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import Svg, { Line as SvgLine } from 'react-native-svg';

import { CandlestickChart, DATE_AXIS_HEIGHT, PRICE_AXIS_WIDTH, RIGHT_PADDING_CANDLES } from '@/components/CandlestickChart';
import { LiveCandleLayer, type SmaKey } from '@/components/LiveCandleLayer';
import { formatVolume } from '@/components/VolumeChart';
import { addLineShape, addNoteShape, type ChartShape } from '@/lib/chartAnnotations';
import type { StockCandle, StockRange } from '@/lib/marketData';

export type DrawMode = 'view' | 'line' | 'note';
export type ChartZoom = { offset: number; count: number; total: number };

const LINE_COLOR = '#6366f1';
const NOTE_COLOR = '#f59e0b';
const MIN_VISIBLE_CANDLES = 8;
// How often a live pinch/pan pushes a real React commit (axis labels,
// gridlines, RSI/MACD) — the candles/SMA themselves move every gesture
// frame via shared values below, with zero React involvement, so this only
// has to keep the supporting chrome roughly in sync, not drive the motion.
const COMMIT_THROTTLE_MS = 60;

const SMA_KEYS: SmaKey[] = ['sma10', 'sma50', 'sma100', 'sma200'];
const TOOLTIP_WIDTH = 128;

function InspectTooltip({ candle, x, plotWidth }: { candle: StockCandle; x: number; plotWidth: number }) {
  const change = candle.close - candle.open;
  const percent = candle.open !== 0 ? (change / candle.open) * 100 : 0;
  const bullish = candle.close >= candle.open;
  const color = bullish ? '#22c55e' : '#ef4444';
  const left = Math.min(Math.max(x - TOOLTIP_WIDTH / 2, 4), plotWidth - TOOLTIP_WIDTH - 4);

  return (
    <View pointerEvents="none" className="absolute top-2 rounded-lg bg-black/85 px-2.5 py-2" style={{ left, width: TOOLTIP_WIDTH }}>
      <View className="flex-row justify-between">
        <Text className="text-[10px] text-zinc-400">O</Text>
        <Text className="text-[10px] font-medium" style={{ color }}>
          {candle.open.toFixed(2)}
        </Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[10px] text-zinc-400">H</Text>
        <Text className="text-[10px] font-medium" style={{ color }}>
          {candle.high.toFixed(2)}
        </Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[10px] text-zinc-400">L</Text>
        <Text className="text-[10px] font-medium" style={{ color }}>
          {candle.low.toFixed(2)}
        </Text>
      </View>
      <View className="flex-row justify-between">
        <Text className="text-[10px] text-zinc-400">C</Text>
        <Text className="text-[10px] font-medium" style={{ color }}>
          {candle.close.toFixed(2)} ({bullish ? '+' : ''}
          {percent.toFixed(2)}%)
        </Text>
      </View>
      <View className="mt-1 flex-row justify-between border-t border-white/10 pt-1">
        <Text className="text-[10px] text-zinc-400">Vol</Text>
        <Text className="text-[10px] font-medium text-white">{formatVolume(candle.volume)}</Text>
      </View>
    </View>
  );
}

export function AnnotatedChart({
  allCandles,
  allSma,
  enabledSma,
  smaColors,
  shapes,
  channelId,
  symbol,
  range,
  userId,
  mode,
  zoom,
  onZoomChange,
  lastPrice,
  width = 320,
  height = 180,
}: {
  allCandles: StockCandle[];
  allSma: Record<SmaKey, (number | null)[]>;
  enabledSma: Set<SmaKey>;
  smaColors: Record<SmaKey, string>;
  shapes: ChartShape[];
  channelId: string;
  symbol: string;
  range: StockRange;
  userId: string;
  mode: DrawMode;
  zoom: ChartZoom;
  onZoomChange: (offset: number, count: number) => void;
  lastPrice?: { value: number; up: boolean };
  width?: number;
  height?: number;
}) {
  const [previewLine, setPreviewLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [notePrompt, setNotePrompt] = useState<{ x: number; y: number } | null>(null);
  const [noteText, setNoteText] = useState('');
  const [inspected, setInspected] = useState<{ candle: StockCandle; x: number } | null>(null);
  const [crosshair, setCrosshair] = useState<{ candle: StockCandle; x: number; y: number; price: number } | null>(
    null,
  );
  const [yZoomFactor, setYZoomFactor] = useState(1);
  const startRef = useRef({ x: 0, y: 0 });

  // The live truth for what's visibly on screen — mutated every gesture
  // frame directly on the UI thread. `zoom` (props, React state) trails
  // behind at a throttled rate purely to keep the axis/RSI/MACD in sync.
  const offsetShared = useSharedValue(zoom.offset);
  const countShared = useSharedValue(zoom.count);
  const totalShared = useSharedValue(zoom.total);
  const startOffsetShared = useSharedValue(zoom.offset);
  const startCountShared = useSharedValue(zoom.count);
  const lastCommitShared = useSharedValue(0);
  // Vertical zoom on the price axis — kept entirely local to this chart
  // (not lifted to the parent) since it only affects this chart's own
  // price scale, not RSI/MACD/Volume, which each auto-fit independently.
  const yZoomShared = useSharedValue(1);
  const startYZoomShared = useSharedValue(1);

  useEffect(() => {
    offsetShared.value = zoom.offset;
    countShared.value = zoom.count;
    totalShared.value = zoom.total;
  }, [zoom.offset, zoom.count, zoom.total, offsetShared, countShared, totalShared]);

  // The inspected candle is a snapshot of a specific tap — clear it once
  // it's no longer meaningful (left view mode, or the underlying data for
  // this range changed under it). New data also means a stale vertical
  // zoom would misrepresent the new auto-fit range, so reset that too.
  useEffect(() => {
    setInspected(null);
  }, [mode, allCandles]);

  useEffect(() => {
    yZoomShared.value = 1;
    setYZoomFactor(1);
  }, [allCandles, yZoomShared]);

  // CandlestickChart reserves margin on the right/bottom for its price and
  // date axes, so candles only occupy this smaller "plot" area — gestures
  // and saved shape coordinates need to line up with that, not the full
  // component size.
  const plotWidth = width - PRICE_AXIS_WIDTH;
  const plotHeight = height - DATE_AXIS_HEIGHT;

  // Throttled-committed slice, used only for the axis/gridlines (via
  // CandlestickChart with hideCandles) and the live layer's Y-scale.
  const slicedCandles = useMemo(
    () => allCandles.slice(zoom.offset, zoom.offset + zoom.count),
    [allCandles, zoom.offset, zoom.count],
  );
  const activeSmaEntries = useMemo(
    () =>
      SMA_KEYS.filter((key) => enabledSma.has(key)).map((key) => ({
        color: smaColors[key],
        values: allSma[key].slice(zoom.offset, zoom.offset + zoom.count),
      })),
    [allSma, enabledSma, smaColors, zoom.offset, zoom.count],
  );
  const { min, max } = useMemo(() => {
    const smaValues = activeSmaEntries.flatMap((entry) => entry.values).filter((v): v is number => v !== null);
    const lows = slicedCandles.map((candle) => candle.low);
    const highs = slicedCandles.map((candle) => candle.high);
    return {
      min: Math.min(...lows, ...smaValues),
      max: Math.max(...highs, ...smaValues),
    };
  }, [slicedCandles, activeSmaEntries]);

  function beginPreview(x: number, y: number) {
    startRef.current = { x, y };
    setPreviewLine({ x1: x, y1: y, x2: x, y2: y });
  }

  function updatePreview(x2: number, y2: number) {
    setPreviewLine({ x1: startRef.current.x, y1: startRef.current.y, x2, y2 });
  }

  function endLine(x2: number, y2: number) {
    const { x: x1, y: y1 } = startRef.current;
    setPreviewLine(null);
    // Ignore accidental taps/jitters that never really became a line.
    if (Math.hypot(x2 - x1, y2 - y1) < 6) return;
    addLineShape({
      channelId,
      symbol,
      range,
      x1: x1 / plotWidth,
      y1: y1 / plotHeight,
      x2: x2 / plotWidth,
      y2: y2 / plotHeight,
      color: LINE_COLOR,
      createdBy: userId,
    }).catch((err) => console.warn('Could not save line:', err));
  }

  function openNotePrompt(x: number, y: number) {
    setNoteText('');
    setNotePrompt({ x, y });
  }

  function submitNote() {
    const text = noteText.trim();
    const prompt = notePrompt;
    setNotePrompt(null);
    if (!text || !prompt) return;
    addNoteShape({
      channelId,
      symbol,
      range,
      x: prompt.x / plotWidth,
      y: prompt.y / plotHeight,
      text,
      color: NOTE_COLOR,
      createdBy: userId,
    }).catch((err) => console.warn('Could not save note:', err));
  }

  function commitZoom(offset: number, count: number) {
    onZoomChange(offset, count);
  }

  function commitYZoom(factor: number) {
    setYZoomFactor(factor);
  }

  function inspectAt(x: number) {
    if (slicedCandles.length === 0) return;
    const stepX = plotWidth / (slicedCandles.length + RIGHT_PADDING_CANDLES);
    const index = Math.min(slicedCandles.length - 1, Math.max(0, Math.floor(x / stepX)));
    setInspected({ candle: slicedCandles[index], x: index * stepX + stepX / 2 });
  }

  function updateCrosshair(x: number, y: number) {
    if (slicedCandles.length === 0) return;
    const stepX = plotWidth / (slicedCandles.length + RIGHT_PADDING_CANDLES);
    const index = Math.min(slicedCandles.length - 1, Math.max(0, Math.floor(x / stepX)));
    const clampedY = Math.min(Math.max(y, 0), plotHeight);
    // Must match the same effective (vertical-zoom-adjusted) range the
    // chart is actually rendered with, or the readout drifts from what's
    // on screen the moment yZoomFactor isn't 1.
    const mid = (min + max) / 2;
    const halfRange = (max - min || 1) / 2 / yZoomFactor;
    const effectiveMax = mid + halfRange;
    const effectiveRange = halfRange * 2;
    const price = effectiveMax - (clampedY / plotHeight) * effectiveRange;
    setCrosshair({ candle: slicedCandles[index], x: index * stepX + stepX / 2, y: clampedY, price });
  }

  function clearCrosshair() {
    setCrosshair(null);
  }

  const panGesture = Gesture.Pan()
    .onBegin((event) => {
      runOnJS(beginPreview)(event.x, event.y);
    })
    .onUpdate((event) => {
      runOnJS(updatePreview)(event.x, event.y);
    })
    .onEnd((event) => {
      runOnJS(endLine)(event.x, event.y);
    });

  const tapGesture = Gesture.Tap().onEnd((event) => {
    runOnJS(openNotePrompt)(event.x, event.y);
  });

  // Pinch to zoom, drag to scroll through the fetched history. The visible
  // window (offsetShared/countShared) updates every single gesture frame
  // directly on the UI thread — LiveCandleLayer reads these to redraw the
  // candles with zero React re-renders in between. Only a throttled
  // snapshot gets pushed to React state, to keep the axis/RSI/MACD synced
  // without asking React to do that work 60 times a second.
  const pinchGesture = Gesture.Pinch()
    .onBegin(() => {
      startOffsetShared.value = offsetShared.value;
      startCountShared.value = countShared.value;
      lastCommitShared.value = 0;
    })
    .onUpdate((event) => {
      const total = totalShared.value;
      const newCount = Math.min(total, Math.max(MIN_VISIBLE_CANDLES, Math.round(startCountShared.value / event.scale)));
      const centerIndex = startOffsetShared.value + startCountShared.value / 2;
      const newOffset = Math.max(0, Math.min(total - newCount, Math.round(centerIndex - newCount / 2)));
      offsetShared.value = newOffset;
      countShared.value = newCount;

      const now = Date.now();
      if (now - lastCommitShared.value >= COMMIT_THROTTLE_MS) {
        lastCommitShared.value = now;
        runOnJS(commitZoom)(newOffset, newCount);
      }
    })
    .onEnd(() => {
      runOnJS(commitZoom)(offsetShared.value, countShared.value);
    });

  const panScrollGesture = Gesture.Pan()
    .maxPointers(1)
    .onBegin(() => {
      startOffsetShared.value = offsetShared.value;
      lastCommitShared.value = 0;
    })
    .onUpdate((event) => {
      const total = totalShared.value;
      const count = countShared.value;
      const candleWidthPx = plotWidth / count;
      const deltaCandles = Math.round(-event.translationX / candleWidthPx);
      const newOffset = Math.max(0, Math.min(total - count, startOffsetShared.value + deltaCandles));
      offsetShared.value = newOffset;

      const now = Date.now();
      if (now - lastCommitShared.value >= COMMIT_THROTTLE_MS) {
        lastCommitShared.value = now;
        runOnJS(commitZoom)(newOffset, count);
      }
    })
    .onEnd(() => {
      runOnJS(commitZoom)(offsetShared.value, countShared.value);
    });

  // Tap (not drag) to inspect a candle's OHLC/volume/change — a Tap
  // recognizer composes cleanly alongside Pinch and the scroll Pan since
  // it activates on fundamentally different criteria (minimal movement),
  // unlike stacking two Pan recognizers together.
  const inspectGesture = Gesture.Tap().onEnd((event) => {
    runOnJS(inspectAt)(event.x);
  });

  // Hold-and-drag crosshair for a precise price look-up, following the
  // thumb continuously and disappearing on release. This is a second Pan
  // recognizer alongside panScrollGesture, which is exactly what broke
  // line-drawing earlier when both were just tossed into one Simultaneous
  // group — the fix here is Gesture.Race: only one of the two ever wins.
  // A quick drag has no long-press, so panScrollGesture (which activates
  // immediately) always wins for normal scrolling; holding still first
  // lets this one's long-press timer complete before any movement
  // happens, so it wins instead once the drag actually starts.
  const crosshairGesture = Gesture.Pan()
    .activateAfterLongPress(300)
    .onUpdate((event) => {
      runOnJS(updateCrosshair)(event.x, event.y);
    })
    .onEnd(() => {
      runOnJS(clearCrosshair)();
    })
    .onFinalize(() => {
      runOnJS(clearCrosshair)();
    });

  const dragGesture = Gesture.Race(panScrollGesture, crosshairGesture);

  const viewGesture = Gesture.Simultaneous(pinchGesture, dragGesture, inspectGesture);

  // Vertical drag specifically on the price-axis strip (a physically
  // separate touch region from the candles themselves, so no arena
  // conflict with any of the gestures above) shrinks/grows the candles by
  // narrowing or widening the visible price range. Drag down = zoom in
  // (taller candles), drag up = zoom out (shorter candles).
  const axisGesture = Gesture.Pan()
    .onBegin(() => {
      startYZoomShared.value = yZoomShared.value;
    })
    .onUpdate((event) => {
      const newFactor = Math.min(6, Math.max(0.2, startYZoomShared.value * Math.exp(event.translationY / 150)));
      yZoomShared.value = newFactor;

      const now = Date.now();
      if (now - lastCommitShared.value >= COMMIT_THROTTLE_MS) {
        lastCommitShared.value = now;
        runOnJS(commitYZoom)(newFactor);
      }
    })
    .onEnd(() => {
      runOnJS(commitYZoom)(yZoomShared.value);
    });

  // Only one gesture (group) is ever live at a time — mixing two Pan
  // recognizers in the same group previously made line-drawing unreliable,
  // so each mode gets its own exclusive gesture rather than toggling
  // .enabled on a shared set.
  const activeGesture = mode === 'line' ? panGesture : mode === 'note' ? tapGesture : viewGesture;

  // shapes is unchanged for the whole duration of a zoom/pan gesture, so
  // this avoids re-filtering it on every throttled re-render.
  const lines = useMemo(
    () => shapes.filter((shape): shape is Extract<ChartShape, { type: 'line' }> => shape.type === 'line'),
    [shapes],
  );
  const notes = useMemo(
    () => shapes.filter((shape): shape is Extract<ChartShape, { type: 'note' }> => shape.type === 'note'),
    [shapes],
  );

  return (
    <View style={{ width, height }}>
      <GestureDetector gesture={activeGesture}>
        <View style={{ width, height }}>
          <CandlestickChart
            candles={slicedCandles}
            width={width}
            height={height}
            hideCandles
            lastPrice={lastPrice}
            yZoomFactor={yZoomFactor}
            priceRange={{ min, max }}
          />
          <LiveCandleLayer
            allCandles={allCandles}
            allSma={allSma}
            enabledSma={enabledSma}
            smaColors={smaColors}
            offsetShared={offsetShared}
            countShared={countShared}
            yZoomShared={yZoomShared}
            min={min}
            max={max}
            width={plotWidth}
            height={plotHeight}
          />

          <View style={StyleSheet.absoluteFillObject}>
            <Svg width={width} height={height} style={StyleSheet.absoluteFillObject}>
              {lines.map((line) => (
                <SvgLine
                  key={line.id}
                  x1={line.x1 * plotWidth}
                  y1={line.y1 * plotHeight}
                  x2={line.x2 * plotWidth}
                  y2={line.y2 * plotHeight}
                  stroke={line.color}
                  strokeWidth={2}
                />
              ))}
              {previewLine ? (
                <SvgLine
                  x1={previewLine.x1}
                  y1={previewLine.y1}
                  x2={previewLine.x2}
                  y2={previewLine.y2}
                  stroke={LINE_COLOR}
                  strokeWidth={2}
                  strokeDasharray="4,4"
                />
              ) : null}
              {crosshair ? (
                <>
                  <SvgLine
                    x1={crosshair.x}
                    y1={0}
                    x2={crosshair.x}
                    y2={plotHeight}
                    stroke="#a1a1aa"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                  <SvgLine
                    x1={0}
                    y1={crosshair.y}
                    x2={plotWidth}
                    y2={crosshair.y}
                    stroke="#a1a1aa"
                    strokeWidth={1}
                    strokeDasharray="3,3"
                  />
                </>
              ) : null}
            </Svg>

            {notes.map((note) => (
              <View
                key={note.id}
                style={{
                  position: 'absolute',
                  left: note.x * plotWidth - 6,
                  top: note.y * plotHeight - 6,
                  alignItems: 'center',
                }}>
                <View className="h-3 w-3 rounded-full" style={{ backgroundColor: note.color }} />
                <View className="mt-1 max-w-[120px] rounded bg-black/70 px-1.5 py-0.5">
                  <Text className="text-[10px] text-white" numberOfLines={1}>
                    {note.text}
                  </Text>
                </View>
              </View>
            ))}

            {inspected ? (
              <InspectTooltip candle={inspected.candle} x={inspected.x} plotWidth={plotWidth} />
            ) : null}

            {crosshair ? (
              <>
                <View
                  pointerEvents="none"
                  className="absolute items-center justify-center rounded bg-zinc-700 px-1.5 py-0.5"
                  style={{ left: plotWidth + 2, top: crosshair.y - 8 }}>
                  <Text className="text-[10px] font-bold text-white">{crosshair.price.toFixed(2)}</Text>
                </View>
                <InspectTooltip candle={crosshair.candle} x={crosshair.x} plotWidth={plotWidth} />
              </>
            ) : null}
          </View>
        </View>
      </GestureDetector>

      {/* A physically separate touch strip over the price axis — dragging
          here can't conflict with any gesture on the candles themselves,
          since it's simply a different region of the screen. */}
      <GestureDetector gesture={axisGesture}>
        <View style={{ position: 'absolute', left: plotWidth, top: 0, width: PRICE_AXIS_WIDTH, height: plotHeight }} />
      </GestureDetector>

      <Modal visible={!!notePrompt} transparent animationType="fade" onRequestClose={() => setNotePrompt(null)}>
        <Pressable className="flex-1 items-center justify-center bg-black/40" onPress={() => setNotePrompt(null)}>
          <Pressable onPress={() => {}} className="w-4/5 gap-3 rounded-2xl bg-white p-4 dark:bg-zinc-900">
            <Text className="text-base font-medium text-zinc-900 dark:text-white">Add a note</Text>
            <TextInput
              value={noteText}
              onChangeText={setNoteText}
              placeholder="What's happening here?"
              placeholderTextColor="#a1a1aa"
              autoFocus
              maxLength={80}
              className="rounded-xl border border-zinc-200 px-3 py-2 text-base text-zinc-900 dark:border-zinc-700 dark:text-white"
            />
            <View className="flex-row justify-end gap-4">
              <Pressable onPress={() => setNotePrompt(null)}>
                <Text className="text-base text-zinc-400 dark:text-zinc-500">Cancel</Text>
              </Pressable>
              <Pressable onPress={submitNote} disabled={!noteText.trim()}>
                <Text className="text-base font-medium text-accent">Add</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
