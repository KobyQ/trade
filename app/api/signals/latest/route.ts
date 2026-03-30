import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol');
  const timeframe = searchParams.get('timeframe');
  const status = searchParams.get('status');

  let query = supabase.from('signal_decisions').select('*').order('ts', { ascending: false }).limit(50);
  if (symbol) query = query.eq('symbol', symbol);
  if (timeframe) query = query.eq('timeframe', timeframe);
  if (status) query = query.eq('status', status);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}
