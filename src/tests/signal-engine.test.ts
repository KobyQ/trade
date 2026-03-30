import { describe, expect, it } from 'vitest';
import { generateSignal } from '@/services/signal-engine';
import type { FeatureSnapshot, StrategyConfig } from '@/types/domain';

const baseFeature: FeatureSnapshot = {
  symbol: 'BTCUSD',
  timeframe: 'M30',
  timestamp: new Date().toISOString(),
  ema20: 100,
  ema50: 105,
  ema200: 95,
  atr14: 2,
  adx14: 28,
  rsi14: 55,
  sessionTag: 'london',
  volatilityRegime: 'normal',
  trendRegime: 'uptrend',
  pullbackReclaimState: 'reclaim',
};

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
  allowedSessions: ['london', 'new_york'],
  newsWindowsUtc: [],
};

describe('signal engine', () => {
  it('creates buy setup when deterministic checks pass', async () => {
    const signal = await generateSignal(baseFeature, config);
    expect(signal.setup_type).toBe('buy_setup');
    expect(signal.setup_valid).toBe(true);
    expect(signal.deterministic_checks_passed).toBe(true);
  });

  it('returns no_trade when adx below threshold', async () => {
    const signal = await generateSignal({ ...baseFeature, adx14: 5 }, config);
    expect(signal.setup_type).toBe('no_trade');
    expect(signal.setup_valid).toBe(false);
  });
});
