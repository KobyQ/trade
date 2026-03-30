import { supabase } from '@/lib/supabase';

export default async function SignalsDashboard({
  searchParams,
}: {
  searchParams: Promise<{ symbol?: string; timeframe?: string; status?: string }>;
}) {
  const params = await searchParams;
  let query = supabase.from('signal_decisions').select('*').order('ts', { ascending: false }).limit(50);
  if (params.symbol) query = query.eq('symbol', params.symbol);
  if (params.timeframe) query = query.eq('timeframe', params.timeframe);
  if (params.status) query = query.eq('status', params.status);
  const { data } = await query;

  return (
    <section>
      <h2>Latest Signals (Phase 1)</h2>
      <p>Filters: symbol/timeframe/status via query params.</p>
      <table>
        <thead><tr><th>Time</th><th>Symbol</th><th>Type</th><th>Status</th><th>RR</th></tr></thead>
        <tbody>
          {(data ?? []).map((row) => (
            <tr key={row.id}>
              <td>{row.ts}</td>
              <td>{row.symbol}</td>
              <td>{row.setup_type}</td>
              <td>{row.status}</td>
              <td>{row.risk_reward ?? '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
