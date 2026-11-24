# Always platform: what we're building and how

## What Always is, in one line

Always is a shared, consent-first network that makes sure everyone who responds to Jesus in Australia is offered their next best faith step, often a local church, sometimes a course, discipleship or care, with a real person walking with them.

## What exactly Always builds

Five things, all open source.

1/ **The Always Handoff standard.** An open specification (JSON Schema) for passing a person from one ministry to another with their consent attached. Any church app, events tool or CRM can implement it. It defines the consent receipt, the response, the offer, the handoff states and the events (CloudEvents) that systems exchange.

2/ **The Always Network (the platform).** The hosted service the foundation runs for the Church in Australia:
- the directory that maps every evangelical and Pentecostal church and ministry (3,810 so far)
- verified profiles and customisable church pages
- the matching and handoff engine, with its timers and care-team fallback
- the church inbox, and self-service links for the person
- the audit log

3/ **The Always API.** A REST API (OpenAPI 3.1) and signed webhooks so any system can send responses in, receive introductions, update a profile, or listen for events. Sender integrations use scoped, revocable API tokens; church staff sign in with passkeys or an authenticator app.

4/ **The Always SDK** (`@always/sdk`). A small TypeScript library and a drop-in web component that make "add Always to your app" a ten-minute job:
- `<always-response>`, a consent-first response card for any event page or app, brandable to the ministry's own colours (see the UEN example in the prototype)
- `AlwaysClient`, a typed client for the API
- `buildConsent()`, the consent primitive with versioned plain-language wording
- `verifyWebhook()`, to check signed events

5/ **Tools for people.** The church inbox ("welcome from your phone"), church page builder, care-team console, campaign and placement tools for senders, coaching, and the public promise page that shows how we're going.

## What's new: the innovation

Lots of tools capture decision cards. Always is different in four ways that work together.

1/ **Consent that travels with the person (the consent primitive).** Every person carries a consent receipt: what they agreed to, who may receive their details, who agreed (them or a parent), their age band and the exact words they saw. Every system checks it before touching their details and fails closed. Withdrawal is one tap and reaches everyone holding their details. Nothing else in this space makes consent the unit of exchange between ministries.

2/ **Every response gets a next step.** One church or ministry at a time holds an introduction for a set window (configurable; two staffed hours in pilots). If it passes or doesn't answer, the next suitable one is offered. If none can, the care team helps. We don't publish a timing promise.

3/ **Only the person says "connected".** We count someone as connected only when they confirm it themselves, and we publish our numbers, including the people we missed. That honesty is what churches and supporters can trust.

4/ **Shared, not owned.** Members-based, open source, data kept in Australia, nothing sold, and every church and ministry free to take its information and go. That makes it safe for the whole Church to use one network, across denominations, instead of each building its own.

## Where YouVersion fits

YouVersion Platform is free for non-commercial use and opens the technology behind the Bible App to ministries. We use it in three places:

1/ **Scripture from the first step.** When someone responds, the "Start reading the Bible" step opens a reading plan or the Bible in their language, while a church gets in touch. This uses YouVersion's Bible SDKs in member apps and on the person's status page.

2/ **Sign in with YouVersion.** People and partner apps can sign in with an existing YouVersion account (OAuth 2.0 and OpenID Connect). If the person agrees, Always links that sign-in to their home church, so their church stays with them across member apps. They can change or remove the link at any time.

3/ **Every member app starts with Scripture.** Apps built on the Always SDK can add YouVersion's Bible reader in a few lines, and follow YouVersion's terms: free to use, no paywall on Scripture, no ads.

YouVersion confirms who someone is. Always holds which church they belong to and what they agreed to share. Neither holds the other's data.

## The stack, end to end

Chosen for three things: personal data stays in Australia, it costs very little to run, and a small team (with AI help) can build and run it well.

