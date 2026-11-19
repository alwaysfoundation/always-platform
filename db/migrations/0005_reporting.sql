-- 0005: reporting. Durable, de-identified tallies that outlive the people's records they count.
-- No names, contacts, suburbs or ids of people: only an organisation, a day, a step, a state and a milestone.

create type journey_milestone as enum ('responded', 'introduced', 'accepted', 'contacted', 'connected', 'care_team');

create table if not exists journey_tally (
  sender_org_id uuid references organisation(id) on delete cascade,   -- the ministry or event the person responded through
  receiver_org_id uuid references organisation(id) on delete cascade, -- the church or ministry that welcomed them (accepted onwards)
  source_id uuid,                                                      -- a response page, campaign or placement, if any
  day date not null,
  step step_category not null,
  region text not null,                                                -- state or territory, never a suburb
  minor boolean not null,
  milestone journey_milestone not null,
  n integer not null default 0
);
create unique index if not exists journey_tally_key on journey_tally (
  coalesce(sender_org_id, '00000000-0000-0000-0000-000000000000'), coalesce(receiver_org_id, '00000000-0000-0000-0000-000000000000'),
  coalesce(source_id, '00000000-0000-0000-0000-000000000000'), day, step, region, minor, milestone);
create index if not exists journey_tally_sender_idx on journey_tally (sender_org_id, day);
create index if not exists journey_tally_receiver_idx on journey_tally (receiver_org_id, day);
alter table journey_tally enable row level security;  -- read through the API's report endpoints only

/** Australian state or territory from a postcode. */
create or replace function au_region(pc text) returns text language sql immutable as $$
  select case
    when pc is null or pc !~ '^[0-9]{4}$' then 'Unknown'
    when pc::int between 200 and 299 or pc::int between 2600 and 2618 or pc::int between 2900 and 2920 then 'ACT'
    when pc::int between 800 and 999 then 'NT'
    when pc::int between 1000 and 2999 then 'NSW'
    when pc::int between 3000 and 3999 or pc::int between 8000 and 8999 then 'VIC'
    when pc::int between 4000 and 4999 or pc::int between 9000 and 9999 then 'QLD'
    when pc::int between 5000 and 5999 then 'SA'
    when pc::int between 6000 and 6999 then 'WA'
    when pc::int between 7000 and 7999 then 'TAS'
    else 'Unknown' end $$;

create or replace function tally(p_response uuid, p_receiver uuid, p_milestone journey_milestone, p_at timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  select sender_org_id, coalesce(placement_id, campaign_id) as source_id, step, au_region(postcode) as region, age_band <> '18+' as minor
    into r from response where id = p_response;
  if not found then return; end if;
  insert into journey_tally (sender_org_id, receiver_org_id, source_id, day, step, region, minor, milestone, n)
  values (r.sender_org_id, p_receiver, r.source_id, (p_at at time zone 'Australia/Sydney')::date, r.step, r.region, r.minor, p_milestone, 1)
  on conflict (coalesce(sender_org_id, '00000000-0000-0000-0000-000000000000'), coalesce(receiver_org_id, '00000000-0000-0000-0000-000000000000'),
               coalesce(source_id, '00000000-0000-0000-0000-000000000000'), day, step, region, minor, milestone)
  do update set n = journey_tally.n + 1;
end $$;

create or replace function tally_response() returns trigger language plpgsql as $$
begin perform tally(new.id, null, 'responded', new.created_at); return new; end $$;
create trigger journey_responded after insert on response for each row execute function tally_response();

create or replace function tally_offer() returns trigger language plpgsql as $$
declare resp uuid;
begin
  select response_id into resp from handoff where id = new.handoff_id;
  if tg_op = 'INSERT' and new.seq = 1 then perform tally(resp, null, 'introduced', new.offered_at); end if;
  if tg_op = 'UPDATE' and new.outcome = 'accepted' and old.outcome is distinct from 'accepted' then
    perform tally(resp, new.org_id, 'accepted', coalesce(new.decided_at, now()));
  end if;
  return new;
end $$;
create trigger journey_offer after insert or update on handoff_offer for each row execute function tally_offer();

create or replace function tally_handoff() returns trigger language plpgsql as $$
declare receiver uuid;
begin
  select org_id into receiver from handoff_offer where handoff_id = new.id and outcome = 'accepted' order by seq desc limit 1;
  if new.first_contact_at is not null and (tg_op = 'INSERT' or old.first_contact_at is null) then
    perform tally(new.response_id, receiver, 'contacted', new.first_contact_at); end if;
  if new.person_confirmed_connected_at is not null and (tg_op = 'INSERT' or old.person_confirmed_connected_at is null) then
    perform tally(new.response_id, receiver, 'connected', new.person_confirmed_connected_at); end if;
  if new.state = 'care_team' and (tg_op = 'INSERT' or old.state is distinct from 'care_team') then
    perform tally(new.response_id, null, 'care_team', now()); end if;
  return new;
end $$;
create trigger journey_handoff after insert or update on handoff for each row execute function tally_handoff();

-- Report settings each ministry can customise, and share links for funders.
create table if not exists report_profile (
  org_id uuid primary key references organisation(id) on delete cascade,
  title text,                       -- e.g. "Summer camp follow-up"
  funder_name text,                 -- e.g. "Prepared for the Example Foundation"
  intro text,                       -- a short paragraph in the ministry's words
  updated_at timestamptz not null default now()
);
create table if not exists report_share (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisation(id) on delete cascade,
  token_hash bytea not null unique,
  label text not null,              -- who it's for, e.g. "Board, Q1"
  from_day date not null,
  to_day date not null,
  source_id uuid,
  snapshot jsonb not null,          -- frozen, already-withheld totals: what the funder sees never changes after sharing
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_viewed_at timestamptz,
  views integer not null default 0,
  created_at timestamptz not null default now()
);
alter table report_profile enable row level security;
alter table report_share enable row level security;
