# RFC 0003: Always Compliance

- Status: proposed
- Pillar: Support
- Related: ADR 0009, `spec/compliance/register.json`, `packages/core/src/compliance.ts`, `apps/api/src/compliance.ts`

## Summary

Australian churches and ministries face a growing set of rules on privacy, child safety, charity reporting and messaging, and most have no one whose job it is to keep up. Always Compliance gives every member a clear picture of where they stand, a quarterly assessment their board can approve, and a feed of what changed in the law. The rules live in an open, reviewed register that anyone can use.

It is a guide to common obligations. It is not legal advice.

## Goals

1/ Every member can see, in plain words, which obligations apply to them and what to do next.

2/ A quarterly assessment, drafted automatically and approved by a person at the ministry.

3/ Changes to the law are noticed early, reviewed by a qualified person, and explained to members.

4/ The register is open data (CC BY 4.0), so denominations, safe ministry teams and church software vendors can build on one shared view of the rules.

## Non-goals

- Legal advice, or any judgment about a specific situation.
- Holding people's details. Compliance stores organisation facts and answers only.
- Replacing denominational safe ministry programs. We link to them and make them easier to evidence.

## Design

### 1. The register

`spec/compliance/register.json` is a versioned list of obligations. Each obligation has:

| Field | Meaning |
| --- | --- |
| `appliesWhen` | A condition on the ministry's profile (state, size, works with children, and so on) |
| `requiredWhen` | When it is a legal requirement; otherwise it is shown as good practice |
| `status` | `in_force`, `upcoming` (with `commences`) or `watch` (shown, never an action) |
| `evidence` | What shows it is met: a question, a document, or a `platform` check |
| `law` | The official source, always an https link |
| `confidence` | `reviewed`, `draft` or `verify` |

Conditions are small and declarative (`all`, `any`, `not`, `field is`, `states includesAny`). Unknown shapes fail closed.

### 2. The engine

`assess(register, profile, answers, platformSignals, asOf)` in `packages/core` is pure and deterministic. Each applicable obligation is `met`, `attention` (an answer of "no"), `check` (unanswered or unsure) or `upcoming`. Items needing attention come first, required before recommended.

### 3. Evidence Always Platform vouches for

Some obligations are met by how Always Platform is built: consent receipts, row-level security, the retention schedule, minors rules, and Australian hosting. `platformSignals()` reports these, so members don't have to prove what the platform enforces in code.

### 4. Watching the law

A daily job (`/jobs/compliance-watch`) fetches each official source in `compliance_source` and compares a fingerprint of its text, ignoring markup and whitespace. A change creates a pending `compliance_change`. An agent may draft a plain-English summary. A person on the foundation team decides, and only a named reviewer can publish a new register version (`POST /v1/ops/compliance/register`). The register must validate before it is accepted.

### 5. The quarterly assessment

A daily job (`/jobs/compliance-quarterly`) drafts one assessment per member per quarter (Sydney time) against the latest published register, and emails the member that it is ready. Only a signed-in person, not a token or agent, can approve it (`POST /v1/compliance/assessments/:id/approve`). Approval sends a confirmation and is recorded in the audit log.

### 6. The public check-up

`POST /v1/compliance/check` runs the engine with nothing stored. The website's free check-up uses the same register and logic in the browser, so a ministry can see its picture before joining.

## Safety and privacy

- No people's details. Notes are limited to 1,000 characters, and the app asks members not to enter personal details.
- Row-level security on every member table, with a cross-tenant test (`db/test/compliance_rls_test.sql`).
- AI drafts summaries of changes for the foundation team only. AI never decides what the law says, never approves an assessment, and never touches minors' data.
- Every publish, decision and approval is in the hash-chained audit log.

## Alternatives considered

1/ **An AI that reads legislation and answers questions directly.** Rejected: errors would reach members as if they were advice. The register keeps a person between the law and the member.

2/ **A closed, paid compliance product.** Rejected: it duplicates effort across the sector. An open register lets everyone share one reviewed view.

3/ **Re-assessing on every change.** Deferred: a quarterly rhythm matches how boards meet. Members can see a live assessment at any time.

## Open questions

- [ ] Who reviews the register: a legal adviser, a volunteer legal panel, or both? Before the first `reviewed` version.
- [ ] Do we show a score? This RFC deliberately shows counts, not a percentage, to avoid false comfort.
- [ ] Which denominational safe ministry programs should map to evidence first?
- [ ] Reportable conduct schemes (NSW, VIC, QLD, ACT) as their own obligations in the next version.

## Rollout

1/ Merge with the draft register. The public check-up goes live on the website.

2/ A qualified reviewer approves the first `reviewed` register version.

3/ Members switch on quarterly assessments from Always for churches and ministries.
