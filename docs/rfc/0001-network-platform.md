# RFC 0001: The Always Network platform

- Status: Draft for discussion
- Author: Daniel Dizon, with Claude
- Date: 2026-11-18
- Touches: `consent/`, `minors/`, `access/`, `routing/` (CODEOWNER review required)

## Summary

Always grows from one handoff service into a shared platform for the Church in Australia, in the way the YouVersion Platform opened Scripture to developers through an API, SDKs and sign-in. Five parts:

1/ **Ready to welcome**: a shared, live list of churches and ministries ready to receive people, with clear readiness rules.
2/ **One consented record**: a combined, private record of each person's journey that moves between ministries only with that person's consent.
3/ **Developer platform**: API, SDKs and an MCP server, so ministries' own apps and AI tools can use Always safely.
4/ **Reporting and compliance**: reports for funders (built) plus the evidence ministries need for privacy, child safety and charity law.
5/ **Age permissions**: one set of rules, enforced in code, for what can happen at each age.

The aim is that a ministry can join, prove it is ready, receive people, report to funders and show it is compliant without building any of this itself.

## Principles

1/ The person owns the journey. Every movement of their data is covered by a consent they can see and withdraw.
2/ Minors rules run first and cannot be configured (CLAUDE.md).
3/ Least data: share what the next step needs, nothing more.
4/ Australia only for personal data.
5/ Open by default for code and standards; private by default for people.
6/ AI helps people do the work; a person decides every step that affects someone.

## 1. Ready to welcome (shared registry)

Today the directory holds every church (`trust_level`: listed, claimed, verified, verified_youth). Many are listed but not ready to receive anyone. We add a computed **readiness** for each organisation and next step.

An organisation is **ready to welcome adults** when all hold:

