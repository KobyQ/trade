import { ENGINE_DEFAULTS } from '@/config/constants';
import type { FeatureSnapshot, SignalOutput, StrategyConfig } from '@/types/domain';
import type { LlmProvider } from './llm-provider';

export async function generateSignal(
  feature: FeatureSnapshot,
  config: StrategyConfig,
  llmProvider?: LlmProvider,
): Promise<SignalOutput> {
  const reasons: string[] = [];
  const invalidation: string[] = [];

  const bullish = feature.ema50 > feature.ema200;
  const bearish = feature.ema50 < feature.ema200;
  const trendBias = bullish ? 'bullish' : bearish ? 'bearish' : 'neutral';

  const deterministicPassed = (
    feature.adx14 >= config.adxThreshold
    && feature.pullbackReclaimState !== 'none'
    && config.allowedSessions.includes(feature.sessionTag as 'asia' | 'london' | 'new_york')
  );

  if (!deterministicPassed || trendBias === 'neutral') {
    reasons.push('Deterministic filters failed or trend neutral');
    return {
      symbol: feature.symbol,
      timeframe: feature.timeframe,
      timestamp: feature.timestamp,
      setup_valid: false,
      bias: trendBias,
      setup_type: 'no_trade',
      entry: null,
      stop_loss: null,
      take_profit: null,
      risk_reward: null,
      confidence: 0.1,
      reasons,
      invalidation,
      deterministic_checks_passed: false,
      llm_used: false,
      raw_features_json: feature,
    };
  }

  const atr = Math.max(feature.atr14, 0.00001);
  const entry = feature.ema20;
  const stopDistance = atr * ENGINE_DEFAULTS.atrStopMultiplier;
  const stopLoss = trendBias === 'bullish' ? entry - stopDistance : entry + stopDistance;
  const takeProfit = trendBias === 'bullish' ? entry + stopDistance * 2 : entry - stopDistance * 2;
  const rr = Math.abs((takeProfit - entry) / (entry - stopLoss));

  let confidence = 0.6;
  reasons.push('Trend + ADX + pullback/reclaim criteria passed');
  invalidation.push('close through stop loss');
  invalidation.push('trend regime changes against bias');

  let llmUsed = false;

  const base: SignalOutput = {
    symbol: feature.symbol,
    timeframe: feature.timeframe,
    timestamp: feature.timestamp,
    setup_valid: rr >= config.minRiskReward,
    bias: trendBias,
    setup_type: trendBias === 'bullish' ? 'buy_setup' : 'sell_setup',
    entry,
    stop_loss: stopLoss,
    take_profit: takeProfit,
    risk_reward: rr,
    confidence,
    reasons,
    invalidation,
    deterministic_checks_passed: true,
    llm_used: false,
    raw_features_json: feature,
  };

  if (llmProvider) {
    llmUsed = true;
    const judgment = await llmProvider.evaluateCandidate({ features: feature, candidate: base });
    confidence = Math.min(1, Math.max(0, confidence + judgment.confidence_adjustment));
    reasons.push(...judgment.reasons);
    if (judgment.veto) {
      return {
        ...base,
        setup_valid: false,
        setup_type: 'no_trade',
        confidence,
        reasons,
        llm_used: llmUsed,
      };
    }
  }

  return { ...base, confidence, llm_used: llmUsed };
}
