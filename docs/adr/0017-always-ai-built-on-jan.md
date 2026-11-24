# ADR 0017: Always AI is built on Jan, with a monthly technology review

Status: Proposed
Date: 2026-11-24
Related: ADR 0015, ADR 0016

## Context

ADR 0015 planned a thin custom desktop app for Always AI. Jan (github.com/janhq/jan, Apache-2.0, Menlo Research) already provides most of what that app would build: local models through llama.cpp, GGUF models from Hugging Face, assistants with instructions, local document retrieval in projects, MCP servers run with a bundled runtime, opt-in cloud providers (including OpenRouter and Hugging Face), and analytics that are off by default (opt-in, and only in builds that include a key). Open models and runtimes change every month.

## Decision

1. **Always AI is a distribution of Jan.** Stage 1 is a setup pack for standard Jan: the Always AI assistant and the Always Scripture MCP server (repository `alwaysfoundation/always-ai`). Stage 2 is a fork of Jan (`alwaysfoundation/always-ai-desktop`) with Always branding, Always AI as the default assistant, Always Scripture bundled, recommended open models, no analytics key, and updates from Always's own releases and signing key. This replaces the custom-app plan in ADR 0015.
2. **Stay close to upstream.** Changes to Jan are kept small and re-applied when Jan releases. Improvements useful to everyone are offered upstream.
3. **Attribution and names.** Jan's Apache-2.0 notices are kept and the app says "Built on Jan by Menlo Research". Jan's name and logo are not used as Always AI's name or logo.
4. **Always Scripture is an MCP server.** Offline, dependency-free, exact Bible text from openly licensed translations, quote and reference checking, and the Nicene Creed with its propositions. It is the reusable core of the Always AI SDK.
5. **Phones are a separate decision.** Jan's iOS and Android builds currently disable local inference, projects, file attachments and MCP settings, so they cannot meet the on-device default. Options (contribute on-device inference to Jan mobile, fork an open-source on-device phone app, or a browser build with wllama) are reviewed monthly and decided after Stage 2.
6. **A monthly technology review.** On the first weekday of each month an issue opens in `always-ai` with the latest Jan and llama.cpp releases and new open models from tracked families. Candidates are evaluated; a default model changes only on evidence and with a licence that allows free redistribution. Recommendations live in `models/recommended.json` with the review date.

## Consequences

- Most of Always AI's desktop capability arrives from Jan; Always maintains a small patch set, the assistant, the Scripture server, and the evaluation.
- Upstream changes can affect privacy or behaviour, so each Jan merge is reviewed against ADR 0015 before release.
- Signing, notarisation and the updater key become Always responsibilities for Stage 2.
- Phones remain cloud-only in Jan until one of the options in point 5 is delivered; Always AI does not ship a phone build that sends data off the device by default.
