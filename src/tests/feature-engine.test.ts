import { describe, expect, it } from 'vitest';
import { computeFeatureSnapshot } from '@/services/feature-engine';
import type { Candle } from '@/types/domain';

function buildCandles(startIso: string, count: number, startPrice: number, step: number): Candle[] {
  const startTs = new Date(startIso).getTime();
  const candles: Candle[] = [];

  for (let i = 0; i < count; i += 1) {
    const price = startPrice + i * step;
    candles.push({
      symbol: 'BTCUSD',
      timeframe: 'M30',
      timestamp: new Date(startTs + i * 30 * 60 * 1000).toISOString(),
      open: price,
      high: price + 10,
      low: price - 10,
      close: price + 4,
      volume: 1_000 + i,
    });
  }

  return candles;
}

describe('feature engine', () => {
  it('computes deterministic trend and session states from candle history', () => {
    const candles = buildCandles('2026-03-30T00:00:00.000Z', 280, 65_000, 5);
    const feature = computeFeatureSnapshot(candles);

    expect(feature.symbol).toBe('BTCUSD');
    expect(feature.timeframe).toBe('M30');
    expect(feature.ema20).toBeGreaterThan(feature.ema50);
    expect(feature.ema50).toBeGreaterThan(feature.ema200);
    expect(feature.trendRegime).toBe('uptrend');
    expect(feature.pullbackReclaimState).toBe('none');
    expect(feature.sessionTag).toBe('new_york');
    expect(feature.adx14).toBeGreaterThan(0);
    expect(feature.rsi14).toBeGreaterThan(50);
  });
});
