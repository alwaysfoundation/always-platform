# ADR 0015: Always AI, on-device Christian AI grounded in the Nicene Creed

Status: Proposed (points 3 and 4 amended by ADR 0017)
Date: 2026-11-24

## Context

Christians, and pastors especially, already use general AI assistants for study and preparation. Those assistants misquote Scripture, drift on doctrine, handle pastoral moments unevenly, and send private material to third parties. Each Christian app that adds AI rebuilds the same safeguards. Small open models now run on ordinary laptops, phones and in the browser, which makes free, private, shared infrastructure practical.

The research objective and full design are published at alwaysfoundation.org/#/always-ai ("Always AI: free, private Christian AI grounded in the Nicene Creed").

## Decision

Always Foundation will build Always AI as open, shared infrastructure with these properties:

1. **On the person's device by default.** The model, the Creed layer, Scripture lookup and the person's library all run locally. Always runs no inference servers and holds no one's data, questions or documents. No accounts, analytics or crash reporting.
2. **Open to any model; Gemma as the tested default.** Any open-weight GGUF model from Hugging Face or elsewhere (Gemma, Qwen, Llama, Mistral, Phi, regional models), or a model already running in a local runtime such as Ollama or LM Studio. Defaults: Gemma 4 E2B for the browser and phones, E4B for ordinary laptops, 12B for stronger machines. Recommendations per language and device follow the evaluation, and the public scorecard covers every model tested.
   - **Cloud providers by choice only.** Any OpenAI-compatible provider (OpenRouter, Hugging Face Inference Providers and similar) can be connected by a person or developer. Off by default, clearly marked while in use, with zero-retention, no-training providers recommended. Licensed Scripture text is never sent to them. Always still runs no inference servers.
2a. **A layer that routes, not a model.** Always AI does not present itself as a model. A router chooses the model for each request by device capability, language, task and the person's choice, using the public scorecard. The Creed layer, Scripture lookup and checks wrap every model. Free routing is local-first; cloud routing uses the person's own account, because free hosted tiers are not dependable and some keep or train on prompts.
3. **One core, several surfaces.** The desktop app (built on Jan, ADR 0017), the Always AI SDK and the Always Scripture MCP server share the same assistant, Creed layer and GGUF model files. Phones and a browser build are decided under ADR 0017.
4. **Built on Jan.** Superseded in detail by ADR 0017: Always AI is a distribution of Jan (Apache-2.0), starting as a setup pack for standard Jan and then a fork. Third-party apps whose terms forbid redistribution or rebranding are not used.
5. **Nicene Creed (381) as the only theological boundary.** The 381 text is carried in every request, with a note that many Western churches add the filioque. Answers are checked against a published set of propositions drawn from the Creed. Beyond the Creed, the tool presents the range of orthodox views.
6. **Scripture retrieved, never generated.** Bundled public-domain and openly licensed Bibles; the model cites references and the app inserts exact text; invalid references are removed. Translations whose terms forbid AI processing are not imported.
7. **YouVersion Platform for licensed verse text, display only.** Where its terms allow, licensed text is fetched and shown word for word with attribution. Nothing about the person is sent. Licensed text is not passed to the model without the rights holder's approval.
8. **No licensed text through Always Platform APIs.** Open APIs serve open Bibles, verse checking, Creed propositions, the evaluation set and the model scorecard. They hold no personal data and run no AI. Developers use their own YouVersion key for licensed text.
9. **Personal by design.** Collaboration happens by exporting and importing library files. A church team server is a separate, opt-in mode the church runs on its own infrastructure.
10. **Care and age boundaries.** No pastoral-care records and no minors' data; crisis and risk are handed to people; the tool drafts, a person decides. Consistent with non-negotiable 4 in CLAUDE.md.
11. **Alignment from least to most invasive.** Instructions, retrieval and citations; then a checking layer; then a LoRA adapter; then a published Nicene constitution for preference training. Each stage only when the open evaluation shows the previous one falls short.
12. **Claims follow evidence.** "Grounded in the Nicene Creed" until a trained model is tested; "trained and tested against" only with published results.

## Consequences

- Running cost to Always stays close to zero; growth adds no central cost.
- Small models on low-end hardware are slower and less capable than hosted systems; the tool must say what it does not know.
- Because Always holds no data, it cannot recover a lost library; export is the backup.
- Open code can be forked and stripped of safeguards. The Always name is a trademark and may not be used on copies that change them.
- The Creed text, translations and propositions are published openly so anyone can suggest corrections; release does not wait on a formal theological sign-off.
- Bible and Creed translation licences are checked language by language.
- None of this processes personal data on Always infrastructure, so the Australian data-residency rule (non-negotiable 5) is not engaged. Any future hosted mode would need a new ADR.
