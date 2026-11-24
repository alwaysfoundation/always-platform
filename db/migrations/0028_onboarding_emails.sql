-- Setup emails for new churches and ministries. One row per email sent, so none is sent twice.
-- Holds no personal data: an organisation id, which step, and when.
create table if not exists onboarding_email (
  org_id uuid not null references organisation(id) on delete cascade,
  step text not null check (step in ('welcome', 'look', 'team', 'checkin', 'story')),
  sent_at timestamptz not null default now(),
  primary key (org_id, step)
);
alter table onboarding_email enable row level security;
-- No policy for app_user: only the scheduled job (service role) reads or writes it.

alter table organisation add column if not exists onboarding_emails boolean not null default true;
