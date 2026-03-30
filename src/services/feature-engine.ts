import type { Candle, FeatureSnapshot } from '@/types/domain';

function ema(values: number[], period: number): number {
  const k = 2 / (period + 1);
  return values.reduce((acc, value, index) => {
    if (index === 0) return value;
    return value * k + acc * (1 - k);
  }, values[0]);
}

function trueRange(curr: Candle, prev: Candle): number {
  return Math.max(
    curr.high - curr.low,
    Math.abs(curr.high - prev.close),
    Math.abs(curr.low - prev.close),
  );
}

function atr14(candles: Candle[]): number {
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i += 1) {
    trs.push(trueRange(candles[i], candles[i - 1]));
  }
  const last14 = trs.slice(-14);
  return last14.reduce((sum, n) => sum + n, 0) / Math.max(last14.length, 1);
}

function rsi14(candles: Candle[]): number {
  const deltas = candles.slice(1).map((c, i) => c.close - candles[i].close);
  const last14 = deltas.slice(-14);
  const gains = last14.filter((d) => d > 0).reduce((a, b) => a + b, 0);
  const losses = Math.abs(last14.filter((d) => d < 0).reduce((a, b) => a + b, 0));
  if (losses === 0) return 100;
  const rs = gains / losses;
  return 100 - 100 / (1 + rs);
}

function adx14(candles: Candle[]): number {
  if (candles.length < 15) return 0;
  const moves = candles.slice(1).map((c, i) => Math.abs(c.close - candles[i].close));
  const baseline = candles.slice(1).map((c, i) => Math.max(0.0000001, candles[i].high - candles[i].low));
  const dmAvg = moves.slice(-14).reduce((a, b) => a + b, 0) / 14;
  const trAvg = baseline.slice(-14).reduce((a, b) => a + b, 0) / 14;
  return Math.min(100, (dmAvg / trAvg) * 40);
}

function sessionTag(timestamp: string): FeatureSnapshot['sessionTag'] {
  const hour = new Date(timestamp).getUTCHours();
  if (hour >= 0 && hour < 7) return 'asia';
  if (hour >= 7 && hour < 13) return 'london';
  if (hour >= 13 && hour < 21) return 'new_york';
  return 'off_hours';
}

export function computeFeatureSnapshot(candles: Candle[]): FeatureSnapshot {
  const latest = candles[candles.length - 1];
  const closes = candles.map((c) => c.close);
  const ema20 = ema(closes.slice(-40), 20);
  const ema50 = ema(closes.slice(-100), 50);
  const ema200 = ema(closes.slice(-250), 200);
  const atr = atr14(candles);
  const adx = adx14(candles);
  const rsi = rsi14(candles);

  const trendRegime = ema50 > ema200 ? 'uptrend' : ema50 < ema200 ? 'downtrend' : 'range';
  const pullbackReclaimState = latest.close > ema20 && candles[candles.length - 2].close < ema20 ? 'reclaim' :
    latest.close < ema20 ? 'pullback' : 'none';

  const volatilityRegime = atr > latest.close * 0.01 ? 'high' : atr < latest.close * 0.002 ? 'low' : 'normal';

  return {
    symbol: latest.symbol,
    timeframe: latest.timeframe,
    timestamp: latest.timestamp,
    ema20,
    ema50,
    ema200,
    atr14: atr,
    adx14: adx,
    rsi14: rsi,
    sessionTag: sessionTag(latest.timestamp),
    volatilityRegime,
    trendRegime,
    pullbackReclaimState,
  };
}
