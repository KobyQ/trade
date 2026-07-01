DO $$
DECLARE
  edge_url text;
BEGIN
  -- Evaluate edge URL at deploy time
  edge_url := coalesce(current_setting('app.settings.edge_function_url', true), 'https://ktezlusdkqlfdwqrldtn.supabase.co');

  -- 4H Research
  PERFORM cron.unschedule('4h_research');
  PERFORM cron.schedule(
    '4h_research',
    '0 0,4,8,12,16,20 * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''cron_webhook_secret'' LIMIT 1)), timeout_milliseconds := 300000);', edge_url || '/functions/v1/research-run?timeframe=4H')
  );

  -- Exness Monitor
  PERFORM cron.unschedule('exness_monitor');
  PERFORM cron.schedule(
    'exness_monitor',
    '0 * * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''cron_webhook_secret'' LIMIT 1)), timeout_milliseconds := 300000);', edge_url || '/functions/v1/exness-monitor')
  );

  -- Resolve Outcomes
  PERFORM cron.unschedule('resolve_outcomes');
  PERFORM cron.schedule(
    'resolve_outcomes',
    '2,32 * * * *',
    format('select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''cron_webhook_secret'' LIMIT 1)), timeout_milliseconds := 300000);', edge_url || '/functions/v1/resolve-outcomes')
  );

  -- Daily Research
  PERFORM cron.unschedule('daily_research');
  PERFORM cron.schedule(
    'daily_research',
    '30 21 * * 1-5',
    format('select net.http_post(url := %L, headers := jsonb_build_object(''Content-Type'', ''application/json'', ''x-cron-secret'', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = ''cron_webhook_secret'' LIMIT 1)), timeout_milliseconds := 300000);', edge_url || '/functions/v1/research-run?timeframe=1D')
  );
END $$;
