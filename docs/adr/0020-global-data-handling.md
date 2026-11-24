# ADR 0020: Global data handling

Status: Accepted
Date: 2026-11-24
Supersedes: the Australia-only rule in CLAUDE.md (rule 5); the residency parts of ADR 0004, ADR 0008 and ADR 0011

## Context

Always Foundation is a global organisation, operating through a US 501(c)(3). Requiring every personal detail to stay in Australia blocks ordinary services (sign-in email, for example) without protecting what matters most.

## Decision

1. Personal data is kept in the region of the person or organisation where that is practical. Otherwise we choose for reliability and efficiency, with providers that encrypt data in transit and at rest and sign data processing terms.
2. What people ask an AI is private. Always AI runs on the person's own device by default (ADR 0015). Prompts and documents are never sent to Always, never logged, and go to a cloud model only when the person chooses one. This rule is not configurable.
3. Unchanged: consent travels with the data; the minors rules run first and cannot be configured; no personal data in logs, errors, analytics, emails, SMS or push notifications; row-level security on every table with personal data; no linking of people across organisations (ADR 0013).
4. Each provider that handles personal data is listed, with its region, in the privacy policy.

## Consequences

- Sign-in email can use any reputable provider; Amazon SES in Sydney is no longer required.
- The privacy policy needs a global version that names providers and regions. That needs legal review before it is published.
