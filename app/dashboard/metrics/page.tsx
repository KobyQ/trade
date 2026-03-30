import { supabase } from '@/lib/supabase';
import { summarizeOutcomes } from '@/services/evaluation-engine';

export default async function MetricsDashboard() {
  const { data } = await supabase.from('trade_outcomes').select('status,r_multiple,symbol').order('evaluated_at', { ascending: true });
  const summary = summarizeOutcomes((data ?? []).map((d) => ({ status: d.status, rMultiple: d.r_multiple, symbol: d.symbol })));

  return (
    <section>
      <h2>Performance Metrics</h2>
      <p>Win rate: {(summary.winRate * 100).toFixed(2)}%</p>
      <p>Expectancy: {summary.expectancy.toFixed(3)} R</p>
      <p>Closed signals: {summary.closed}</p>
      <p>Rolling 30 count: {summary.rolling30.length}</p>
    </section>
  );
}
