# ADR 0003: Reporting for ministries and their funders

Status: Proposed

## Context

Many ministries on Always are funded by donors, foundations or denominations, and they have to show what happened. Today they build reports by hand from spreadsheets. Always already knows each step a person takes after they respond, so it can produce that report for them. It must do this without exposing anyone.

## Decision

1. Reports are built from a de-identified table, `journey_tally`, kept up to date by database triggers on responses, offers and handoffs. It holds counts by day, organisation, source, next step, state and a minor flag. It holds no person identifiers, so tallies survive retention deletes.
2. Six milestones: responded, introduced, accepted, contacted, connected, helped by the care team. Definitions ship with every report.
3. Small numbers are withheld on the server: fewer than 10 people, or 20 where young people are included (`POLICY.minGroupSize`). Withheld figures are never sent to the browser.
4. Only standard periods (month, quarter, Australian financial year, calendar year) are offered in the interface, which limits differencing between overlapping ranges.
5. A ministry can share a report with a funder as a frozen snapshot link. Links can expire, can be switched off, and record views. Only a hash of the token is stored.
6. Reports export as CSV and print to PDF. A ministry can set a title, a funder name and an introduction.
7. Credit is by role: a sending ministry sees what happened to the people it introduced; a receiving church sees who it welcomed. Neither sees the other's people.

## Consequences

- Ministries get a monthly report with no extra data entry.
- Figures can lag slightly behind live state, and rare edits (for example a reopened handoff) are not reversed in the tally.
- Any new milestone needs a trigger and a definition.
