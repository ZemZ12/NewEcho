import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall } from 'firebase-functions/v2/https';

import { macd, rsi, sma } from './indicators';

const twelveDataApiKey = defineSecret('TWELVE_DATA_API_KEY');

type Quote = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  previousClose: number;
};

type Candle = { date: string; open: number; high: number; low: number; close: number; volume: number };

type ChartData = {
  candles: Candle[];
  sma10: (number | null)[];
  sma50: (number | null)[];
  sma100: (number | null)[];
  sma200: (number | null)[];
  rsi14: (number | null)[];
  macd: { line: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] };
  // How many of the trailing (most recent) candles make up the intended
  // default zoomed-out view — the rest is real fetched history included
  // purely so panning left has real data to scroll into instead of
  // hitting a dead stop almost immediately.
  defaultVisibleCount: number;
};

// Twelve Data's free tier is 8 requests/minute, 800/day, and this data is
// already delayed — so caching per instance well past the request itself is
// both safe and necessary to avoid multiple users looking at the same ticker
// from burning through the quota.
const QUOTE_CACHE_MS = 60_000;
const quoteCache = new Map<string, { data: Quote; expires: number }>();
const candlesCache = new Map<string, { data: ChartData; expires: number }>();

const RANGE_CONFIG = {
  '5m': { interval: '5min', outputsize: 120, cacheMs: 2 * 60_000 },
  '1H': { interval: '1h', outputsize: 90, cacheMs: 10 * 60_000 },
  '1D': { interval: '5min', outputsize: 80, cacheMs: 2 * 60_000 },
  '1W': { interval: '1h', outputsize: 40, cacheMs: 10 * 60_000 },
  '1M': { interval: '1day', outputsize: 30, cacheMs: 60 * 60_000 },
  '3M': { interval: '1day', outputsize: 90, cacheMs: 60 * 60_000 },
  '1Y': { interval: '1week', outputsize: 52, cacheMs: 60 * 60_000 },
} as const;
type Range = keyof typeof RANGE_CONFIG;

// Extra history fetched (but not displayed) purely so SMA200/RSI/MACD have
// enough lookback to produce a real value across the whole visible window,
// not just its tail end. Free since it's the same single API request —
// outputsize is just "how many rows", not extra calls.
const LOOKBACK_BUFFER = 210;

function normalizeSymbol(raw: unknown): string {
  const symbol = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  if (!/^[A-Z]{1,5}$/.test(symbol)) {
    throw new HttpsError('invalid-argument', 'Invalid ticker symbol.');
  }
  return symbol;
}

function normalizeRange(raw: unknown): Range {
  return typeof raw === 'string' && raw in RANGE_CONFIG ? (raw as Range) : '1M';
}

export const getStockQuote = onCall({ secrets: [twelveDataApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before requesting market data.');
  }
  const symbol = normalizeSymbol(request.data?.symbol);

  const cached = quoteCache.get(symbol);
  if (cached && cached.expires > Date.now()) return cached.data;

  const res = await fetch(
    `https://api.twelvedata.com/quote?symbol=${symbol}&apikey=${twelveDataApiKey.value()}`,
  );
  const json = (await res.json()) as Record<string, string>;
  if (json.status === 'error' || json.code) {
    throw new HttpsError('not-found', json.message ?? `Could not find a quote for ${symbol}.`);
  }

  const quote: Quote = {
    symbol,
    price: Number(json.close),
    change: Number(json.change),
    percentChange: Number(json.percent_change),
    previousClose: Number(json.previous_close),
  };
  quoteCache.set(symbol, { data: quote, expires: Date.now() + QUOTE_CACHE_MS });
  return quote;
});

export const getStockCandles = onCall({ secrets: [twelveDataApiKey] }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in before requesting market data.');
  }
  const symbol = normalizeSymbol(request.data?.symbol);
  const range = normalizeRange(request.data?.range);
  const config = RANGE_CONFIG[range];
  const cacheKey = `${symbol}:${range}`;

  const cached = candlesCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.data;

  const fetchSize = config.outputsize + LOOKBACK_BUFFER;
  const res = await fetch(
    `https://api.twelvedata.com/time_series?symbol=${symbol}&interval=${config.interval}&outputsize=${fetchSize}&apikey=${twelveDataApiKey.value()}`,
  );
  const json = (await res.json()) as {
    status?: string;
    message?: string;
    values?: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }[];
  };
  if (json.status === 'error' || !json.values) {
    throw new HttpsError('not-found', json.message ?? `Could not find history for ${symbol}.`);
  }

  const allCandles: Candle[] = json.values
    .map((value) => ({
      date: value.datetime,
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
      volume: Number(value.volume ?? 0),
    }))
    .reverse();

  const closes = allCandles.map((candle) => candle.close);
  const sma10 = sma(closes, 10);
  const sma50 = sma(closes, 50);
  const sma100 = sma(closes, 100);
  const sma200 = sma(closes, 200);
  const rsi14 = rsi(closes, 14);
  const macdResult = macd(closes);

  // The full fetched set (visible window + lookback buffer) goes to the
  // client as real, pannable history — only the *default* on-open zoom
  // level is capped to outputsize, not what's actually available to scroll
  // into.
  const data: ChartData = {
    candles: allCandles,
    sma10,
    sma50,
    sma100,
    sma200,
    rsi14,
    macd: macdResult,
    defaultVisibleCount: Math.min(config.outputsize, allCandles.length),
  };
  candlesCache.set(cacheKey, { data, expires: Date.now() + config.cacheMs });
  return data;
});
