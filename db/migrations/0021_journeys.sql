-- 0021: journeys across ministries (ADR 0012).
-- A journey links one adult's responses through different ministries, only with their share.journey consent.
-- Holds no names or contacts: a keyed link (never returned by the API), the responses it joins, and
-- milestones the person reported themselves. Reports never read these tables; they read journey_tally.
begin;

alter type journey_milestone add value if not exists 'baptised';
alter type journey_milestone add value if not exists 'in_group';
alter type journey_milestone add value if not exists 'serving';
alter type journey_milestone add value if not exists 'connected_12m';

create table if not exists journey (
  id uuid primary key default gen_random_uuid(),
  link_hash bytea not null unique,               -- HMAC(LINK_KEY, normalised mobile); the key never leaves the API
  link_key_version smallint not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists journey_response (
  response_id uuid primary key references response(id) on delete cascade,
  journey_id uuid not null references journey(id) on delete cascade,
  linked_at timestamptz not null default now()
);
create index if not exists journey_response_journey_idx on journey_response (journey_id);

create table if not exists journey_self_milestone (
  journey_id uuid not null references journey(id) on delete cascade,
  response_id uuid not null references journey_response(response_id) on delete cascade,  -- withdrawing that response removes it
  milestone text not null check (milestone in ('baptised', 'in_group', 'serving', 'connected_12m')),
  month date not null check (extract(day from month) = 1),
  primary key (journey_id, milestone)
);

-- Service access only. No policies, so app_user (every ministry) reads nothing directly.
alter table journey enable row level security;
alter table journey_response enable row level security;
alter table journey_self_milestone enable row level security;
revoke all on journey, journey_response, journey_self_milestone from app_user;

-- Guards that hold even if application code is wrong: adults only, and only with a current share.journey consent.
create or replace function journey_response_guard() returns trigger language plpgsql as $$
declare c record;
begin
  select age_band, purposes, withdrawn_at, expires_at into c from consent where response_id = new.response_id;
  if not found then raise exception 'journey_no_consent'; end if;
  if c.age_band <> '18+' then raise exception 'journey_minors_never_linked'; end if;
  if not ('share.journey' = any (c.purposes)) or c.withdrawn_at is not null or (c.expires_at is not null and c.expires_at <= now()) then
    raise exception 'journey_consent_required';
  end if;
  return new;
end $$;
drop trigger if exists journey_response_guard on journey_response;
create trigger journey_response_guard before insert on journey_response for each row execute function journey_response_guard();

-- Withdrawal unlinks straight away.
create or replace function journey_unlink_on_withdraw() returns trigger language plpgsql as $$
begin
  if new.withdrawn_at is not null and old.withdrawn_at is null then
    delete from journey_response where response_id = new.response_id;
  end if;
  return new;
end $$;
drop trigger if exists journey_unlink_on_withdraw on consent;
create trigger journey_unlink_on_withdraw after update of withdrawn_at on consent for each row execute function journey_unlink_on_withdraw();

-- A journey with no linked responses left is deleted, with its milestones.
create or replace function journey_cleanup() returns trigger language plpgsql as $$
begin
  delete from journey j where j.id = old.journey_id and not exists (select 1 from journey_response r where r.journey_id = old.journey_id);
  return old;
end $$;
drop trigger if exists journey_cleanup on journey_response;
create trigger journey_cleanup after delete on journey_response for each row execute function journey_cleanup();

commit;
