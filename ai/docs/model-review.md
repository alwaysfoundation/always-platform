# Monthly technology review

Open models, runtimes and Jan itself change month to month. Always AI keeps up on a fixed rhythm, so new capability reaches people without anyone chasing headlines.

## Rhythm

On the first weekday of each month:

1. **An issue opens automatically** (`.github/workflows/ai-monthly-review.yml` in the Always Platform repository) with the latest Jan and llama.cpp releases, newly published open models from the families we track, and the checklist below.
2. **A scheduled review** reads the month's releases and model cards and comments on the issue with candidates worth testing.
3. **A maintainer runs the evaluation** on each candidate: the open Nicene evaluation set, Scripture fidelity, care handoffs, and the released languages.
4. **Change only on evidence.** A candidate replaces a default in `ai/models/recommended.json` only if it scores at least as well overall and better on something that matters (a language, a device tier, speed), under a licence that allows free use and redistribution.
5. **Release.** Update `ai/models/recommended.json` with the review date, merge upstream Jan if there is a new release, run the tests, and publish the scorecard.

## Checklist

- [ ] New Jan release? Read the changelog for privacy, MCP, retrieval and mobile changes.
- [ ] New llama.cpp release with performance or model support that matters?
- [ ] New open models in tracked families (Gemma, Qwen, Llama, Mistral, Phi, regional models)?
- [ ] Licence of every candidate checked (Apache-2.0, MIT or equivalent; no non-commercial terms).
- [ ] Evaluation run and scorecard updated.
- [ ] Bible and Creed sources unchanged, or licences re-checked.
- [ ] Phones: has Jan mobile, LiteRT-LM or WebGPU support changed enough to revisit Stage 3?

## Rules

- No model becomes a default without evaluation results.
- No default may send data off the device.
- Every change is recorded in the issue, so anyone can see why a model was chosen.
