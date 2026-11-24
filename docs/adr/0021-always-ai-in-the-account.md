# ADR 0021: Always AI in the Always account

Status: Accepted
Date: 2026-11-24
Builds on: ADR 0015 (on-device, Nicene-grounded), ADR 0018 (infrastructure first), ADR 0020 (global data handling)

## Context

Always AI shipped as building blocks and a study tool set up by hand in Jan, apart from the tools churches use every day. Churches meet Always through one account; AI should be one of the things that account switches on, without weakening the rule that what people ask an AI stays private.

## Decision

1. **Always AI is a tool in the account, beside Respond, Connect, Safety and Reports.** An admin switches it on for the organisation (`modules` includes `ai`). It needs no partner check.
2. **Switching it on stores nothing about use.** The account records only that the tool is on. The study tool runs on each adult team member's own device; prompts and documents never reach Always and are never logged.
3. **Three layers, one name.**
   - *For leaders:* the private study tool for sermon and study preparation.
   - *Inside the tools:* helpers that save time: checking Scripture quoted on response pages, drafting a first message for a person to edit and send, writing a report's story from totals, answering questions about a safety rule with citations. Each runs on the person's device or uses no personal data. Each is marked "coming" until it is built.
   - *For builders:* Always Scripture, the assistant specification, recommended models and the evaluation.
4. **The boundaries hold everywhere.** No AI on young people's data. A person approves every action that affects someone who responded. Never a companion, persona, AI pastor or crisis support. The Nicene Creed (AD 381) is the boundary.
5. **What people write is theirs.** Sermons and studies prepared with Always AI belong to their authors. Always claims no rights in them and never sees them.

## Consequences

- Migration 0027 allows `ai` in `organisation.modules`; new accounts start with it on.
- The website presents Always AI as one of the tools, with honest statuses, and the terms say plainly who owns what is written with it.