| Layer | Choice | Why | Region |
| --- | --- | --- | --- |
| Database | Supabase Postgres 16 | Row-level security does our access control; managed backups; open source, so no lock-in | Sydney (ap-southeast-2) |
| Staff sign-in | Supabase Auth | Email plus passkeys or an authenticator app; MFA required for admins and care team | Sydney |
| API | TypeScript, Hono, Zod | Small, fast, runs anywhere (Node, Vercel, Cloudflare); typed end to end | Vercel functions pinned to Sydney (syd1) |
| Web apps | Next.js on Vercel | Church inbox, page builder, care console, person pages, public directory | syd1 |
| Marketing site | Static, Cloudflare Pages | Free, fast, no personal data | Global CDN |
| Scheduler | Vercel Cron (every minute) calling idempotent job endpoints; Supabase pg_cron as backup | Timers, outbox, nightly retention | Sydney |
| Email | Amazon SES (transactional) | About US$0.10 per 1,000 emails; email addresses are processed onshore; staff alerts carry no personal data | Sydney (ap-southeast-2) |
| SMS | An Australian SMS provider (Mobile Message, MessageMedia or similar) | Data stays onshore; low volume because churches text from their own phones | Australia |
| Field encryption keys | AWS KMS | One key per environment; the database only sees ciphertext | Sydney |
| Maps | Suburb centroids from ABS open data; MapLibre with self-hosted tiles | No Google Maps bill; no street addresses for people | Sydney |
| Mobile | Web apps only for now (installable PWA); no native app | One codebase, nothing to download, add to home screen | n/a |
| Speech to text (Always app field notes) | NVIDIA Parakeet TDT 0.6B v2 (English), on the phone: Core ML through FluidAudio on iOS, ONNX Runtime (sherpa-onnx) on Android. Whisper as the fallback for languages Parakeet doesn't cover | Offline and private: audio never leaves the phone. Open weights under CC BY 4.0, credited in the app. About 500 MB quantised, downloaded on first use over Wi-Fi | On the phone |
| Errors and uptime | Sentry with personal data scrubbing; Better Stack uptime | Free tiers to start | n/a |
| Code, CI and issues | GitHub (public), GitHub Actions, Linear | Free for open source | n/a |

**Repository layout (monorepo):**
- `packages/core` is the rules engine: consent, minors, matching, timers and retention. Pure functions, fully tested.
- `packages/db` holds the database helpers that run every request under row-level security.
- `packages/sdk` is the Always SDK.
- `apps/api` is the Always API, the scheduler jobs and the delivery adapters.
- `apps/web` (next) holds the church inbox, page builder, care console and person pages, built from the prototype.
- `db/migrations` holds the schema, row-level security policies and their tests.
- `spec/` is the Always Handoff standard; `api/openapi.yaml` is the API contract.

## What it costs to run

Estimated monthly cost at launch (US dollars, before GST), checked November 2026:

| Item | Monthly |
| --- | --- |
| Supabase Pro (production, includes a small compute instance) | $25 |
| Supabase staging project | about $10 |
| Vercel Pro (one seat; extra seats $20 each) | $20 |
| Cloudflare (DNS, WAF, Pages) | $0 |
| Amazon SES | about $1 |
| AWS KMS (two keys) | about $2 |
| SMS (about 1,000 confirmation texts at roughly 5 cents) | about $50 |
| Domain and email (Google Workspace for Nonprofits or Microsoft 365 nonprofit grant) | $0 to $10 |
| **Total** | **about $110 to $120** |

At 1,000 partners the database moves up a compute size and SMS grows with use: expect roughly $300 to $600 a month. Larger ministries' contributions are designed to cover this, so it stays free for every church.

## Security and privacy built in

- Every table holding personal data has row-level security, with tests that prove one church can't see another's people.
- Names, contacts and notes are encrypted in the application before they reach the database.
- Contact details are only shown to a church after it accepts.
- Notifications and webhooks carry ids, never personal details.
- The audit log is append-only and hash-chained, so tampering is detectable.
- Minors' rules run first and can't be switched off. Under 13: no child data. Under 15: a parent confirms. Minors go only to verified youth partners, and no AI touches their data.
- Retention is automatic: unreceived adults after 30 days, minors after 14, withdrawals within 7 days.

