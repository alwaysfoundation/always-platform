# ADR 0019: One Always account, modules switched on

Status: Accepted
Date: 2026-11-24

## Context

Churches and ministries should be able to start with as little as possible: no sales call, no third-party accounts, no setup by staff. ADR 0011 gives them an account (email link, no password) and an organisation. They also need one place to choose what they use.

## Decision

1. One Always account per person, signed in by email link (ADR 0011). One organisation can be run by several people; one person can run up to five organisations.
2. Anyone can create an account straight away; no enquiry or call is needed. Creating an organisation affirms the Nicene Creed (AD 381), Always's statement of faith, and records when.
3. Each organisation switches modules on and off itself: `respond`, `connect`, `safety`, `reports`. Admins only. Every change is audited.
4. A module is on as soon as it is switched on, except Connect, which hands people to a church: it shows `awaiting_check` until the organisation passes the partner check, then turns on by itself.
5. Nothing else is required to start: no Google, Microsoft or other third-party account, and no payment details. Always is free.
6. Always AI needs no account. It runs on the person's own computer (ADR 0015).

## Consequences

- Start is: email, name the church, tick what you need.
- Safety rules are unchanged: the partner check, the minors rules and consent checks still apply inside each module.
- Switching a module off hides it from the organisation; it does not delete data. Deletion follows each module's own rules.
