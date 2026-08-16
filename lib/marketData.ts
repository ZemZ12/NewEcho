import { getApp } from '@react-native-firebase/app';
import { getFunctions, httpsCallable } from '@react-native-firebase/functions';

export type StockQuote = {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  previousClose: number;
};

export type StockCandle = { date: string; open: number; high: number; low: number; close: number; volume: number };

export type StockRange = '5m' | '1H' | '1D' | '1W' | '1M' | '3M' | '1Y';

export type StockChartData = {
  candles: StockCandle[];
  sma10: (number | null)[];
  sma50: (number | null)[];
  sma100: (number | null)[];
  sma200: (number | null)[];
  rsi14: (number | null)[];
  macd: { line: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] };
  // How many of the trailing candles make up the intended default
  // zoomed-out view — the rest is real history to pan into.
  defaultVisibleCount: number;
};

// Mirrors the server-side cache in functions/src/marketData.ts, just to
// avoid redundant calls when the same ticker appears in several messages
// on screen at once.
const CLIENT_QUOTE_CACHE_MS = 30_000;
const quoteCache = new Map<string, { data: StockQuote; expires: number }>();

export async function fetchStockQuote(symbol: string): Promise<StockQuote> {
  const cached = quoteCache.get(symbol);
  if (cached && cached.expires > Date.now()) return cached.data;

  const call = httpsCallable<{ symbol: string }, StockQuote>(getFunctions(getApp()), 'getStockQuote');
  const { data } = await call({ symbol });
  quoteCache.set(symbol, { data, expires: Date.now() + CLIENT_QUOTE_CACHE_MS });
  return data;
}

export async function fetchStockChartData(symbol: string, range: StockRange = '1M'): Promise<StockChartData> {
  const call = httpsCallable<{ symbol: string; range: StockRange }, StockChartData>(
    getFunctions(getApp()),
    'getStockCandles',
  );
  const { data } = await call({ symbol, range });
  return data;
}
