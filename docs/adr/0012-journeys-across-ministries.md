# ADR 0012: Journeys across ministries

Status: Implemented, awaiting CODEOWNER and Prolegis review

## Context

A person who says yes to Jesus is often helped by several ministries in turn. Each holds a fragment, so no one can see whether a yes became a disciple, and people are asked the same questions again. RFC 0001 describes a consented journey record and ADR 0003 describes de-identified reporting. This ADR settles how journeys are linked across ministries.

A record that follows one person over time is reasonably identifiable, so it is personal information, and faith is sensitive information. Only totals leave the platform as de-identified data.

## Decision

1. Two layers. `journey_tally` (ADR 0003) stays the only source for reports, with the same minimum group sizes. Linked journeys are personal information and never appear in reports.
2. New consent purpose `share.journey`, separate from `connect.church`, never pre-ticked, adults only. The person agrees that the ministries that help them can see their steps. Without it, each response stands alone.
3. Linking: `link = HMAC(LINK_KEY, normalised mobile)`, stored server-side only, never returned by an API. `LINK_KEY` is read from the environment, rotated yearly, and can be destroyed to unlink everything.
4. Per-ministry codes: `code = HMAC(ORG_KEY, journey_id || org_id)`. A ministry sees only its own code. Codes are unrelated between ministries.
5. Every ministry on the journey sees the whole journey, before and after its own part: the ministry the person responded through (`GET /v1/responses/:id/journey`) and each church or ministry that welcomed them (`GET /v1/handoffs/:id/journey`). It sees the step and the month, and which steps were its own, never other ministries' names or notes. Every read is written to the audit chain.
6. New self-reported milestones: baptised, in a group, serving, connected after 12 months. Counted only when the person reports them.
7. The Handoff standard carries the ministry code with the consent receipt. Receivers must not pass it on or combine it beyond the consent, and must honour `consent.withdrawn`.
8. Minors: no `link` is computed for anyone under 18. This is not configurable.

## Consequences

- Network funnels by region become possible from tallies alone.
- Tests: cross-tenant tests that no ministry reads another's codes or journeys; minors tests that no link exists under 18; a test that `LINK_KEY` rotation re-links within one transaction.
- Prolegis reviews the `share.journey` wording before release.

## Rejected

- Showing earlier steps only to the church that welcomes the person: the ministries earlier in the journey, such as an event or a course, could never learn whether the person found a church.

- A shared public id across ministries: anyone with two datasets could join them.
- An unkeyed hash of the mobile number: the Australian mobile number space is small enough to reverse by brute force.
