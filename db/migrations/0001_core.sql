-- Always platform core schema (Postgres 16).
-- All personal data lives in Australian regions. Restricted columns are stored
-- as ciphertext (bytea) encrypted by the application with keys from the KMS;
-- the database never sees plaintext names, contacts or notes.

begin;

create extension if not exists pgcrypto;

-- Roles. The application connects as app_user and sets app.org_id / app.user_id
-- per request; row-level security does the rest.
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then create role app_user nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'network_ops') then create role network_ops nologin; end if;
end $$;

create type trust_level as enum ('listed', 'claimed', 'verified', 'verified_youth');
create type org_kind as enum ('church', 'ministry', 'network');
create type age_band as enum ('under13', '13-14', '15-17', '18+');
create type step_category as enum ('church', 'explore', 'talk', 'youth', 'group', 'help', 'read');
create type handoff_state as enum ('awaiting_parent', 'routing', 'offered', 'accepted', 'contacted', 'care_team', 'closed', 'withdrawn');
create type offer_outcome as enum ('pending', 'accepted', 'passed', 'expired', 'returned');

create or replace function app_org() returns uuid language sql stable as
  $$ select nullif(current_setting('app.org_id', true), '')::uuid $$;
create or replace function app_user_id() returns uuid language sql stable as
  $$ select nullif(current_setting('app.user_id', true), '')::uuid $$;

