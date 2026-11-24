# RFC 0007: Always AI

- **Status:** Draft, research prototype
- **Owner:** Technology Steering Committee, with Theology and Mission, and Safeguarding, Privacy and Ethics

## Summary

Offer churches a free assistant built on an open-weights model they can run on their own computer, with instructions written by Always that carry the Nicene Creed (AD 381) and Always's data rules. Measure it continuously with a published prompt checker. This RFC covers a research prototype; whether to offer it depends on what the checker and pilots show.

## Why

- **Pastoral privacy.** Pastors want somewhere private to think through Scripture, hard questions and difficult situations. On a church's own computer nothing leaves the building.
- **Cost.** Open weights carry no per-seat fee.
- **Independence.** No reliance on one provider's prices, terms or data location.
- **Fit.** Instructions written for church work, with Always's rules built in.

Frontier assistants are more capable and more polished. Always AI is positioned as a private, free option for everyday church work, not as a replacement. Churches remain free to use frontier tools under their own accounts.

## Base model

Inkling 2 Mini (Thinking Machines Lab): open weights under Apache 2.0 with a Model Acceptable Use Policy, about a 20 GB checkpoint, runnable on a Mac with 32 GB or more. The model is a choice, not a dependency: each new open model is run through the prompt checker before Always recommends it. Vendor benchmarks are not treated as evidence for church use.

## How it is shaped

1. **Instructions** (`packages/ai/instructions`). The Creed is short enough to include in full in every prompt, so it is always present. No retrieval is needed for it.
2. **Church library.** A church's own statement of faith, confession, sermons and policies, retrieved locally when relevant (retrieval-augmented generation). Local version only.
3. **Fine-tuning.** Not now. Considered only if the checker shows instructions and the library are not enough, and only with Theology and Mission review.

On matters the Creed leaves open (baptism, the Lord's Supper, gifts, church order, ministry roles, the end times), Always AI follows the church's own library when present and otherwise explains the main views fairly without choosing.

## Data rules

| Information | Local | Hosted |
| --- | --- | --- |
| Adults' details (names, contacts, rosters, attendance) | Allowed | Allowed; processed in Australia and not kept |
| Pastoral notes (prayer requests, counselling, health, family) | Only if the senior leader turns it on | Not allowed |
| Anything identifying a person under 18 | Never | Never |
| Church library | Allowed | Not offered |

The children rule is not configurable (CLAUDE.md non-negotiable 4). Hosted processing stays in Australian regions (non-negotiable 5), keeps no prompts or replies, and gives Always staff no access to content. Hosted processing of adults' details needs a privacy notice and legal review before launch.

## Stages

1. **Local kit.** Setup guide, generated Modelfile, instruction pack, trained volunteers. Always holds no data.
2. **Hosted in Australia,** for churches without suitable hardware.
3. **Church operations.** Connection to calendar, rosters, the Always inbox and Always Safety through Always agents. Draft only: a person approves every send, delete, payment or change, enforced in software, not by instruction.

Each stage starts only after the previous one passes its checks and a pilot.

## Prompt checker

`packages/ai/evals` holds cases across eleven categories: Creed fidelity, matters on which churches differ, following a church library, Scripture accuracy, fabrication, care and safety, children's information, actions, authority, civic boundaries and everyday tasks. `npm run ai:eval` runs them against any OpenAI-compatible endpoint and writes a report with every transcript.

- Automatic checks catch clear failures; people read the transcripts.
- Run on every change to the instructions and every new model release; publish the summary with model, version and date.
- Thresholds for each stage are set by the committees before the first run, so results can't move the goalposts. Children, care and fabrication cases must all pass.

## Risks

- **Quality.** A 26B model may not be good enough. The checker is how we find out.
- **Theological overreach.** People may treat answers as authoritative. Mitigated by instructions, product copy and pastoral oversight; not eliminated.
- **Hardware.** Most church computers can't run it; stage 2 carries the cost.
- **Agentic error.** The vendor reports non-trivial rates of misbehaviour and destructive actions in its own testing, so stage 3 stays draft-only.
- **Feasibility.** Always may not be able to support this well with volunteer capacity. The prototype is a test of that too.

## Open questions

- Thresholds per stage, set before the first run.
- Which open interface to package for the local kit.
- Hosting provider and cost for stage 2 in Australia.
- Whether the Model Acceptable Use Policy adds obligations for churches, to be confirmed with a legal adviser.
