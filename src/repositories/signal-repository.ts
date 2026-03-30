import type { Candle, FeatureSnapshot, RiskDecision, SignalOutput, StrategyConfig, SymbolCode, Timeframe } from '@/types/domain';
import { supabase } from '@/lib/supabase';

export class SignalRepository {
  async getStrategyConfig(symbol: SymbolCode, timeframe: Timeframe): Promise<StrategyConfig> {
    const { data, error } = await supabase
      .from('strategy_configs')
      .select('*')
      .eq('instrument_symbol', symbol)
      .eq('timeframe', timeframe)
      .single();
    if (error || !data) throw new Error(`strategy config missing: ${error?.message ?? 'unknown'}`);

    return {
      instrumentSymbol: data.instrument_symbol,
      timeframe: data.timeframe,
      enabled: data.enabled,
      maxRiskPerTradePct: data.max_risk_per_trade_pct,
      maxDailyRiskPct: data.max_daily_risk_pct,
      maxOpenTrades: data.max_open_trades,
      cooldownAfterLosses: data.cooldown_after_losses,
      cooldownMinutes: data.cooldown_minutes,
      minRiskReward: data.min_risk_reward,
      adxThreshold: data.adx_threshold,
      killSwitch: data.kill_switch,
      allowedSessions: data.allowed_sessions,
      newsWindowsUtc: data.news_windows_utc,
    };
  }

  async saveFeatureSnapshot(feature: FeatureSnapshot): Promise<void> {
    const { error } = await supabase.from('indicator_snapshots').insert({
      symbol: feature.symbol,
      timeframe: feature.timeframe,
      ts: feature.timestamp,
      ema20: feature.ema20,
      ema50: feature.ema50,
      ema200: feature.ema200,
      atr14: feature.atr14,
      adx14: feature.adx14,
      rsi14: feature.rsi14,
      session_tag: feature.sessionTag,
      volatility_regime: feature.volatilityRegime,
      trend_regime: feature.trendRegime,
      pullback_reclaim_state: feature.pullbackReclaimState,
      raw_json: feature,
    });
    if (error) throw error;
  }

  async logSignalRun(payload: {
    symbol: SymbolCode;
    timeframe: Timeframe;
    marketSnapshot: Candle[];
    features: FeatureSnapshot;
    deterministicResult: unknown;
    aiOutput: unknown;
    finalSignal: SignalOutput;
    errorMessage?: string;
  }): Promise<string> {
    const { data, error } = await supabase.from('signal_runs').insert({
      symbol: payload.symbol,
      timeframe: payload.timeframe,
      market_snapshot_json: payload.marketSnapshot,
      features_json: payload.features,
      deterministic_filters_json: payload.deterministicResult,
      ai_output_json: payload.aiOutput,
      final_signal_json: payload.finalSignal,
      error_message: payload.errorMessage ?? null,
    }).select('id').single();

    if (error || !data) throw new Error(`failed to insert signal run: ${error?.message ?? 'unknown'}`);
    return data.id as string;
  }

  async saveDecision(runId: string, signal: SignalOutput, risk: RiskDecision): Promise<string> {
    const { data, error } = await supabase.from('signal_decisions').insert({
      signal_run_id: runId,
      symbol: signal.symbol,
      timeframe: signal.timeframe,
      ts: signal.timestamp,
      setup_valid: signal.setup_valid,
      bias: signal.bias,
      setup_type: signal.setup_type,
      entry: signal.entry,
      stop_loss: signal.stop_loss,
      take_profit: signal.take_profit,
      risk_reward: signal.risk_reward,
      confidence: signal.confidence,
      reasons: signal.reasons,
      invalidation: signal.invalidation,
      deterministic_checks_passed: signal.deterministic_checks_passed,
      llm_used: signal.llm_used,
      raw_features_json: signal.raw_features_json,
      approved_by_risk: risk.approved,
      risk_reasons: risk.reasons,
      status: risk.approved ? 'pending' : 'invalidated',
    }).select('id').single();

    if (error || !data) throw new Error(`failed to save signal decision: ${error?.message ?? 'unknown'}`);
    return data.id as string;
  }
}
