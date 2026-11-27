# ADR 0024: Always Safety checks products as well as organisations

Status: Accepted
Date: 2026-11-27
Amends: ADR 0009

## Context

Ministries building apps and websites keep meeting the same questions: does our product need parental consent in the US, must we let people delete their account in the app, can young people's names appear in a feed, does our privacy policy match what we built? Each answers them alone, and the answers change when they launch in a new country. The organisation check-up (RFC 0003) can't answer them, because they are about a product's features and data, not about the ministry.

## Decision

1. Always Safety gains a second register, `spec/safety/product-register.json`, of rules about products, and a pure engine, `assessProduct`, in `packages/core/src/products.ts` (RFC 0008).
2. Conditions are three-valued. A fact a profile doesn't give is unknown, and an unknown is never a pass: the rule is reported as needing information.
3. A profile describes a product and must not contain people's details. The validator refuses email addresses and phone numbers, and the API stores nothing.
4. The product register ships with the code and changes through reviewed pull requests, like the organisation register's draft. Rules about law outside Australia start as `verify` until a qualified reviewer checks them.
5. The check runs in CI through `scripts/safety-check-product.ts`, and publicly through `POST /v1/safety/product-check`.

## Consequences

- Ministries can check a product in a pull request and see gaps before launch, especially when moving from Australia to the US.
- The foundation takes on keeping product rules current. The same law-watching and human review as the organisation register applies.
- Products that plug in share one open view of the rules; improvements reach every product at once.
