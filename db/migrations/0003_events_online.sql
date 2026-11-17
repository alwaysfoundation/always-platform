-- 0003: Christian events across Australia, and hosted response pages for online responses.
-- Events hold no personal data. Response pages belong to a sending church or ministry.

create type event_source as enum ('org', 'import', 'foundation', 'suggested');
create type event_status as enum ('pending', 'published', 'hidden');
create type event_kind as enum ('worship', 'music', 'outreach', 'conference', 'youth', 'course', 'prayer', 'training', 'other');

create table if not exists event (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references organisation(id) on delete set null,
  title text not null check (length(title) between 3 and 140),
  kind event_kind not null default 'other',
  starts_at timestamptz not null,
  ends_at timestamptz,
  venue text,
  suburb text,
  state text check (state in ('NSW','VIC','QLD','WA','SA','TAS','ACT','NT')),
  postcode text,
  url text check (url is null or url ~ '^https://'),
  source event_source not null,
  external_id text,                 -- id on the ticketing platform, for imports
  status event_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (source, external_id)
);
create index if not exists event_upcoming on event (status, starts_at);

-- Hosted response pages: a link or QR in a video description, a social bio or a printed card.
create table if not exists response_page (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisation(id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,60}$'),
  title text not null,
  channel text not null default 'online' check (channel in ('online', 'event', 'street', 'print')),
  steps step_category[] not null default '{church,explore,talk,read}',
  brand jsonb not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table event enable row level security;
alter table response_page enable row level security;
create policy event_public on event for select to app_user using (status = 'published' or org_id = app_org());
create policy event_own on event for insert to app_user with check (org_id = app_org());
create policy page_own on response_page for all to app_user using (org_id = app_org()) with check (org_id = app_org());
grant select, insert on event to app_user;
grant select, insert, update on response_page to app_user;
