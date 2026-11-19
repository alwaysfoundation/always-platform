# ADR 0010: Put accepted people into a church's own church management system

Status: Proposed
Date: 2026-11-19

## Context

Churches already keep their people in a church management system (Elvanto, Planning Center and others). Retyping a handoff from the Always inbox loses time, and a person waiting for a welcome should not wait on data entry.

## Decision

1. Connectors live in `packages/integrations`. Each takes one church's settings and an injected `fetch`.
2. Every sync passes `canSync` first, which fails closed in this order:
   - minors: no one under 18 is synced; their details stay in the Always inbox, with a verified youth partner;
   - consent: `canProcess` for `connect.church` to this church;
   - the handoff: only the church that accepted the person;
   - trust: verified churches only;
   - residency: the church's account must keep data in Australia.
3. A sync sends a packet with the least a welcome needs: first name, last name if given, email and mobile if given. No faith details, notes or street address.
4. Errors carry a code and status only, never a provider body.
5. Elvanto: Australian accounts (`*.elvanto.com.au`) are allowed. People land in the church's chosen People Category and, if set, a newcomers' group.
6. Planning Center: built and tested, but refused by the residency check because it hosts in the United States. Webhook signatures are verified and deliveries are reduced to ids and flags.
7. A completed workflow card means the church finished its follow-up. It is never recorded as "connected"; only the person can confirm that.

## Consequences

- Elvanto can go live once a pilot church supplies an API key and the API is deployed.
- Planning Center needs a decision before it can run: either keep it off, or agree how a church's own offshore system is covered by the person's consent and the Privacy policy. Prolegis should review.
- 15 to 17 year olds sent to verified youth partners are not synced automatically. If youth partners need this, it needs its own rule and review.
- Elvanto's `groups/addPerson` call needs checking against a test account before use.
