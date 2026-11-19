# ADR 0009: A reviewed, open register drives compliance assessments

- Status: proposed
- Date: 2026-11-19
- RFC: 0003

## Context

Always Compliance tells ministries which legal obligations apply to them. Getting this wrong could mislead a church about its duties to children, donors or the people on its lists. Laws change, and AI can read them quickly but can also be confidently wrong.

## Decision

1/ Obligations live in a versioned, declarative register (`spec/compliance/register.json`), published as open data under CC BY 4.0.

2/ A pure, deterministic engine applies the register to a ministry's profile and answers. It never interprets law itself.

3/ Changes to official sources are detected automatically, but a person on the foundation team decides, and only a named reviewer can publish a register version. The register must validate first.

4/ Quarterly assessments are drafted automatically and approved by a person at the ministry. Tokens and agents cannot approve.

5/ Compliance stores organisation facts and answers only, never people's details, under row-level security.

## Consequences

- Members get consistent, explainable results that cite the official source.
- Updates are slower than a fully automatic system. That is intended: a reviewed register is worth a short delay.
- The sector can reuse the register, which spreads the cost of keeping it right.
- We must keep reviewers engaged. The `confidence` field shows what still needs review.
