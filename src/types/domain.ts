import { z } from 'zod';

export const timeframeSchema = z.enum(['M30']);
export type Timeframe = z.infer<typeof timeframeSchema>;

export const symbolSchema = z.enum(['XAUUSD', 'BTCUSD']);
export type SymbolCode = z.infer<typeof symbolSchema>;

export const candleSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  timestamp: z.string().datetime(),
  open: z.number().positive(),
  high: z.number().positive(),
  low: z.number().positive(),
  close: z.number().positive(),
  volume: z.number().nonnegative(),
});
export type Candle = z.infer<typeof candleSchema>;

export const featureSnapshotSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  timestamp: z.string().datetime(),
  ema20: z.number(),
  ema50: z.number(),
  ema200: z.number(),
  atr14: z.number().nonnegative(),
  adx14: z.number().nonnegative(),
  rsi14: z.number().nonnegative(),
  sessionTag: z.enum(['asia', 'london', 'new_york', 'off_hours']),
  volatilityRegime: z.enum(['low', 'normal', 'high']),
  trendRegime: z.enum(['uptrend', 'downtrend', 'range']),
  pullbackReclaimState: z.enum(['pullback', 'reclaim', 'none']),
});
export type FeatureSnapshot = z.infer<typeof featureSnapshotSchema>;

export const signalOutputSchema = z.object({
  symbol: symbolSchema,
  timeframe: timeframeSchema,
  timestamp: z.string().datetime(),
  setup_valid: z.boolean(),
  bias: z.enum(['bullish', 'bearish', 'neutral']),
  setup_type: z.enum(['no_trade', 'buy_setup', 'sell_setup']),
  entry: z.number().nullable(),
  stop_loss: z.number().nullable(),
  take_profit: z.number().nullable(),
  risk_reward: z.number().nullable(),
  confidence: z.number().min(0).max(1),
  reasons: z.array(z.string()),
  invalidation: z.array(z.string()),
  deterministic_checks_passed: z.boolean(),
  llm_used: z.boolean(),
  raw_features_json: z.record(z.string(), z.unknown()),
});

export type SignalOutput = z.infer<typeof signalOutputSchema>;

export const riskDecisionSchema = z.object({
  approved: z.boolean(),
  reasons: z.array(z.string()),
  violatedGuards: z.array(z.string()),
});

export type RiskDecision = z.infer<typeof riskDecisionSchema>;

export const strategyConfigSchema = z.object({
  id: z.string().uuid().optional(),
  instrumentSymbol: symbolSchema,
  timeframe: timeframeSchema,
  enabled: z.boolean().default(true),
  maxRiskPerTradePct: z.number(),
  maxDailyRiskPct: z.number(),
  maxOpenTrades: z.number().int().nonnegative(),
  cooldownAfterLosses: z.number().int().nonnegative(),
  cooldownMinutes: z.number().int().nonnegative(),
  minRiskReward: z.number(),
  adxThreshold: z.number(),
  killSwitch: z.boolean().default(false),
  allowedSessions: z.array(z.enum(['asia', 'london', 'new_york'])),
  newsWindowsUtc: z.array(z.object({ start: z.string(), end: z.string() })),
});

export type StrategyConfig = z.infer<typeof strategyConfigSchema>;
