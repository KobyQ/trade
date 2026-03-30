import { supabase } from '@/lib/supabase';

export default async function ConfigDashboard() {
  const { data } = await supabase.from('strategy_configs').select('*').order('instrument_symbol');

  return (
    <section>
      <h2>Strategy Configuration</h2>
      <table>
        <thead><tr><th>Symbol</th><th>Enabled</th><th>Kill switch</th><th>Min RR</th><th>ADX threshold</th></tr></thead>
        <tbody>
          {(data ?? []).map((cfg) => (
            <tr key={cfg.id}>
              <td>{cfg.instrument_symbol}</td>
              <td>{String(cfg.enabled)}</td>
              <td>{String(cfg.kill_switch)}</td>
              <td>{cfg.min_risk_reward}</td>
              <td>{cfg.adx_threshold}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p>Manual enable/disable per instrument is controlled by strategy_configs.enabled.</p>
    </section>
  );
}
