import type { RiskDecision, SignalOutput, StrategyConfig } from '@/types/domain';

export interface RiskContext {
  openTrades: number;
  dailyRiskUsedPct: number;
  consecutiveLosses: number;
  duplicateWithinMinutes: boolean;
  nowIso: string;
}

function inNewsWindow(nowIso: string, windows: { start: string; end: string }[]): boolean {
  const now = new Date(nowIso).toISOString().slice(11, 16);
  return windows.some((w) => now >= w.start && now <= w.end);
}

export function evaluateRisk(
  signal: SignalOutput,
  config: StrategyConfig,
  context: RiskContext,
): RiskDecision {
  const violated: string[] = [];

  if (!config.enabled) violated.push('instrument_disabled');
  if (config.killSwitch) violated.push('kill_switch_enabled');
  if (context.openTrades >= config.maxOpenTrades) violated.push('max_open_trades_reached');
  if (context.dailyRiskUsedPct >= config.maxDailyRiskPct) violated.push('daily_risk_budget_exceeded');
  if (context.consecutiveLosses >= config.cooldownAfterLosses) violated.push('loss_cooldown_active');
  if (context.duplicateWithinMinutes) violated.push('duplicate_signal_blocker');
  if ((signal.risk_reward ?? 0) < config.minRiskReward) violated.push('min_risk_reward_failed');
  if (inNewsWindow(context.nowIso, config.newsWindowsUtc)) violated.push('news_window_block');
  if (!signal.setup_valid) violated.push('invalid_setup');

  return {
    approved: violated.length === 0,
    reasons: violated.length ? ['risk controls rejected signal'] : ['risk controls approved signal'],
    violatedGuards: violated,
  };
}
