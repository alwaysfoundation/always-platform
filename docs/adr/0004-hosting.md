# ADR 0004: Hosting the API, web console and jobs

Status: Proposed

## Context

ADR 0001 chose Supabase Postgres and Vercel functions in Sydney. We now have a hosted Supabase project (Always Foundation organisation, Pro plan, ap-southeast-2) and need the API, the web console and the scheduled jobs running.

## Decision

1. The API deploys as one Vercel function (`api/index.js`), bundled from `apps/api/src/vercel.ts` with esbuild and pinned to `syd1`. Every path is rewritten to it.
2. The web console (`apps/web`) is a second Vercel project, also in `syd1`, and reaches the API through its own `/api` rewrite (ADR 0002).
3. Scheduled jobs run on Supabase with `pg_cron` and `pg_net` (`db/supabase/jobs.sql`), calling the API's job endpoints with the cron secret. The API address and secret are kept in Supabase Vault. This avoids needing Vercel Pro for minute-level cron.
4. The Supabase Data API (PostgREST) is turned off. Only the Always API talks to the database.
5. Secrets (database URL, field and hash keys, cron and auth secrets) are set by a maintainer in Vercel and GitHub environments, never in the repository.

## Consequences

- Personal data is stored and processed in Sydney.
- Jobs run whenever the API is reachable; if Vault isn't configured, the job function does nothing.
- Email delivery still needs an Australian-region provider before real people's data flows (see ADR 0001: Amazon SES in ap-southeast-2).
