create extension if not exists "pgcrypto";

create table if not exists instruments (
  id uuid primary key default gen_random_uuid(),
  symbol text not null unique,
  display_name text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists market_candles (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  ts timestamptz not null,
  open numeric not null,
  high numeric not null,
  low numeric not null,
  close numeric not null,
  volume numeric not null,
  created_at timestamptz not null default now(),
  unique(symbol, timeframe, ts)
);

create table if not exists indicator_snapshots (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  ts timestamptz not null,
  ema20 numeric not null,
  ema50 numeric not null,
  ema200 numeric not null,
  atr14 numeric not null,
  adx14 numeric not null,
  rsi14 numeric not null,
  session_tag text not null,
  volatility_regime text not null,
  trend_regime text not null,
  pullback_reclaim_state text not null,
  raw_json jsonb not null,
  created_at timestamptz not null default now(),
  unique(symbol, timeframe, ts)
);

create table if not exists signal_runs (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  timeframe text not null,
  run_ts timestamptz not null default now(),
  market_snapshot_json jsonb not null,
  features_json jsonb not null,
  deterministic_filters_json jsonb,
  ai_output_json jsonb,
  final_signal_json jsonb not null,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists signal_decisions (
  id uuid primary key default gen_random_uuid(),
  signal_run_id uuid not null references signal_runs(id) on delete cascade,
  symbol text not null,
  timeframe text not null,
  ts timestamptz not null,
  setup_valid boolean not null,
  bias text not null,
  setup_type text not null,
  entry numeric,
  stop_loss numeric,
  take_profit numeric,
  risk_reward numeric,
  confidence numeric not null,
  reasons text[] not null,
  invalidation text[] not null,
  deterministic_checks_passed boolean not null,
  llm_used boolean not null,
  raw_features_json jsonb not null,
  approved_by_risk boolean not null,
  risk_reasons text[] not null,
  status text not null check (status in ('pending','won','lost','invalidated','expired')),
  created_at timestamptz not null default now()
);

create table if not exists trade_outcomes (
  id uuid primary key default gen_random_uuid(),
  signal_decision_id uuid not null unique references signal_decisions(id) on delete cascade,
  symbol text not null,
  timeframe text not null,
  status text not null check (status in ('pending','won','lost','invalidated','expired')),
  r_multiple numeric not null default 0,
  evaluated_at timestamptz not null default now(),
  details_json jsonb not null default '{}'::jsonb
);

create table if not exists risk_events (
  id uuid primary key default gen_random_uuid(),
  symbol text,
  timeframe text,
  event_type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists strategy_configs (
  id uuid primary key default gen_random_uuid(),
  instrument_symbol text not null,
  timeframe text not null,
  enabled boolean not null default true,
  max_risk_per_trade_pct numeric not null,
  max_daily_risk_pct numeric not null,
  max_open_trades int not null,
  cooldown_after_losses int not null,
  cooldown_minutes int not null,
  min_risk_reward numeric not null,
  adx_threshold numeric not null,
  kill_switch boolean not null default false,
  allowed_sessions text[] not null,
  news_windows_utc jsonb not null,
  updated_at timestamptz not null default now(),
  unique(instrument_symbol, timeframe)
);

create table if not exists system_jobs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  status text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  details_json jsonb not null default '{}'::jsonb
);

create index if not exists idx_market_candles_symbol_tf_ts on market_candles(symbol, timeframe, ts desc);
create index if not exists idx_signal_decisions_symbol_tf_ts on signal_decisions(symbol, timeframe, ts desc);
create index if not exists idx_trade_outcomes_status on trade_outcomes(status);
