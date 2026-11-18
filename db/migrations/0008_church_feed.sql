-- 0008: the church feed (RFC 0001, part 1). Organisation facts only, never people.
-- Churches opt in to the feed; readiness ("welcoming now") is computed, never set by hand.

alter table organisation
  add column if not exists feed_opt_in_at timestamptz,
  add column if not exists connect_trained_at timestamptz,
  add column if not exists service_times text,
  add column if not exists languages text[] not null default array['English'];

-- Welcoming now: verified, trained, fresh, has room, not paused, and usually answers on time.
create or replace view org_readiness as
with month_accepts as (
  select o.org_id, count(*)::int as n
  from handoff_offer o
  where o.outcome = 'accepted' and o.decided_at >= date_trunc('month', now() at time zone 'Australia/Sydney') at time zone 'Australia/Sydney'
  group by o.org_id
), recent as (
  select org_id, outcome, row_number() over (partition by org_id order by offered_at desc) as rn
  from handoff_offer where outcome in ('accepted', 'passed', 'expired')
), on_time as (
  select org_id, count(*)::int as decided, count(*) filter (where outcome <> 'expired')::int as answered
  from recent where rn <= 20 group by org_id
)
select org.id as org_id,
  (org.trust_level in ('verified', 'verified_youth')
   and not org.is_care_team
   and org.connect_trained_at is not null
   and org.last_confirmed_at > now() - interval '90 days'
   and cap.org_id is not null
   and (cap.paused_until is null or cap.paused_until < now())
   and coalesce(ma.n, 0) < cap.monthly_limit
   and (coalesce(ot.decided, 0) < 5 or ot.answered::numeric / ot.decided >= 0.8)
  ) as welcoming_now,
  org.trust_level = 'verified_youth' as youth_partner,
  coalesce(ot.decided, 0) as recent_offers,
  case when coalesce(ot.decided, 0) = 0 then null else round(ot.answered::numeric / ot.decided, 2) end as on_time_rate
from organisation org
left join capacity cap on cap.org_id = org.id
left join month_accepts ma on ma.org_id = org.id
left join on_time ot on ot.org_id = org.id;

-- Developer app keys for the open APIs (directory feed, verification). Separate from member API tokens.
create table if not exists app_key (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 80),
  contact_email_ct bytea not null,
  kind text not null check (kind in ('test', 'live')),
  key_hash bytea not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);
alter table app_key enable row level security;
