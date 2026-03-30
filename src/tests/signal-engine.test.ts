import { describe, expect, it } from 'vitest';
import { generateSignal } from '@/services/signal-engine';
import type { FeatureSnapshot, StrategyConfig } from '@/types/domain';
import type { LlmProvider } from '@/services/llm-provider';

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
    expect(signal.llm_used).toBe(false);
  });

  it('returns no_trade when adx below threshold', async () => {
    const signal = await generateSignal({ ...baseFeature, adx14: 5 }, config);
    expect(signal.setup_type).toBe('no_trade');
    expect(signal.setup_valid).toBe(false);
  });

  it('supports optional llm veto through provider interface', async () => {
    const vetoProvider: LlmProvider = {
      async evaluateCandidate() {
        return {
          confidence_adjustment: -0.2,
          reasons: ['low macro conviction'],
          veto: true,
        };
      },
    };

    const signal = await generateSignal(baseFeature, config, vetoProvider);
    expect(signal.setup_type).toBe('no_trade');
    expect(signal.setup_valid).toBe(false);
    expect(signal.llm_used).toBe(true);
    expect(signal.reasons).toContain('low macro conviction');
  });
});
