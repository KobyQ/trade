import { describe, expect, it } from 'vitest';
import { MockMarketDataProvider } from '@/providers/market-data';
import { IngestionService } from '@/services/ingestion-service';
import { computeFeatureSnapshot } from '@/services/feature-engine';
import { generateSignal } from '@/services/signal-engine';
import { evaluateRisk } from '@/services/risk-engine';
import type { Candle, StrategyConfig } from '@/types/domain';

class InMemoryRepo {
  candles: Candle[] = [];

  async upsertCandles(candles: Candle[]): Promise<void> {
    this.candles = candles;
  }

  async getLastTimestamp(): Promise<string | null> {
    return this.candles.at(-1)?.timestamp ?? null;
  }
}

describe('happy path integration', () => {
  it('runs ingestion -> features -> signal -> risk', async () => {
    const provider = new MockMarketDataProvider();
    const repo = new InMemoryRepo();
    const ingestion = new IngestionService(provider, repo);

    await ingestion.ingest('BTCUSD', 'M30', 280);
    const feature = computeFeatureSnapshot(repo.candles);

    const config: StrategyConfig = {
      instrumentSymbol: 'BTCUSD',
      timeframe: 'M30',
      enabled: true,
      maxRiskPerTradePct: 0.5,
      maxDailyRiskPct: 2,
      maxOpenTrades: 3,
      cooldownAfterLosses: 3,
      cooldownMinutes: 180,
      minRiskReward: 1.5,
      adxThreshold: 20,
      killSwitch: false,
      allowedSessions: ['asia', 'london', 'new_york'],
      newsWindowsUtc: [],
    };

    const signal = await generateSignal(feature, config);
    const risk = evaluateRisk(signal, config, {
      openTrades: 0,
      dailyRiskUsedPct: 0,
      consecutiveLosses: 0,
      duplicateWithinMinutes: false,
      nowIso: new Date().toISOString(),
    });

    expect(feature.symbol).toBe('BTCUSD');
    expect(['no_trade', 'buy_setup', 'sell_setup']).toContain(signal.setup_type);
    expect(typeof risk.approved).toBe('boolean');
  });
});
