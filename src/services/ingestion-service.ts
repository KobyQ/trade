import type { MarketDataProvider } from '@/providers/market-data';
import type { Candle, SymbolCode, Timeframe } from '@/types/domain';
import { log } from '@/lib/logger';

export interface CandleRepository {
  upsertCandles(candles: Candle[]): Promise<void>;
  getLastTimestamp(symbol: SymbolCode, timeframe: Timeframe): Promise<string | null>;
}

export class IngestionService {
  constructor(private readonly provider: MarketDataProvider, private readonly repo: CandleRepository) {}

  async ingest(symbol: SymbolCode, timeframe: Timeframe, limit: number): Promise<{ inserted: number; gaps: number }> {
    const candles = await this.retry(() => this.provider.fetchCandles({ symbol, timeframe, limit }), 2);
    const deduped = this.deduplicate(candles);
    const gaps = this.detectGaps(deduped);

    await this.repo.upsertCandles(deduped);
    log('info', 'ingestion.completed', { symbol, timeframe, inserted: deduped.length, gaps });
    return { inserted: deduped.length, gaps };
  }

  private deduplicate(candles: Candle[]): Candle[] {
    const map = new Map<string, Candle>();
    for (const candle of candles) {
      map.set(`${candle.symbol}:${candle.timeframe}:${candle.timestamp}`, candle);
    }
    return Array.from(map.values()).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  private detectGaps(candles: Candle[]): number {
    let gaps = 0;
    for (let i = 1; i < candles.length; i += 1) {
      const prev = new Date(candles[i - 1].timestamp).getTime();
      const curr = new Date(candles[i].timestamp).getTime();
      const diffMin = (curr - prev) / 60000;
      if (diffMin > 30.5) gaps += 1;
    }
    return gaps;
  }

  private async retry<T>(fn: () => Promise<T>, retries: number): Promise<T> {
    let lastErr: unknown;
    for (let i = 0; i <= retries; i += 1) {
      try {
        return await fn();
      } catch (error) {
        lastErr = error;
        log('warn', 'ingestion.retry', { attempt: i + 1, error: String(error) });
      }
    }
    throw lastErr;
  }
}
