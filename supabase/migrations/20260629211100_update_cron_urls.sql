-- 000215_update_cron_urls.sql
-- Update the existing cron jobs to use the dynamic environment URL 

select cron.schedule(
  'daily_research',
  '30 13 * * 1-5',
  $$ select net.http_post(url := coalesce(current_setting('app.settings.edge_function_url', true), 'http://kong:8000') || '/functions/v1/research-run?timeframe=1D', headers := '{"Content-Type": "application/json"}'::jsonb); $$
);

select cron.schedule(
  'hourly_research',
  '0 * * * *',
  $$ select net.http_post(url := coalesce(current_setting('app.settings.edge_function_url', true), 'http://kong:8000') || '/functions/v1/research-run?timeframe=1H', headers := '{"Content-Type": "application/json"}'::jsonb); $$
);

select cron.schedule(
  'exness_monitor',
  '0 * * * *',
  $$ select net.http_post(url := coalesce(current_setting('app.settings.edge_function_url', true), 'http://kong:8000') || '/functions/v1/exness-monitor', headers := '{"Content-Type": "application/json"}'::jsonb); $$
);

select cron.schedule(
  'resolve_outcomes',
  '2,32 * * * *',
  $$ select net.http_post(url := coalesce(current_setting('app.settings.edge_function_url', true), 'http://kong:8000') || '/functions/v1/resolve-outcomes', headers := '{"Content-Type": "application/json"}'::jsonb); $$
);
