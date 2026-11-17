# Always platform

Open-source software for the Always network: helping churches and ministries across Australia welcome everyone who turns to the Lord Jesus Christ, and walk with them into a local church. In service of the Great Commission (Matthew 28:19–20).

## What's here

| Path | What it is |
| --- | --- |
| `packages/core` | The rules engine: consent gate, minors rules, matching, the two-clock handoff engine, follow-up rules, retention. Pure TypeScript with tests. |
| `db/migrations` | Postgres schema with row-level security, encrypted personal fields, and schema-level safeguards (no data about children under 13, one pending offer per handoff). |
| `db/test` | Cross-tenant and safeguarding tests for the database. |
| `spec/schemas` | The Always Handoff standard v0.1 (JSON Schema, CC BY 4.0). |
| `api/openapi.yaml` | Always API v0.1 contract. |

## Run the checks

```bash
npm install
npm run check          # type-check and unit tests
psql -d always -v ON_ERROR_STOP=1 -f db/migrations/0001_core.sql -f db/test/rls_test.sql
```

## Rules for contributors

Read `CLAUDE.md` (it applies to people and AI assistants alike), the policies and the specification. No real personal data, ever. Australia only. Consent and minors rules run first.

Code: Apache 2.0. Specification text: CC BY 4.0.
