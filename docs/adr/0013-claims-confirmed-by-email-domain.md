# ADR 0013: Claims confirmed by the church's own email domain

Status: Proposed
Date: 2026-11-23

## Context

Every church claim waits for the foundation team. Most claims come from someone with an address at the church's own website domain, and the team approves those on sight. The team is small, and waiting is the main reason a church gives up on joining.

## Decision

1. A claim on an unclaimed (`listed`) church whose email domain is exactly its website's host, ignoring `www`, gets a confirmation link by email instead of going to the team.
2. Opening the link shows a page with a Confirm button. Only the button approves, so a mail scanner that fetches the link approves nothing. The link works once, for 48 hours. Only its hash is stored.
3. Confirming makes the requester an admin and the church `claimed`, exactly as a team approval does. It never makes a church a partner: `verified` and `verified_youth` stay with the team.
4. Free mail and shared site hosts (Gmail, Outlook, Facebook, Wix and similar) never match. Neither do subdomains.
5. Everything else goes to the team as before: no match, an already claimed church (a second admin), or an expired link. The team queue shows which claims are still waiting on email.

## Consequences

- Most claims finish in minutes with no one from the team involved.
- Whoever controls a church's email domain can claim its listing. That is the same evidence the team relied on.
- Confirmation links point at the API (`API_URL`), which must be set in production.