1/ Verified by the foundation (denomination or network confirms it).
2/ At least one connect lead has completed the welcoming course.
3/ It offers at least one next step and has capacity this month (`capacity.monthly_limit` not reached, not paused).
4/ It has confirmed its details in the last 90 days (`last_confirmed_at`).
5/ It is meeting the response promise: offers accepted or passed within the window in at least 80% of the last 20 offers (no shaming; it just pauses routing until they're back).

It is **ready to welcome young people** when, in addition:

6/ `verified_youth`: a child safe policy, a named child safety contact, and every youth leader on the team with a current Working With Children Check recorded (state, expiry, verified by, verified on). We store the check's state and expiry, and only a keyed hash of its number.
7/ Two-adult practice confirmed for youth contact.

What's shared, with whom:

| Who | Sees |
| --- | --- |
| The public | Name, suburb, steps offered, a "welcoming now" badge. Never capacity numbers or response rates. |
| Partner ministries (API, `directory` scope) | The same, plus readiness per step, so they can route people and show options. |
| The foundation | Everything, including why an organisation isn't ready, so we can help. |

Readiness is a database view (`org_readiness`) recomputed on change, used by the matching engine (`packages/core/src/matching.ts`) instead of trust level alone.

## 2. One consented record (the combined database)

Ministries each hold fragments today: an event knows someone said yes, a church knows they came on Sunday. People get asked the same questions again, or fall through the gaps. The goal is one journey per person, held by Always, that the right people can see at the right time, with consent.

**What it is**
- A **person** record (already `response` plus `consent`, `handoff`, `activity`), linked across responses when the same person responds again, so a second ministry sees "already connected with Hope Church" instead of starting over.
- Linking uses a keyed hash of the mobile number (`HASH_KEY`) inside the platform only. Names and numbers stay encrypted (`FIELD_KEY`).

**What it isn't**
- Not a shared CRM anyone can browse. No organisation can search for people.
- Not for marketing, fundraising lists or profiling. Ever.
- Not sold, rented or exchanged.

**Consent that travels**
- Each consent names its purposes (`connect.church`, `notify.sender`, `share.journey`, `ai.assist`) and its recipients (`consent.recipients`), with `allowNextNearby` for the next church if the first passes.
- New purpose `share.journey`: the person agrees that ministries who later help them may see their earlier steps (which church, which step, when), not notes.
- A person can see, download and withdraw everything from their link (`/me/:token`). Withdrawal reaches every recipient through webhooks (`consent.withdrawn`) and deletes or de-identifies within the retention rules.
- Every read of a person's record by a ministry is written to the audit chain.

**Interoperability**
- The Always Handoff standard carries a person's next step between systems (Planning Center, Elvanto, ministry apps) with the consent receipt attached. A receiving system must honour the receipt's purposes and withdrawal.

**Minors**: no cross-ministry linking for anyone under 18. Each response by a young person stands alone (see section 5).

## 3. Developer platform (API, SDKs, MCP)

Modelled on how the YouVersion Platform works for Scripture: register an app, get a key, use typed SDKs and ready-made components, sign users in.

**Developer portal** (`developers.alwaysfoundation.org`)
- Register an app, get a test key and synthetic data (`fixtures/`), then request a live key after review.
- App keys are scoped (`responses:write`, `directory:read`, `reports:read`, `webhooks`), hashed at rest, revocable, rate limited.
- OAuth 2.1 with PKCE for apps acting for a church team member.

**API**: the existing Hono API, versioned under `/v1`, described in `api/openapi.yaml`, with webhooks signed as CloudEvents.

**SDKs**
- `@always/sdk` (TypeScript, exists): client, consent helpers, webhooks, response card widget.
- Next: React components (response card, church picker, report view), then Swift and Kotlin for ministry apps.

**MCP server** (`mcp.alwaysfoundation.org`)
So churches and ministries can use Always from Claude and other AI assistants.
- Version 1 is **read-only and holds no personal data**: search the directory, check readiness, list events, explain the Handoff standard, fetch an organisation's own de-identified report.
- Version 2 adds team tools for an organisation's own inbox for **adults only** and only where the person granted `ai.assist`: summarise what's waiting, draft a welcome message. Every action still needs a person to press send. Minors' records are never exposed to MCP or any AI.
- Each MCP session is tied to one organisation and one signed-in person, with the same scopes as the web app, and logged.

## 4. Reporting and compliance

Reports for funders are built (RFC to ADR 0003). The compliance module gives each organisation a **Compliance** tab and an exportable evidence pack.

| Area | What Always provides |
| --- | --- |
| Privacy Act (APPs) | Template privacy policy and collection notice in plain language (APP 1, 5); access and correction requests handled through the person's link (APP 12, 13); security controls described (APP 11). |
| Notifiable Data Breaches | A breach register, the 30-day assessment checklist, and draft notifications to people and the OAIC. |
| Consent register | Every consent, purpose, recipient and withdrawal, exportable, with the wording version shown to the person. |
| Child safety | National Principles for Child Safe Organisations checklist, Working With Children Check expiry tracking and reminders, child safety contact, incident log (stored with no child data in AI or exports). |
| Retention | Evidence that records were deleted or de-identified on schedule (`runRetention`). |
| Audit | Export of the audit chain with a verification tool (hash chain). |
| Charity governance | Helpers for ACNC annual reporting: activities and beneficiaries, from reports. |
| Children's Online Privacy Code | A register of how each child-facing screen meets the Code, kept current as the final Code is published. |

The compliance tab never shows a person's details. It shows records, dates and status.

Note: the OAIC's Children's Online Privacy Code is due to be registered by 10 December 2026. We should check the final text against section 5 before launch to young people.

## 5. Age permissions

One rule table, in `packages/core/src/minors.ts`, applied before anything else. Unknown age is treated as under 13. If there's reason to doubt a stated age, the lower band applies (CY-3).

| | Under 13 | 13–14 | 15–17 | 18+ |
| --- | --- | --- | --- | --- |
| Their own details collected | No (parent only) | Yes, minimal | Yes, minimal | Yes |
| Parent or guardian confirmation | Required, parent acts | Required before any handoff | Not required; parent may be told if the young person agrees | No |
| Who may receive | Verified youth partners | Verified youth partners | Verified youth partners | Any ready organisation |
| Who at the organisation sees it | Youth access members with a current check | Same | Same | Team members with inbox access |
| First contact | To the parent | Parent and young person together | Young person, two-adult practice | Person |
| Cross-ministry journey link | Never | Never | Never | With `share.journey` consent |
| AI (incl. MCP) | Never | Never | Never | Only with `ai.assist` |
| Bulk views and exports | Never | Never | Never | Allowed for the receiving org |
| Report minimum group | 20 | 20 | 20 | 10 |
| Retention after closing | Shortest (proposed 6 months) | 6 months | 6 months | 12 months |
| Notes on the record | No free text | Structured only | Structured only | Free text, encrypted |

Team permissions (who can do what inside an organisation):

| Role | Inbox (adults) | Inbox (minors) | Reports | Settings and team | Compliance |
| --- | --- | --- | --- | --- | --- |
| Follow-up | Yes | Only with youth access | View | No | No |
| Youth leader | Yes | Yes (needs current check) | View | No | No |
| Admin | Yes | Only with youth access | View, share | Yes | Yes |
| Integration (API key) | By scope | Never in bulk | By scope | No | No |
| Foundation ops | Only to resolve an issue, logged with a reason | Same, plus safeguarding lead sign-off | Network view | Verify and pause | Read |

Youth access is granted per person by an admin, requires a recorded check, and expires with it.

## Delivery

1/ **Now**: readiness view and badge; WWCC records and youth access expiry; age table tests (fail-closed).
2/ **Next**: developer portal with test keys; MCP v1 (read-only, no personal data); compliance tab with consent register, breach register and retention evidence.
3/ **Then**: `share.journey` consent and cross-ministry linking for adults; React components; MCP v2 for adults with `ai.assist`; Handoff standard adapters for church management systems.

Each step gets its own issue, tests first for consent, minors and access, and an ADR when a decision is made.

## Open questions for the members

1/ Readiness: is 80% within the response window the right bar, and should a church see its own rate?
2/ Should 15–17s be able to opt to tell a parent, or should parents always be told?
3/ Retention periods for minors and adults: confirm with legal counsel.
4/ Who at the foundation is the safeguarding lead who signs off ops access to minors' records?
5/ Which church management systems should the Handoff standard support first?
6/ Policies referenced in CLAUDE.md (`docs/policies/`, `docs/spec/`) aren't in this repository yet. Add them so this RFC can cite policy numbers.

This RFC is not legal advice. Privacy, child safety and charity obligations should be confirmed with counsel before launch.
