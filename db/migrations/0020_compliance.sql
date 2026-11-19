-- 0020: Always Compliance (RFC 0003, ADR 0009).
-- Organisation facts and assessments only. These tables never hold people's details.
-- Row-level security on every table; members see only their own organisation.

-- The published register. Each version is approved by a named reviewer before members see it.
create table if not exists compliance_register (
  version text primary key,
  content jsonb not null,
  status text not null check (status in ('draft', 'reviewed')),
  published_at timestamptz not null default now(),
  approved_by text not null,                 -- reviewer's name or role, for the audit trail
  change_summary text
);
alter table compliance_register enable row level security;
create policy compliance_register_read on compliance_register for select to app_user using (true);
grant select on compliance_register to app_user;

-- Official sources the watcher checks for changes.
create table if not exists compliance_source (
  id text primary key,
  name text not null,
  url text not null check (url like 'https://%'),
  jurisdiction text not null,
  enabled boolean not null default true,
  last_hash text,
  last_checked_at timestamptz,
  last_changed_at timestamptz
);
alter table compliance_source enable row level security;   -- service role only

-- A change the watcher found. An agent may draft a summary; a person decides.
create table if not exists compliance_change (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references compliance_source(id),
  detected_at timestamptz not null default now(),
  draft_summary text,                        -- AI or template draft, never shown to members until approved
  status text not null default 'pending' check (status in ('pending', 'approved', 'dismissed')),
  decided_by uuid references app_user_account(id),
  decided_at timestamptz,
  decision_note text,
  register_version text references compliance_register(version)
);
create index if not exists compliance_change_status_idx on compliance_change (status, detected_at desc);
alter table compliance_change enable row level security;   -- service role only (foundation team)

-- A member's profile: organisation facts that decide which obligations apply.
create table if not exists compliance_profile (
  org_id uuid primary key references organisation(id) on delete cascade,
  profile jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references app_user_account(id)
);
alter table compliance_profile enable row level security;
create policy compliance_profile_own on compliance_profile for all to app_user using (org_id = app_org()) with check (org_id = app_org());
grant select, insert, update on compliance_profile to app_user;

-- A member's answers to evidence questions.
create table if not exists compliance_answer (
  org_id uuid not null references organisation(id) on delete cascade,
  evidence_id text not null,
  answer text not null check (answer in ('yes', 'no', 'unsure', 'not_applicable')),
  note text check (length(note) <= 1000),    -- organisation notes only; the app asks people not to enter personal details
  updated_at timestamptz not null default now(),
  updated_by uuid references app_user_account(id),
  primary key (org_id, evidence_id)
);
alter table compliance_answer enable row level security;
create policy compliance_answer_own on compliance_answer for all to app_user using (org_id = app_org()) with check (org_id = app_org());
grant select, insert, update, delete on compliance_answer to app_user;

-- Quarterly assessments. Drafted by the scheduler, approved by a person at the ministry.
create table if not exists compliance_assessment (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organisation(id) on delete cascade,
  quarter text not null check (quarter ~ '^[0-9]{4}-Q[1-4]$'),
  register_version text not null references compliance_register(version),
  result jsonb not null,
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references app_user_account(id),
  unique (org_id, quarter)
);
alter table compliance_assessment enable row level security;
create policy compliance_assessment_own on compliance_assessment for select to app_user using (org_id = app_org());
create policy compliance_assessment_approve on compliance_assessment for update to app_user using (org_id = app_org()) with check (org_id = app_org());
grant select, update (approved_at, approved_by) on compliance_assessment to app_user;

-- Sources to watch. URLs are checked for changes; a person reviews every change.
insert into compliance_source (id, name, url, jurisdiction) values
  ('privacy-act', 'Privacy Act 1988 (Cth)', 'https://www.legislation.gov.au/C2004A03712/latest/text', 'CTH'),
  ('oaic-app', 'OAIC: Australian Privacy Principles', 'https://www.oaic.gov.au/privacy/australian-privacy-principles', 'CTH'),
  ('oaic-copc', 'OAIC: Children''s Online Privacy Code', 'https://www.oaic.gov.au/privacy/privacy-registers/privacy-codes/childrens-online-privacy-code', 'CTH'),
  ('oaic-ndb', 'OAIC: Notifiable Data Breaches', 'https://www.oaic.gov.au/privacy/notifiable-data-breaches', 'CTH'),
  ('acnc-reporting', 'ACNC: Reporting annually', 'https://www.acnc.gov.au/for-charities/manage-your-charity/obligations-acnc/reporting-annually-acnc', 'CTH'),
  ('acnc-standards', 'ACNC: Governance Standards', 'https://www.acnc.gov.au/for-charities/manage-your-charity/governance-hub/governance-standards', 'CTH'),
  ('acma-spam', 'ACMA: Avoid sending spam', 'https://www.acma.gov.au/avoid-sending-spam', 'CTH'),
  ('nsw-ocg-faith', 'NSW Office of the Children''s Guardian: faith-based organisations', 'https://ocg.nsw.gov.au/child-safe-scheme/sector-specific/faith-based-organisations', 'NSW'),
  ('qld-cso-act', 'Child Safe Organisations Act 2024 (Qld)', 'https://www.legislation.qld.gov.au/view/whole/html/inforce/current/act-2024-049', 'QLD'),
  ('act-child-safe', 'ACT Child Safe Standards', 'https://hrc.act.gov.au/childrenyoungpeople/act-child-safe-standards', 'ACT'),
  ('national-principles', 'National Principles for Child Safe Organisations', 'https://www.humanrights.gov.au/national-principles-child-safe-organisations', 'CTH')
on conflict (id) do nothing;
