# ADR 0008: Send email through Amazon SES in Sydney

Status: Proposed
Date: 2026-11-18

## Context

Email went through Resend, which has no Australian region. Email addresses are personal data, and CLAUDE.md rule 5 says personal data is stored and processed in Australian regions. Staff alerts carry no personal data, but onboarding and claim emails go to people's addresses.

## Decision

1. The API sends email through Amazon SES v2 in Sydney (`ap-southeast-2`), or Melbourne (`ap-southeast-4`) if set.
2. The adapter refuses to start with any other region (`ses_region_not_australian`).
3. Requests are signed with `aws4fetch`, a small MIT-licensed SigV4 library with no dependencies, rather than the full AWS SDK.
4. Errors never include the provider's response body, which can echo an address.
5. Resend is removed from the API.

## Consequences

- Email addresses are processed onshore.
- SES has no idempotency key, so a retried outbox row could, rarely, send twice. The outbox already marks rows sent before moving on; we accept the small risk for alerts that carry no personal data.
- Setup: verify send.alwaysfoundation.org in SES Sydney, request production access, and create an IAM user limited to `ses:SendEmail`. The keys go in the environment, never in code.
