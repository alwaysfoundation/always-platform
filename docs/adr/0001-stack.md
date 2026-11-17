# ADR 0001: Platform stack

- Status: accepted
- Date: 2026-11-17

## Context
Personal data (faith responses) is sensitive under the Privacy Act and must stay in Australia. We need very low running costs, strong access control and a stack a small team and AI assistants can work in safely.

## Decision
Postgres 16 on Supabase (Sydney) with row-level security as the access-control boundary; TypeScript everywhere (Hono API, Next.js web, shared core rules engine); Vercel functions pinned to syd1; Amazon SES and KMS in ap-southeast-2; an Australian SMS provider; Cloudflare for DNS and the static site.

## Consequences
- RLS policies and their tests are part of every schema change.
- The API is portable: Hono runs on Node, Vercel or Cloudflare, so we can move hosts without rewriting.
- Supabase is open source, so we can self-host Postgres in Sydney if pricing or policy changes.
- Vercel cron needs the Pro plan; pg_cron is the fallback.
