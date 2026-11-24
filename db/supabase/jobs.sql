-- Scheduled jobs on Supabase (Sydney), run once per hosted project after the migrations.
-- pg_cron calls the API's job endpoints every minute through pg_net. The cron secret is
-- generated here, inside Vault, and the API reads it from Vault, so no person copies it.
-- Set the API address once (not a secret):
--   select vault.create_secret('https://api.alwaysfoundation.org', 'always_api_url');
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$ begin
  if not exists (select 1 from vault.secrets where name = 'always_cron_secret') then
    perform vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'always_cron_secret', 'Shared by pg_cron and the Always API job endpoints');
  end if;
end $$;

create or replace function public.always_run_job(path text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  base text := (select decrypted_secret from vault.decrypted_secrets where name = 'always_api_url');
  secret text := (select decrypted_secret from vault.decrypted_secrets where name = 'always_cron_secret');
begin
  if base is null or secret is null then return; end if; -- not configured yet
  perform net.http_post(url := base || path, headers := jsonb_build_object('x-cron-secret', secret, 'content-type', 'application/json'), body := '{}'::jsonb, timeout_milliseconds := 25000);
end $$;
revoke all on function public.always_run_job(text) from public, anon, authenticated;

select cron.schedule('always-tick', '* * * * *', $$select public.always_run_job('/jobs/tick')$$);
select cron.schedule('always-outbox', '* * * * *', $$select public.always_run_job('/jobs/outbox')$$);
select cron.schedule('always-retention', '17 16 * * *', $$select public.always_run_job('/jobs/retention')$$);
select cron.schedule('always-onboarding', '7 * * * *', $$select public.always_run_job('/jobs/onboarding')$$);
