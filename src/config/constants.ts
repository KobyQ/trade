export const DEFAULT_TIMEFRAME = 'M30';
export const DEFAULT_SYMBOLS = ['XAUUSD', 'BTCUSD'] as const;

export const ENGINE_DEFAULTS = {
  adxThreshold: 20,
  minRiskReward: 1.5,
  atrStopMultiplier: 1.2,
  maxRiskPerTradePct: 0.5,
  maxDailyRiskPct: 2,
  maxOpenTrades: 3,
  cooldownLosses: 3,
  cooldownMinutes: 180,
};
