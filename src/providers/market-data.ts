import type { Candle, SymbolCode, Timeframe } from '@/types/domain';

export interface MarketDataProvider {
  fetchCandles(input: { symbol: SymbolCode; timeframe: Timeframe; limit: number }): Promise<Candle[]>;
}

function isoFromIndex(index: number): string {
  const now = Date.now();
  return new Date(now - index * 30 * 60 * 1000).toISOString();
}

export class MockMarketDataProvider implements MarketDataProvider {
  async fetchCandles({ symbol, timeframe, limit }: { symbol: SymbolCode; timeframe: Timeframe; limit: number }): Promise<Candle[]> {
    const seed = symbol === 'XAUUSD' ? 2700 : 65000;
    const candles: Candle[] = [];
    for (let i = limit; i > 0; i -= 1) {
      const drift = Math.sin(i / 10) * (seed * 0.001);
      const base = seed + drift + (limit - i) * (symbol === 'XAUUSD' ? 0.2 : 4);
      candles.push({
        symbol,
        timeframe,
        timestamp: isoFromIndex(i),
        open: base,
        high: base * 1.001,
        low: base * 0.999,
        close: base * (1 + Math.sin(i / 7) * 0.0005),
        volume: Math.max(1, 1000 + Math.cos(i / 5) * 100),
      });
    }
    return candles;
  }
}

export class AlphaVantageProvider implements MarketDataProvider {
  constructor(private readonly apiKey: string) {}

  async fetchCandles(input: { symbol: SymbolCode; timeframe: Timeframe; limit: number }): Promise<Candle[]> {
    void input;

    if (!this.apiKey) {
      throw new Error('ALPHA_VANTAGE_API_KEY missing');
    }

    throw new Error('AlphaVantage provider integration is intentionally left as pluggable interface for MVP');
  }
}
