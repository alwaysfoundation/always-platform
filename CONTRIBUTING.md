# Contributing to Always

Thank you for helping. Always connects people who respond to Jesus with their next best faith step, so the bar is care: for people, for their data, and for each other.

## Ways to help
- Code, tests and reviews (see good first issues)
- The Always Pathway standard and RFCs (`spec/`, `docs/rfc/`)
- Accessibility, design and plain-language copy
- Translation into community languages
- Church and ministry feedback from pilots

## Before you start
1. Read `CLAUDE.md` (the rules apply to people and AI assistants alike), the Always Pathway standard in `spec/`, and the RFCs and ADRs in `docs/rfc/` and `docs/adr/`. The foundation's policies are not published in this repository yet (see issue #98).
2. Find or open an issue. Behaviour changes to consent, minors, routing timers or access control need an RFC and the Safeguarding, Privacy and Ethics committee's approval.
3. Use synthetic data only. Never paste real people's details anywhere, including prompts to AI tools.

## Developer Certificate of Origin (DCO)
Every commit must be signed off, confirming you wrote it or have the right to submit it under the project's licence (https://developercertificate.org):

    git commit -s -m "feat: ..."

You keep the copyright in your contribution; you license it under Apache 2.0 (code) or CC BY 4.0 (docs). We don't use a CLA.

AI-assisted work is welcome and must be disclosed with a trailer, e.g. `Co-Authored-By: Claude <noreply@anthropic.com>`. You are responsible for every line you submit.

## Local setup
    cp .env.example .env.local     # fill in random keys: openssl rand -base64 32
    make up && make migrate && make seed
    make dev                       # API on http://localhost:8787
    make check                     # types, tests, RLS

## Pull requests
- Small, focused, conventional commit titles (`feat:`, `fix:`, `docs:`...).
- Tests first for consent, minors, timers and access control.
- Changes merge only when every required check passes: types, tests, row-level security, migrations (fresh, upgrade with data, backup and restore), the web build, CodeQL, secret scanning, dependency review and DCO sign-off. Branch protection enforces this with no bypass. There is no human approval step at present. AI-assisted changes to protected paths (`auth/`, `consent/`, `minors/`, `crypto/`, `access/`, `routing/`) get a recorded safeguarding review on the pull request before merge.
