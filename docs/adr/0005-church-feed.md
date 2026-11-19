# ADR 0005: The church feed, verification and the MCP server

Status: Proposed

## Context

RFC 0001 starts the Always Network with an open, low-risk wedge: a trustworthy list of churches ready to welcome people, which ministries, apps and AI assistants can use, and which gives churches a reason to claim their page and connect.

## Decision

1/ Churches **opt in** to the feed (`organisation.feed_opt_in_at`). The directory imported from public denominational listings is never republished in bulk.
2/ The feed holds **organisation facts only**: name, suburb, denomination, rough location (3 decimal places), service times, languages, next steps, and computed badges. No staff names, phones or emails.
3/ **Welcoming now** is computed in the `org_readiness` view: verified, connect lead trained, details confirmed in 90 days, capacity left this month, not paused, and at least 80% of the last 20 offers answered (or fewer than 5 offers). A church sees its own rate on its Listing page; nobody else does.
4/ Open endpoints: `GET /v1/feed/churches`, `GET /v1/feed/churches.jsonl`, `GET /v1/verify/{slug}`, plus CORS for any website. A developer key (`x-always-key`, `alk_test_` / `alk_live_`) is optional; an invalid key is refused.
5/ **MCP server v1** at `POST /mcp` (stateless Streamable HTTP) with four read-only tools that call the same public endpoints. It cannot read people, inboxes or any young person's information, and cannot act. `GET /llms.txt` describes the API for agents.
6/ SDK: `client.feed.churches()`, `client.feed.verify()`, and the `<always-church-finder>` web component.

## Consequences

- AI-first by design for public data; personal data stays behind consent, sign-in and a person approving actions (RFC 0001).
- Each church controls whether it appears. The feed grows only as churches claim and opt in.
- Readiness depends on data churches keep current; stale churches drop out of "welcoming now" automatically.