-- Directory -----------------------------------------------------------------
create table organisation (
  id uuid primary key default gen_random_uuid(),
  kind org_kind not null,
  display_name text not null,
  legal_name text,
  abn text,
  acnc_registered boolean,
  denomination text,
  category text,
  trust_level trust_level not null default 'listed',
  verified_at timestamptz,
  youth_verified_at timestamptz,
  last_confirmed_at timestamptz,
  address text,
  suburb text,
  state text check (state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
  postcode text,
  geo_lat double precision,
  geo_lng double precision,
  website text,
  description text,
  welcome_line text,
  brand_colour text,
  page_layout jsonb not null default '{}'::jsonb, -- section order, style, custom sections
  source_url text,
  source_date date,
  created_at timestamptz not null default now()
);
create index organisation_state_idx on organisation (state, trust_level);

create table offer_category (
  org_id uuid not null references organisation(id) on delete cascade,
  category step_category not null,
  label text,
  active boolean not null default true,
  primary key (org_id, category)
);

create table capacity (
  org_id uuid primary key references organisation(id) on delete cascade,
  monthly_limit int not null default 10 check (monthly_limit >= 0),
  area_radius_km numeric(5,1) not null default 8,
  languages text[] not null default array['English'],
  paused_until timestamptz
);

-- People who use the platform (staff and partner users only) ----------------
create table app_user_account (
  id uuid primary key default gen_random_uuid(),
  email_ct bytea not null,            -- Confidential, encrypted
  email_hash bytea not null unique,   -- for lookup
  display_name text not null,
  totp_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table membership (
  user_id uuid not null references app_user_account(id) on delete cascade,
  org_id uuid not null references organisation(id) on delete cascade,
  role text not null check (role in ('follow_up', 'admin', 'youth', 'sender', 'integration')),
  youth_access boolean not null default false,
  primary key (user_id, org_id)
);

-- Responses, consent and handoffs (Restricted) -------------------------------
create table response (
  id uuid primary key default gen_random_uuid(),
  sender_org_id uuid references organisation(id),
  campaign_id uuid,
  placement_id uuid,
  first_name_ct bytea,                -- Restricted, null for under-13 (no child data)
  contact_ct bytea,                   -- Restricted
  suburb text,
  postcode text,
  geo_lat double precision,           -- suburb centroid, never a street address
  geo_lng double precision,
  age_band age_band not null,
  step step_category not null,
  language text,
  note_ct bytea,                      -- Restricted
  created_at timestamptz not null default now(),
  delete_after timestamptz not null,
  constraint under13_no_child_data check (age_band <> 'under13' or first_name_ct is null)
);

create table consent (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references response(id) on delete cascade,
  purposes text[] not null,
  recipients uuid[] not null default '{}',
  allow_next_nearby boolean not null default false,
  wording_version text not null,
  party text not null check (party in ('self', 'parent')),
  age_band age_band not null,
  collected_at timestamptz not null default now(),
  parent_confirmed_at timestamptz,
  withdrawn_at timestamptz
);

create table handoff (
  id uuid primary key default gen_random_uuid(),
  response_id uuid not null references response(id) on delete cascade,
  state handoff_state not null,
  age_band age_band not null,
  created_at timestamptz not null default now(),
  care_hello_at timestamptz,
  accepted_at timestamptz,
  first_contact_at timestamptz,
  person_confirmed_connected_at timestamptz,
  companion_named boolean
);

create table handoff_offer (
  handoff_id uuid not null references handoff(id) on delete cascade,
  seq int not null,
  org_id uuid not null references organisation(id),
  offered_at timestamptz not null,
  deadline timestamptz not null,
  outcome offer_outcome not null default 'pending',
  decided_at timestamptz,
  pass_reason text check (pass_reason in ('capacity','language','fit','safeguarding','other')),
  primary key (handoff_id, seq)
);
-- One church holds an offer at a time.
create unique index one_pending_offer on handoff_offer (handoff_id) where outcome = 'pending';

create table activity (
  id uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references handoff(id) on delete cascade,
  org_id uuid not null references organisation(id),
  kind text not null check (kind in ('call','message','text','met','note','status','reply_received')),
  body_ct bytea,                      -- Restricted; never message content from chats (Always hosts no chat)
  actor uuid references app_user_account(id),
  created_at timestamptz not null default now()
);

-- Audit (append-only, hash-chained) -----------------------------------------
create table audit_event (
  id bigserial primary key,
  at timestamptz not null default now(),
  actor uuid,
  org_id uuid,
  action text not null,
  subject_ref text not null,
  reason text,
  prev_hash bytea,
  hash bytea not null
);
revoke update, delete on audit_event from public;

-- Row-level security ----------------------------------------------------------
alter table response enable row level security;
alter table consent enable row level security;
alter table handoff enable row level security;
alter table handoff_offer enable row level security;
alter table activity enable row level security;

-- An organisation sees a response only while it holds (or held and accepted) an offer for it.
create or replace function org_holds_response(r uuid) returns boolean language sql stable security definer as $$
  select exists (
    select 1 from handoff h join handoff_offer o on o.handoff_id = h.id
    where h.response_id = r and o.org_id = app_org() and o.outcome in ('pending', 'accepted')
  )
$$;

create policy response_holder on response for select to app_user using (org_holds_response(id));
create policy consent_holder on consent for select to app_user using (org_holds_response(response_id));
create policy handoff_holder on handoff for select to app_user using (org_holds_response(response_id));
create policy offer_own on handoff_offer for select to app_user using (org_id = app_org());
create policy offer_decide on handoff_offer for update to app_user using (org_id = app_org() and outcome = 'pending');
create policy activity_own on activity for all to app_user using (org_id = app_org()) with check (org_id = app_org());

-- Minors: only memberships flagged for youth access can read under-18 records.
create or replace function user_has_youth_access() returns boolean language sql stable security definer as $$
  select exists (select 1 from membership m where m.user_id = app_user_id() and m.org_id = app_org() and m.youth_access)
$$;
create policy response_minors on response as restrictive for select to app_user using (
  age_band = '18+' or user_has_youth_access()
);

grant select on organisation, offer_category to app_user;
grant select, update on handoff_offer to app_user;
grant select on response, consent, handoff to app_user;
grant select, insert on activity to app_user;
grant insert on audit_event to app_user;

commit;
