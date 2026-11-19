# Always Compliance: developer guide

Always Compliance helps Australian churches and ministries stay on top of privacy, child safety, charity and messaging rules. This guide is for developers and for the foundation team. The design is in [RFC 0003](rfc/0003-always-compliance.md) and [ADR 0009](adr/0009-compliance-register-and-human-review.md).

It is a guide to common obligations. It is not legal advice.

## Pieces

| Piece | Where |
| --- | --- |
| The register (open data, CC BY 4.0) | `spec/compliance/register.json` |
| The assessment engine (pure, tested) | `packages/core/src/compliance.ts` |
| API routes and jobs | `apps/api/src/compliance.ts` |
| Tables, with row-level security | `db/migrations/0020_compliance.sql` |
| Cross-tenant test | `db/test/compliance_rls_test.sql` |

## Use the register

```sh
curl https://api.alwaysfoundation.org/v1/compliance/register
```

Run a check-up without signing in. Nothing is stored:

```sh
curl -X POST https://api.alwaysfoundation.org/v1/compliance/check \
  -H 'content-type: application/json' \
  -d '{"profile":{"states":["NSW"],"collectsPersonalInfo":true,"turnoverOver3m":false,"providesHealthService":false,"usesOverseasServices":false,"worksWithChildren":true,"onlineServicesForChildren":false,"sendsEmailOrSms":true,"acncRegistered":true,"basicReligiousCharity":true,"acncMediumOrLarge":false},"answers":{"wwcc-register":"yes"}}'
```

Or use the engine directly in TypeScript:

```ts
import { assess } from '@always/core';
const result = assess(register, profile, answers, {}, new Date());
```

## Statuses

| Status | Meaning |
| --- | --- |
| `met` | Every piece of evidence is shown |
| `attention` | At least one answer is "no" |
| `check` | Something is unanswered or unsure |
| `upcoming` | Not in force yet; shows the start date |

Each item is `required` (a legal requirement for this ministry) or `recommended` (good practice). Watch items are listed separately and are never actions.

## Add or change an obligation

1/ Edit `spec/compliance/register.json`. Cite an official https source and set `confidence` to `draft`.

2/ Run `npm test`. The register must pass `validateRegister`, and the engine tests must still pass.

3/ Open a pull request. A qualified reviewer checks the wording against the source.

4/ After merge, the foundation team publishes the version with `POST /v1/ops/compliance/register`, naming the reviewer.

## Jobs

| Job | Schedule | What it does |
| --- | --- | --- |
| `/jobs/compliance-watch` | Daily | Checks each official source; records a pending change for review |
| `/jobs/compliance-quarterly` | Daily | On the first run of each quarter, drafts each member's assessment and emails them |

Both need `CRON_SECRET`. Both are idempotent and safe to run twice.

## Rules that never change

- No people's details in compliance tables, emails or logs.
- AI may draft a summary of a change for the foundation team. A person decides. AI never touches minors' data.
- Only a signed-in person can approve an assessment.
