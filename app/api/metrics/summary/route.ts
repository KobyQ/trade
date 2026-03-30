import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { summarizeOutcomes } from '@/services/evaluation-engine';

export async function GET() {
  const { data, error } = await supabase
    .from('trade_outcomes')
    .select('status,r_multiple,symbol')
    .order('evaluated_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = summarizeOutcomes((data ?? []).map((row) => ({
    status: row.status,
    rMultiple: row.r_multiple,
    symbol: row.symbol,
  })));

  return NextResponse.json({ data: summary });
}
