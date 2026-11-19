# RFC 0004: Always Compliance as infrastructure

- Status: proposed
- Pillar: Support
- Builds on: RFC 0003, ADR 0009

## Summary

Make Always Compliance something other platforms plug into, not only a check-up members read. Christian tech platforms, denominations and church software can use one open, reviewed view of the rules, hear when it changes, and ship products that meet common obligations from the start. Love is Our Weapon is the first user.

It stays a guide to common obligations. It is not legal advice.

## The layers

1/ **Open register.** Versioned, machine-readable, CC BY 4.0. `GET /v1/compliance/register` (ETag), `/register/versions`, `/register/{version}` (immutable). Open to any origin, with no credentials.

2/ **Change alerts.** When the foundation team publishes a version, subscribers get `always.compliance.register.published`, and members whose obligations changed get `always.compliance.obligations.affected` plus an email. Signed CloudEvents through the existing outbox. Endpoints are managed at `/v1/webhooks`.

3/ **Check-up API and embed.** The stateless `POST /v1/compliance/check`, and `<always-compliance-check>`, a web component any site can drop in.

4/ **Compliant by default.** `@always/sdk` guardrails mirror what Always Platform enforces: age first (`ageGuard`, checked against the core minors rules in tests), `requireConsent`, `personalDataProblems` for notifications, and `spamActProblems` and `messageFooter` for messages.

5/ **Board-approved record.** The quarterly assessment a person approves (RFC 0003). It can be shared with funders, a denomination or an insurer. It is a record of a check-up, not a certificate.

## Rules

- Organisation facts and register facts only. Webhook data never carries people's details.
- A named person approves every register version before anyone sees it, and every quarterly assessment.
- Webhook deliveries go to public HTTPS hostnames only: no IP literals, internal names or credentials in the URL.
- The minors rules in the guardrails are not configurable, and a test keeps them identical to `packages/core/src/minors.ts`.

## Contribution

Free for churches. Tech platforms, larger ministries and networks contribute for change alerts at volume, the network view and support.

## Open questions

- A combined network view for denominations, with totals only.
- De-identified patterns across members ("most youth ministries miss X") for a sector report, with a research partner.
- Partnering with church insurers and denominations.
- Legal review of the register before any version is marked reviewed.
