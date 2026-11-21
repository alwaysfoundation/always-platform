# Always AI (research prototype)

An open-weights assistant for churches and ministries: an open model, the Always instructions with the Nicene Creed (AD 381), and a prompt checker. Status and decisions: [RFC 0007](../../docs/rfc/0007-always-ai.md).

This is a prototype. It has not been evaluated against a model yet, and it may not prove good enough to offer.

| Path | What it is |
| --- | --- |
| `creed/nicene-creed-381.md` | The Creed, Schaff's public-domain translation |
| `instructions/always-ai.md` | The system prompt every deployment uses; `{{CREED}}` is filled in from the creed file |
| `Modelfile` | Generated Ollama Modelfile wrapping the base model. Don't edit it by hand |
| `evals/cases.json` | The prompt checker's cases |
| `src/run.ts` | Runs the cases against any OpenAI-compatible endpoint and writes a report |

## Run it locally

Needs a computer that can run Inkling 2 Mini (about 20 GB; a Mac with 32 GB or more).

On a Mac, one command checks the memory, downloads the model, installs Always AI and, with `--eval`, runs the prompt checker:

```bash
packages/ai/setup-mac.sh <inkling-2-mini tag> --eval
```

Or step by step:

```bash
ollama pull <inkling-2-mini tag>        # the tag Ollama lists for Inkling 2 Mini
npm run ai:modelfile -- <that tag>      # regenerates packages/ai/Modelfile
ollama create always-ai -f packages/ai/Modelfile
ollama run always-ai
```

## Run the prompt checker

```bash
npm run ai:eval                         # all cases, against http://localhost:11434/v1, model always-ai
npm run ai:eval -- children             # one category, or a case id prefix
```

Set `ALWAYS_AI_BASE_URL`, `ALWAYS_AI_MODEL` and, for hosted endpoints, `ALWAYS_AI_API_KEY` in the environment to test another model or server. Reports land in `evals/reports/` (not committed); publish a summary with the model name, version and date.

The automatic checks catch clear failures only. Read every transcript before drawing conclusions, and never put real personal information in a case.

## Changing the instructions

Edit `instructions/always-ai.md`, run `npm run ai:modelfile`, then run the checker and compare with the last report. Changes to the theology sections need the Theology and Mission committee; changes to children, care or data rules need the Safeguarding, Privacy and Ethics committee.
