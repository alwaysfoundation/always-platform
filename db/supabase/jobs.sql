-- Scheduled jobs on Supabase (Sydney), run once per hosted project after the migrations.
-- pg_cron calls the API's job endpoints every minute through pg_net. The API address and the
-- cron secret live in Supabase Vault, never in this file:
--   select vault.create_secret('https://<api host>', 'always_api_url');
--   select vault.create_secret('<the CRON_SECRET set on the API>', 'always_cron_secret');
create extension if not exists pg_cron;
create extension if not exists pg_net;

create or replace function public.always_run_job(path text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'always_api_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'always_cron_secret');
begin
  if base is null or secret is null then return; end if; -- not configured yet
  perform net.http_post(url := base || path, headers := jsonb_build_object('x-cron-secret', secret), body := '{}'::jsonb, timeout_milliseconds := 25000);
end $$;
revoke all on function public.always_run_job(text) from public;

select cron.schedule('always-tick', '* * * * *', $$select public.always_run_job('/jobs/tick')$$);
select cron.schedule('always-outbox', '* * * * *', $$select public.always_run_job('/jobs/outbox')$$);
select cron.schedule('always-retention', '17 16 * * *', $$select public.always_run_job('/jobs/retention')$$);
