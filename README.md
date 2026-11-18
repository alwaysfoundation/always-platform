# Always platform

**No one who responds to Jesus should walk alone.**

Always connects the body of Christ in Australia, so everyone who responds to Jesus is offered their next best faith step, often a local church, sometimes a course, discipleship or care, with a real person walking with them. It is a gift to the Church: shared, not owned, open source, and every person's story stays theirs.

See [ROADMAP.md](ROADMAP.md) for what we're building next.

## What's here

| Path | What it is |
| --- | --- |
| `packages/core` | The rules engine: the consent primitive, minors rules, matching, the two-clock handoff, retention. Pure and fully tested. |
| `packages/db` | Database helpers. Every request runs under Postgres row-level security. |
| `packages/sdk` | The Always SDK: `<always-response>` web component, typed API client, consent builder, webhook verification. |
| `apps/api` | The Always API (Hono), scheduler jobs, delivery adapters (Amazon SES email in Sydney, Australian SMS, signed webhooks). |
| `db/migrations` | Schema, row-level security and the public directory views. |
| `spec/` | The Always Handoff standard (JSON Schema, CC BY 4.0). |
| `api/openapi.yaml` | The Always API contract (OpenAPI 3.1). |
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
