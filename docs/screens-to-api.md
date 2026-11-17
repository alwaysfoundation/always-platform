# Prototype screens to API and data

How each prototype board (Always core flow prototypes) maps to the API and tables, so design and build stay in step.

| Board | Who | API | Tables |
| --- | --- | --- | --- |
| A1 Main, C1 Capture, `<always-response>` | Person at an event | `POST /v1/responses` (via the sender's backend) | response, consent, handoff, person_link, outbox |
| A4 Parent | Parent of a 13 to 14 year old | `POST /v1/parent/{token}/confirm` | consent.parent_confirmed_at |
| A2 Confirmed, A5 Texts, A6 Check-in | Person | `GET /v1/me/{token}`, `POST /v1/me/{token}/connected`, `/withdraw` | handoff, consent |
| B1 Alert | Church | email `offer.new` from the outbox | outbox |
| B2 Accept | Church | `GET /v1/inbox`, `POST /v1/handoffs/{id}/accept`, `/pass` | handoff_offer, audit_event |
| B4 Inbox, B5 Person | Church | `GET /v1/inbox`, `POST /v1/handoffs/{id}/contacted`, `/activity` | activity |
| B3 Claim | Church | `POST /v1/orgs/{id}/claims` | claim_request |
| B6 Settings, B7 Church profile, B10 Church page | Church | `GET/PUT /v1/org/profile`, `GET /v1/orgs/{slug}` | organisation.page_layout, offer_category, capacity |
| B9 Coach | Church | static content (next) | none |
| C2 Console, C3 Campaign | Sender | tokens, placements (next) | api_token |
| D1 Routing, D3 Care | Care team | `POST /jobs/tick`, care inbox (next) | handoff, handoff_offer |
| D2 Verify | Care team | `POST /v1/ops/orgs/{id}/verify` | organisation.trust_level |
| D4 Directory | Anyone | `GET /v1/directory`, `/tally` | directory_listing |
| D5 Promise, D6 Network | Anyone | aggregates with minimum group sizes (next) | directory_tally |
