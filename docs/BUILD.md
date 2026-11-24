# Always Platform: what we build and how

## In one line

Free, open-source tools that help churches and ministries welcome every person who says yes to Jesus, under their own name, with consent that travels with the person.

## What we build

1. **The Always Handoff standard.** An open specification (JSON Schema, CC BY 4.0) for passing a person from one ministry to another with their consent attached: the consent receipt, the introduction and its outcome.
2. **The Always account** at my.alwaysfoundation.org. One sign-in (email code), with modules a church or ministry switches on:
   - **Respond:** a response page for every account (`/p/<slug>`), with its own logo and colours, QR code and printable welcome card.
   - **Connect:** an inbox where a church accepts or passes each introduction; the next nearby church is offered, and a care team catches anyone missed.
   - **Safety:** a rules register by country and a quarterly check-up.
   - **Reports:** totals for boards and funders, never names.
   - **Always AI:** open models running in the browser on the person's own device, with Scripture looked up, not generated.
3. **The Always API.** REST and signed webhooks for integrations, with scoped, revocable tokens.
4. **The Always SDK** (`@always/sdk`): a typed client, `buildConsent()`, `verifyWebhook()` and the `<always-response>` web component.

## What is different

1. **Consent travels with the person.** Every step checks the consent receipt and fails closed.
2. **One introduction at a time.** Churches never compete for people; the local church decides.
3. **No linkage across organisations.** We never recognise the same person across ministries (see the record linkage case study on the website).
4. **Free, open and portable.** No fees, ads, data sales or donation asks. Apache 2.0 code, full export, and anyone can run it themselves.

## The stack

| Layer | Choice | Where |
| --- | --- | --- |
| Database | Supabase Postgres, row-level security on every table holding personal data | Sydney (ap-southeast-2) |
| Sign-in | Supabase Auth, email code | Sydney |
| API | TypeScript, Hono, Zod on Node | Railway, Singapore (asia-southeast1) |
| Always account | Next.js static export, served by the website's Cloudflare worker | Cloudflare edge |
| Website | Static site built from `always-website`, Cloudflare worker | Cloudflare edge |
| Scheduler | Supabase pg_cron calling idempotent job endpoints (`db/supabase/jobs.sql`) | Sydney |
| Email | Resend, from notify.alwaysfoundation.org; alerts carry no personal data | |
| SMS | HTTP SMS provider adapter | |
| Field encryption | Application-level encryption before data reaches the database (`FIELD_KEY`), keyed hashes (`HASH_KEY`) | |
| Human check | Cloudflare Turnstile on public forms | |
| Always AI | WebLLM in a web worker; Gemma and Qwen models | The person's device |
| Analytics | Cloudflare Web Analytics, no cookies | |
| Code and CI | GitHub, GitHub Actions | |

**Repository layout:**
- `packages/core`: the rules engine (consent, minors, matching, timers, retention). Pure functions, fully tested.
- `packages/db`: database helpers that run every request under row-level security.
- `packages/sdk`: the Always SDK.
- `apps/api`: the API, scheduled jobs and delivery adapters.
- `apps/web`: the Always account, response pages, Always AI and the demo.
- `db/migrations`: schema, policies and their tests.
- `spec/`: the Always Handoff standard.

## What it costs to run

Roughly US$50 to $100 a month at launch: Supabase Pro ($25), Railway (usage, about $5 to $20), Resend (free tier, then $20), SMS by use, Cloudflare ($0). The founding team covers running costs, so it stays free for every church and ministry.

## Security and privacy

- Row-level security on every table holding personal data, with cross-tenant tests.
- Names, contacts and notes are encrypted before they reach the database.
- A church sees contact details only after it accepts an introduction.
- Notifications and webhooks carry ids, never personal details.
- The audit log is append-only and hash-chained.
- Minors rules run first and cannot be configured. Under 13: no child data. Under 15: a parent confirms. Minors go only to verified youth partners. No AI on minors' data.
- What people ask Always AI never leaves their device.
- Retention is automatic: unreceived adults after 30 days, minors after 14, withdrawals within 7 days.

## CI

Every pull request runs type checks, unit and integration tests against Postgres, row-level security tests, schema validation, secret scanning, a DCO sign-off check, CodeQL and dependency review. Every change needs two human approvals, and code owners approve changes to `auth/`, `consent/`, `minors/`, `crypto/`, `access/` and `routing/`.

## Licences and ownership

- **Owner:** Always Foundation, a US 501(c)(3), owns the code, the standard and the Always name and marks.
- **Code:** Apache 2.0. **Docs, the standard, policies and training:** CC BY 4.0.
- **Brand:** "Always", "Always Foundation" and the mark are trademarks, not open licensed. Anyone may say "built on Always". See `TRADEMARKS.md`.
- **Contributions:** Developer Certificate of Origin (signed-off commits), no CLA. AI-assisted commits carry a co-author trailer.
- **Third-party terms:** apps using YouVersion through the SDK follow YouVersion's terms. Model and data licences are listed in `ai/`.
