# CLAUDE.md

Rules for Claude Code (and any AI coding assistant) working in Always Foundation repositories. Humans follow the same rules. Where this file and a policy differ, the policy wins.

## What we are building

Always Platform: the open-source technology of the Always Foundation, an independent, member-based Christian nonprofit that brings churches and Christian ministries together ("Together for the Gospel"). It equips them with free tools (the Always App, branded response pages, forms), supports them with shared tools for governance, safety, safeguarding and reporting, and connects them as one network: mapping churches and handing each consenting person who responds to the Lord Jesus Christ to a verified local church or ministry, with a guaranteed fallback. Read `docs/spec/` (Always Platform Software Specification) and the Always Pathway standard before changing behaviour.

## Non-negotiables

1. **No real personal data, ever.** Use the synthetic fixtures in `fixtures/`. Never paste production data, logs or screenshots containing people's details into a prompt.
2. **No secrets.** Never write keys, tokens or passwords into code, tests, docs or commit messages. Read configuration from the environment.
3. **Consent travels with the data.** Any code that moves, shows, exports or syncs a person's data must call the consent check and fail closed if it doesn't pass.
4. **Minors rules run first.** Age band before any other field. Under 13: no child data. Under 15: parent or guardian confirmation. Minors go only to verified youth partners. No AI on minors' data. These rules cannot be made configurable.
5. **Private AI stays private.** What people ask an AI runs on their own device by default and is never sent to Always or logged. Other personal data stays in the person's region where practical, with providers that encrypt it and sign data processing terms (ADR 0020).
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
7. Changes merge only when every required check passes: types, tests, row-level security, migrations (fresh, upgrade with data, backup and restore), the web build, CodeQL, secret scanning, dependency review and DCO sign-off. Branch protection enforces this with no bypass. There is no human approval step at present. AI-assisted changes to protected paths (`auth/`, `consent/`, `minors/`, `crypto/`, `access/`, `routing/`) get a recorded safeguarding review on the pull request before merge.

## Style

- Plain, warm language in the interface: care before church jargon.
- Australian spelling.
- Name things by what users understand (a church "passes" a person, a person "withdraws").

## Where to look

- Policies: `docs/policies/` (Cybersecurity, Data Governance, Privacy, Children and Young People's Information, AI, Terms of Use)
- Spec: `docs/spec/`
- Engineering practice: `ENGINEERING.md`, `docs/ai-assisted-development.md`
- Security reporting: `SECURITY.md` (admin@alwaysfoundation.org)
