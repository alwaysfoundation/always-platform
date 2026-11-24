# ADR 0011: Ministry sign-in and onboarding from the website

Status: Proposed. Residency superseded by ADR 0020.
Date: 2026-11-19

## Context

Churches and ministries start with Always Compliance on alwaysfoundation.org. To save results and get quarterly reminders they need an account and an organisation, without staff setting them up by hand.

## Decision

1. People sign in with an email link through Supabase Auth in Sydney. No passwords.
2. Supabase Auth sends that email through Amazon SES in Sydney (custom SMTP), so addresses stay onshore. Until SES is set up, sign-in stays switched off on the website.
3. `/v1/account/orgs` lets a signed-in person with no organisation create one church or ministry. It starts on the map (`listed`), with the person as admin and their email as the notify address. One person can create at most five.
4. The website reaches the API through its own `/api` proxy in the Cloudflare Worker, as the web console does (ADR 0002). No CORS on member routes.
5. Signed-in people get the `compliance` scope. Compliance holds organisation facts only, never people's details.
6. Compliance emails link to the website's signed-in area (`SITE_URL/#/compliance/my`).

## Consequences

- A new church can go from check-up to saved results in a few minutes.
- Becoming a partner church is still a separate, checked step. Creating an organisation grants nothing in Always Connect.
