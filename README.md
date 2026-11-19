# Always Platform

**Together for the Gospel.**

Always Platform is the open-source technology of the Always Foundation, an independent, member-based Christian nonprofit that brings churches and Christian ministries together across Australia. It powers the tools members use to:

- **Equip:** the Always App for evangelists, branded response pages, forms and QR codes.
- **Support:** shared tools for governance, compliance, safeguarding and reporting.
- **Connect:** the church and ministry directory, common standards, and a consent-based handoff that connects each person who responds to Jesus with a local church, with a real person walking with them.

It is built together and shared freely: free for churches, open source, and every person's details stay theirs, in Australia.

See [ROADMAP.md](ROADMAP.md) for what we're building next.

## What's here

| Path | What it is |
| --- | --- |
| `packages/core` | The rules engine: the consent primitive, minors rules, matching, the two-clock handoff, retention. Pure and fully tested. |
| `packages/db` | Database helpers. Every request runs under Postgres row-level security. |
| `packages/sdk` | The Always SDK: `<always-response>` web component, typed API client, consent builder, webhook verification. |
| `apps/api` | The Always API (Hono), scheduler jobs, delivery adapters (Resend email, Australian SMS, signed webhooks). |
| `db/migrations` | Schema, row-level security and the public directory views. |
| `spec/` | The Always Handoff standard (JSON Schema, CC BY 4.0). |
| `api/openapi.yaml` | The Always API contract (OpenAPI 3.1). |
| `spec/compliance/` | The Always Compliance register: open, reviewed obligations for Australian ministries (CC BY 4.0). Versioned feed, change alerts, an embeddable check-up and guardrails for any app. See `docs/compliance.md`. |
| `docs/BUILD.md` | What we build, what's new, the stack, costs, CI/CD, licences and setup. Start here. |

## Run it locally

```sh
cp .env.example .env.local            # add keys: openssl rand -base64 32
make up && make migrate && make seed  # Postgres 16 in Docker, schema, demo data
npm run import:directory -- path/to/directory.csv   # optional: the Australian directory
make dev                              # API on http://localhost:8787
make check                            # types and 68 tests against real Postgres
```

## Principles that are enforced in code

- Consent travels with the person and every data movement checks it, failing closed.
- Minors rules run first and can't be configured away.
- Personal data stays in Australia, is encrypted before it reaches the database, and never appears in logs, emails or webhooks.
- Each introduction has one clear owner at a time, so no one is dropped; if no one can help, the care team does.
- Only the person can say they are connected.

## Licences

Code: Apache 2.0 (`LICENSE`). Docs, the standard and policies: CC BY 4.0 (`CONTENT-LICENSE.md`). The Always name and mark are trademarks (`TRADEMARKS.md`). Contributions use the DCO (`CONTRIBUTING.md`). Report security issues privately (`SECURITY.md`).