## CI/CD

Every pull request runs:
- type checks
- unit and integration tests against a real Postgres
- row-level security tests
- standard schema validation
- secret scanning (gitleaks)
- a DCO sign-off check
- CodeQL security analysis
- dependency review, which blocks high-severity vulnerabilities and incompatible licences

Main branch:
- Merges deploy to staging automatically, running migrations first.
- Releases are cut by release-please from conventional commits.
- Production deploys only when a release is published and a maintainer approves the production environment in GitHub.
- A software bill of materials (CycloneDX) and an OpenSSF Scorecard run weekly. Dependabot keeps dependencies current.

## Open source, licences and IP

- **Code:** Apache 2.0, which is permissive, widely trusted and includes a patent grant, so churches, ministries and companies can all build on it.
- **Docs, the standard, policies and training:** CC BY 4.0.
- **Brand:** "Always", "Always Foundation" and the mark are trademarks, not open licensed, so no look-alike service can misuse people's trust. Anyone may say "built on Always".
- **Contributions:** Developer Certificate of Origin (signed-off commits), no CLA. Contributors keep their copyright and license it to everyone on the same terms. AI-assisted commits are disclosed with a co-author trailer.
- **Ownership:** Rejoice and UEN steward the code and brand on the foundation's behalf, and will assign them to Always Foundation, a US 501(c)(3). A short assignment deed makes this binding.
- **Third-party terms:** apps using YouVersion through the SDK follow YouVersion's terms. NVIDIA Parakeet weights are CC BY 4.0: we credit NVIDIA in the app's About screen and in the docs.
- **Governance:** Technology Steering Committee for the roadmap and standard; the Safeguarding, Privacy and Ethics Committee approves any change to consent, minors, retention, timers or AI; two human approvals on every change.

## Setting up: what we need, in order

1/ **Domain and email.** Register alwaysfoundation.org (and .org.au when eligible). Set up Google Workspace for Nonprofits or Microsoft 365 nonprofit once the charity is registered (free); until then a paid starter plan. Create these addresses: hello@, security@, safeguarding@, conduct@, maintainers@, and a shared ops@ for service accounts. Turn on two-step verification for everyone.

2/ **GitHub organisation** `alwaysfoundation`, owned by ops@:
- require two-factor authentication for all members
- create teams: maintainers, safeguarding, security, standard
- make repositories public: always-platform, always-website, always-standard
- turn on private vulnerability reporting, secret scanning and push protection
- protect `main` (pull requests only, two approvals, code owners, status checks)
- set up `staging` and `production` environments, with a required reviewer on production

3/ **Supabase.** An organisation on ops@ with two projects in Sydney: always-staging and always-production. Turn on point-in-time recovery for production when budget allows. Store the database URLs in GitHub environment secrets.

4/ **Vercel.** A team on ops@ with one project for apps/api plus apps/web. Pin functions to syd1, add the environment variables, and connect the GitHub repository.

5/ **AWS** (one account, Sydney only, with an organisation policy denying other regions):
- KMS keys for staging and production
- SES in Sydney with send.alwaysfoundation.org verified (SPF, DKIM), a DMARC record on the root domain, and production access requested
- separate IAM users for staging and production, allowed only ses:SendEmail

6/ **SMS.** Open an account with an Australian provider, register the "Always" sender ID, and store the API key.

7/ **Cloudflare.** Move DNS for alwaysfoundation.org, and host the marketing site on Pages.

8/ **Linear and GitHub Projects.** Mirror the build checklist as issues.

9/ **Legal:**
- the IP assignment deed from Rejoice and UEN to Always Foundation
- trademark filing for "Always Foundation"
- data processing terms with each provider
- partner terms

Everything personal lives in Sydney. No service on this list stores people's details offshore.
