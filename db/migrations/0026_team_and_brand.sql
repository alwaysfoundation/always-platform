-- An organisation's logo, kept with its other brand settings (brand_colour, page_layout.brand).
alter table organisation
  add column if not exists logo_data text
  check (logo_data is null or (length(logo_data) < 350000 and logo_data like 'data:image/%'));

-- Invitations to join an organisation's team. Only the token's hash is stored.
create table if not exists org_invite (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisation(id) on delete cascade,
  email_ct bytea not null,
  email_hash bytea not null,
  role text not null check (role in ('admin', 'follow_up', 'youth')),
  token_hash bytea not null unique,
  invited_by uuid references app_user_account(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists org_invite_org on org_invite (org_id);
alter table org_invite enable row level security;
create policy org_invite_own on org_invite for select to app_user using (org_id = app_org());
grant select on org_invite to app_user;
