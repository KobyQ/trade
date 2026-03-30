import { supabase } from '@/lib/supabase';
import type { Candle, SymbolCode, Timeframe } from '@/types/domain';

export class SupabaseCandleRepository {
  async upsertCandles(candles: Candle[]): Promise<void> {
    const rows = candles.map((c) => ({
      symbol: c.symbol,
      timeframe: c.timeframe,
      ts: c.timestamp,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
    }));

    const { error } = await supabase.from('market_candles').upsert(rows, { onConflict: 'symbol,timeframe,ts' });
    if (error) throw error;
  }

  async getLastTimestamp(symbol: SymbolCode, timeframe: Timeframe): Promise<string | null> {
    const { data, error } = await supabase.from('market_candles')
      .select('ts')
      .eq('symbol', symbol)
      .eq('timeframe', timeframe)
      .order('ts', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data?.ts ?? null;
  }

  async getRecent(symbol: SymbolCode, timeframe: Timeframe, limit: number): Promise<Candle[]> {
    const { data, error } = await supabase.from('market_candles')
      .select('*')
      .eq('symbol', symbol)
      .eq('timeframe', timeframe)
      .order('ts', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map((row) => ({
      symbol: row.symbol,
      timeframe: row.timeframe,
      timestamp: row.ts,
      open: row.open,
      high: row.high,
      low: row.low,
      close: row.close,
      volume: row.volume,
    })).reverse();
  }
}
