# ADR 0018: Always AI is infrastructure first, and never a companion

Status: Accepted
Date: 2026-11-24
Related: ADR 0015, ADR 0016, ADR 0017

## Context

External feedback suggested positioning Always AI as a consumer "faith companion" for everyone, distributed through Always Platform. Consumer conversational AI carries the greatest risks in this field: emotional reliance, people in crisis turning to a machine instead of a person, use by minors, and the impression that a system speaks with spiritual authority. Always Foundation is a small, volunteer-led infrastructure organisation. Its strength is building shared components that many ministries and apps use.

## Decision

1. **Infrastructure first.** Always AI is faithful AI infrastructure: Always Scripture (exact text, quote and reference checking, the Nicene Creed and its propositions), the assistant specification, recommended open models, the open evaluation and scorecard, and private sync. Other apps, including large Bible apps, are invited to adopt these components.
2. **The study tool is a reference implementation.** The Jan-based tool is for adult pastors, ministry leaders and Bible teachers, for study and preparation. It is presented as a tool, with no persona.
3. **What Always never builds.** Always Foundation does not build, fund or brand:
   - a conversational AI companion, friend or persona;
   - an AI pastor, or anything presented as spiritual authority;
   - emotional, mental-health or crisis support;
   - any AI product for people under 18;
   - engagement features designed to keep people talking.
4. **Out-of-scope conversations end.** When a user raises personal, emotional or crisis matters, the study tool declines in a few kind sentences, directs them to a trusted person, their pastor, a qualified professional or emergency services, and stops. When a user indicates they are under 18, it explains it is for adults and stops.
5. **Distribution is to leaders, not the public.** Always Platform does not promote Always AI to people who respond at events or to youth audiences.
6. **A future AI-assisted Bible reader** that stays anchored to the text may be considered only under a new ADR, subject to the rules in point 3 and to the terms of any Bible platform it uses.

## Consequences

- Always AI will not reach consumer scale through its own app. Its reach comes through the ministries and apps that adopt its components.
- The study tool's instructions are amended to enforce points 4 and 8 (no persona) and the adults-only rule.
- Research papers and the website describe Always AI as infrastructure plus a study tool for leaders, and state what Always never builds.
- Non-negotiable 4 in CLAUDE.md (no AI on minors' data) is reinforced: no Always AI product targets or knowingly serves minors.
