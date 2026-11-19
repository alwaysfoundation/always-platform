# ADR 0007: Child assent for under-15s, and consent that lasts 12 months

Status: Proposed
Date: 2026-11-18

## Context

The Children and Young People's Information Policy says a parent's consent is not enough on its own for a child: the child agrees too. The Privacy Policy says consent lasts 12 months unless the person renews it. Until now the code checked parent confirmation only, and consent never lapsed.

## Decision

1. **Child assent.** Under-13s and 13 to 14 year olds need both a parent's consent and the child's assent.
   - When a 13 to 14 year old fills the form themselves, their own yes is their assent, and a parent still confirms by link.
   - When a parent fills the form, they must confirm the child agrees (`consent.childAssent: true`). Otherwise the API returns `422 child_assent_required`.
   - The consent gate (`canProcess`) refuses with `child_assent_required` when assent is missing. The database refuses new or updated under-15 consent rows without `child_assent_at` (constraint `under15_child_assent`).
   - 15 to 17 year olds consent for themselves, so separate assent is not needed. They still go only to verified youth partners, with no AI.
2. **12-month consent.** Every consent has `expires_at`, 12 months after it was given. The consent gate refuses with `expired` from that moment, so no church can accept and nothing moves. The check runs after withdrawal, so a withdrawn record always reports `withdrawn`.
3. **Renewal.** Adults can renew by their self-service link (`POST /v1/me/{token}/renew`), which sets a fresh 12 months. Young people's consent can't be renewed by link: their family starts a new response, so a parent stays involved.
4. These rules sit in `@always/core` with the other minors rules. They are not configurable.

## Consequences

- Fails closed: a missing assent or a lapsed consent stops the introduction.
- Existing rows: `expires_at` is back-filled from `collected_at`, and 13 to 14 year olds who filled the form themselves get their own yes as assent. The constraint is added `NOT VALID`, so any older row without assent stays readable but can't be used or updated without assent.
- A later change can add a reminder text before consent lapses. It must carry no personal or faith details.
- Changes under `consent/` and `minors/` need a CODEOWNER's approval.
