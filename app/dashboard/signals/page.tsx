import { supabase } from '@/lib/supabase';

export default async function SignalsDashboard() {
  const { data } = await supabase.from('signal_decisions').select('*').order('ts', { ascending: false }).limit(20);

  return (
    <section>
      <h2>Latest Signals</h2>
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
