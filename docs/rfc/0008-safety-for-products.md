# RFC 0008: Always Safety for products

- Status: proposed
- Pillar: Support
- Related: RFC 0003, ADR 0009, ADR 0024, `spec/safety/product-register.json`, `packages/core/src/products.ts`

## Summary

Always Safety's check-up asks a ministry about itself. Ministries that build apps and websites also need to know whether **the product** is safe and lawful: what it collects and from whom, who can see it, how long it is kept, whether young people are protected, and whether it does what its own privacy policy promises. This is hardest when a ministry grows from Australia into the US, where the rules change state by state.

Always Safety for products lets a product team describe their product in one file, a profile, and checks it against an open register of product rules for each country and the app stores' rules. It runs in a pull request, from a terminal, or through the API, and produces a plain-English report: gaps first, each with what to do and the official source.

It is a guide to common obligations. It is not legal advice.

## Goals

1/ A product team can see, in one report, where their product falls short in each country it serves, ordered by severity.

2/ Mismatches between what the privacy policy and terms promise and what the product does are found automatically.

3/ The check runs in CI, so a change that adds a risk (a new personal field, a public feed for under-18s) is noticed before it ships.

4/ One open register, so ministries springboarding from Australia to the US share one reviewed view of the rules instead of each paying for the same research.

## Non-goals

- Legal advice, or a judgment that a product is compliant.
- Holding people's details. A profile describes a product; profiles containing contact details are refused.
- Replacing a lawyer's review of a product's documents. The report says what to take to one.

## Design

### 1. The profile

A product profile (`ProductProfile` in `packages/core/src/products.ts`) records facts about the product:

| Part | What it says |
| --- | --- |
| `surfaces`, `countries`, `usStates`, `appStores` | Where the product is used and offered |
| `audience` | Minimum age, whether under-18s and under-13s take part and how |
| `accounts`, `ageAssurance`, `parentalConsent` | Sign-up, deletion, age checks and permission |
| `data` | Each kind of information: category, whose it is (including third parties and other people's children), purpose, who sees it, retention, consent |
| `processors` | Services that store or process information, their country and data processing terms |
| `social`, `publicDisplay`, `tracking`, `messaging`, `moderation`, `ai` | Features that change which rules apply |
| `security` | Encryption, access, breach plan, written policies |
| `policies.claims` | What the privacy policy and terms promise, so the engine can compare them with the product |

A fact left out is unknown, not "no".

### 2. The register

`spec/safety/product-register.json` is a versioned list of rules. Each rule has a country (or `ALL` for app store rules and good practice), a kind (`law`, `platform_rule`, `good_practice`), `appliesWhen` and `meets` conditions on the profile, a severity, a recommendation, official sources, and a confidence (`reviewed`, `draft`, `verify`).

Conditions are declarative and three-valued: true, false, or unknown when the profile doesn't say. `all`, `any` and `not` combine them so that an unknown never becomes a pass. Unknown condition shapes are false.

### 3. The engine

`assessProduct(register, profile, asOf)` is pure and deterministic. For each rule in the product's countries:

| Applies | Meets | Result |
| --- | --- | --- |
| no | | not listed |
| yes | yes | `met` |
| yes | no | `gap` |
| unknown (fail closed: assumed yes) or yes | unknown | `needs_info`, with the facts to add |

Rules that start later are `upcoming_gap` or `upcoming_met` until their start date. `watch` rules are listed but never actions.

### 4. Where it runs

- **CI:** `scripts/safety-check-product.ts` prints a Markdown report and exits 1 when there are gaps at or above a chosen severity.
- **API:** `GET /v1/safety/product-register` and `POST /v1/safety/product-check` are public and store nothing.
- **Code:** `import { assessProduct } from '@always/core'`.

## Safety and privacy

- A profile is product facts only. The validator refuses email addresses and phone numbers.
- Nothing is stored by the API route. The CLI reads only the files it is given and sends nothing.
- AI never decides what the law says or whether a product complies.

## Alternatives considered

1/ **Extend the organisation check-up with product questions.** Rejected: a product's facts (fields, retention, features) don't fit yes/no questions about an organisation, and product teams want to run checks in CI, not fill in a form.

2/ **Scan the product's code to infer the profile.** Deferred: inference would miss intent (why a field exists, who sees it). A reviewed profile, kept next to the code, is more reliable. Generating parts of it from API contracts is a good next step.

## Open questions

- [ ] Who reviews the product rules before the first `reviewed` version? The same panel as the organisation register?
- [ ] Which US states next, after the six whose privacy laws cover nonprofits?
- [ ] Should the register track teen social media laws state by state once court challenges settle?

## Rollout

1/ Merge with the draft register (36 rules: Australia, the US, Apple and Google, good practice).

2/ First products check themselves in CI and report rules that misfire.

3/ A qualified reviewer approves the first `reviewed` version; rules marked `verify` are checked first.
