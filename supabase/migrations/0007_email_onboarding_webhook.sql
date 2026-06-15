-- 0007_email_onboarding_webhook.sql

create or replace function public.trigger_email_onboarding()
returns trigger as $$
declare
  webhook_url text;
  payload jsonb;
  request_id bigint;
begin
  webhook_url := current_setting('app.settings.edge_functions_base_url', true);
  
  if webhook_url is null then
    webhook_url := 'http://kong:8000/functions/v1';
  end if;

  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'users',
    'schema', 'auth',
    'record', jsonb_build_object('id', NEW.id, 'email', NEW.email)
  );

  select net.http_post(
    url := webhook_url || '/email-onboarding',
    body := payload,
    headers := '{"Content-Type": "application/json"}'::jsonb
  ) into request_id;

  return NEW;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_email_welcome on auth.users;

create trigger on_auth_user_email_welcome
  after insert on auth.users
  for each row
  execute function public.trigger_email_onboarding();
