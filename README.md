# Always Platform

**Together for the Gospel.**

Always Platform is the open-source technology of the Always Foundation, a gospel technology ministry serving churches and Christian ministries freely. The foundation is a Delaware nonprofit corporation, recognised by the IRS as tax-exempt under section 501(c)(3). It owns this code, the Always Pathway standard and the Always name outright, and has no commercial arm. Churches and ministries use one free account with three tools, and reports included:

- **Equip, with Always Respond:** branded response pages, forms and QR codes, and the Always Sent app for everyday evangelists.
- **Support, with Always Safety:** the rules for safe follow-up (privacy, children and young people, emails and texts), with a quarterly check-up. Totals-only reports come with every account.
- **Connect, with Always Connect:** common standards and a consent-based handoff, so ministries can pass each person who responds to Jesus on to the right next step and a local church, with a real person walking with them.

It is built together and shared freely: free for churches, open source, and every person's details stay theirs.

**Why we build.** The Gospel is the power of God for salvation; technology is a gift of common grace that can serve it but never change a heart. Christ builds His Church. We build with excellence, but we don't place our hope in what we build.

See [ROADMAP.md](ROADMAP.md) for what we're building next.

## What's here

| Path | What it is |
| --- | --- |
| `packages/core` | The rules engine: the consent primitive, minors rules, matching, the two-clock handoff, retention. Pure and fully tested. |
| `packages/db` | Database helpers. Every request runs under Postgres row-level security. |
| `packages/sdk` | The Always SDK: `<always-response>` web component, typed API client, consent builder, webhook verification. |
| `apps/api` | The Always API (Hono), scheduler jobs, delivery adapters (email through Resend, an HTTP SMS provider, signed webhooks). |
| `apps/web` | The Always account at my.alwaysfoundation.org: sign-in, modules, inbox, reports, settings and the demo. |
| `db/migrations` | Schema, row-level security and the public directory views. |
| `spec/` | The Always Pathway standard, JSON Schema, CC BY 4.0: v0.2 for any country (`handoff-standard-v0.2.schema.json`, with a synthetic example) and v0.1, the Australian profile. Also the Always Safety register. |
| `api/openapi.yaml` | The Always API contract (OpenAPI 3.1). |
| `spec/safety/` | The Always Safety register: open obligations for ministries in Australia, the US, Canada, the UK, the EU and New Zealand (draft, CC BY 4.0). Versioned feed, change alerts, an embeddable check-up and guardrails for any app. Not legal advice. See `docs/safety.md`. |
| `ai/` | Research: the Always Scripture tool server, an assistant specification and an evaluation design for faithful Christian AI. Not a product (ADR 0022). |
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
- Personal data is encrypted before it reaches the database, kept in the person's region where practical (ADR 0020), and never appears in logs, emails or webhooks.
- Each introduction has one clear owner at a time, so no one is dropped; if no one can help, the care team does.
- Only the person can say they are connected.

## Get involved

- **Build on Always.** Start with the SDK in `packages/sdk` and the API contract in `api/openapi.yaml`. The Always Pathway standard in `spec/` is open for any app to adopt.
- **Contribute.** Issues labelled [help wanted](https://github.com/alwaysfoundation/always-platform/labels/help%20wanted) and [good first issue](https://github.com/alwaysfoundation/always-platform/labels/good%20first%20issue) are ready to pick up. Read [CONTRIBUTING.md](CONTRIBUTING.md) first.
- **Follow along.** Watch the repository for releases, and star it if you'd like to see more shared technology for churches and ministries.

## Licences

Code: Apache 2.0 (`LICENSE`). Docs, the standard and policies: CC BY 4.0 (`CONTENT-LICENSE.md`). The Always name and mark are trademarks (`TRADEMARKS.md`). Contributions use the DCO (`CONTRIBUTING.md`). Report security issues privately (`SECURITY.md`).

## Using this code

Always Platform is free and open source under Apache 2.0. Check it with your own developers and lawyers before you rely on it: Always Safety is a guide to common obligations, not legal advice, and each ministry remains responsible for its own legal advice and decisions. Report bugs as GitHub issues, and security issues privately as described in [SECURITY.md](SECURITY.md).
