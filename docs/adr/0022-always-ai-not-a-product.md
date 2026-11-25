# ADR 0022: Always AI is not offered as a product

Status: Accepted
Date: 2026-11-25
Supersedes: ADR 0021
Amends: ADR 0015, ADR 0018, ADR 0019 (point 6)

## Context

Always is evangelism technology that connects ministries: response pages, handoffs to local churches, safety and reports, and the open standard and platform underneath. An AI assistant for study and preparation is a product in its own right. It sits at the application layer, where builders, including commercial ones, can serve churches better than a small foundation can, and it puts Always next to Christian AI companies it should serve rather than compete with.

## Decision

1. Always Foundation does not offer Always AI as a module, page or product.
2. The `ai` module is removed from the Always account and the API (migration 0029). Existing settings are cleared.
3. The in-browser assistant is removed from `apps/web`.
4. The `ai/` folder stays in the repository as research: the Scripture tool server, the assistant specification and the evaluation design, open for others to use and build on. It is not maintained as a product.
5. The research papers stay published, with a dated note recording this decision.
6. The rules that applied to AI still apply to anything AI near Always: no AI on minors' data, nothing anyone asks an AI is sent to or logged by Always, and a person decides.

## Consequences

- The Always account has four modules: Respond, Connect, Safety and Reports. Always Sent needs no account.
- Builders are free to offer AI products on Always Platform on the same terms as everyone else.
- The agent connector (MCP) stays: it gives any AI assistant public, read-only facts about churches and events.
