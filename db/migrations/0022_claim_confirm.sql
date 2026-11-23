-- A claim whose email domain matches the church's website is approved when the requester
-- confirms from that inbox. Only the token's hash is stored.
alter table claim_request
  add column if not exists confirm_token_hash bytea,
  add column if not exists confirm_expires_at timestamptz,
  add column if not exists confirmed_by_email boolean not null default false;
create unique index if not exists claim_request_confirm_token on claim_request (confirm_token_hash) where confirm_token_hash is not null;
