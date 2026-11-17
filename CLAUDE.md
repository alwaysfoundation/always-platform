# CLAUDE.md

Rules for Claude Code (and any AI coding assistant) working in Always Foundation repositories. Humans follow the same rules. Where this file and a policy differ, the policy wins.

## What we are building

An open-source, Australian-only platform that maps Australia's churches and hands each consenting person who responds to the Lord Jesus Christ to a verified local church or ministry, with a guaranteed fallback. Read `docs/spec/` (Always Platform Software Specification) and the Always Handoff standard before changing behaviour.

## Non-negotiables

1. **No real personal data, ever.** Use the synthetic fixtures in `fixtures/`. Never paste production data, logs or screenshots containing people's details into a prompt.
2. **No secrets.** Never write keys, tokens or passwords into code, tests, docs or commit messages. Read configuration from the environment.
3. **Consent travels with the data.** Any code that moves, shows, exports or syncs a person's data must call the consent check and fail closed if it doesn't pass.
4. **Minors rules run first.** Age band before any other field. Under 13: no child data. Under 15: parent or guardian confirmation. Minors go only to verified youth partners. No AI on minors' data. These rules cannot be made configurable.
5. **Australia only.** Personal data is stored and processed in Australian regions. Do not add a dependency or service that sends personal data offshore.
6. **No personal data in logs, errors, analytics, emails, SMS or push notifications.**
7. **Row-level security on every table holding personal data**, with a cross-tenant test.
8. **Accessibility:** WCAG 2.2 AA, real buttons and labels, 44 px targets.

## How to work

1. Start from an issue or RFC. If the spec is unclear, stop and ask in the issue; don't invent behaviour.
2. One branch per issue. Small pull requests.
3. Write or update tests first for consent, minors, routing timers and access control.
4. Run `make check` (lint, types, tests, RLS tests, secret scan) before proposing a change.
5. Use conventional commits. Every commit carries a DCO sign-off. AI-assisted commits carry a co-author trailer.
6. Record significant design choices as an ADR in `docs/adr/`.
7. Never merge your own work. Two human approvals are required; a CODEOWNER must approve changes under `auth/`, `consent/`, `minors/`, `crypto/`, `access/` and `routing/`.

## Style

- Plain, warm language in the interface: care before church jargon.
- Australian spelling.
- Name things by what users understand (a church "passes" a person, a person "withdraws").

## Where to look

- Policies: `docs/policies/` (Cybersecurity, Data Governance, Privacy, Children and Young People's Information, AI, Terms of Use)
- Spec: `docs/spec/`
- Engineering practice: `ENGINEERING.md`, `docs/ai-assisted-development.md`
- Security reporting: `SECURITY.md` (admin@alwaysfoundation.org)
