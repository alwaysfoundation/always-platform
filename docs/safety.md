# Always Safety: developer guide

Always Safety is the shared source of truth for the rules around safe follow-up (privacy, children and young people, and emails and texts): an open register of obligations, a stateless check-up, rule-change alerts and guardrails. Ministry apps and websites plug into it instead of building their own. This guide is for developers and the foundation team. The original design is in [RFC 0003](rfc/0003-always-compliance.md), [RFC 0004](rfc/0004-compliance-infrastructure.md) and [ADR 0009](adr/0009-compliance-register-and-human-review.md).

It is a guide to common obligations, not legal advice, and it does not cover charity reporting or governance (ADR 0023). Each ministry remains responsible for its own legal advice and decisions. The code is free and open source: check it with your own developers and lawyers before you rely on it, and report bugs as GitHub issues (security issues to security@alwaysfoundation.org, see [SECURITY.md](../SECURITY.md)).

## Where it applies

| Where | Code | In the register |
| --- | --- | --- |
| Australia | `AU` | Federal privacy and messaging law, plus child safety rules in every state and territory |
| United States | `US` | Federal rules and good practice; state laws are being added |
| Canada | `CA` | Federal rules and good practice; provincial laws are not yet covered |
| United Kingdom | `GB` | UK-wide rules |
| European Union | `EU` | EU-wide law; national laws are being added |
| New Zealand | `NZ` | National rules |

The whole register is a draft (`status: draft`) until a named person on the foundation team publishes a reviewed version. Every obligation outside Australia has `confidence: verify`.

## Pieces

| Piece | Where |
| --- | --- |
| The register (open data, CC BY 4.0) | `spec/safety/register.json` |
| The assessment engine (pure, tested) | `packages/core/src/compliance.ts` |
| API routes and jobs | `apps/api/src/compliance.ts` |
| Tables, with row-level security | `db/migrations/0020_compliance.sql` |
| Cross-tenant test | `db/test/compliance_rls_test.sql` |
| Webhook endpoints and change alerts | `apps/api/src/webhooks.ts`, `queueChangeAlerts` in `apps/api/src/compliance.ts` |
| Guardrails for any app | `packages/sdk/src/guardrails.ts` |
| Embeddable check-up | `packages/sdk/src/safety-widget.ts` |
| MCP tools | `safety_obligations` and `safety_check` in `apps/api/src/mcp.ts` |

Internal file and table names still say `compliance`; public paths, events, scopes and names say `safety`.

## Use the register

```sh
curl https://api.alwaysfoundation.org/v1/safety/register
```

Run a check-up without signing in. It takes organisation facts only, and nothing is stored:

```sh
curl -X POST https://api.alwaysfoundation.org/v1/safety/check \
  -H 'content-type: application/json' \
  -d '{"profile":{"countries":["GB","NZ"],"collectsPersonalInfo":true,"providesHealthService":false,"usesOverseasServices":false,"worksWithChildren":true,"onlineServicesForChildren":false,"sendsEmailOrSms":true}}'
```

Questions that don't apply can be left out and read as "no". A profile without `countries` means Australia. When `AU` is chosen, give at least one state in `states`.

Or use the engine directly in TypeScript:

```ts
import { assess } from '@always/core';
const result = assess(register, profile, answers, {}, new Date());
```

The earlier `/v1/compliance/*` paths still work and return `Deprecation: true` with a link to the new path.

## Build on it

Pin a version, or follow the latest with its ETag:

```sh
curl https://api.alwaysfoundation.org/v1/safety/register/versions
curl https://api.alwaysfoundation.org/v1/safety/register/2026.11.1
```

Signed-in routes take an admin session or a token with the `safety` scope (tokens issued with the earlier `compliance` scope still work).

Get change alerts. Create an endpoint (admin, or a token with the `webhooks` scope) and keep the secret it returns:

```sh
curl -X POST https://api.alwaysfoundation.org/v1/webhooks \
  -H "authorization: Bearer $ALWAYS_TOKEN" -H "x-always-org: $ORG_ID" -H 'content-type: application/json' \
  -d '{"url":"https://your-app.example/hooks/always","events":["always.safety.obligations.affected"]}'
```

| Event | Sent to | Data |
| --- | --- | --- |
| `always.safety.register.published` | every subscriber | version, status, summary, changed obligations |
| `always.safety.obligations.affected` | members whose obligations changed | version, obligation ids |

Endpoints that subscribed under the earlier `always.compliance.*` names still receive those names. Verify each delivery with `verifyWebhook` from the SDK. Affected members also get an email.

Embed the check-up in any page. It calls the public check-up, so nothing is stored and no token is needed:

```html
<script type="module" src="https://alwaysfoundation.org/sdk/v0/safety-widget.js"></script>
<always-safety-check accent="#5B67D8"></always-safety-check>
```

Listen for `always-safety-result`. The earlier `<always-compliance-check>` element still works.

Use the guardrails in your own code. They fail closed:

```ts
import { ageGuard, requireConsent, personalDataProblems, spamActProblems, messageFooter } from '@always/sdk';

if (!ageGuard(person.ageBand).aiAllowed) skipAi();
requireConsent(person.consent, 'connect.church'); // throws without it
```

The SDK and core packages are in this repository; they are not published to npm yet.

## Statuses

| Status | Meaning |
| --- | --- |
| `met` | Every piece of evidence is shown |
| `attention` | At least one answer is "no" |
| `check` | Something is unanswered or unsure |
| `upcoming` | Not in force yet; shows the start date |

Each item is `required` (a legal requirement for this ministry) or `recommended` (good practice). Watch items are listed separately and are never actions.

## Add or change an obligation

1/ Edit `spec/safety/register.json`. Set `country`, cite an official https source and set `confidence` to `draft` or `verify`.

2/ Run `npm test`. The register must pass `validateRegister`, and the engine tests must still pass.

3/ Open a pull request. Someone checks the wording against the source.

4/ After merge, the foundation team publishes the version with `POST /v1/ops/safety/register`, naming who approved it.

## Jobs

| Job | Schedule | What it does |
| --- | --- | --- |
| `/jobs/safety-watch` | Daily | Checks each official source; records a pending change for review |
| `/jobs/safety-quarterly` | Daily | On the first run of each quarter, drafts each member's assessment and emails them |

Both need `CRON_SECRET`, are idempotent and safe to run twice. The earlier `/jobs/compliance-*` paths still work.

## Rules that never change

- No people's details in safety tables, emails or logs.
- AI may draft a summary of a change for the foundation team. A person decides. AI never touches minors' data.
- Only a signed-in person can approve an assessment.
