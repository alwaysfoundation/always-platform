-- 0012: receiving partners. A person can choose to have their details shared with a named partner
-- (first: Alpha Australia, for people who want to explore faith). Adults only, and only for the step
-- that partner serves. The partner's leaders see only the people who chose them.
-- Applied to production on 2026-11-18; recorded here for review.
alter table field_contact add column share_with text[] not null default '{}';
alter table field_contact add constraint fc_share_with_known check (share_with <@ array['alpha']::text[]);
alter table field_contact add constraint fc_share_with_adults check (cardinality(share_with) = 0 or age_band = '18+');
alter table field_contact add constraint fc_alpha_explore check (not ('alpha' = any(share_with)) or step = 'explore');
create index field_contact_share_idx on field_contact using gin (share_with);
