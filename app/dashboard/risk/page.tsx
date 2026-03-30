import { supabase } from '@/lib/supabase';

export default async function RiskDashboard() {
  const { data } = await supabase.from('risk_events').select('*').order('created_at', { ascending: false }).limit(30);

  return (
    <section>
      <h2>Risk Events / System Health</h2>
      <ul>
        {(data ?? []).map((event) => (
          <li key={event.id}>{event.created_at} - {event.event_type} - {event.message}</li>
        ))}
      </ul>
    </section>
  );
}
