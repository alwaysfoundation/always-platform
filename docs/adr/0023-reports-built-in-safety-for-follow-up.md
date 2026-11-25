# ADR 0023: Reports is built in; Always Safety covers safe follow-up

Status: Accepted
Date: 2026-11-25
Amends: ADR 0019, ADR 0009

## Context

Always is evangelism technology that connects ministries. The account had four switchable modules after ADR 0022. Two simplifications make it clearer:

- Reports is the totals of what Respond and Connect already did. A switch for it adds a decision with no benefit.
- Always Safety had grown to include charity regulator duties (annual returns, governance standards, record keeping). That is general charity compliance: the heaviest part of the register to keep current, and the part closest to paid compliance vendors and advisers. It is not what safe follow-up needs.

## Decision

1. Reports is part of every Always account. The `reports` module is removed (migration 0030); every organisation sees its reports.
2. Always Safety covers safe follow-up: privacy, children and young people, and emails and texts. The charity area and its eight obligations are removed from the register, with the profile questions only they used. The ACNC registration question stays because the Spam Act rule depends on it.
3. The account has three switchable modules: Respond, Connect and Safety. Always Sent needs no account and is presented as part of Always Respond, so churches see three tools everywhere.

## Consequences

- Fewer choices at sign-up and in settings.
- Ministries still need their own charity reporting; Always Safety says so plainly and does not track it.
