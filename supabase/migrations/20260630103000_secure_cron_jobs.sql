-- Update the cron URLs to include the Service Role Key in the Authorization header to securely authenticate against the Edge Functions

SELECT cron.unschedule('4h_research');
SELECT cron.schedule(
  '4h_research',
  '0 0,4,8,12,16,20 * * *',
  $$ select net.http_post(
      url := coalesce(current_setting('app.settings.edge_function_url', true), 'https://ktezlusdkqlfdwqrldtn.supabase.co') || '/functions/v1/research-run?timeframe=4H',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
  ); $$
);

SELECT cron.unschedule('exness_monitor');
SELECT cron.schedule(
  'exness_monitor',
  '0 * * * *',
  $$ select net.http_post(
      url := coalesce(current_setting('app.settings.edge_function_url', true), 'https://ktezlusdkqlfdwqrldtn.supabase.co') || '/functions/v1/exness-monitor',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
  ); $$
);

SELECT cron.unschedule('resolve_outcomes');
SELECT cron.schedule(
  'resolve_outcomes',
  '2,32 * * * *',
  $$ select net.http_post(
      url := coalesce(current_setting('app.settings.edge_function_url', true), 'https://ktezlusdkqlfdwqrldtn.supabase.co') || '/functions/v1/resolve-outcomes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
  ); $$
);

SELECT cron.unschedule('daily_research');
SELECT cron.schedule(
  'daily_research',
  '30 13 * * 1-5',
  $$ select net.http_post(
      url := coalesce(current_setting('app.settings.edge_function_url', true), 'https://ktezlusdkqlfdwqrldtn.supabase.co') || '/functions/v1/research-run?timeframe=1D',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
      )
  ); $$
);
