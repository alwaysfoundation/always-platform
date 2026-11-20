# ADR 0013: No linking of people across organisations

Status: Accepted
Date: 2026-11-21
Supersedes: ADR 0012

## Context

ADR 0012 linked one adult's responses across ministries with a keyed hash of their mobile number, so ministries could see a person's earlier and later steps. On review, the foundation decided that a capability to link and reconstruct people's religious activity across independent Christian organisations carries privacy, security, ethical and institutional risks that its mission does not need, however well it is protected. It would make Always a high-value target, it could be misused under future pressure or leadership, and it cuts against the freedom to explore, change churches or leave without a persistent record.

## Decision

Always Platform does not build or operate:

1. Persistent identity linkage across organisations for tracking religious participation.
2. Central reconstruction of a person's spiritual journey.
3. Shared identity fingerprints designed to correlate activity between independent ministries.
4. A database of identifiable or pseudonymised religious participation histories.
5. Analytics that depend on recognising the same person across organisations.

This holds whatever the technique: hashing, encryption, pseudonymisation, federated or third-party matching. A change of technique does not answer the concern.

Still supported:

- A person's own, narrowly scoped handoff to a church or ministry they choose, with consent that travels with it and no persistent link afterwards.
- Reporting for each ministry about its own responses and handoffs.
- De-identified totals built from single responses and handoffs (`journey_tally`, ADR 0003), which never recognise a person across organisations.
- Each ministry keeps responsibility for its own records, access, retention and pastoral relationships.

## Consequences

- Migration 0022 drops the journey tables, guards and triggers from 0021. The extra `journey_milestone` enum values remain because Postgres cannot drop them; nothing writes them.
- The `share.journey` consent purpose, `LINK_KEY`, `ORG_CODE_KEY`, the journey endpoints and person-reported milestones are removed. Network totals move to `GET /v1/network/totals` and count handoff steps only.
- The public website no longer describes the initiative and carries a short discontinuation notice.
- Any future proposal that recognises the same person across organisations is out of scope and needs a new ADR that reverses this one.
