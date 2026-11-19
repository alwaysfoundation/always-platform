-- 0010: field contacts. A simple, consented store for outreach responses (e.g. Sydney Fire's app)
-- until church routing is switched on. Stored in Sydney. Only the foundation (database owner) can read it:
-- RLS is on with no policies, and the public API roles have no grants.
-- Applied to production on 2026-11-18 for Sydney Fire's outreach; recorded here for review.

create table field_contact (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  source text not null check (source ~ '^[a-z0-9-]{2,40}$'),
  age_band age_band not null,
  step text not null check (step in ('church', 'youth', 'talk', 'explore')),
  first_name text check (char_length(first_name) between 1 and 60),
  mobile text not null check (mobile ~ '^(\+?61|0)4[0-9]{8}$'),
  parent_mobile text check (parent_mobile ~ '^(\+?61|0)4[0-9]{8}$'),
  suburb text not null check (char_length(suburb) between 2 and 60),
  postcode text not null check (postcode ~ '^[0-9]{4}$'),
  -- consent, exactly as the person gave it
  consent_connect boolean not null check (consent_connect),
  allow_next_nearby boolean not null default false,
  notify_sender boolean not null default false,
  party text not null check (party in ('self', 'parent')),
  child_assent boolean not null default false,
  wording_version text not null check (char_length(wording_version) between 1 and 40),
  -- follow-up
  status text not null default 'new' check (status in ('new', 'parent_pending', 'contacted', 'connected', 'withdrawn')),
  handled_at timestamptz,
  delete_after timestamptz not null default (now() + interval '90 days'),
  -- minors rules (cannot be switched off)
  constraint fc_under13_parent check (age_band <> 'under13' or (party = 'parent' and first_name is null and child_assent)),
  constraint fc_13_14_parent check (age_band <> '13-14' or (parent_mobile is not null and child_assent)),
  constraint fc_minor_steps check (age_band = '18+' or step in ('youth', 'talk'))
);

alter table field_contact enable row level security;
revoke all on field_contact from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then execute 'revoke all on field_contact from anon'; end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then execute 'revoke all on field_contact from authenticated'; end if;
end $$;
create index field_contact_created_idx on field_contact (source, created_at desc);
create index field_contact_delete_idx on field_contact (delete_after);

-- Delete contacts after 90 days, nightly (Supabase only; pg_cron is not in the local test database).
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('field-contact-retention', '30 16 * * *', $c$delete from field_contact where delete_after < now()$c$);
  end if;
end $$;
