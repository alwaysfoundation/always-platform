-- Always platform: API, notifications, directory and self-service additions (Postgres 16).
-- Builds on 0001_core.sql. Personal data stays in Australian regions.

begin;

-- Directory search ------------------------------------------------------------
create extension if not exists pg_trgm;

alter table organisation
  add column if not exists slug text unique,
  add column if not exists notify_email_ct bytea,          -- Confidential, encrypted: where alerts go
  add column if not exists notify_email_hash bytea,
  add column if not exists median_accept_minutes int,
  add column if not exists is_care_team boolean not null default false,
  add column if not exists search_text text generated always as (
    lower(coalesce(display_name, '') || ' ' || coalesce(suburb, '') || ' ' || coalesce(denomination, '') || ' ' || coalesce(category, ''))
  ) stored;

create index if not exists organisation_search_trgm on organisation using gin (search_text gin_trgm_ops);
create unique index if not exists organisation_natural_key on organisation (lower(display_name), lower(coalesce(suburb, '')), coalesce(state, ''));

-- Suburb and postcode centroids (ABS open data). Never a street address.
create table if not exists place_centroid (
  postcode text not null,
  suburb text not null,
  state text not null,
  lat double precision not null,
  lng double precision not null,
  primary key (postcode, suburb)
);

-- Claims: a church asks to manage its listing ---------------------------------
create type claim_status as enum ('pending', 'approved', 'rejected');
create table if not exists claim_request (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisation(id) on delete cascade,
  requester_email_ct bytea not null,
  requester_email_hash bytea not null,
  requester_role text not null,
  evidence text,                       -- e.g. "listed on denomination site as senior pastor"
  status claim_status not null default 'pending',
  decided_by uuid references app_user_account(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

-- API tokens for sender integrations (hash only; the token is shown once) -----
create table if not exists api_token (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisation(id) on delete cascade,
  user_id uuid references app_user_account(id) on delete set null,
  name text not null,
  token_hash bytea not null unique,
  scopes text[] not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- Person self-service links (withdraw, confirm connected). Hash only. ---------
create table if not exists person_link (
  token_hash bytea primary key,
  response_id uuid not null references response(id) on delete cascade,
  purpose text not null check (purpose in ('self_service', 'parent_confirm')),
  expires_at timestamptz not null,
  used_at timestamptz
);

-- Handoff timing columns used by the scheduler -------------------------------
alter table handoff add column if not exists next_check_at timestamptz;
create index if not exists handoff_open_idx on handoff (next_check_at) where state in ('awaiting_parent', 'routing', 'offered', 'accepted');

-- Outbox: every notification and webhook goes through here -----------------
-- Payloads never contain personal data: they carry ids, and the recipient
-- signs in to see details. SMS bodies to a person are template ids plus
-- encrypted parameters.
create type outbox_channel as enum ('email', 'sms', 'webhook', 'push');
create type outbox_status as enum ('pending', 'sent', 'failed', 'dead');
create table if not exists outbox (
  id bigserial primary key,
  channel outbox_channel not null,
  template text not null,
  org_id uuid references organisation(id) on delete cascade,
  response_id uuid references response(id) on delete cascade,
  params_ct bytea,                     -- encrypted template parameters, if any
  not_before timestamptz not null default now(),
  attempts int not null default 0,
  status outbox_status not null default 'pending',
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists outbox_due_idx on outbox (not_before) where status = 'pending';

-- Webhook endpoints (CloudEvents 1.0, HMAC-SHA256 signed) --------------------
create table if not exists webhook_endpoint (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisation(id) on delete cascade,
  url text not null check (url like 'https://%'),
  secret_ct bytea not null,
  events text[] not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS for the new tables ------------------------------------------------------
alter table api_token enable row level security;
alter table webhook_endpoint enable row level security;
alter table claim_request enable row level security;
alter table outbox enable row level security;
alter table person_link enable row level security;

create policy api_token_own on api_token for select to app_user using (org_id = app_org());
create policy webhook_own on webhook_endpoint for all to app_user using (org_id = app_org()) with check (org_id = app_org());
create policy claim_own on claim_request for select to app_user using (org_id = app_org());
-- outbox and person_link: service role only (no app_user policies = no access).

-- Organisations edit their own public page and settings.
create policy org_self_update on organisation for update to app_user using (id = app_org()) with check (id = app_org());
grant update (display_name, description, welcome_line, brand_colour, page_layout, website, address, last_confirmed_at) on organisation to app_user;
alter table organisation enable row level security;
create policy org_public_read on organisation for select to app_user, public using (true);

grant select, insert, update, delete on offer_category, capacity to app_user;
alter table offer_category enable row level security;
alter table capacity enable row level security;
create policy offer_category_read on offer_category for select to app_user using (true);
create policy offer_category_own on offer_category for all to app_user using (org_id = app_org()) with check (org_id = app_org());
create policy capacity_own on capacity for all to app_user using (org_id = app_org()) with check (org_id = app_org());

grant select on api_token, claim_request to app_user;
grant select, insert, update, delete on webhook_endpoint to app_user;

-- Public directory view: only the fields anyone may see -------------------------
create or replace view directory_listing as
  select id, slug, kind, display_name, denomination, category, trust_level, suburb, state, postcode, website, welcome_line
  from organisation
  where not is_care_team;
grant select on directory_listing to app_user, public;

-- Aggregate counts for the public tally (no personal data).
create or replace view directory_tally as
  select state, kind, trust_level, count(*)::int as n from organisation where not is_care_team group by 1, 2, 3;
grant select on directory_tally to app_user, public;

commit;
