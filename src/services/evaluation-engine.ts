import type { Candle, SignalOutput } from '@/types/domain';

export type OutcomeStatus = 'pending' | 'won' | 'lost' | 'invalidated' | 'expired';

export interface OutcomeResult {
  status: OutcomeStatus;
  rMultiple: number;
}

export function evaluateOutcome(signal: SignalOutput, candlesAfter: Candle[], maxBars = 48): OutcomeResult {
  if (!signal.entry || !signal.stop_loss || !signal.take_profit || signal.setup_type === 'no_trade') {
    return { status: 'invalidated', rMultiple: 0 };
  }

  const risk = Math.abs(signal.entry - signal.stop_loss);
  const relevant = candlesAfter.slice(0, maxBars);

  for (const candle of relevant) {
    if (signal.setup_type === 'buy_setup') {
      if (candle.low <= signal.stop_loss) return { status: 'lost', rMultiple: -1 };
      if (candle.high >= signal.take_profit) return { status: 'won', rMultiple: Math.abs(signal.take_profit - signal.entry) / risk };
    } else {
      if (candle.high >= signal.stop_loss) return { status: 'lost', rMultiple: -1 };
      if (candle.low <= signal.take_profit) return { status: 'won', rMultiple: Math.abs(signal.entry - signal.take_profit) / risk };
    }
  }

  return relevant.length < maxBars ? { status: 'pending', rMultiple: 0 } : { status: 'expired', rMultiple: 0 };
}

export function summarizeOutcomes(outcomes: Array<{ status: OutcomeStatus; rMultiple: number; symbol: string }>) {
  const closed = outcomes.filter((o) => o.status === 'won' || o.status === 'lost');
  const wins = closed.filter((o) => o.status === 'won').length;
  const winRate = closed.length === 0 ? 0 : wins / closed.length;
  const expectancy = closed.length === 0 ? 0 : closed.reduce((sum, o) => sum + o.rMultiple, 0) / closed.length;

  const bySymbol = Object.groupBy(outcomes, (o) => o.symbol);

  return {
    total: outcomes.length,
    closed: closed.length,
    winRate,
    expectancy,
    rolling30: outcomes.slice(-30),
    bySymbol,
  };
}
