-- 0011: who may see a ministry's field contacts. One row per leader per ministry (source).
-- Only the foundation adds or removes leaders. RLS on, no public grants.
-- Applied to production on 2026-11-18 for Sydney Fire's outreach; recorded here for review.
create table field_team (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source ~ '^[a-z0-9-]{2,40}$'),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  role text not null default 'leader' check (role in ('leader')),
  added_at timestamptz not null default now(),
  removed_at timestamptz,
  unique (source, email)
);
alter table field_team enable row level security;
revoke all on field_team from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on field_team from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on field_team from authenticated'; end if;
end $$;

alter table field_contact add column handled_by text;
