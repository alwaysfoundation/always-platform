# ADR 0021: Always AI is a module of the Always account

Status: Proposed
Date: 2026-11-24
Amends: ADR 0019 (point 6), RFC 0007 (data rules)
Related: ADR 0015, ADR 0016, ADR 0017, ADR 0018, ADR 0020

## Context

Always AI started as infrastructure plus a separate study tool that needs no account (ADR 0015, ADR 0018, ADR 0019 point 6). Churches meet Always through their Always account, and the writing they do there (response pages, follow-up and welcome messages, safety explanations, board summaries) is exactly where faithful AI saves volunteer time. Keeping Always AI outside the account made it feel like a separate product with separate rules.

The rules must not move: what people ask an AI stays private (non-negotiable 5, ADR 0020), no AI on minors' data (non-negotiable 4), no personal data in logs (non-negotiable 6), and a person decides (ADR 0015 point 10).

## Decision

1. **One name for all AI in Always.** Always AI is the faithful AI layer of Always Platform. It has four parts:
   - **Writing help** inside Always Respond, Always Connect, Always Safety and Always Reports: drafts, translations and Scripture checks.
   - **Agents** inside Always Connect and Always Safety (formerly "the Always Agent"): reminders, missing-detail checks and preparing the quarterly check-up.
   - **The study tool** for adult leaders (ADR 0017).
   - **Building blocks** for developers: Always Scripture, the church finder MCP server, the assistant specification and the open evaluation (ADR 0018 point 1).
2. **A module of the account.** `ai` joins `respond`, `connect`, `safety` and `reports` as a module an organisation's admins switch on (ADR 0019 point 3). It is on as soon as it is switched on; it needs no partner check, because it never handles people who respond. Switching it on is audited like any module.
3. **On the device.** Writing help runs in the browser or on the person's computer, using an open model chosen by the router (ADR 0015 point 2a). Always runs no inference servers and receives no prompts, drafts or documents. The API records only that the module is on.
4. **Never on people.** Writing help works only on the organisation's own content: page wording, templates, rules, statements of faith and totals. It never receives a person's details, messages, notes or inbox content. Names reach messages as placeholders (for example `[first name]`), filled in by the software when a team member sends, after the draft is approved. Agents that touch introductions run on fixed rules and approved templates, not a model.
5. **Never on young people.** Nothing identifying a person under 18 is ever passed to Always AI, by any part, in any mode. Not configurable (non-negotiable 4).
6. **Drafts only.** Everything Always AI produces is a draft. A person reviews it and a person sends, publishes or approves it, enforced in software.
7. **Cloud by the organisation's choice only.** An organisation may connect its own OpenAI-compatible provider for larger models (ADR 0015 point 2). Off by default, clearly marked in the interface while in use, zero-retention and no-training providers recommended. Points 4 to 6 still apply. Licensed Scripture text is never sent.
8. **Faithful by the same rules everywhere.** Scripture is looked up, never generated; the Nicene Creed (AD 381) is the boundary; beyond it the organisation's own statement of faith is followed where present, otherwise the main views are set out fairly. No persona, no spiritual authority, no companion features (ADR 0018 point 3).
9. **The account adds, never requires.** The study tool still needs no account. With an account, an organisation can export a **church library pack** (its statement of faith and documents it chooses) for leaders to import into the study tool. The pack is a file; it goes from the browser to the leader's computer and never back to Always.

10. **What people write is theirs.** Sermons, studies, pages and messages written with Always AI belong to their authors. Always claims no rights in them and never receives them.

## Consequences

- `MODULES` gains `ai`; the `organisation.modules` check constraint is widened (migration 0027).
- ADR 0019 point 6 now reads: the study tool needs no account; Always AI writing help and agents are switched on in the account.
- RFC 0007's data table no longer applies to Always AI: hosted processing of adults' details is not offered. Any future hosted mode needs a new ADR, as ADR 0015 already requires.
- The website, docs, privacy policy and terms of use describe Always AI as part of the account, with these rules. The terms gain an Always AI section (drafts are the user's responsibility; not advice; no personal or minors' information; model licences and provider terms apply).
- Browser inference needs WebGPU and enough memory. Where a device can't run it, Scripture checks (deterministic, no model) still work, and drafting is unavailable unless the organisation connects its own provider.
