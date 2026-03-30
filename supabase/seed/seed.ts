import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for seed');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });

async function run() {
  await supabase.from('instruments').upsert([
    { symbol: 'XAUUSD', display_name: 'Gold Spot / USD', enabled: true },
    { symbol: 'BTCUSD', display_name: 'Bitcoin / USD', enabled: true },
  ], { onConflict: 'symbol' });

  await supabase.from('strategy_configs').upsert([
    {
      instrument_symbol: 'XAUUSD',
      timeframe: 'M30',
      enabled: true,
      max_risk_per_trade_pct: 0.5,
      max_daily_risk_pct: 2,
      max_open_trades: 3,
      cooldown_after_losses: 3,
      cooldown_minutes: 180,
      min_risk_reward: 1.5,
      adx_threshold: 20,
      kill_switch: false,
      allowed_sessions: ['london', 'new_york'],
      news_windows_utc: [{ start: '12:25', end: '12:45' }],
    },
    {
      instrument_symbol: 'BTCUSD',
      timeframe: 'M30',
      enabled: true,
      max_risk_per_trade_pct: 0.5,
      max_daily_risk_pct: 2,
      max_open_trades: 3,
      cooldown_after_losses: 3,
      cooldown_minutes: 180,
      min_risk_reward: 1.5,
      adx_threshold: 20,
      kill_switch: false,
      allowed_sessions: ['asia', 'london', 'new_york'],
      news_windows_utc: [],
    },
  ], { onConflict: 'instrument_symbol,timeframe' });

  console.log('Seed complete');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
