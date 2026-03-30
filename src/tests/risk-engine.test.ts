import { describe, expect, it } from 'vitest';
import { evaluateRisk } from '@/services/risk-engine';
import type { SignalOutput, StrategyConfig } from '@/types/domain';

const cfg: StrategyConfig = {
  instrumentSymbol: 'XAUUSD',
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

const signal: SignalOutput = {
  symbol: 'XAUUSD',
  timeframe: 'M30',
  timestamp: new Date().toISOString(),
  setup_valid: true,
  bias: 'bullish',
  setup_type: 'buy_setup',
  entry: 2700,
  stop_loss: 2695,
  take_profit: 2710,
  risk_reward: 2,
  confidence: 0.7,
  reasons: [],
  invalidation: [],
  deterministic_checks_passed: true,
  llm_used: false,
  raw_features_json: {},
};

describe('risk engine', () => {
  it('approves clean signal', () => {
    const decision = evaluateRisk(signal, cfg, {
      openTrades: 0,
      dailyRiskUsedPct: 0,
      consecutiveLosses: 0,
      duplicateWithinMinutes: false,
      nowIso: '2026-03-30T10:00:00.000Z',
    });
    expect(decision.approved).toBe(true);
  });

  it('rejects with kill switch', () => {
    const decision = evaluateRisk(signal, { ...cfg, killSwitch: true }, {
      openTrades: 0,
      dailyRiskUsedPct: 0,
      consecutiveLosses: 0,
      duplicateWithinMinutes: false,
      nowIso: '2026-03-30T10:00:00.000Z',
    });
    expect(decision.approved).toBe(false);
    expect(decision.violatedGuards).toContain('kill_switch_enabled');
  });
});
