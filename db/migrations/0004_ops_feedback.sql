-- 0004: the foundation team's work queue (claims, events) and public feedback.

alter table claim_request add column if not exists decision_note text;

create type feedback_kind as enum ('idea', 'bug', 'missing');
create type feedback_status as enum ('new', 'triaged', 'done', 'spam');
create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  kind feedback_kind not null,
  area text not null,
  message text not null check (length(message) between 3 and 4000),
  email_ct bytea,                        -- optional, encrypted; only if they want a reply
  status feedback_status not null default 'new',
  created_at timestamptz not null default now(),
  delete_after timestamptz not null default now() + interval '18 months'
);
create index if not exists feedback_status_idx on feedback (status, created_at desc);
alter table feedback enable row level security;   -- service role only; no app_user policies

alter table event add column if not exists reviewed_by uuid references app_user_account(id);
alter table event add column if not exists reviewed_at timestamptz;
